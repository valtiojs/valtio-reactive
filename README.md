# valtio-reactive

[![CI](https://img.shields.io/github/actions/workflow/status/valtiojs/valtio-reactive/ci.yml?branch=main)](https://github.com/valtiojs/valtio-reactive/actions?query=workflow%3ACI)
[![npm](https://img.shields.io/npm/v/valtio-reactive)](https://www.npmjs.com/package/valtio-reactive)
[![size](https://img.shields.io/bundlephobia/minzip/valtio-reactive)](https://bundlephobia.com/result?p=valtio-reactive)
[![discord](https://img.shields.io/discord/627656437971288081)](https://discord.gg/MrQdmzd)

Reactive primitives for [Valtio](https://github.com/pmndrs/valtio) — adds `watch`, `computed`, `effect`, and `batch` to enable fine-grained reactivity outside of React.

## Motivation

Valtio excels at making state management simple with its proxy-based approach. However, its reactive capabilities are primarily designed for React via `useSnapshot`. This library extends Valtio with framework-agnostic reactive primitives, enabling you to:

- Run side effects when specific properties change (not just any change)
- Create derived/computed state that automatically updates
- Batch multiple updates into a single reaction
- Use Valtio's reactivity in vanilla JS, Node.js, or any framework

See the [original discussion](https://github.com/pmndrs/valtio/discussions/949) for more context.

## Installation

```bash
npm install valtio valtio-reactive
```

## API

### `watch(fn): Unwatch`

Runs a function immediately and re-runs it whenever any accessed proxy state changes. Only the properties actually read during execution are tracked — changes to unread properties won't trigger re-runs.

```ts
import { proxy } from 'valtio/vanilla';
import { unstable_watch as watch } from 'valtio-reactive';

const state = proxy({ count: 0, unrelated: 'hello' });

const unwatch = watch(() => {
  console.log('count is:', state.count);
});
// Logs: "count is: 0"

state.count = 1;
// Logs: "count is: 1"

state.unrelated = 'world';
// Nothing logged — `unrelated` wasn't accessed in the watch fn

unwatch(); // Stop watching
```

#### Nested Objects and Arrays

`watch` automatically tracks nested property access:

```ts
const state = proxy({
  user: { name: 'Alice', settings: { theme: 'dark' } },
  items: [],
});

watch(() => {
  console.log('theme:', state.user.settings.theme);
});

state.user.settings.theme = 'light'; // Triggers
state.user.name = 'Bob'; // Does NOT trigger

watch(() => {
  console.log('item count:', state.items.length);
});

state.items.push('new item'); // Triggers
```

#### Structural Changes

`watch` detects structural changes to objects and arrays (additions, deletions, reordering):

```ts
const state = proxy<{ todos: Record<string, { title: string }> }>({
  todos: {},
});

watch(() => {
  console.log('todos:', state.todos);
});

state.todos['1'] = { title: 'Buy milk' }; // Triggers
state.todos['2'] = { title: 'Buy coffee' }; // Triggers
delete state.todos['1']; // Triggers
```

---

### `batch(fn): T`

Batches multiple state changes so that watchers only react once after all changes complete. Returns the value returned by `fn`.

```ts
import { proxy } from 'valtio/vanilla';
import { batch, unstable_watch as watch } from 'valtio-reactive';

const state = proxy({ count: 0 });

watch(() => {
  console.log('count:', state.count);
});
// Logs: "count: 0"

batch(() => {
  state.count++;
  state.count++;
  state.count++;
});
// Logs: "count: 3" (only once, not three times)
```

---

### `computed(obj): T`

Creates a proxy object with computed/derived properties. Each property is defined as a getter function that automatically re-runs when its dependencies change.

```ts
import { proxy } from 'valtio/vanilla';
import { computed } from 'valtio-reactive';

const state = proxy({ count: 1 });

const derived = computed({
  double: () => state.count * 2,
  quadruple: () => state.count * 4,
});

console.log(derived.double); // 2
console.log(derived.quadruple); // 4

state.count = 5;

console.log(derived.double); // 10
console.log(derived.quadruple); // 20
```

The returned object is itself a Valtio proxy, so you can use it with `watch`, `useSnapshot`, or any other Valtio utility.

---

### `effect(fn, cleanup?): Dispose`

A convenience wrapper around `watch` that supports an optional cleanup function. The cleanup runs when the effect is disposed.

```ts
import { proxy } from 'valtio/vanilla';
import { effect } from 'valtio-reactive';

const state = proxy({ userId: 1 });

const dispose = effect(
  () => {
    console.log('Fetching user:', state.userId);
    // Imagine starting a fetch here...
  },
  () => {
    console.log('Cleaning up...');
    // Cancel pending requests, etc.
  },
);

state.userId = 2; // Re-runs effect

dispose(); // Stops watching and runs cleanup
```

---

## Usage with React

While these primitives are framework-agnostic, they integrate seamlessly with Valtio's React bindings:

```tsx
import { proxy, useSnapshot } from 'valtio';
import { unstable_watch as watch, computed } from 'valtio-reactive';

const state = proxy({ count: 0 });

// Computed values work with useSnapshot
const derived = computed({
  double: () => state.count * 2,
});

// Side effects outside of React
watch(() => {
  console.log('Count changed:', state.count);
});

function Counter() {
  const snap = useSnapshot(state);
  const derivedSnap = useSnapshot(derived);

  return (
    <div>
      <p>Count: {snap.count}</p>
      <p>Double: {derivedSnap.double}</p>
      <button onClick={() => state.count++}>+1</button>
    </div>
  );
}
```

---

## TypeScript

All exports are fully typed. The `computed` function infers types from your getter functions:

```ts
const state = proxy({ count: 1, name: 'test' });

const derived = computed({
  double: () => state.count * 2, // inferred as number
  message: () => `Hello ${state.name}`, // inferred as string
});

derived.double; // number
derived.message; // string
```

---

## API Stability

| Export           | Status   |
| ---------------- | -------- |
| `batch`          | Stable   |
| `computed`       | Stable   |
| `effect`         | Stable   |
| `unstable_watch` | Unstable |

The `watch` function is exported as `unstable_watch` to indicate its API may change. The core functionality is solid, but the exact behavior around edge cases may be refined.

---

## How It Works

`valtio-reactive` hooks into Valtio's internal proxy handler to track which properties are accessed during a `watch` callback. It then subscribes only to the relevant proxies and re-runs the callback when those specific values change.

Key implementation details:

- Uses Valtio's `unstable_replaceInternalFunction` to intercept property access
- Tracks accessed properties and their versions to detect changes
- Compares values and versions to avoid unnecessary re-runs
- Supports nested proxies with proper subscription management

---

## License

MIT
