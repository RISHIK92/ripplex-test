import React, { useState, useRef, Profiler, useEffect } from "react";
import { ripple, useRipple } from "../lib";
import { useZustandStore } from "./ripples/zustandStore";
import { makeAutoObservable, reaction, runInAction } from "mobx";
import { observer } from "mobx-react-lite";
import { produce, Draft } from "immer";

type Subtask = {
  id: number;
  title: string;
  done: boolean;
};

type Task = {
  id: number;
  title: string;
  completed: boolean;
  subtasks: Subtask[];
};

type Project = {
  id: number;
  name: string;
  tasks: Task[];
};

const appStore = {
  projects: ripple.immer<Project[]>([]),

  async updateProject(id: number, updater: (project: Draft<Project>) => void) {
    await this.projects.update((draft: Project[]) => {
      const project = draft.find((p) => p.id === id);
      if (project) updater(project);
    });
  },

  async batchUpdate(
    updates: Array<{ id: number; updater: (project: Draft<Project>) => void }>
  ) {
    await this.projects.update((draft: Project[]) => {
      updates.forEach(({ id, updater }) => {
        const project = draft.find((p) => p.id === id);
        if (project) updater(project);
      });
    });
  },

  async deepUpdateProject(
    id: number,
    updater: (project: Draft<Project>) => void
  ) {
    await this.projects.update((draft: Project[]) => {
      const project = draft.find((p) => p.id === id);
      if (project) updater(project);
    });
  },

  async updateTask(
    projectId: number,
    taskId: number,
    updater: (task: Draft<Task>) => void
  ) {
    await this.projects.update((draft: Project[]) => {
      const project = draft.find((p) => p.id === projectId);
      if (project) {
        const task = project.tasks.find((t) => t.id === taskId);
        if (task) updater(task);
      }
    });
  },

  async updateSubtask(
    projectId: number,
    taskId: number,
    subtaskId: number,
    updater: (subtask: Draft<Subtask>) => void
  ) {
    await this.projects.update((draft: Project[]) => {
      const project = draft.find((p) => p.id === projectId);
      if (project) {
        const task = project.tasks.find((t) => t.id === taskId);
        if (task) {
          const subtask = task.subtasks.find((s) => s.id === subtaskId);
          if (subtask) updater(subtask);
        }
      }
    });
  },
};

// MobX Store (unchanged)
class MobxStore {
  projects: Project[] = [];
  loading = false;
  error: Error | null = null;

  constructor() {
    makeAutoObservable(this);
  }

  setProjects(newProjects: Project[]) {
    this.projects = newProjects;
  }

  updateProjectName(id: number, newName: string) {
    const project = this.projects.find((p) => p.id === id);
    if (project) {
      project.name = newName;
    }
  }

  updateProjectDeep(id: number, updates: Partial<Project>) {
    const project = this.projects.find((p) => p.id === id);
    if (project) {
      Object.assign(project, updates);
    }
  }

  batchUpdate(updates: Array<{ id: number; update: Partial<Project> }>) {
    runInAction(() => {
      updates.forEach(({ id, update }) => {
        const project = this.projects.find((p) => p.id === id);
        if (project) {
          Object.assign(project, update);
        }
      });
    });
  }

  setLoading(loading: boolean) {
    this.loading = loading;
  }

  setError(error: Error | null) {
    this.error = error;
  }
}

const mobxStore = new MobxStore();

// ======================== UTILITIES ========================
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

function formatNumber(num: number): string {
  return num < 0.01 ? "~0" : num.toFixed(2);
}

// ======================== TEST COMPONENTS ========================
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

const MobxTestComponent = observer(({ projectId }: { projectId: number }) => {
  const renderCountRef = useRef(0);
  const project = mobxStore.projects.find((p) => p.id === projectId);

  renderCountRef.current++;

  useEffect(() => {
    console.log(
      `MobxTestComponent ${projectId} rendered ${renderCountRef.current} times`
    );
  });

  return <div>Project: {project?.name || "Not found"}</div>;
});

