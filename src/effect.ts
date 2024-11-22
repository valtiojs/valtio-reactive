import { watch } from './core.js';

export function effect(fn: () => void, cleanup?: () => void): () => void {
  const unwatch = watch(fn);
  return () => {
    unwatch();
    cleanup?.();
  };
}
