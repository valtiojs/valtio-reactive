import {
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

const callbackStack = [new Set<() => void>()];
let callbackPromise: Promise<void> | undefined;

const registerCallback = (callback: () => void) => {
  const callbacks = callbackStack[callbackStack.length - 1]!;
  callbacks.add(callback);
  if (!callbackPromise && callbackStack.length === 1) {
    callbackPromise = Promise.resolve().then(() => {
      callbackPromise = undefined;
      for (const callback of callbacks) {
        callback();
      }
      callbacks.clear();
    });
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
  type PreviousKeyAndValue = Map<string | symbol, unknown>;
  const touchedKeys = new Map<ProxyObject, PreviousKeyAndValue>();

  const isChanged = (p: ProxyObject, prev: PreviousKeyAndValue): boolean =>
    Array.from(prev).some(([key, prevValue]) => {
      const value: unknown = (p as never)[key];
      const prevOfValue = touchedKeys.get(value as ProxyObject);
      if (prevOfValue) {
        return isChanged(value as ProxyObject, prevOfValue);
      }
      return !Object.is(value, prevValue);
    });

  const callback = () => {
    if (Array.from(touchedKeys).some(([p, prev]) => isChanged(p, prev))) {
      runFn();
    }
  };

  const subscribeProxies = () => {
    const rootTouchedProxies = new Set<ProxyObject>();
    for (const p of touchedKeys.keys()) {
      // FIXME this isn't very efficient.
      if (Object.values(p).every((v) => !touchedKeys.has(v))) {
        rootTouchedProxies.add(p);
      }
    }
    for (const [p, unsub] of subscriptions) {
      if (rootTouchedProxies.has(p)) {
        rootTouchedProxies.delete(p);
      } else {
        unsub();
      }
    }
    for (const p of rootTouchedProxies) {
      const unsub = subscribe(p, () => registerCallback(callback), true);
      subscriptions.set(p, unsub);
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
      prev.set(p, (target as never)[p]);
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