// ======================== BENCHMARK COMPONENT ========================
export default function Benchmark() {
  const [ripplexLoaded, setRipplexLoaded] = useState(false);
  const [zustandLoaded, setZustandLoaded] = useState(false);
  const [mobxLoaded, setMobxLoaded] = useState(false);
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
    mobx: 0,
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

  // Helper functions
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
    testFunction: () => void | Promise<void>,
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
        mobxStore.setProjects(structuredClone(resetData));
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
      await testFunction();
      await new Promise((resolve) => setTimeout(resolve, 50));
    }

    setCurrentTest("");
  };

  const test1 = () => {
    const data = generateProjects();

    const ripplexStart = performance.now();
    appStore.projects.value = structuredClone(data);
    const ripplexEnd = performance.now();

    const zustandStart = performance.now();
    setZustandProjectsSync(structuredClone(data));
    const zustandEnd = performance.now();

    const mobxStart = performance.now();
    mobxStore.setProjects(structuredClone(data));
    const mobxEnd = performance.now();

    recordPerformance("load", "ripplex", ripplexEnd - ripplexStart);
    recordPerformance("load", "zustand", zustandEnd - zustandStart);
    recordPerformance("load", "mobx", mobxEnd - mobxStart);

    setRipplexLoaded(true);
    setZustandLoaded(true);
    setMobxLoaded(true);
  };

  const test2 = () => {
    if (
      !ripplexProjects?.length ||
      !zustandProjects?.length ||
      !mobxStore.projects.length
    ) {
      console.log("⚠️ No projects available for update test");
      return;
    }

    // Ripplex with Proxy
    const ripplexStart = performance.now();
    appStore.updateProject(1, (project) => {
      project.name = "🔁 Updated Ripplex Project";
    });
    const ripplexEnd = performance.now();

    // Zustand
    const zustandStart = performance.now();
    setZustandProjectsSync([
      { ...zustandProjects[0], name: "🔁 Updated Zustand Project" },
      ...zustandProjects.slice(1),
    ]);
    const zustandEnd = performance.now();

    // MobX
    const mobxStart = performance.now();
    mobxStore.updateProjectName(1, "🔁 Updated MobX Project");
    const mobxEnd = performance.now();

    recordPerformance("update", "ripplex", ripplexEnd - ripplexStart);
    recordPerformance("update", "zustand", zustandEnd - zustandStart);
    recordPerformance("update", "mobx", mobxEnd - mobxStart);
  };

  const test3 = () => {
    if (
      !ripplexProjects?.length ||
      !zustandProjects?.length ||
      !mobxStore.projects.length
    ) {
      console.log("⚠️ No projects available for batch update test");
      return;
    }

    // Ripplex with Proxy
    const ripplexStart = performance.now();
    appStore.batchUpdate(
      Array.from({ length: 100 }, (_, i) => ({
        id: (i % 1000) + 1,
        updater: (project: Project) => {
          project.name = `Ripplex Batch Update ${i}`;
        },
      }))
    );
    const ripplexEnd = performance.now();

    // Zustand
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

    // MobX
    const mobxStart = performance.now();
    const mobxUpdates = [];
    for (let i = 0; i < 100; i++) {
      const id = i % 1000;
      if (mobxStore.projects[id]) {
        mobxUpdates.push({
          id: id + 1,
          update: { name: `MobX Batch Update ${i}` },
        });
      }
    }
    mobxStore.batchUpdate(mobxUpdates);
    const mobxEnd = performance.now();

    recordPerformance("batchUpdate", "ripplex", ripplexEnd - ripplexStart);
    recordPerformance("batchUpdate", "zustand", zustandEnd - zustandStart);
    recordPerformance("batchUpdate", "mobx", mobxEnd - mobxStart);
  };

  const test4 = () => {
    console.log("📊 Test 4: Memory Usage Comparison");

    const memoryStart = (performance as any).memory?.usedJSHeapSize || 0;
    test1();
    const memoryEnd = (performance as any).memory?.usedJSHeapSize || 0;
    const memoryDiff = (memoryEnd - memoryStart) / 1024 / 1024;

    console.log("  Memory usage:", formatNumber(memoryDiff), "MB");
    recordPerformance("memory", "total", memoryDiff);
  };

  const test5 = () => {
    const newProjects = generateProjects();

    // Ripplex
    const ripplexStart = performance.now();
    appStore.projects.value = structuredClone(newProjects);
    const ripplexEnd = performance.now();

    // Zustand
    const zustandStart = performance.now();
    setZustandProjectsSync(structuredClone(newProjects));
    const zustandEnd = performance.now();

    // MobX
    const mobxStart = performance.now();
    mobxStore.setProjects(structuredClone(newProjects));
    const mobxEnd = performance.now();

    recordPerformance("replace", "ripplex", ripplexEnd - ripplexStart);
    recordPerformance("replace", "zustand", zustandEnd - zustandStart);
    recordPerformance("replace", "mobx", mobxEnd - mobxStart);

    console.log(`  Ripplex: ${formatNumber(ripplexEnd - ripplexStart)}ms`);
    console.log(`  Zustand: ${formatNumber(zustandEnd - zustandStart)}ms`);
    console.log(`  MobX: ${formatNumber(mobxEnd - mobxStart)}ms`);
  };

  const test6 = () => {
    if (
      !ripplexProjects?.length ||
      !zustandProjects?.length ||
      !mobxStore.projects.length
    ) {
      console.log("⚠️ No projects available for deep mutation test");
      return;
    }

    // Ripplex with Proxy
    const ripplexStart = performance.now();
    appStore.updateSubtask(1, 1, 1, (subtask) => {
      subtask.done = true;
    });
    const ripplexEnd = performance.now();

    // Zustand
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

    // MobX
    const mobxStart = performance.now();
    mobxStore.updateProjectDeep(1, {
      tasks: [
        {
          ...mobxStore.projects[0].tasks[0],
          subtasks: mobxStore.projects[0].tasks[0].subtasks.map((s, i) =>
            i === 0 ? { ...s, done: true } : s
          ),
        },
      ],
    });
    const mobxEnd = performance.now();

    recordPerformance("deepMutation", "ripplex", ripplexEnd - ripplexStart);
    recordPerformance("deepMutation", "zustand", zustandEnd - zustandStart);
    recordPerformance("deepMutation", "mobx", mobxEnd - mobxStart);
  };

  const test7 = () => {
    if (
      !ripplexProjects?.length ||
      !zustandProjects?.length ||
      !mobxStore.projects.length
    ) {
      console.log("⚠️ No projects available for massive batch test");
      return;
    }

    console.log("Test 7: Massive Batch Updates (1000 ops)");

    // Ripplex with Proxy
    const ripplexStart = performance.now();
    appStore.batchUpdate(
      Array.from({ length: 1000 }, (_, i) => ({
        id: (i % 1000) + 1,
        updater: (project: Project) => {
          project.name = `Heavy Ripplex ${i}`;
          project.tasks[0].completed = i % 2 === 0;
        },
      }))
    );
    const ripplexEnd = performance.now();

    // Zustand
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

    // MobX
    const mobxStart = performance.now();
    const mobxUpdates = [];
    for (let i = 0; i < 1000; i++) {
      const id = i % 1000;
      if (mobxStore.projects[id]) {
        mobxUpdates.push({
          id,
          update: {
            name: `Heavy MobX ${i}`,
            tasks: [
              {
                ...mobxStore.projects[id].tasks[0],
                completed: i % 2 === 0,
              },
            ],
          },
        });
      }
    }
    mobxStore.batchUpdate(mobxUpdates);
    const mobxEnd = performance.now();

    recordPerformance("massiveBatch", "ripplex", ripplexEnd - ripplexStart);
    recordPerformance("massiveBatch", "zustand", zustandEnd - zustandStart);
    recordPerformance("massiveBatch", "mobx", mobxEnd - mobxStart);
  };

  const test8 = () => {
    if (
      !ripplexProjects?.length ||
      !zustandProjects?.length ||
      !mobxStore.projects.length
    ) {
      console.log("⚠️ No projects available for deep nested test");
      return;
    }

    console.log("Test 8: Deep Nested Updates (100 items)");

    // Ripplex with Proxy
    const ripplexStart = performance.now();
    for (let i = 0; i < 100; i++) {
      if (i >= appStore.projects.value.length) continue;
      for (let j = 0; j < 5; j++) {
        if (j >= appStore.projects.value[i].tasks[0].subtasks.length) continue;
        appStore.projects.value[i].tasks[0].subtasks[j].done =
          !appStore.projects.value[i].tasks[0].subtasks[j].done;
        appStore.projects.value[i].tasks[0].subtasks[
          j
        ].title = `Updated ${i}-${j}`;
      }
    }
    const ripplexEnd = performance.now();

    // Zustand
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

    // MobX
    const mobxStart = performance.now();
    const mobxUpdates = [];
    for (let i = 0; i < 100; i++) {
      if (mobxStore.projects[i]) {
        mobxUpdates.push({
          id: i + 1,
          update: {
            tasks: [
              {
                ...mobxStore.projects[i].tasks[0],
                subtasks: mobxStore.projects[i].tasks[0].subtasks.map(
                  (s, j) => ({
                    ...s,
                    done: !s.done,
                    title: `Updated ${i}-${j}`,
                  })
                ),
              },
            ],
          },
        });
      }
    }
    mobxStore.batchUpdate(mobxUpdates);
    const mobxEnd = performance.now();

    recordPerformance("deepNested", "ripplex", ripplexEnd - ripplexStart);
    recordPerformance("deepNested", "zustand", zustandEnd - zustandStart);
    recordPerformance("deepNested", "mobx", mobxEnd - mobxStart);

    console.log(`  Ripplex: ${formatNumber(ripplexEnd - ripplexStart)}ms`);
    console.log(`  Zustand: ${formatNumber(zustandEnd - zustandStart)}ms`);
    console.log(`  MobX: ${formatNumber(mobxEnd - mobxStart)}ms`);
  };

  const test9 = () => {
    if (
      !ripplexProjects?.length ||
      !zustandProjects?.length ||
      !mobxStore.projects.length
    ) {
      console.log("⚠️ No projects available for rapid updates test");
      return;
    }

    console.log("Test 9: Rapid Successive Updates");

    // Ripplex
    const ripplexStart = performance.now();
    for (let round = 0; round < 10; round++) {
      for (let i = 0; i < 50; i++) {
        if (appStore.projects.value[i]) {
          appStore.projects.value[i].name = `Rapid ${round}-${i}`;
        }
      }
    }
    const ripplexEnd = performance.now();

    // Zustand
    const zustandStart = performance.now();
    let rapidUpdated = [...zustandProjects];
    for (let round = 0; round < 10; round++) {
      rapidUpdated = rapidUpdated.map((project, i) => {
        if (i >= 50) return project;
        return { ...project, name: `Rapid ${round}-${i}` };
      });
      setZustandProjectsSync(rapidUpdated);
    }
    const zustandEnd = performance.now();

    // MobX
    const mobxStart = performance.now();
    for (let round = 0; round < 10; round++) {
      runInAction(() => {
        for (let i = 0; i < 50; i++) {
          if (mobxStore.projects[i]) {
            mobxStore.projects[i].name = `Rapid ${round}-${i}`;
          }
        }
      });
    }
    const mobxEnd = performance.now();

    recordPerformance("rapidSuccessive", "ripplex", ripplexEnd - ripplexStart);
    recordPerformance("rapidSuccessive", "zustand", zustandEnd - zustandStart);
    recordPerformance("rapidSuccessive", "mobx", mobxEnd - mobxStart);

    console.log(`  Ripplex: ${formatNumber(ripplexEnd - ripplexStart)}ms`);
    console.log(`  Zustand: ${formatNumber(zustandEnd - zustandStart)}ms`);
    console.log(`  MobX: ${formatNumber(mobxEnd - mobxStart)}ms`);
  };

  const test10 = () => {
    console.log("Test 10: Large Dataset Replacement (10k items)");

    const largeData = generateProjects(10000);

    // Ripplex
    const ripplexStart = performance.now();
    appStore.projects.value = structuredClone(largeData);
    const ripplexEnd = performance.now();

    // Zustand
    const zustandStart = performance.now();
    setZustandProjectsSync(structuredClone(largeData));
    const zustandEnd = performance.now();

    // MobX
    const mobxStart = performance.now();
    mobxStore.setProjects(structuredClone(largeData));
    const mobxEnd = performance.now();

    recordPerformance("largeDataset", "ripplex", ripplexEnd - ripplexStart);
    recordPerformance("largeDataset", "zustand", zustandEnd - zustandStart);
    recordPerformance("largeDataset", "mobx", mobxEnd - mobxStart);

    console.log(`  Ripplex: ${formatNumber(ripplexEnd - ripplexStart)}ms`);
    console.log(`  Zustand: ${formatNumber(zustandEnd - zustandStart)}ms`);
    console.log(`  MobX: ${formatNumber(mobxEnd - mobxStart)}ms`);
  };

  const test11 = () => {
    if (
      !ripplexProjects?.length ||
      !zustandProjects?.length ||
      !mobxStore.projects.length
    ) {
      console.log("⚠️ No projects available for re-render test");
      return;
    }

    console.log("🔁 Test 11: Re-render Count - Top Level Update");

    renderCountRef.current = { ripplex: 0, zustand: 0, mobx: 0 };
    setShowTestComponents(true);

    setTimeout(() => {
      // Ripplex
      const ripplexStart = performance.now();
      appStore.projects.value[0].name = "🔁 Ripplex Top Level Update";
      const ripplexEnd = performance.now();

      // Zustand
      const zustandStart = performance.now();
      setZustandProjectsSync([
        { ...zustandProjects[0], name: "🔁 Zustand Top Level Update" },
        ...zustandProjects.slice(1),
      ]);
      const zustandEnd = performance.now();

      // MobX
      const mobxStart = performance.now();
      mobxStore.updateProjectName(1, "🔁 MobX Top Level Update");
      const mobxEnd = performance.now();

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
      recordPerformance("rerenderTopLevel", "mobx", mobxEnd - mobxStart);

      console.log(`  Ripplex: ${formatNumber(ripplexEnd - ripplexStart)}ms`);
      console.log(`  Zustand: ${formatNumber(zustandEnd - zustandStart)}ms`);
      console.log(`  MobX: ${formatNumber(mobxEnd - mobxStart)}ms`);
    }, 100);
  };

  const test12 = () => {
    if (
      !ripplexProjects?.length ||
      !zustandProjects?.length ||
      !mobxStore.projects.length
    ) {
      console.log("⚠️ No projects available for nested re-render test");
      return;
    }

    console.log("🔁 Test 12: Re-render Count - Nested Update");

    renderCountRef.current = { ripplex: 0, zustand: 0, mobx: 0 };

    // Ripplex
    const ripplexStart = performance.now();
    appStore.projects.value[0].tasks[0].subtasks[0].done =
      !appStore.projects.value[0].tasks[0].subtasks[0].done;
    const ripplexEnd = performance.now();

    // Zustand
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

    // MobX
    const mobxStart = performance.now();
    mobxStore.updateProjectDeep(1, {
      tasks: [
        {
          ...mobxStore.projects[0].tasks[0],
          subtasks: mobxStore.projects[0].tasks[0].subtasks.map((s, i) =>
            i === 0 ? { ...s, done: !s.done } : s
          ),
        },
      ],
    });
    const mobxEnd = performance.now();

    recordPerformance("rerenderNested", "ripplex", ripplexEnd - ripplexStart);
    recordPerformance("rerenderNested", "zustand", zustandEnd - zustandStart);
    recordPerformance("rerenderNested", "mobx", mobxEnd - mobxStart);

    console.log(`  Ripplex: ${formatNumber(ripplexEnd - ripplexStart)}ms`);
    console.log(`  Zustand: ${formatNumber(zustandEnd - zustandStart)}ms`);
    console.log(`  MobX: ${formatNumber(mobxEnd - mobxStart)}ms`);
  };

  const test13 = () => {
    if (
      !ripplexProjects?.length ||
      !zustandProjects?.length ||
      !mobxStore.projects.length
    ) {
      console.log("⚠️ No projects available for no-op test");
      return;
    }

    console.log("🔁 Test 13: Re-render Count - No-op Update");

    renderCountRef.current = { ripplex: 0, zustand: 0, mobx: 0 };

    const currentName = appStore.projects.value[0].name;

    // Ripplex
    const ripplexStart = performance.now();
    appStore.projects.value[0].name = currentName; // Same value
    const ripplexEnd = performance.now();

    // Zustand
    const zustandStart = performance.now();
    setZustandProjectsSync([
      { ...zustandProjects[0], name: currentName }, // Same value
      ...zustandProjects.slice(1),
    ]);
    const zustandEnd = performance.now();

    // MobX
    const mobxStart = performance.now();
    mobxStore.updateProjectName(1, currentName); // Same value
    const mobxEnd = performance.now();

    recordPerformance("rerenderNoOp", "ripplex", ripplexEnd - ripplexStart);
    recordPerformance("rerenderNoOp", "zustand", zustandEnd - zustandStart);
    recordPerformance("rerenderNoOp", "mobx", mobxEnd - mobxStart);

    console.log(`  Ripplex: ${formatNumber(ripplexEnd - ripplexStart)}ms`);
    console.log(`  Zustand: ${formatNumber(zustandEnd - zustandStart)}ms`);
    console.log(`  MobX: ${formatNumber(mobxEnd - mobxStart)}ms`);
  };

  const test14 = () => {
    console.log("📈 Test 14: Retained Heap Size After Operations");

    takeMemorySnapshot("Before operations");

    const largeData = generateProjects(5000);
    appStore.projects.value = structuredClone(largeData);
    setZustandProjectsSync(structuredClone(largeData));
    mobxStore.setProjects(structuredClone(largeData));

    takeMemorySnapshot("After large data load");

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
    mobxStore.setProjects([]);

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
      mobxStore.setProjects(structuredClone(tempData));

      // Clear immediately
      appStore.projects.value = [];
      setZustandProjectsSync([]);
      mobxStore.setProjects([]);
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

  const test16 = () => {
    if (
      !ripplexProjects?.length ||
      !zustandProjects?.length ||
      !mobxStore.projects.length
    ) {
      const testData = generateProjects(1000);
      appStore.projects.value = structuredClone(testData);
      setZustandProjectsSync(structuredClone(testData));
      mobxStore.setProjects(structuredClone(testData));
    }

    console.log(" Test 16: Concurrent/Async Updates");

    const asyncUpdates = [];

    // Ripplex
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

    Promise.all(asyncUpdates).then(() => {
      const ripplexEnd = performance.now();
      recordPerformance("asyncUpdates", "ripplex", ripplexEnd - ripplexStart);
      console.log(`  Ripplex: ${formatNumber(ripplexEnd - ripplexStart)}ms`);
    });

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

    Promise.all(asyncUpdates).then(() => {
      const zustandEnd = performance.now();
      recordPerformance("asyncUpdates", "zustand", zustandEnd - zustandStart);
      console.log(`  Zustand: ${formatNumber(zustandEnd - zustandStart)}ms`);
    });

    // MobX async updates
    const mobxStart = performance.now();
    for (let i = 0; i < 50; i++) {
      const id = i % (mobxStore.projects.length || 100);
      if (!mobxStore.projects[id]) continue;

      asyncUpdates.push(
        new Promise((resolve) => {
          setTimeout(() => {
            runInAction(() => {
              mobxStore.projects[id].name = `Async MobX ${i}`;
            });
            resolve(true);
          }, Math.random() * 10);
        })
      );
    }

    Promise.all(asyncUpdates).then(() => {
      const mobxEnd = performance.now();
      recordPerformance("asyncUpdates", "mobx", mobxEnd - mobxStart);
      console.log(`  MobX: ${formatNumber(mobxEnd - mobxStart)}ms`);
    });
  };

  const test17 = () => {
    if (
      !ripplexProjects?.length ||
      !zustandProjects?.length ||
      !mobxStore.projects.length
    ) {
      const testData = generateProjects(1);
      appStore.projects.value = structuredClone(testData);
      setZustandProjectsSync(structuredClone(testData));
      mobxStore.setProjects(structuredClone(testData));
    }

    console.log("🚦 Test 17: Race Condition Handling");

    let ripplexFinalValue = "";
    let zustandFinalValue = "";
    let mobxFinalValue = "";

    // Ripplex
    const ripplexStart = performance.now();
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

    Promise.all([ripplexPromise1, ripplexPromise2]).then(() => {
      ripplexFinalValue = appStore.projects.value[0].name;
      const ripplexEnd = performance.now();
      recordPerformance("raceConditions", "ripplex", ripplexEnd - ripplexStart);
      console.log(`  Ripplex final value: ${ripplexFinalValue}`);
      console.log(`  Ripplex: ${formatNumber(ripplexEnd - ripplexStart)}ms`);
    });

    // Zustand
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

    Promise.all([zustandPromise1, zustandPromise2]).then(() => {
      zustandFinalValue = zustandProjects[0].name;
      const zustandEnd = performance.now();
      recordPerformance("raceConditions", "zustand", zustandEnd - zustandStart);
      console.log(`  Zustand final value: ${zustandFinalValue}`);
      console.log(`  Zustand: ${formatNumber(zustandEnd - zustandStart)}ms`);
    });

    // MobX
    const mobxStart = performance.now();
    const mobxPromise1 = new Promise((resolve) => {
      setTimeout(() => {
        runInAction(() => {
          mobxStore.projects[0].name = "MobX Race A";
        });
        resolve("A");
      }, 10);
    });

    const mobxPromise2 = new Promise((resolve) => {
      setTimeout(() => {
        runInAction(() => {
          mobxStore.projects[0].name = "MobX Race B";
        });
        resolve("B");
      }, 10);
    });

    Promise.all([mobxPromise1, mobxPromise2]).then(() => {
      mobxFinalValue = mobxStore.projects[0].name;
      const mobxEnd = performance.now();
      recordPerformance("raceConditions", "mobx", mobxEnd - mobxStart);
      console.log(`  MobX final value: ${mobxFinalValue}`);
      console.log(`  MobX: ${formatNumber(mobxEnd - mobxStart)}ms`);
    });
  };

  const test18 = () => {
    if (
      !ripplexProjects?.length ||
      !zustandProjects?.length ||
      !mobxStore.projects.length
    ) {
      console.log("⚠️ No projects available for subscription test");
      return;
    }

    console.log(" Test 18: Subscription Latency");

    let ripplexSubscriptionTime = 0;
    let zustandSubscriptionTime = 0;
    let mobxSubscriptionTime = 0;

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

    // MobX reaction test
    const mobxStart = performance.now();
    const mobxDisposer = reaction(
      () => mobxStore.projects[0].name,
      () => {
        mobxSubscriptionTime = performance.now() - mobxStart;
      }
    );

    mobxStore.updateProjectName(1, "Subscription Test MobX");

    setTimeout(() => {
      mobxDisposer();
      recordPerformance("subscriptionLatency", "mobx", mobxSubscriptionTime);
      console.log(
        `  MobX reaction latency: ${formatNumber(mobxSubscriptionTime)}ms`
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

    // Test MobX reactions
    const mobxStart = performance.now();
    const mobxDisposers = [];

    for (let i = 0; i < subscriptionCount; i++) {
      const disposer = reaction(
        () => mobxStore.projects.length,
        () => {
          // Empty reaction
        }
      );
      mobxDisposers.push(disposer);
    }

    // Dispose all
    mobxDisposers.forEach((disposer) => disposer());
    const mobxEnd = performance.now();

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
    recordPerformance("unsubscriptionLeak", "mobx", mobxEnd - mobxStart);

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
    console.log(
      `  MobX ${subscriptionCount} reactions: ${formatNumber(
        mobxEnd - mobxStart
      )}ms`
    );
  };

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

    // MobX computed test
    const mobxStart = performance.now();
    const mobxSelected = mobxStore.projects
      .filter((p) => p.id <= 10)
      .map((p) => p.name);
    const mobxEnd = performance.now();

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
    recordPerformance("selectorEfficiency", "mobx", mobxEnd - mobxStart);

    console.log(`  Ripplex: ${formatNumber(ripplexEnd - ripplexStart)}ms`);
    console.log(`  Zustand: ${formatNumber(zustandEnd - zustandStart)}ms`);
    console.log(`  MobX: ${formatNumber(mobxEnd - mobxStart)}ms`);
    console.log(`  Ripplex selected items: ${ripplexSelected.length}`);
    console.log(`  Zustand selected items: ${zustandSelected.length}`);
    console.log(`  MobX selected items: ${mobxSelected.length}`);
  };

  const test21 = () => {
    console.log("🧪 Test 21: MobX Reaction System");

    const mobxStart = performance.now();
    const disposer = reaction(
      () => mobxStore.projects.map((p) => p.name),
      () => {
        const latency = performance.now() - mobxStart;
        recordPerformance("mobxReaction", "latency", latency);
        console.log(`  MobX reaction latency: ${formatNumber(latency)}ms`);
      }
    );

    // Trigger update
    mobxStore.updateProjectName(1, "MobX Reaction Test");

    setTimeout(() => disposer(), 100);
  };

  const runAllTests = async () => {
    setIsRunning(true);
    performanceRef.current = {};
    renderCountRef.current = { ripplex: 0, zustand: 0, mobx: 0 };
    setMemorySnapshots([]);

    console.log(" Running comprehensive benchmark with multiple iterations...");
    console.log("Each test will run multiple times for statistical accuracy\n");

    const testConfigs = [
      { name: "Initial Load", fn: test1, iterations: 20 },
      { name: "Single Update", fn: test2, iterations: 20 },
      { name: "Batch Updates", fn: test3, iterations: 20 },
      { name: "Memory Usage", fn: test4, iterations: 20 },
      { name: "List Replace", fn: test5, iterations: 5 },
      { name: "Deep Mutation", fn: test6, iterations: 20 },
      { name: "Massive Batch", fn: test7, iterations: 20 },
      { name: "Deep Nested", fn: test8, iterations: 20 },
      { name: "Rapid Updates", fn: test9, iterations: 20 },
      { name: "Large Dataset", fn: test10, iterations: 20 },
      { name: "Re-render Top Level", fn: test11, iterations: 20 },
      { name: "Re-render Nested", fn: test12, iterations: 20 },
      { name: "Re-render No-op", fn: test13, iterations: 20 },
      { name: "Retained Heap", fn: test14, iterations: 20 },
      { name: "GC Impact", fn: test15, iterations: 20 },
      { name: "Async Updates", fn: test16, iterations: 20 },
      { name: "Race Conditions", fn: test17, iterations: 20 },
      { name: "Subscription Latency", fn: test18, iterations: 20 },
      { name: "Unsubscription Leak", fn: test19, iterations: 20 },
      { name: "Selector Efficiency", fn: test20, iterations: 20 },
      { name: "MobX Reaction", fn: test21, iterations: 20 },
    ];

    for (const config of testConfigs) {
      if (config.fn === test21) {
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

    Object.entries(performanceRef.current).forEach(([testName, libraries]) => {
      console.log(`\n${testName}:`);
      Object.entries(libraries).forEach(([lib, stats]) => {
        const { average, min, max, stdDev } = stats as any;
        const color =
          lib === "ripplex"
            ? "\x1b[31m"
            : lib === "zustand"
            ? "\x1b[34m"
            : "\x1b[35m";
        console.log(
          `${color}  ${lib}: ${formatNumber(average)}ms (±${formatNumber(
            stdDev
          )}) [${formatNumber(min)}-${formatNumber(max)}ms]\x1b[0m`
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
        Comparing Ripplex, Zustand, and MobX across performance, re-renders,
        memory usage, async handling, and subscriptions
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
          Test 7: Massive Batch (1000)
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
          Test 10: Large Dataset (10k)
        </button>

        <div style={{ marginBottom: 8, width: "100%", marginTop: 16 }}>
          <strong>Re-render Tests:</strong>
        </div>
        <button
          onClick={test11}
          style={{
            padding: "8px 12px",
            backgroundColor: "#2ecc71",
            color: "white",
          }}
        >
          Test 11: Top Level
        </button>
        <button
          onClick={test12}
          style={{
            padding: "8px 12px",
            backgroundColor: "#2ecc71",
            color: "white",
          }}
        >
          Test 12: Nested
        </button>
        <button
          onClick={test13}
          style={{
            padding: "8px 12px",
            backgroundColor: "#2ecc71",
            color: "white",
          }}
        >
          Test 13: No-op
        </button>

        <div style={{ marginBottom: 8, width: "100%", marginTop: 16 }}>
          <strong>Async Tests:</strong>
        </div>
        <button
          onClick={test16}
          style={{
            padding: "8px 12px",
            backgroundColor: "#f39c12",
            color: "white",
          }}
        >
          Test 16: Async Updates
        </button>
        <button
          onClick={test17}
          style={{
            padding: "8px 12px",
            backgroundColor: "#f39c12",
            color: "white",
          }}
        >
          Test 17: Race Conditions
        </button>

        <div style={{ marginBottom: 8, width: "100%", marginTop: 16 }}>
          <strong>Subscription Tests:</strong>
        </div>
        <button
          onClick={test18}
          style={{
            padding: "8px 12px",
            backgroundColor: "#3498db",
            color: "white",
          }}
        >
          Test 18: Latency
        </button>
        <button
          onClick={test19}
          style={{
            padding: "8px 12px",
            backgroundColor: "#3498db",
            color: "white",
          }}
        >
          Test 19: Leak Test
        </button>

        <div style={{ marginBottom: 8, width: "100%", marginTop: 16 }}>
          <strong>MobX Tests:</strong>
        </div>
        <button
          onClick={test21}
          style={{
            padding: "8px 12px",
            backgroundColor: "#9b59b6",
            color: "white",
          }}
        >
          Test 21: Reaction System
        </button>

        <div style={{ marginBottom: 8, width: "100%", marginTop: 16 }}>
          <strong>Control Panel:</strong>
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
          {isRunning ? ` ${currentTest || "Running..."}` : "Run All Tests"}
        </button>
      </div>

      {showTestComponents && (
        <div style={{ marginTop: 20, padding: 20, border: "1px solid #ccc" }}>
          <h2>Test Components</h2>
          <div style={{ marginBottom: 20 }}>
            <strong>Ripplex:</strong>
          </div>
          <RipplexTestComponent projectId={1} />
          <div style={{ marginBottom: 20, marginTop: 20 }}>
            <strong>Zustand:</strong>
          </div>
          <ZustandTestComponent projectId={1} />
          <div style={{ marginBottom: 20, marginTop: 20 }}>
            <strong>MobX:</strong>
          </div>
          <MobxTestComponent projectId={1} />
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

        <div style={{ flex: 1 }}>
          <h2>MobX</h2>
          <Profiler id="mobx" onRender={onRender}>
            <ul style={{ fontSize: "12px" }}>
              {mobxLoaded &&
                mobxStore.projects.slice(0, 5).map((p) => (
                  <li key={p.id}>
                    {p.name} - {p.tasks[0]?.title}
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
                    const { average, min, max, stdDev } = stats as any;
                    const color =
                      lib === "ripplex"
                        ? "#e74c3c"
                        : lib === "zustand"
                        ? "#3498db"
                        : "#9b59b6";
                    return (
                      <div
                        key={lib}
                        style={{ marginLeft: "10px", marginTop: "5px" }}
                      >
                        <span style={{ fontWeight: "bold", color }}>
                          {lib}:
                        </span>
                        <span style={{ marginLeft: "5px" }}>
                          {formatNumber(average)}ms avg (±{formatNumber(stdDev)}
                          ) [{formatNumber(min)}-{formatNumber(max)}ms] (
                          {stats.times.length} runs)
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

      <div style={{ marginTop: 20 }}>
        <h3>Memory Snapshots</h3>
        <pre
          style={{
            fontSize: "12px",
            backgroundColor: "#f0f0f0",
            padding: "10px",
            border: "1px solid #ddd",
            maxHeight: "300px",
            overflow: "auto",
          }}
        >
          {JSON.stringify(memorySnapshots, null, 2)}
        </pre>
      </div>
    </div>
  );
}
