# valtio-reactive

[![CI](https://img.shields.io/github/actions/workflow/status/valtiojs/valtio-reactive/ci.yml?branch=main)](https://github.com/valtiojs/valtio-reactive/actions?query=workflow%3ACI)
[![npm](https://img.shields.io/npm/v/valtio-reactive)](https://www.npmjs.com/package/valtio-reactive)
[![size](https://img.shields.io/bundlephobia/minzip/valtio-reactive)](https://bundlephobia.com/result?p=valtio-reactive)
[![discord](https://img.shields.io/discord/627656437971288081)](https://discord.gg/MrQdmzd)

Reactive primitives for [valtio](https://github.com/pmndrs/valtio) — adds, `computed`, `effect`, and `batch` to enable fine-grained reactivity outside of React.

## Motivation

`valtio`'s reactive capabilities are primarily designed for React via `useSnapshot` and only has limited support for computed values. `valtio-reactive` was made to fill those gaps while keeping `valtio` lean and fast.

- Run side effects when specific properties change (not just any change)
- Create derived/computed state that automatically updates
- Batch multiple updates into a single reaction

See the [original discussion](https://github.com/pmndrs/valtio/discussions/949) for more context.

## Installation

```bash
npm install valtio valtio-reactive
```

## API

### `effect(fn, cleanup?): Dispose

This runs the first function (`fn`) immediately and re-runs it whenever any of the properties that are accessed in that function change. Only the properties are actually read during execution are tracked — changes to unread properties won't trigger re-runs. It returns a `dispose` function that will run the cleanup function when called.

```ts
import { proxy } from 'valtio/vanilla';
import { effect } from 'valtio-reactive';

const state = proxy({
  count: 0,
  unrelated: 'hello'
  user: {
    settings: {
      theme: 'light' //
    },
    name: 'Bob'
  },

})

const dispose = effect(
  () => {
    console.log('count is: ', state.count)
    console.log('theme is: ', state.user.settings.theme)
  },
  () => {
    // optional cleanup function
    console.log('cleaning up')
  }
)
// immediately logs:
// "count is: 0"
// "theme is: light'
state.count++
// logs:
// "count is: 1"
// "theme is: light"
state.unrelated = 'world' // nothing happens when this property is changed because it wasn't accessed
state.user.name = 'Robert' // nothing happens

state.user.settings.theme = 'dark'
// logs:
// "count is: 1"
// "theme is: dark"

dispose()
// logs "cleaning up"
```

---

### `batch(fn): T`

Batches multiple state changes so that effects only react once after all changes complete. Returns the value returned by `fn`.

```ts
import { proxy } from 'valtio/vanilla';
import { batch, effect } from 'valtio-reactive';

const state = proxy({ count: 0 });

effect(() => {
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

The returned object is itself a `valtio` proxy, so you can use it with `effect`, `useSnapshot`, or any other `valtio` utility.

<details>
<summary> Note: Specific behavior <code>computed()</code> when mutating proxied array </summary>

When a `computed()` getter depends on a proxied array, in-place mutations like `splice`/`shift`/`pop` can briefly expose `empty`/`undefined` during the same tick. If you iterate the array with `for of`/`find`/`findIndex` , etc. in `computed()`, wrap these mutations in `batch(() => ...)` to keep derived reads consistent.

```ts
import { proxy } from 'valtio/vanilla';
import { computed, batch } from 'valtio-reactive';

const selectedId = 1;
const state = proxy({ list: [
  {id: 1},
  {id: 2},
  {id: 3}
]});

const derived = computed({
  selected: () => state.list.find(item => item.id === selectedId),
});

console.log(derived.selected); // {id: 1}

// Bad: in derived.selected --> Will throw an error "TypeError: Cannot read properties of undefined (reading 'id')"
state.list.splice(0, 1); 

// Good
batch(() => state.list.splice(0, 1)); 

console.log(derived.selected); // undefined

```
</details>

---

## Usage with React

While these primitives are framework-agnostic, they integrate seamlessly with `valtio`'s React bindings:

```tsx
import { proxy, useSnapshot } from 'valtio';
import { effect, computed } from 'valtio-reactive';

const state = proxy({ count: 0 });

// Computed values work with useSnapshot
const derived = computed({
  double: () => state.count * 2,
});

// Side effects outside of React
effect(() => {
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

## License

MIT
