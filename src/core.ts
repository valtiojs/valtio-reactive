import {
  getVersion,
  subscribe,
  unstable_getInternalStates,
  unstable_replaceInternalFunction,
} from 'valtio/vanilla';

const { proxyStateMap } = unstable_getInternalStates();
const isProxy = (x: unknown): x is object => proxyStateMap.has(x as object);

const trappersForGet = new Set<
  (target: object, p: string | symbol, receiver: unknown) => void
>();

unstable_replaceInternalFunction(
  'createHandler',
  (createHandler) =>
    (...args) => {
      const handler = createHandler(...args);
      const origGet =
        handler.get ||
        ((target, p, receiver) => Reflect.get(target, p, receiver));
      handler.get = (target, p, receiver) => {
        for (const trapper of trappersForGet) {
          trapper(target, p, receiver);
        }
        return origGet(target, p, receiver);
      };
      return handler;
    },
);

const callbackStack: Set<() => void>[] = [];

const registerCallback = (callback: () => void) => {
  if (callbackStack.length) {
    callbackStack[callbackStack.length - 1]!.add(callback);
  } else {
    // invoke immediately
    callback();
  }
};

export function batch<T>(fn: () => T): T {
  const callbacks = new Set<() => void>();
  callbackStack.push(callbacks);
  try {
    return fn();
  } finally {
    callbackStack.pop();
    for (const callback of callbacks) {
      callback();
    }
    callbacks.clear();
  }
}

type Unwatch = () => void;

export function watch(fn: () => void): Unwatch {
  type ProxyObject = object;
  type Unsubscribe = () => void;
  const subscriptions = new Map<ProxyObject, Unsubscribe>();
  type PrevValue = [value: unknown, version: number | undefined];
  type PrevValues = Map<string | symbol, PrevValue>;
  const touchedKeys = new Map<ProxyObject, PrevValues>();

  const isChanged = (p: ProxyObject, prev: PrevValues): boolean =>
    Array.from(prev).some(([key, prevValue]) => {
      const value: unknown = (p as never)[key];
      const prevOfValue = touchedKeys.get(value as ProxyObject);
      if (prevOfValue) {
        return isChanged(value as ProxyObject, prevOfValue);
      }
      if (!Object.is(value, prevValue[0])) {
        return true;
      }
      const version = getVersion(value);
      const prevVersion = prevValue[1];
      if (typeof version === 'number' && typeof prevVersion === 'number') {
        return version !== prevVersion;
      }
      return false;
    });

  const callback = () => {
    if (Array.from(touchedKeys).some(([p, prev]) => isChanged(p, prev))) {
      runFn();
    }
  };

  const subscribeProxies = () => {
    for (const [p, unsub] of subscriptions) {
      if (!touchedKeys.has(p)) {
        unsub();
        subscriptions.delete(p);
      }
    }

    for (const p of touchedKeys.keys()) {
      if (!subscriptions.has(p)) {
        const unsub = subscribe(p, () => registerCallback(callback), true);
        subscriptions.set(p, unsub);
      }
    }
  };

  const runFn = () => {
    touchedKeys.clear();
    const trapper = (target: object, p: string | symbol, receiver: unknown) => {
      if (!isProxy(receiver)) {
        return;
      }
      let prev = touchedKeys.get(receiver);
      if (!prev) {
        prev = new Map();
        touchedKeys.set(receiver, prev);
      }
      const v = Reflect.get(target, p, receiver);
      prev.set(p, [v, getVersion(v)]);
    };
    trappersForGet.add(trapper);
    try {
      fn();
    } finally {
      trappersForGet.delete(trapper);
      subscribeProxies();
    }
  };

  runFn();

  const unwatch = () => {
    for (const unsub of subscriptions.values()) {
      unsub();
    }
    subscriptions.clear();
    touchedKeys.clear();
  };

  return unwatch;
}
