import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App";
import Benchmark from "./benchmark";
import RipplexStressTests from "./benchmarkComponen";
import AdvancedBenchmark from "./advancedBenchmark";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/compare" element={<Benchmark />} />
        <Route path="/specific" element={<RipplexStressTests />} />
        <Route path="/advanced" element={<AdvancedBenchmark />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>
);
