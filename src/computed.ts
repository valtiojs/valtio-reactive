import { proxy } from 'valtio/vanilla';

import { watch } from './core.js';

export function computed<T extends object>(obj: {
  [K in keyof T]: () => T[K];
}): T {
  const computedState = proxy({}) as T;
  for (const key in obj) {
    watch(() => {
      computedState[key] = obj[key]();
    });
  }
  return computedState;
}
