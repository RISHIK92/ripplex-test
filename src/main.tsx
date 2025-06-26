import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
// import App from "./App.tsx";
import Benchmark from "./benchmark";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Benchmark />
  </StrictMode>
);
