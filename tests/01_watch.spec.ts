import { describe, expect, it, vi } from 'vitest';
import { proxy } from 'valtio';
import { batch, unstable_watch as watch } from 'valtio-reactive';

describe('watch', () => {
  it('should run function initially', async () => {
    const fn = vi.fn();
    const unwatch = watch(fn);
    expect(fn).toHaveBeenCalledTimes(1);
    unwatch();
  });

  it('should rerun function on change', async () => {
    const state = proxy({ count: 0 });
    const data: number[] = [];
    const unwatch = watch(() => {
      data.push(state.count);
    });
    expect(data).toEqual([0]);
    ++state.count;
    await new Promise<void>((r) => setTimeout(r));
    expect(data).toEqual([0, 1]);
    ++state.count;
    await new Promise<void>((r) => setTimeout(r));
    expect(data).toEqual([0, 1, 2]);
    unwatch();
    ++state.count;
    await new Promise<void>((r) => setTimeout(r));
    expect(data).toEqual([0, 1, 2]);
  });

  it('should work with nested object', async () => {
    const state = proxy({ count: 0, nested: { count: 0, anotherCount: 0 } });
    const data: number[] = [];
    const unwatch = watch(() => {
      data.push(state.nested.count);
    });
    expect(data).toEqual([0]);
    ++state.nested.count;
    await new Promise<void>((r) => setTimeout(r));
    expect(data).toEqual([0, 1]);
    ++state.count;
    await new Promise<void>((r) => setTimeout(r));
    expect(data).toEqual([0, 1]);
    ++state.nested.anotherCount;
    await new Promise<void>((r) => setTimeout(r));
    expect(data).toEqual([0, 1]);
    unwatch();
  });
});

describe('watch with batch', () => {
  it('should rerun function on change', async () => {
    const state = proxy({ count: 0 });
    const data: number[] = [];
    const unwatch = watch(() => {
      data.push(state.count);
    });
    expect(data).toEqual([0]);
    batch(() => {
      ++state.count;
    });
    expect(data).toEqual([0, 1]);
    batch(() => {
      ++state.count;
    });
    expect(data).toEqual([0, 1, 2]);
    unwatch();
    batch(() => {
      ++state.count;
    });
    expect(data).toEqual([0, 1, 2]);
  });
});
