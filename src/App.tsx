import reactLogo from "./assets/react.svg";
import "./App.css";
import { useRipple } from "ripplex";
import { countStore } from "./ripples/rippleStore";
import { RipplexCounter } from "./components/counter";

function App() {
  const countValue = useRipple(countStore.count);

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank"></a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Ripplex Test</h1>
      <div className="card">
        <button onClick={() => (countStore.count.value += 1)}>
          count is {countValue}
        </button>
        <button onClick={() => countStore.count.value++}>Increment</button>
        {Array.from({ length: 1000 }, (_, i) => (
          <RipplexCounter key={i} index={i} />
        ))}
      </div>
    </>
  );
}

export default App;
