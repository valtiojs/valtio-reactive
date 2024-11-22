import { proxy, useSnapshot } from 'valtio';
import { unstable_watch as watch } from 'valtio-reactive';

const state = proxy({ count: 0 });

watch(() => {
  console.log(state.count);
});

const Counter = () => {
  const snap = useSnapshot(state);
  return (
    <div>
      count: {snap.count}
      <button onClick={() => state.count++}>+1</button>
    </div>
  );
};

const App = () => (
  <>
    <Counter />
  </>
);

export default App;
