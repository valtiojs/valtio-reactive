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
  type PreviousKeyAndValue = Map<string | symbol, unknown>;
  const touchedKeys = new Map<ProxyObject, PreviousKeyAndValue>();
  const touchedRootProxies = new Map<ProxyObject, Set<string | symbol>>();

  const isChanged = (p: ProxyObject, prev: PreviousKeyAndValue): boolean => {
    return Array.from(prev).some(([key, prevValue]) => {
      const value: unknown = (p as never)[key];
      const prevOfValue = touchedKeys.get(value as ProxyObject);
      if (prevOfValue) {
        return isChanged(value as ProxyObject, prevOfValue);
      }
      return !Object.is(value, prevValue);
    });
  }

  const callback = () => {
    if (Array.from(touchedKeys).some(([p, prev]) => isChanged(p, prev))) {
      runFn();
      return;
    }
    const keysChanged = Array.from(touchedRootProxies).some(([p, prevKeys]) => {
      const currentKeys = Object.keys(p);
      if (currentKeys.length !== prevKeys.size) {
        return true;
      }
      return !Array.from(prevKeys).every((key) => currentKeys.includes(key as string));
    });
    if (keysChanged) {
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
    touchedRootProxies.clear();
    const trapper = (target: object, p: string | symbol, receiver: unknown) => {
      if (!isProxy(receiver)) {
        return;
      }
      let prev = touchedKeys.get(receiver);
      if (!prev) {
        prev = new Map();
        touchedKeys.set(receiver, prev);
      }
      const value = (target as never)[p];
      prev.set(p, value);
      if (typeof value === 'object' && value !== null) {
        touchedRootProxies.set(value, new Set(Object.keys(value)));
      }
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
