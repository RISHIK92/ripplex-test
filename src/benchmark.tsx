import React, {
  useState,
  useRef,
  Profiler,
  useEffect,
  useCallback,
} from "react";
import { ripple, useRipple } from "ripplex";
import { appStore } from "./ripples/rippleStore";
import { useZustandStore } from "./ripples/zustandStore";
import type { Project } from "./ripples/rippleStore";

export function generateProjects(count = 1000): Project[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Project ${i + 1}`,
    tasks: [
      {
        id: 1,
        title: `Initial Task ${i + 1}`,
        completed: false,
        subtasks: Array.from({ length: 5 }, (_, j) => ({
          id: j + 1,
          title: `Subtask ${j + 1}`,
          done: false,
        })),
      },
    ],
  }));
}

// Test components for re-render counting
const RipplexTestComponent = React.memo(
  ({ projectId }: { projectId: number }) => {
    const renderCountRef = useRef(0);
    const projects = useRipple(appStore.projects);
    const project = projects?.find((p) => p.id === projectId);

    renderCountRef.current++;

    useEffect(() => {
      console.log(
        `RipplexTestComponent ${projectId} rendered ${renderCountRef.current} times`
      );
    });

    return <div>Project: {project?.name || "Not found"}</div>;
  }
);

const ZustandTestComponent = React.memo(
  ({ projectId }: { projectId: number }) => {
    const renderCountRef = useRef(0);
    const project = useZustandStore((s: any) =>
      s.projects?.find((p: Project) => p.id === projectId)
    );

    renderCountRef.current++;

    useEffect(() => {
      console.log(
        `ZustandTestComponent ${projectId} rendered ${renderCountRef.current} times`
      );
    });

    return <div>Project: {project?.name || "Not found"}</div>;
  }
);

export default function Benchmark() {
  const [ripplexLoaded, setRipplexLoaded] = useState(false);
  const [zustandLoaded, setZustandLoaded] = useState(false);
  const [testResults, setTestResults] = useState({});
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState("");
  const [showTestComponents, setShowTestComponents] = useState(false);
  const [memorySnapshots, setMemorySnapshots] = useState<any[]>([]);

  const ripplexProjects = useRipple(appStore.projects);
  const zustandProjects = useZustandStore((s: any) => s.projects);
  const setZustandProjectsSync = useZustandStore((s: any) => s.setProjectsSync);

  const renderCountRef = useRef<Record<string, number>>({
    ripplex: 0,
    zustand: 0,
  });

  const performanceRef = useRef<
    Record<
      string,
      Record<
        string,
        {
          times: number[];
          average: number;
          min: number;
          max: number;
          stdDev: number;
        }
      >
    >
  >({});

  const subscriptionRef = useRef<{
    ripplexSubscriptions: (() => void)[];
    zustandSubscriptions: (() => void)[];
  }>({
    ripplexSubscriptions: [],
    zustandSubscriptions: [],
  });

  const onRender = (id: string, phase: string, actualDuration: number) => {
    renderCountRef.current[id]++;
    console.log(`[Profiler: ${id}]`, { phase, actualDuration });
  };

  const recordPerformance = (
    testName: string,
    library: string,
    duration: number
  ) => {
    if (!performanceRef.current[testName]) {
      performanceRef.current[testName] = {};
    }
    if (!performanceRef.current[testName][library]) {
      performanceRef.current[testName][library] = {
        times: [],
        average: 0,
        min: Infinity,
        max: -Infinity,
        stdDev: 0,
      };
    }

    const stats = performanceRef.current[testName][library];
    stats.times.push(duration);
    stats.min = Math.min(stats.min, duration);
    stats.max = Math.max(stats.max, duration);

    stats.average =
      stats.times.reduce((sum, time) => sum + time, 0) / stats.times.length;

    const variance =
      stats.times.reduce(
        (sum, time) => sum + Math.pow(time - stats.average, 2),
        0
      ) / stats.times.length;
    stats.stdDev = Math.sqrt(variance);
  };

  const formatNumber = (num: number) => {
    return num < 0.01 ? "~0" : num.toFixed(2);
  };

  const takeMemorySnapshot = (label: string) => {
    if ((performance as any).memory) {
      const snapshot = {
        label,
        timestamp: Date.now(),
        usedJSHeapSize: (performance as any).memory.usedJSHeapSize,
        totalJSHeapSize: (performance as any).memory.totalJSHeapSize,
        jsHeapSizeLimit: (performance as any).memory.jsHeapSizeLimit,
      };
      setMemorySnapshots((prev) => [...prev, snapshot]);
      return snapshot;
    }
    return null;
  };

  const runTestMultipleTimes = async (
    testName: string,
    testFunction: () => void,
    iterations: number = 5
  ) => {
    console.log(`\nRunning ${testName} (${iterations} iterations)...`);
    setCurrentTest(`${testName} (0/${iterations})`);

    for (let i = 0; i < iterations; i++) {
      setCurrentTest(`${testName} (${i + 1}/${iterations})`);

      if (testName !== "Initial Load") {
        const resetData = generateProjects();
        appStore.projects.value = structuredClone(resetData);
        setZustandProjectsSync(structuredClone(resetData));
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
      testFunction();
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    setCurrentTest("");
  };

  // Original tests (1-10) - keeping existing functionality
  const test1 = () => {
    const data = generateProjects();

    const ripplexStart = performance.now();
    appStore.projects.value = structuredClone(data);
    const ripplexEnd = performance.now();

    const zustandStart = performance.now();
    setZustandProjectsSync(structuredClone(data));
    const zustandEnd = performance.now();

    recordPerformance("load", "ripplex", ripplexEnd - ripplexStart);
    recordPerformance("load", "zustand", zustandEnd - zustandStart);

    console.log(`  Ripplex: ${formatNumber(ripplexEnd - ripplexStart)}ms`);
    console.log(`  Zustand: ${formatNumber(zustandEnd - zustandStart)}ms`);

    setRipplexLoaded(true);
    setZustandLoaded(true);
  };

  const test2 = () => {
    if (!ripplexProjects?.length || !zustandProjects?.length) {
      console.log("⚠️ No projects available for update test");
      return;
    }

    const ripplexStart = performance.now();
    appStore.projects.value[0].name = "🔁 Updated Ripplex Project";
    const ripplexEnd = performance.now();

    const zustandStart = performance.now();
    setZustandProjectsSync([
      { ...zustandProjects[0], name: "🔁 Updated Zustand Project" },
      ...zustandProjects.slice(1),
    ]);
    const zustandEnd = performance.now();

    recordPerformance("update", "ripplex", ripplexEnd - ripplexStart);
    recordPerformance("update", "zustand", zustandEnd - zustandStart);

    console.log(`  Ripplex: ${formatNumber(ripplexEnd - ripplexStart)}ms`);
    console.log(`  Zustand: ${formatNumber(zustandEnd - zustandStart)}ms`);
  };

  const test3 = () => {
    if (!ripplexProjects?.length || !zustandProjects?.length) {
      console.log("⚠️ No projects available for batch update test");
      return;
    }

    const ripplexStart = performance.now();
    for (let i = 0; i < 100; i++) {
      const id = i % 1000;
      if (appStore.projects.value[id]) {
        appStore.projects.value[id].name = `Ripplex Batch Update ${i}`;
      }
    }
    const ripplexEnd = performance.now();

    const zustandStart = performance.now();
    const updatedProjects = [...zustandProjects];
    for (let i = 0; i < 100; i++) {
      const id = i % 1000;
      if (updatedProjects[id]) {
        updatedProjects[id] = {
          ...updatedProjects[id],
          name: `Zustand Batch Update ${i}`,
        };
      }
    }
    setZustandProjectsSync(updatedProjects);
    const zustandEnd = performance.now();

    recordPerformance("batchUpdate", "ripplex", ripplexEnd - ripplexStart);
    recordPerformance("batchUpdate", "zustand", zustandEnd - zustandStart);

    console.log(`  Ripplex: ${formatNumber(ripplexEnd - ripplexStart)}ms`);
    console.log(`  Zustand: ${formatNumber(zustandEnd - zustandStart)}ms`);
  };

  const test4 = () => {
    const memoryStart = (performance as any).memory?.usedJSHeapSize || 0;
    test1();
    const memoryEnd = (performance as any).memory?.usedJSHeapSize || 0;
    const memoryDiff = (memoryEnd - memoryStart) / 1024 / 1024;

    console.log("  Memory usage:", formatNumber(memoryDiff), "MB");
    recordPerformance("memory", "total", memoryDiff);
  };

  const test5 = () => {
    const newProjects = generateProjects();

    const ripplexStart = performance.now();
    appStore.projects.value = structuredClone(newProjects);
    const ripplexEnd = performance.now();

    const zustandStart = performance.now();
    setZustandProjectsSync(structuredClone(newProjects));
    const zustandEnd = performance.now();

    recordPerformance("replace", "ripplex", ripplexEnd - ripplexStart);
    recordPerformance("replace", "zustand", zustandEnd - zustandStart);

    console.log(`  Ripplex: ${formatNumber(ripplexEnd - ripplexStart)}ms`);
    console.log(`  Zustand: ${formatNumber(zustandEnd - zustandStart)}ms`);
  };

  const test6 = () => {
    if (!ripplexProjects?.length || !zustandProjects?.length) {
      console.log("⚠️ No projects available for deep mutation test");
      return;
    }

    const ripplexStart = performance.now();
    appStore.projects.value[0].tasks[0].subtasks[0].done = true;
    const ripplexEnd = performance.now();

    const zustandStart = performance.now();
    const updatedZustand = [...zustandProjects];
    updatedZustand[0] = {
      ...updatedZustand[0],
      tasks: [
        {
          ...updatedZustand[0].tasks[0],
          subtasks: updatedZustand[0].tasks[0].subtasks.map(
            (subtask: any, index: number) =>
              index === 0 ? { ...subtask, done: true } : subtask
          ),
        },
      ],
    };
    setZustandProjectsSync(updatedZustand);
    const zustandEnd = performance.now();

    recordPerformance("deepMutation", "ripplex", ripplexEnd - ripplexStart);
    recordPerformance("deepMutation", "zustand", zustandEnd - zustandStart);

    console.log(`  Ripplex: ${formatNumber(ripplexEnd - ripplexStart)}ms`);
    console.log(`  Zustand: ${formatNumber(zustandEnd - zustandStart)}ms`);
  };

  const test7 = () => {
    if (!ripplexProjects?.length || !zustandProjects?.length) {
      console.log("⚠️ No projects available for massive batch test");
      return;
    }

    console.log("Test 7: Massive Batch Updates (1000 ops)");

    const ripplexStart = performance.now();
    for (let i = 0; i < 1000; i++) {
      const id = i % 1000;
      if (appStore.projects.value[id]) {
        appStore.projects.value[id].name = `Heavy Ripplex ${i}`;
        appStore.projects.value[id].tasks[0].completed = i % 2 === 0;
      }
    }
    const ripplexEnd = performance.now();

    const zustandStart = performance.now();
    const heavyUpdated = [...zustandProjects];
    for (let i = 0; i < 1000; i++) {
      const id = i % 1000;
      if (heavyUpdated[id]) {
        heavyUpdated[id] = {
          ...heavyUpdated[id],
          name: `Heavy Zustand ${i}`,
          tasks: [
            {
              ...heavyUpdated[id].tasks[0],
              completed: i % 2 === 0,
            },
          ],
        };
      }
    }
    setZustandProjectsSync(heavyUpdated);
    const zustandEnd = performance.now();

    recordPerformance("massiveBatch", "ripplex", ripplexEnd - ripplexStart);
    recordPerformance("massiveBatch", "zustand", zustandEnd - zustandStart);

    console.log(`  Ripplex: ${formatNumber(ripplexEnd - ripplexStart)}ms`);
    console.log(`  Zustand: ${formatNumber(zustandEnd - zustandStart)}ms`);
  };

  const test8 = () => {
    if (!ripplexProjects?.length || !zustandProjects?.length) {
      console.log("⚠️ No projects available for deep nested test");
      return;
    }

    console.log("Test 8: Deep Nested Updates (100 items)");

    const ripplexStart = performance.now();
    for (let i = 0; i < 100; i++) {
      for (let j = 0; j < 5; j++) {
        if (appStore.projects.value[i]?.tasks[0]?.subtasks[j]) {
          appStore.projects.value[i].tasks[0].subtasks[j].done =
            !appStore.projects.value[i].tasks[0].subtasks[j].done;
          appStore.projects.value[i].tasks[0].subtasks[
            j
          ].title = `Updated ${i}-${j}`;
        }
      }
    }
    const ripplexEnd = performance.now();

    const zustandStart = performance.now();
    const deepUpdated = zustandProjects.map(
      (project: { tasks: { subtasks: any[] }[] }, i: number) => {
        if (i >= 100) return project;
        return {
          ...project,
          tasks: [
            {
              ...project.tasks[0],
              subtasks: project.tasks[0].subtasks.map(
                (subtask: { done: any }, j: any) => ({
                  ...subtask,
                  done: !subtask.done,
                  title: `Updated ${i}-${j}`,
                })
              ),
            },
          ],
        };
      }
    );
    setZustandProjectsSync(deepUpdated);
    const zustandEnd = performance.now();

    recordPerformance("deepNested", "ripplex", ripplexEnd - ripplexStart);
    recordPerformance("deepNested", "zustand", zustandEnd - zustandStart);

    console.log(`  Ripplex: ${formatNumber(ripplexEnd - ripplexStart)}ms`);
    console.log(`  Zustand: ${formatNumber(zustandEnd - zustandStart)}ms`);
  };

  const test9 = () => {
    if (!ripplexProjects?.length || !zustandProjects?.length) {
      console.log("⚠️ No projects available for rapid updates test");
      return;
    }

    console.log("Test 9: Rapid Successive Updates");

    const ripplexStart = performance.now();
    for (let round = 0; round < 10; round++) {
      for (let i = 0; i < 50; i++) {
        if (appStore.projects.value[i]) {
          appStore.projects.value[i].name = `Rapid ${round}-${i}`;
        }
      }
    }
    const ripplexEnd = performance.now();

    const zustandStart = performance.now();
    let rapidUpdated = [...zustandProjects];
    for (let round = 0; round < 10; round++) {
      rapidUpdated = rapidUpdated.map((project, i) => {
        if (i >= 50) return project;
        return { ...project, name: `Rapid ${round}-${i}` };
      });
      setZustandProjectsSync([...rapidUpdated]);
    }
    const zustandEnd = performance.now();

    recordPerformance("rapidSuccessive", "ripplex", ripplexEnd - ripplexStart);
    recordPerformance("rapidSuccessive", "zustand", zustandEnd - zustandStart);

    console.log(`  Ripplex: ${formatNumber(ripplexEnd - ripplexStart)}ms`);
    console.log(`  Zustand: ${formatNumber(zustandEnd - zustandStart)}ms`);
  };

  const test10 = () => {
    console.log("Test 10: Large Dataset Replacement (10k items)");

    const largeData = generateProjects(10000);

    const ripplexStart = performance.now();
    appStore.projects.value = structuredClone(largeData);
    const ripplexEnd = performance.now();

    const zustandStart = performance.now();
    setZustandProjectsSync(structuredClone(largeData));
    const zustandEnd = performance.now();

    recordPerformance("largeDataset", "ripplex", ripplexEnd - ripplexStart);
    recordPerformance("largeDataset", "zustand", zustandEnd - zustandStart);

    console.log(`  Ripplex: ${formatNumber(ripplexEnd - ripplexStart)}ms`);
    console.log(`  Zustand: ${formatNumber(zustandEnd - zustandStart)}ms`);
  };

  // NEW TESTS: Re-render Efficiency (Tests 11-13)
  const test11 = () => {
    if (!ripplexProjects?.length || !zustandProjects?.length) {
      console.log("⚠️ No projects available for re-render test");
      return;
    }

    console.log("🔁 Test 11: Re-render Count - Top Level Update");

    renderCountRef.current = { ripplex: 0, zustand: 0 };
    setShowTestComponents(true);

    setTimeout(() => {
      const ripplexStart = performance.now();
      appStore.projects.value[0].name = "🔁 Ripplex Top Level Update";
      const ripplexEnd = performance.now();

      const zustandStart = performance.now();
      setZustandProjectsSync([
        { ...zustandProjects[0], name: "🔁 Zustand Top Level Update" },
        ...zustandProjects.slice(1),
      ]);
      const zustandEnd = performance.now();

      recordPerformance(
        "rerenderTopLevel",
        "ripplex",
        ripplexEnd - ripplexStart
      );
      recordPerformance(
        "rerenderTopLevel",
        "zustand",
        zustandEnd - zustandStart
      );

      console.log(`  Ripplex: ${formatNumber(ripplexEnd - ripplexStart)}ms`);
      console.log(`  Zustand: ${formatNumber(zustandEnd - zustandStart)}ms`);
    }, 100);
  };

  const test12 = () => {
    if (!ripplexProjects?.length || !zustandProjects?.length) {
      console.log("⚠️ No projects available for nested re-render test");
      return;
    }

    console.log("🔁 Test 12: Re-render Count - Nested Update");

    renderCountRef.current = { ripplex: 0, zustand: 0 };

    const ripplexStart = performance.now();
    appStore.projects.value[0].tasks[0].subtasks[0].done =
      !appStore.projects.value[0].tasks[0].subtasks[0].done;
    const ripplexEnd = performance.now();

    const zustandStart = performance.now();
    const updatedZustand = [...zustandProjects];
    updatedZustand[0] = {
      ...updatedZustand[0],
      tasks: [
        {
          ...updatedZustand[0].tasks[0],
          subtasks: updatedZustand[0].tasks[0].subtasks.map(
            (subtask: any, index: number) =>
              index === 0 ? { ...subtask, done: !subtask.done } : subtask
          ),
        },
      ],
    };
    setZustandProjectsSync(updatedZustand);
    const zustandEnd = performance.now();

    recordPerformance("rerenderNested", "ripplex", ripplexEnd - ripplexStart);
    recordPerformance("rerenderNested", "zustand", zustandEnd - zustandStart);

    console.log(`  Ripplex: ${formatNumber(ripplexEnd - ripplexStart)}ms`);
    console.log(`  Zustand: ${formatNumber(zustandEnd - zustandStart)}ms`);
  };

  const test13 = () => {
    if (!ripplexProjects?.length || !zustandProjects?.length) {
      console.log("⚠️ No projects available for no-op test");
      return;
    }

    console.log("🔁 Test 13: Re-render Count - No-op Update");

    renderCountRef.current = { ripplex: 0, zustand: 0 };

    const currentName = appStore.projects.value[0].name;

    const ripplexStart = performance.now();
    appStore.projects.value[0].name = currentName; // Same value
    const ripplexEnd = performance.now();

    const zustandStart = performance.now();
    setZustandProjectsSync([
      { ...zustandProjects[0], name: currentName }, // Same value
      ...zustandProjects.slice(1),
    ]);
    const zustandEnd = performance.now();

    recordPerformance("rerenderNoOp", "ripplex", ripplexEnd - ripplexStart);
    recordPerformance("rerenderNoOp", "zustand", zustandEnd - zustandStart);

    console.log(`  Ripplex: ${formatNumber(ripplexEnd - ripplexStart)}ms`);
    console.log(`  Zustand: ${formatNumber(zustandEnd - zustandStart)}ms`);
  };

  // NEW TESTS: Memory Profiling (Tests 14-15)
  const test14 = () => {
    console.log("📈 Test 14: Retained Heap Size After Operations");

    takeMemorySnapshot("Before operations");

    // Perform heavy operations
    const largeData = generateProjects(5000);
    appStore.projects.value = structuredClone(largeData);
    setZustandProjectsSync(structuredClone(largeData));

    takeMemorySnapshot("After large data load");

    // Perform many updates
    for (let i = 0; i < 500; i++) {
      const id = i % 1000;
      if (appStore.projects.value[id]) {
        appStore.projects.value[id].name = `Memory test ${i}`;
      }
    }

    takeMemorySnapshot("After many updates");

    // Clear data
    appStore.projects.value = [];
    setZustandProjectsSync([]);

    takeMemorySnapshot("After clearing data");

    console.log("Memory snapshots taken - check memory profiling section");
  };

  const test15 = () => {
    console.log("🧼 Test 15: Garbage Collection Impact");

    const initialMemory = takeMemorySnapshot("GC Test - Initial");

    // Create and destroy many objects
    for (let round = 0; round < 10; round++) {
      const tempData = generateProjects(1000);
      appStore.projects.value = structuredClone(tempData);
      setZustandProjectsSync(structuredClone(tempData));

      // Clear immediately
      appStore.projects.value = [];
      setZustandProjectsSync([]);
    }

    // Force garbage collection if available
    if ((window as any).gc) {
      (window as any).gc();
    }

    const finalMemory = takeMemorySnapshot("GC Test - Final");

    if (initialMemory && finalMemory) {
      const memoryDiff =
        (finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize) /
        1024 /
        1024;
      recordPerformance("gcImpact", "memoryDiff", memoryDiff);
      console.log(`  Memory difference: ${formatNumber(memoryDiff)}MB`);
    }
  };

  // NEW TESTS: Async Update Handling (Tests 16-17)
  const test16 = async () => {
    if (!ripplexProjects?.length || !zustandProjects?.length) {
      const testData = generateProjects(1000);
      appStore.projects.value = structuredClone(testData);
      setZustandProjectsSync(structuredClone(testData));
    }

    console.log(" Test 16: Concurrent/Async Updates");

    const asyncUpdates = [];

    const ripplexStart = performance.now();
    for (let i = 0; i < 50; i++) {
      const id = i % (ripplexProjects?.length || 100);
      if (!ripplexProjects || !ripplexProjects[id]) continue;

      asyncUpdates.push(
        new Promise((resolve) => {
          setTimeout(() => {
            appStore.projects.value[id].name = `Async Ripplex ${i}`;
            resolve(true);
          }, Math.random() * 10);
        })
      );
    }

    await Promise.all(asyncUpdates);
    const ripplexEnd = performance.now();

    // Clear async updates array
    asyncUpdates.length = 0;

    // Zustand async updates
    const zustandStart = performance.now();
    for (let i = 0; i < 50; i++) {
      const id = i % (zustandProjects?.length || 100);
      if (!zustandProjects || !zustandProjects[id]) continue;

      asyncUpdates.push(
        new Promise((resolve) => {
          setTimeout(() => {
            const updated = [...zustandProjects];
            updated[id] = {
              ...updated[id],
              name: `Async Zustand ${i}`,
            };
            setZustandProjectsSync(updated);
            resolve(true);
          }, Math.random() * 10);
        })
      );
    }

    await Promise.all(asyncUpdates);
    const zustandEnd = performance.now();

    recordPerformance("asyncUpdates", "ripplex", ripplexEnd - ripplexStart);
    recordPerformance("asyncUpdates", "zustand", zustandEnd - zustandStart);

    console.log(`  Ripplex: ${formatNumber(ripplexEnd - ripplexStart)}ms`);
    console.log(`  Zustand: ${formatNumber(zustandEnd - zustandStart)}ms`);
  };

  const test17 = async () => {
    if (!ripplexProjects?.length || !zustandProjects?.length) {
      const testData = generateProjects(1);
      appStore.projects.value = structuredClone(testData);
      setZustandProjectsSync(structuredClone(testData));
    }

    console.log("🚦 Test 17: Race Condition Handling");

    let ripplexFinalValue = "";
    let zustandFinalValue = "";

    const ripplexStart = performance.now();

    // Create overlapping async updates
    const ripplexPromise1 = new Promise((resolve) => {
      setTimeout(() => {
        appStore.projects.value[0].name = "Ripplex Race A";
        resolve("A");
      }, 20);
    });

    const ripplexPromise2 = new Promise((resolve) => {
      setTimeout(() => {
        appStore.projects.value[0].name = "Ripplex Race B";
        resolve("B");
      }, 10); // Finishes first but should be overridden
    });

    await Promise.all([ripplexPromise1, ripplexPromise2]);
    ripplexFinalValue = appStore.projects.value[0].name;
    const ripplexEnd = performance.now();

    const zustandStart = performance.now();

    const zustandPromise1 = new Promise((resolve) => {
      setTimeout(() => {
        setZustandProjectsSync([
          { ...zustandProjects[0], name: "Zustand Race A" },
          ...zustandProjects.slice(1),
        ]);
        resolve("A");
      }, 10);
    });

    const zustandPromise2 = new Promise((resolve) => {
      setTimeout(() => {
        setZustandProjectsSync([
          { ...zustandProjects[0], name: "Zustand Race B" },
          ...zustandProjects.slice(1),
        ]);
        resolve("B");
      }, 10);
    });

    await Promise.all([zustandPromise1, zustandPromise2]);
    zustandFinalValue = zustandProjects[0].name;
    const zustandEnd = performance.now();

    recordPerformance("raceConditions", "ripplex", ripplexEnd - ripplexStart);
    recordPerformance("raceConditions", "zustand", zustandEnd - zustandStart);

    console.log(`  Ripplex final value: ${ripplexFinalValue}`);
    console.log(`  Zustand final value: ${zustandFinalValue}`);
    console.log(`  Ripplex: ${formatNumber(ripplexEnd - ripplexStart)}ms`);
    console.log(`  Zustand: ${formatNumber(zustandEnd - zustandStart)}ms`);
  };

  // NEW TESTS: Subscription System (Tests 18-19)
  const test18 = () => {
    if (!ripplexProjects?.length || !zustandProjects?.length) {
      console.log("⚠️ No projects available for subscription test");
      return;
    }

    console.log(" Test 18: Subscription Latency");

    let ripplexSubscriptionTime = 0;
    let zustandSubscriptionTime = 0;

    // Ripplex subscription test
    const ripplexStart = performance.now();
    const ripplexUnsub = appStore.projects.subscribe(() => {
      ripplexSubscriptionTime = performance.now() - ripplexStart;
    });

    appStore.projects.value[0].name = "Subscription Test Ripplex";

    setTimeout(() => {
      ripplexUnsub();
      recordPerformance(
        "subscriptionLatency",
        "ripplex",
        ripplexSubscriptionTime
      );
      console.log(
        `  Ripplex subscription latency: ${formatNumber(
          ripplexSubscriptionTime
        )}ms`
      );
    }, 10);

    // Zustand subscription test
    const zustandStart = performance.now();
    const zustandUnsub = useZustandStore.subscribe(() => {
      zustandSubscriptionTime = performance.now() - zustandStart;
    });

    setZustandProjectsSync([
      { ...zustandProjects[0], name: "Subscription Test Zustand" },
      ...zustandProjects.slice(1),
    ]);

    setTimeout(() => {
      zustandUnsub();
      recordPerformance(
        "subscriptionLatency",
        "zustand",
        zustandSubscriptionTime
      );
      console.log(
        `  Zustand subscription latency: ${formatNumber(
          zustandSubscriptionTime
        )}ms`
      );
    }, 10);
  };

  const test19 = () => {
    console.log("🚫 Test 19: Unsubscription Leak Test");

    const subscriptionCount = 100;

    // Test Ripplex subscriptions
    const ripplexStart = performance.now();
    const ripplexUnsubs = [];

    for (let i = 0; i < subscriptionCount; i++) {
      const unsub = appStore.projects.subscribe(() => {
        // Empty subscriber
      });
      ripplexUnsubs.push(unsub);
    }

    // Unsubscribe all
    ripplexUnsubs.forEach((unsub) => unsub());
    const ripplexEnd = performance.now();

    // Test Zustand subscriptions
    const zustandStart = performance.now();
    const zustandUnsubs = [];

    for (let i = 0; i < subscriptionCount; i++) {
      const unsub = useZustandStore.subscribe(() => {
        // Empty subscriber
      });
      zustandUnsubs.push(unsub);
    }

    // Unsubscribe all
    zustandUnsubs.forEach((unsub) => unsub());
    const zustandEnd = performance.now();

    recordPerformance(
      "unsubscriptionLeak",
      "ripplex",
      ripplexEnd - ripplexStart
    );
    recordPerformance(
      "unsubscriptionLeak",
      "zustand",
      zustandEnd - zustandStart
    );

    console.log(
      `  Ripplex ${subscriptionCount} subscriptions: ${formatNumber(
        ripplexEnd - ripplexStart
      )}ms`
    );
    console.log(
      `  Zustand ${subscriptionCount} subscriptions: ${formatNumber(
        zustandEnd - zustandStart
      )}ms`
    );
  };

  // NEW TEST: Selector Efficiency (Test 20)
  const test20 = () => {
    console.log("Test 20: Selector Efficiency");

    // Ripplex selector test
    const ripplexStart = performance.now();
    const ripplexSelected =
      ripplexProjects
        ?.filter((p: any) => p.id <= 10)
        ?.map((p: any) => p.name) || [];
    const ripplexEnd = performance.now();

    // Zustand selector test
    const zustandStart = performance.now();
    const zustandSelected =
      zustandProjects
        ?.filter((p: Project) => p.id <= 10)
        ?.map((p: Project) => p.name) || [];
    const zustandEnd = performance.now();

    recordPerformance(
      "selectorEfficiency",
      "ripplex",
      ripplexEnd - ripplexStart
    );
    recordPerformance(
      "selectorEfficiency",
      "zustand",
      zustandEnd - zustandStart
    );

    console.log(`  Ripplex: ${formatNumber(ripplexEnd - ripplexStart)}ms`);
    console.log(`  Zustand: ${formatNumber(zustandEnd - zustandStart)}ms`);
    console.log(`  Ripplex selected items: ${ripplexSelected.length}`);
    console.log(`  Zustand selected items: ${zustandSelected.length}`);
  };

  const runAllTests = async () => {
    setIsRunning(true);
    performanceRef.current = {}; // Reset results
    renderCountRef.current = { ripplex: 0, zustand: 0 };
    setMemorySnapshots([]);

    console.log(" Running comprehensive benchmark with multiple iterations...");
    console.log("Each test will run multiple times for statistical accuracy\n");

    const testConfigs = [
      // Original Performance Tests
      { name: "Initial Load", fn: test1, iterations: 5 },
      { name: "Single Update", fn: test2, iterations: 10 },
      { name: "Batch Updates", fn: test3, iterations: 10 },
      { name: "Memory Usage", fn: test4, iterations: 3 },
      { name: "List Replace", fn: test5, iterations: 5 },
      { name: "Deep Mutation", fn: test6, iterations: 10 },
      { name: "Massive Batch", fn: test7, iterations: 5 },
      { name: "Deep Nested", fn: test8, iterations: 5 },
      { name: "Rapid Updates", fn: test9, iterations: 5 },
      { name: "Large Dataset", fn: test10, iterations: 3 },

      // Re-render Efficiency Tests
      { name: "Re-render Top Level", fn: test11, iterations: 5 },
      { name: "Re-render Nested", fn: test12, iterations: 5 },
      { name: "Re-render No-op", fn: test13, iterations: 5 },

      // Memory Profiling Tests
      { name: "Retained Heap", fn: test14, iterations: 3 },
      { name: "GC Impact", fn: test15, iterations: 3 },

      // Async Update Tests
      { name: "Async Updates", fn: test16, iterations: 3 },
      { name: "Race Conditions", fn: test17, iterations: 3 },

      // Subscription Tests
      { name: "Subscription Latency", fn: test18, iterations: 5 },
      { name: "Unsubscription Leak", fn: test19, iterations: 3 },

      // Selector Efficiency
      { name: "Selector Efficiency", fn: test20, iterations: 10 },
    ];

    for (const config of testConfigs) {
      if (config.fn === test16 || config.fn === test17) {
        // Handle async tests
        console.log(
          `\nRunning ${config.name} (${config.iterations} iterations)...`
        );
        for (let i = 0; i < config.iterations; i++) {
          setCurrentTest(`${config.name} (${i + 1}/${config.iterations})`);
          await config.fn();
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        setCurrentTest("");
      } else {
        await runTestMultipleTimes(config.name, config.fn, config.iterations);
      }
    }

    console.log("\n🎉 Comprehensive Benchmark Complete!");
    console.log("\n📈 Statistical Performance Summary:");

    // Display formatted results
    Object.entries(performanceRef.current).forEach(([testName, libraries]) => {
      console.log(`\n${testName}:`);
      Object.entries(libraries).forEach(([lib, stats]) => {
        const { average, min, max, stdDev } = stats as any;
        console.log(
          `  ${lib}: ${formatNumber(average)}ms (±${formatNumber(
            stdDev
          )}) [${formatNumber(min)}-${formatNumber(max)}ms]`
        );
      });
    });

    setTestResults({ ...performanceRef.current });
    setIsRunning(false);
  };

  return (
    <div style={{ padding: 20, fontFamily: "monospace" }}>
      <h1>Comprehensive State Management Benchmark</h1>
      <p style={{ fontSize: "14px", color: "#666", marginBottom: "20px" }}>
        Enhanced benchmark testing performance, re-renders, memory usage, async
        handling, and subscriptions
      </p>

      <div
        style={{ marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 8 }}
      >
        <div style={{ marginBottom: 8, width: "100%" }}>
          <strong>Performance Tests:</strong>
        </div>
        <button onClick={test1} style={{ padding: "8px 12px" }}>
          Test 1: Equal Load
        </button>
        <button onClick={test2} style={{ padding: "8px 12px" }}>
          Test 2: Update Name
        </button>
        <button onClick={test3} style={{ padding: "8px 12px" }}>
          Test 3: Batch Updates
        </button>
        <button onClick={test4} style={{ padding: "8px 12px" }}>
          Test 4: Memory Usage
        </button>
        <button onClick={test5} style={{ padding: "8px 12px" }}>
          Test 5: Replace List
        </button>
        <button onClick={test6} style={{ padding: "8px 12px" }}>
          Test 6: Deep Mutation
        </button>
        <button
          onClick={test7}
          style={{
            padding: "8px 12px",
            backgroundColor: "#ff6b6b",
            color: "white",
          }}
        >
          Test 7: Massive Batch
        </button>
        <button
          onClick={test8}
          style={{
            padding: "8px 12px",
            backgroundColor: "#ff6b6b",
            color: "white",
          }}
        >
          Test 8: Deep Nested
        </button>
        <button
          onClick={test9}
          style={{
            padding: "8px 12px",
            backgroundColor: "#ff6b6b",
            color: "white",
          }}
        >
          Test 9: Rapid Updates
        </button>
        <button
          onClick={test10}
          style={{
            padding: "8px 12px",
            backgroundColor: "#ff6b6b",
            color: "white",
          }}
        >
          Test 10: Large Dataset
        </button>

        <div style={{ marginBottom: 8, width: "100%", marginTop: 16 }}>
          <strong> Async Update Tests:</strong>
        </div>
        <button
          onClick={test17}
          style={{
            padding: "8px 12px",
            backgroundColor: "#f39c12",
            color: "white",
          }}
        >
          Test 11: Async Updates
        </button>
        <button
          onClick={test16}
          style={{
            padding: "8px 12px",
            backgroundColor: "#f39c12",
            color: "white",
          }}
        >
          Test 12: Race Conditions
        </button>

        {/* Control Buttons */}
        <div style={{ marginBottom: 8, width: "100%", marginTop: 16 }}>
          <strong> Control Panel:</strong>
        </div>
        <button
          onClick={() => setShowTestComponents(!showTestComponents)}
          style={{
            padding: "8px 12px",
            backgroundColor: showTestComponents ? "#e74c3c" : "#95a5a6",
            color: "white",
          }}
        >
          {showTestComponents ? "Hide" : "Show"} Test Components
        </button>
        <button
          onClick={runAllTests}
          disabled={isRunning}
          style={{
            padding: "8px 16px",
            backgroundColor: isRunning ? "#ccc" : "#2c3e50",
            color: "white",
            fontWeight: "bold",
            cursor: isRunning ? "not-allowed" : "pointer",
          }}
        >
          {isRunning
            ? ` ${currentTest || "Running..."}`
            : " Run All Tests (Comprehensive)"}
        </button>
      </div>

      {showTestComponents && (
        <div
          style={{
            marginBottom: 20,
            padding: 10,
            backgroundColor: "#f8f9fa",
            border: "1px solid #dee2e6",
          }}
        >
          <h3>🔁 Re-render Test Components</h3>
          <div style={{ display: "flex", gap: 20 }}>
            <div>
              <h4>Ripplex Components:</h4>
              <RipplexTestComponent projectId={1} />
              <RipplexTestComponent projectId={2} />
              <RipplexTestComponent projectId={3} />
            </div>
            <div>
              <h4>Zustand Components:</h4>
              <ZustandTestComponent projectId={1} />
              <ZustandTestComponent projectId={2} />
              <ZustandTestComponent projectId={3} />
            </div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 32 }}>
        <div style={{ flex: 1 }}>
          <h2>Ripplex</h2>
          <Profiler id="ripplex" onRender={onRender}>
            <ul style={{ fontSize: "12px" }}>
              {ripplexLoaded &&
                ripplexProjects &&
                Array.isArray(ripplexProjects) &&
                ripplexProjects.slice(0, 5).map((p, i) => (
                  <li key={p.id}>
                    {p.name} - {p.tasks[0]?.title}
                  </li>
                ))}
            </ul>
          </Profiler>
        </div>

        <div style={{ flex: 1 }}>
          <h2>Zustand</h2>
          <Profiler id="zustand" onRender={onRender}>
            <ul style={{ fontSize: "12px" }}>
              {zustandLoaded &&
                zustandProjects &&
                Array.isArray(zustandProjects) &&
                zustandProjects?.slice(0, 5)?.map((p: Project) => (
                  <li key={p.id}>
                    {p.name} - {p?.tasks[0]?.title}
                  </li>
                ))}
            </ul>
          </Profiler>
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Statistical Performance Results</h3>
        <div
          style={{
            fontSize: "12px",
            backgroundColor: "#f5f5f5",
            padding: "10px",
            border: "1px solid #ddd",
            maxHeight: "800px",
            overflow: "auto",
          }}
        >
          {Object.keys(performanceRef.current).length > 0 ? (
            Object.entries(performanceRef.current).map(
              ([testName, libraries]) => (
                <div
                  key={testName}
                  style={{
                    marginBottom: "15px",
                    borderBottom: "1px solid #ddd",
                    paddingBottom: "10px",
                  }}
                >
                  <strong>{testName}:</strong>
                  {Object.entries(libraries).map(([lib, stats]) => {
                    const { average, min, max, stdDev, times } = stats as any;
                    return (
                      <div
                        key={lib}
                        style={{ marginLeft: "10px", marginTop: "5px" }}
                      >
                        <span
                          style={{
                            fontWeight: "bold",
                            color: lib === "ripplex" ? "#e74c3c" : "#3498db",
                          }}
                        >
                          {lib}:
                        </span>
                        <span style={{ marginLeft: "5px" }}>
                          {formatNumber(average)}ms avg (±{formatNumber(stdDev)}
                          ) [{formatNumber(min)}-{formatNumber(max)}ms] (
                          {times.length} runs)
                        </span>
                      </div>
                    );
                  })}
                </div>
              )
            )
          ) : (
            <div>
              No results yet. Run the comprehensive benchmark to see detailed
              performance data across all categories.
            </div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 20 }}>
        <h3>Render Count</h3>
        <pre
          style={{
            fontSize: "12px",
            backgroundColor: "#f0f8ff",
            padding: "10px",
            border: "1px solid #ddd",
          }}
        >
          {JSON.stringify(renderCountRef.current, null, 2)}
        </pre>
      </div>
    </div>
  );
}
