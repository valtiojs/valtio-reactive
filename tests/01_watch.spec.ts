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
    const state = proxy({
      count: 0,
      nested: { count: 0, anotherCount: 0, anotherObject: { count2: 0 } },
    });
    const data: number[] = [];
    const unwatch = watch(() => {
      data.push(state.nested.count);
    });
    expect(data).toEqual([0]);
    ++state.nested.count;
    expect(data).toEqual([0, 1]);
    ++state.count;
    expect(data).toEqual([0, 1]);
    ++state.nested.anotherCount;
    expect(data).toEqual([0, 1]);
    ++state.nested.anotherObject.count2;
    expect(data).toEqual([0, 1]);
    unwatch();
  });

  it('should work with arrays', async () => {
    const state = proxy<{ items: number[] }>({ items: [] });
    const data: number[] = [];
    const unwatch = watch(() => {
      data.push(state.items.length);
    });
    expect(data).toEqual([0]);
    state.items.push(1);
    expect(data).toEqual([0, 1]);
    state.items.push(2);
    expect(data).toEqual([0, 1, 2]);
    unwatch();
  });

  it('should work with objects', async () => {
    const fn = vi.fn();
    const list = proxy<{
      todos: Record<string, { title: string }>;
    }>({
      todos: {},
    });
    const unwatch = watch(() => {
      fn(list.todos);
    });
    fn.mockClear();
    list.todos['1'] = { title: 'Buy milk' };
    expect(fn).toHaveBeenCalledExactlyOnceWith({
      '1': { title: 'Buy milk' },
    });
    fn.mockClear();
    list.todos['2'] = { title: 'Buy coffee' };
    expect(fn).toHaveBeenCalledExactlyOnceWith({
      '1': { title: 'Buy milk' },
      '2': { title: 'Buy coffee' },
    });
    fn.mockClear();
    delete list.todos['1'];
    expect(fn).toHaveBeenCalledExactlyOnceWith({
      '2': { title: 'Buy coffee' },
    });
    unwatch();
  });

  it('should watch arrays for structure changes', async () => {
    const fn = vi.fn();
    const state = proxy<{ items: number[] }>({ items: [] });
    const unwatch = watch(() => {
      fn(state.items);
    });
    fn.mockClear();
    state.items.push(1);
    expect(fn).toHaveBeenCalledExactlyOnceWith([1]);
    fn.mockClear();
    state.items.push(2);
    expect(fn).toHaveBeenCalledExactlyOnceWith([1, 2]);
    fn.mockClear();
    state.items.shift();
    expect(fn).toHaveBeenLastCalledWith([2]);
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
      ++state.count;
    });
    expect(data).toEqual([0, 2]);
    batch(() => {
      ++state.count;
      ++state.count;
    });
    expect(data).toEqual([0, 2, 4]);
    unwatch();
    batch(() => {
      ++state.count;
      ++state.count;
    });
    expect(data).toEqual([0, 2, 4]);
  });
});
