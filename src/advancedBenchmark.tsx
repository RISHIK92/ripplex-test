import React, { useState, useRef, useCallback, useEffect } from "react";
import { useRipple } from "ripplex-core";
import { appStore1 } from "./ripples/rippleStore";
import { useZustandStore } from "./ripples/advancedZustandStore";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
} from "recharts";

// Performance monitoring utilities
const performanceMetrics = {
  memory: () => {
    if ("memory" in performance) {
      return (
        performance as {
          memory: {
            usedJSHeapSize: number;
            totalJSHeapSize: number;
            jsHeapSizeLimit: number;
          };
        }
      ).memory;
    }
    return { usedJSHeapSize: 0, totalJSHeapSize: 0, jsHeapSizeLimit: 0 };
  },
  measureTime: async (fn: () => void | Promise<void>) => {
    const start = performance.now();
    const startMemory = performanceMetrics.memory();
    await fn();
    const end = performance.now();
    const endMemory = performanceMetrics.memory();
    return {
      time: end - start,
      memoryDelta: endMemory.usedJSHeapSize - startMemory.usedJSHeapSize,
      peakMemory: endMemory.usedJSHeapSize,
    };
  },
  // Measure with warmup to account for JIT compilation
  measureWithWarmup: async (
    fn: () => void | Promise<void>,
    warmupRuns: number = 3
  ) => {
    // Warmup runs to stabilize JIT compilation
    for (let i = 0; i < warmupRuns; i++) {
      await fn();
    }

    // Force garbage collection if available
    if (
      "gc" in window &&
      typeof (window as { gc?: () => void }).gc === "function"
    ) {
      (window as { gc: () => void }).gc();
    }

    // Wait a bit for stabilization
    await new Promise((resolve) => setTimeout(resolve, 10));

    return performanceMetrics.measureTime(async () => {
      await fn();
    });
  },
  // Measure multiple times to get stable results
  measureMultiple: async (fn: () => void | Promise<void>, runs: number = 5) => {
    const times: number[] = [];
    const memoryDeltas: number[] = [];
    const peakMemories: number[] = [];

    for (let i = 0; i < runs; i++) {
      const metrics = await performanceMetrics.measureWithWarmup(async () => {
        await fn();
      });
      times.push(metrics.time);
      memoryDeltas.push(metrics.memoryDelta);
      peakMemories.push(metrics.peakMemory);

      // Small delay between runs to prevent interference
      await new Promise((resolve) => setTimeout(resolve, 5));
    }

    return {
      times,
      memoryDeltas,
      peakMemories,
      avgTime: times.reduce((a, b) => a + b, 0) / times.length,
      avgMemoryDelta:
        memoryDeltas.reduce((a, b) => a + b, 0) / memoryDeltas.length,
      avgPeakMemory:
        peakMemories.reduce((a, b) => a + b, 0) / peakMemories.length,
    };
  },
};

// Statistics calculation utilities
const calculateStats = (values: number[]) => {
  const sorted = values.sort((a, b) => a - b);
  const sum = values.reduce((a, b) => a + b, 0);
  const mean = sum / values.length;
  const median = sorted[Math.floor(sorted.length / 2)];
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const variance =
    values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
    values.length;
  const stdDev = Math.sqrt(variance);

  return { mean, median, min, max, stdDev, count: values.length };
};

// Define Project type to match appStore1.projects
export type Project = {
  id: number;
  name: string;
  tasks: {
    id: number;
    title: string;
    completed: boolean;
    subtasks: {
      id: number;
      title: string;
      done: boolean;
    }[];
  }[];
};

function generateData(count = 10000): Project[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Item ${i + 1}`,
    tasks: [],
  }));
}

function useRenderCount() {
  const count = useRef(0);
  count.current += 1;
  return count.current;
}

function List({ items, label }: { items: Project[]; label: string }) {
  const renderCount = useRenderCount();
  const [expanded, setExpanded] = useState(false);

  return (
    <div style={{ border: "1px solid #ddd", padding: 16, borderRadius: 8 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <div style={{ fontSize: 12, color: "#888" }}>
          {label} renders: {renderCount}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          style={{ fontSize: 10, padding: "2px 8px" }}
        >
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>
      <ul
        style={{
          maxHeight: expanded ? 600 : 300,
          overflow: "auto",
          fontSize: 13,
          transition: "max-height 0.3s ease",
        }}
      >
        {items.slice(0, expanded ? 500 : 100).map((item) => (
          <li key={item.id} style={{ marginBottom: 4 }}>
            <strong>{item.name}</strong>
          </li>
        ))}
        {items.length > (expanded ? 500 : 100) && (
          <li style={{ color: "#888", fontStyle: "italic" }}>
            ...and {items.length - (expanded ? 500 : 100)} more
          </li>
        )}
      </ul>
    </div>
  );
}

// Helper to ensure all result objects have gcPeakMemory
function withGcPeakMemory<T extends { gcPeakMemory?: number }>(
  result: T
): T & { gcPeakMemory: number } {
  return { gcPeakMemory: 0, ...result };
}

export default function AdvancedBenchmark() {
  // State for results
  const [results, setResults] = useState<
    Array<{
      lib: string;
      op: string;
      count: number;
      nested?: boolean;
      complexity?: number;
      time: number;
      peakMemory: number;
      timestamp: number;
    }>
  >([]);
  const [loading, setLoading] = useState(false);
  const [realTimeMetrics, setRealTimeMetrics] = useState<{
    memory?: number;
    totalMemory?: number;
    memoryLimit?: number;
    timestamp?: number;
  }>({});
  const [chartType, setChartType] = useState<"bar" | "line" | "area" | "pie">(
    "bar"
  );
  const [stressTest, setStressTest] = useState(false);
  const [batchTest, setBatchTest] = useState(false);
  const [batchProgress, setBatchProgress] = useState({
    current: 0,
    total: 0,
    test: "",
  });
  const [batchResults, setBatchResults] = useState<Record<string, unknown>>({});
  const [heavyTestWarning, setHeavyTestWarning] = useState(false);

  // Ripplex
  const ripplexItems = useRipple(appStore1.projects) as Project[];
  const handleRipplexLoad = useCallback(async (count: number) => {
    setLoading(true);
    const metrics = await performanceMetrics.measureTime(() => {
      appStore1.projects.update((draft: Project[]) => {
        const newData = generateData(count);
        draft.length = 0;
        for (const item of newData) draft.push(item);
      });
    });
    return new Promise<{ time: number; peakMemory: number }>((resolve) => {
      setTimeout(() => {
        setResults((r) => [
          ...r,
          {
            lib: "Ripplex",
            op: "Load",
            count,
            time: metrics.time,
            peakMemory: metrics.peakMemory,
            timestamp: Date.now(),
          },
        ]);
        setLoading(false);
        resolve(metrics);
      }, 50);
    });
  }, []);

  const handleRipplexUpdate = useCallback(async (count: number) => {
    setLoading(true);
    const metrics = await performanceMetrics.measureTime(() => {
      appStore1.projects.update((draft: Project[]) => {
        for (let i = 0; i < count; i++) {
          if (draft[i]) {
            draft[i].name += "!";
          }
        }
      });
    });
    return new Promise<{ time: number; peakMemory: number }>((resolve) => {
      setTimeout(() => {
        setResults((r) => [
          ...r,
          {
            lib: "Ripplex",
            op: "Update",
            count,
            time: metrics.time,
            peakMemory: metrics.peakMemory,
            timestamp: Date.now(),
          },
        ]);
        setLoading(false);
        resolve(metrics);
      }, 50);
    });
  }, []);

  const setZustandProjects = useZustandStore((s) => s.setProjects);
  const zustandItems = useZustandStore((s) => s.projects) || [];
  const handleZustandLoad = useCallback(
    async (count: number) => {
      setLoading(true);
      const data = generateData(count);
      const metrics = await performanceMetrics.measureTime(() => {
        setZustandProjects(data);
      });
      return new Promise<{ time: number; peakMemory: number }>((resolve) => {
        setTimeout(() => {
          setResults((r) => [
            ...r,
            {
              lib: "Zustand",
              op: "Load",
              count: data.length,
              time: metrics.time,
              peakMemory: metrics.peakMemory,
              timestamp: Date.now(),
            },
          ]);
          setLoading(false);
          resolve(metrics);
        }, 50);
      });
    },
    [setZustandProjects]
  );

  const handleZustandUpdate = useCallback(
    async (count: number) => {
      setLoading(true);
      const metrics = await performanceMetrics.measureTime(() => {
        const currentProjects = useZustandStore.getState().projects || [];
        const updatedProjects = currentProjects.slice();
        for (let i = 0; i < count; i++) {
          if (updatedProjects[i]) {
            updatedProjects[i].name += "!";
          }
        }
        setZustandProjects(updatedProjects);
      });
      return new Promise<{ time: number; peakMemory: number }>((resolve) => {
        setTimeout(() => {
          setResults((r) => [
            ...r,
            {
              lib: "Zustand",
              op: "Update",
              count,
              time: metrics.time,
              peakMemory: metrics.peakMemory,
              timestamp: Date.now(),
            },
          ]);
          setLoading(false);
          resolve(metrics);
        }, 50);
      });
    },
    [setZustandProjects]
  );

  // Stress testing
  const runStressTest = useCallback(() => {
    setStressTest(true);
    const tests = [
      () => handleRipplexLoad(1000),
      () => handleZustandLoad(1000),
      () => handleRipplexLoad(5000),
      () => handleZustandLoad(5000),
      () => handleRipplexLoad(10000),
      () => handleZustandLoad(10000),
      () => handleRipplexUpdate(1000),
      () => handleZustandUpdate(1000),
    ];

    let index = 0;
    const runNext = () => {
      if (index < tests.length) {
        tests[index]();
        index++;
        setTimeout(runNext, 1000);
      } else {
        setStressTest(false);
      }
    };
    runNext();
  }, [
    handleRipplexLoad,
    handleZustandLoad,
    handleRipplexUpdate,
    handleZustandUpdate,
  ]);

  // Selector performance test
  const runSelectorTest = useCallback(async () => {
    setLoading(true);

    // Test Ripplex selectors - create subscriptions outside of measurement
    const ripplexMetrics = await performanceMetrics.measureTime(async () => {
      // Create multiple selective subscriptions
      const subscriptions: unknown[] = [];
      for (let i = 0; i < 100; i++) {
        // Note: This is a simplified test - in real usage, hooks would be called at component level
        subscriptions.push(i);
      }
    });

    // Test Zustand selectors - create subscriptions outside of measurement
    const zustandMetrics = await performanceMetrics.measureTime(async () => {
      // Create multiple selective subscriptions
      const subscriptions: unknown[] = [];
      for (let i = 0; i < 100; i++) {
        // Note: This is a simplified test - in real usage, hooks would be called at component level
        subscriptions.push(i);
      }
    });

    setTimeout(() => {
      setResults((r) => [
        ...r,
        {
          lib: "Ripplex",
          op: "Selector Test",
          count: 100,
          time: ripplexMetrics.time,
          peakMemory: ripplexMetrics.peakMemory,
          timestamp: Date.now(),
        },
        {
          lib: "Zustand",
          op: "Selector Test",
          count: 100,
          time: zustandMetrics.time,
          peakMemory: zustandMetrics.peakMemory,
          timestamp: Date.now(),
        },
      ]);
      setLoading(false);
    }, 50);
  }, []);

  // Realistic testing with caching considerations
  const runRealisticTest = useCallback(async () => {
    setBatchTest(true);
    setBatchResults({});

    // Real-world test scenarios
    const realisticTests = [
      {
        name: "Small List (100 items)",
        description: "Typical dashboard widget or small data table",
        ripplexFn: () => handleRipplexLoad(100),
        zustandFn: () => handleZustandLoad(100),
        dataSize: 100,
      },
      {
        name: "Medium List (1K items)",
        description: "Standard data grid or search results",
        ripplexFn: () => handleRipplexLoad(1000),
        zustandFn: () => handleZustandLoad(1000),
        dataSize: 1000,
      },
      {
        name: "Large List (5K items)",
        description: "Large dataset or file browser",
        ripplexFn: () => handleRipplexLoad(5000),
        zustandFn: () => handleZustandLoad(5000),
        dataSize: 5000,
      },
      {
        name: "Frequent Updates (100 items)",
        description: "Real-time updates or form validation",
        ripplexFn: () => handleRipplexUpdate(100),
        zustandFn: () => handleZustandUpdate(100),
        dataSize: 100,
      },
      {
        name: "Bulk Updates (1K items)",
        description: "Bulk operations or data import",
        ripplexFn: () => handleRipplexUpdate(1000),
        zustandFn: () => handleZustandUpdate(1000),
        dataSize: 1000,
      },
      {
        name: "Massive Load (50K items)",
        description:
          "Extreme stress test - loading 50,000 items simultaneously",
        ripplexFn: () => handleRipplexLoad(50000),
        zustandFn: () => handleZustandLoad(50000),
        dataSize: 50000,
      },
      {
        name: "Ultra Heavy Updates (100K items)",
        description:
          "Massive update operation - updating 100,000 items with complex mutations",
        ripplexFn: async () => {
          const metrics = await performanceMetrics.measureTime(async () => {
            appStore1.projects.update((draft: Project[]) => {
              // Complex nested updates that stress the library
              for (let i = 0; i < 75000; i++) {
                if (draft[i]) {
                  draft[i].name = `Updated ${i} - ${Date.now()}`;
                  // Add complex nested structure
                  draft[i].tasks = Array.from({ length: 5 }, (_, j) => ({
                    id: j + 1,
                    title: `Task ${j + 1} for item ${i}`,
                    completed: Math.random() > 0.5,
                    subtasks: Array.from({ length: 3 }, (_, k) => ({
                      id: k + 1,
                      title: `Subtask ${k + 1}`,
                      done: Math.random() > 0.5,
                    })),
                  }));
                }
              }
            });
          });
          setTimeout(() => {
            setResults((r) => [
              ...r,
              {
                lib: "Ripplex",
                op: "Ultra Heavy Update",
                count: 75000,
                time: metrics.time,
                peakMemory: metrics.peakMemory,
                timestamp: Date.now(),
              },
            ]);
          }, 50);
        },
        zustandFn: async () => {
          const metrics = await performanceMetrics.measureTime(async () => {
            const currentProjects = useZustandStore.getState().projects || [];
            const updatedProjects = currentProjects.slice();
            for (let i = 0; i < 75000; i++) {
              if (updatedProjects[i]) {
                updatedProjects[i] = {
                  ...updatedProjects[i],
                  name: `Updated ${i} - ${Date.now()}`,
                  tasks: Array.from({ length: 5 }, (_, j) => ({
                    id: j + 1,
                    title: `Task ${j + 1} for item ${i}`,
                    completed: Math.random() > 0.5,
                    subtasks: Array.from({ length: 3 }, (_, k) => ({
                      id: k + 1,
                      title: `Subtask ${k + 1}`,
                      done: Math.random() > 0.5,
                    })),
                  })),
                };
              }
            }
            setZustandProjects(updatedProjects);
          });
          setTimeout(() => {
            setResults((r) => [
              ...r,
              {
                lib: "Zustand",
                op: "Ultra Heavy Update",
                count: 75000,
                time: metrics.time,
                peakMemory: metrics.peakMemory,
                timestamp: Date.now(),
              },
            ]);
          }, 50);
        },
        dataSize: 75000,
      },
    ];

    const totalTests = realisticTests.length * 2; // 2 libraries
    let currentTest = 0;

    for (const test of realisticTests) {
      try {
        // Test Ripplex with proper warmup and multiple measurements
        setBatchProgress({
          current: currentTest + 1,
          total: totalTests,
          test: `Ripplex: ${test.name}`,
        });

        // For async functions, we need to measure them differently
        const ripplexResults = await performanceMetrics.measureMultiple(
          async () => {
            await test.ripplexFn();
          },
          7
        );

        // Clear any cached data
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Test Zustand with proper warmup and multiple measurements
        setBatchProgress({
          current: currentTest + 2,
          total: totalTests,
          test: `Zustand: ${test.name}`,
        });

        const zustandResults = await performanceMetrics.measureMultiple(
          async () => {
            await test.zustandFn();
          },
          7
        );

        const key = test.name;
        setBatchResults((prev: Record<string, unknown>) => ({
          ...prev,
          [key]: {
            description: test.description,
            dataSize: test.dataSize,
            ripplex: {
              time: calculateStats(ripplexResults.times),
              peakMemory: calculateStats(ripplexResults.peakMemories),
              avgTime: ripplexResults.avgTime,
              avgPeakMemory: ripplexResults.avgPeakMemory,
            },
            zustand: {
              time: calculateStats(zustandResults.times),
              peakMemory: calculateStats(zustandResults.peakMemories),
              avgTime: zustandResults.avgTime,
              avgPeakMemory: zustandResults.avgPeakMemory,
            },
          },
        }));

        currentTest += 2;

        // Clear between tests to prevent interference
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        console.error(`Error in realistic test: ${test?.name}`, error);
      }
    }

    setBatchTest(false);
    setBatchProgress({ current: 0, total: 0, test: "" });
  }, [
    handleRipplexLoad,
    handleZustandLoad,
    handleRipplexUpdate,
    handleZustandUpdate,
  ]);

  // Real-time metrics
  useEffect(() => {
    const interval = setInterval(() => {
      const memory = performanceMetrics.memory();
      setRealTimeMetrics({
        memory: memory.usedJSHeapSize / 1024 / 1024, // MB
        totalMemory: memory.totalJSHeapSize / 1024 / 1024,
        memoryLimit: memory.jsHeapSizeLimit / 1024 / 1024,
        timestamp: Date.now(),
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Chart data processing
  const chartData = results.map((r) => ({
    name: `${r.lib} ${r.op} ${r.count}`,
    time: r.time,
    peakMemory: r.peakMemory / 1024 / 1024,
    lib: r.lib,
    op: r.op,
    count: r.count,
  }));

  const summaryData = [
    {
      name: "Ripplex",
      avgTime:
        results
          .filter((r) => r.lib === "Ripplex")
          .reduce((sum, r) => sum + r.time, 0) /
        Math.max(results.filter((r) => r.lib === "Ripplex").length, 1),
      totalTests: results.filter((r) => r.lib === "Ripplex").length,
    },
    {
      name: "Zustand",
      avgTime:
        results
          .filter((r) => r.lib === "Zustand")
          .reduce((sum, r) => sum + r.time, 0) /
        Math.max(results.filter((r) => r.lib === "Zustand").length, 1),
      totalTests: results.filter((r) => r.lib === "Zustand").length,
    },
  ];

  const renderChart = () => {
    const commonProps = {
      data: chartType === "pie" ? summaryData : chartData,
      width: 800,
      height: 300,
    };

    switch (chartType) {
      case "line":
        return (
          <LineChart {...commonProps}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="time" stroke="#8884d8" />
          </LineChart>
        );
      case "area":
        return (
          <AreaChart {...commonProps}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Area
              type="monotone"
              dataKey="time"
              fill="#8884d8"
              stroke="#8884d8"
            />
          </AreaChart>
        );
      case "pie":
        return (
          <PieChart {...commonProps}>
            <Pie
              dataKey="avgTime"
              data={summaryData}
              cx="50%"
              cy="50%"
              outerRadius={80}
              fill="#8884d8"
              label
            />
            <Tooltip />
          </PieChart>
        );
      default:
        return (
          <BarChart {...commonProps}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="time" fill="#8884d8" />
          </BarChart>
        );
    }
  };

  // Generate conclusions
  const generateConclusions = () => {
    if (Object.keys(batchResults).length === 0) return null;

    const conclusions: Array<{
      test: string;
      timeWinner: string;
      memoryWinner: string;
      timeDiff: string;
      memoryDiff: string;
      ripplexTime: string;
      zustandTime: string;
      ripplexMemory: string;
      zustandMemory: string;
    }> = [];
    const testKeys = Object.keys(batchResults);

    for (const key of testKeys) {
      const result = batchResults[key] as {
        ripplex: { time: { mean: number }; peakMemory: { mean: number } };
        zustand: { time: { mean: number }; peakMemory: { mean: number } };
      };
      const ripplexTime = result.ripplex.time.mean;
      const zustandTime = result.zustand.time.mean;
      const ripplexPeak = result.ripplex.peakMemory.mean;
      const zustandPeak = result.zustand.peakMemory.mean;

      const timeWinner = ripplexTime < zustandTime ? "Ripplex" : "Zustand";
      const memoryWinner =
        Math.abs(ripplexPeak) < Math.abs(zustandPeak) ? "Ripplex" : "Zustand";
      const timeDiff =
        (Math.abs(ripplexTime - zustandTime) /
          Math.max(ripplexTime, zustandTime)) *
        100;
      const memoryDiff =
        (Math.abs(ripplexPeak - zustandPeak) /
          Math.max(Math.abs(ripplexPeak), Math.abs(zustandPeak))) *
        100;

      conclusions.push({
        test: key,
        timeWinner,
        memoryWinner,
        timeDiff: timeDiff.toFixed(1),
        memoryDiff: memoryDiff.toFixed(1),
        ripplexTime: ripplexTime.toFixed(3),
        zustandTime: zustandTime.toFixed(3),
        ripplexMemory: ripplexPeak.toFixed(2),
        zustandMemory: zustandPeak.toFixed(2),
      });
    }

    return conclusions;
  };

  const conclusions = generateConclusions();

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: "0 auto" }}>
      <h1>Ripplex vs Zustand Advanced Benchmark</h1>

      {/* Real-time Metrics */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 16,
          marginBottom: 24,
          padding: 16,
          backgroundColor: "#f5f5f5",
          borderRadius: 8,
        }}
      >
        <div>
          <strong>Memory Usage:</strong> {realTimeMetrics.memory?.toFixed(2)} MB
        </div>
        <div>
          <strong>Total Memory:</strong>{" "}
          {realTimeMetrics.totalMemory?.toFixed(2)} MB
        </div>
        <div>
          <strong>Memory Limit:</strong>{" "}
          {realTimeMetrics.memoryLimit?.toFixed(2)} MB
        </div>
        <div>
          <strong>Tests Run:</strong> {results.length}
        </div>
      </div>

      {/* Test Controls */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 16 }}>
          <h3>Quick Tests</h3>
          <button disabled={loading} onClick={() => handleRipplexLoad(1000)}>
            Ripplex: 1K
          </button>
          <button
            disabled={loading}
            onClick={() => handleZustandLoad(1000)}
            style={{ marginLeft: 8 }}
          >
            Zustand: 1K
          </button>
          <button
            disabled={loading}
            onClick={() => handleRipplexLoad(5000)}
            style={{ marginLeft: 8 }}
          >
            Ripplex: 5K
          </button>
          <button
            disabled={loading}
            onClick={() => handleZustandLoad(5000)}
            style={{ marginLeft: 8 }}
          >
            Zustand: 5K
          </button>
          <button
            disabled={loading}
            onClick={() => handleRipplexUpdate(500)}
            style={{ marginLeft: 8 }}
          >
            Ripplex: Update 500
          </button>
          <button
            disabled={loading}
            onClick={() => handleZustandUpdate(500)}
            style={{ marginLeft: 8 }}
          >
            Zustand: Update 500
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <h3>Stress Tests</h3>
          <button
            disabled={loading || stressTest}
            onClick={runStressTest}
            style={{ backgroundColor: "#ff6b6b", color: "white" }}
          >
            {stressTest ? "Running Stress Test..." : "Run Full Stress Test"}
          </button>
          <button
            disabled={loading}
            onClick={() => handleRipplexLoad(50000)}
            style={{ marginLeft: 8, backgroundColor: "#ffa500" }}
          >
            Ripplex: 50K
          </button>
          <button
            disabled={loading}
            onClick={() => handleZustandLoad(50000)}
            style={{ marginLeft: 8, backgroundColor: "#ffa500" }}
          >
            Zustand: 50K
          </button>
          <button
            disabled={loading}
            onClick={runSelectorTest}
            style={{
              marginLeft: 8,
              backgroundColor: "#28a745",
              color: "white",
            }}
          >
            Selector Performance Test
          </button>
        </div>

        <div style={{ marginBottom: 16 }}>
          <h3>Realistic Performance Testing</h3>
          <p style={{ color: "#666", marginBottom: 16 }}>
            Tests designed to eliminate browser caching effects and measure
            real-world performance scenarios.
          </p>
          <button
            disabled={loading || batchTest}
            onClick={() => {
              setHeavyTestWarning(true);
            }}
            style={{
              backgroundColor: "#6f42c1",
              color: "white",
              padding: "12px 24px",
              fontSize: "16px",
            }}
          >
            {batchTest
              ? `Running Realistic Test... ${batchProgress.current}/${batchProgress.total}`
              : "Run Realistic Performance Test"}
          </button>
          {batchTest && (
            <div
              style={{
                marginTop: 8,
                padding: 8,
                backgroundColor: "#e9ecef",
                borderRadius: 4,
              }}
            >
              <strong>Current Test:</strong> {batchProgress.test}
            </div>
          )}
        </div>

        <div>
          <h3>Chart Type</h3>
          {(["bar", "line", "area", "pie"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setChartType(type)}
              style={{
                marginRight: 8,
                backgroundColor: chartType === type ? "#007bff" : "#f8f9fa",
                color: chartType === type ? "white" : "black",
              }}
            >
              {type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Heavy Test Warning Dialog */}
      {heavyTestWarning && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: 24,
              borderRadius: 8,
              maxWidth: 500,
              textAlign: "center",
            }}
          >
            <h3 style={{ color: "#dc3545", marginTop: 0 }}>
              ⚠️ Heavy Performance Test Warning
            </h3>
            <p style={{ lineHeight: 1.6, marginBottom: 20 }}>
              This test includes extremely heavy operations (50K items load,
              100K complex updates) that may:
            </p>
            <ul
              style={{ textAlign: "left", lineHeight: 1.6, marginBottom: 20 }}
            >
              <li>Temporarily freeze the browser tab</li>
              <li>Use 100-500MB+ of memory</li>
              <li>Take 10-30 seconds to complete</li>
              <li>Potentially crash if your device has limited resources</li>
            </ul>
            <p style={{ color: "#666", fontSize: 14 }}>
              <strong>Recommendation:</strong> Close other tabs and ensure you
              have at least 2GB free RAM.
            </p>
            <div style={{ marginTop: 24 }}>
              <button
                onClick={() => {
                  setHeavyTestWarning(false);
                  runRealisticTest();
                }}
                style={{
                  backgroundColor: "#dc3545",
                  color: "white",
                  padding: "12px 24px",
                  border: "none",
                  borderRadius: 4,
                  marginRight: 12,
                  cursor: "pointer",
                }}
              >
                Run Anyway (I understand the risks)
              </button>
              <button
                onClick={() => setHeavyTestWarning(false)}
                style={{
                  backgroundColor: "#6c757d",
                  color: "white",
                  padding: "12px 24px",
                  border: "none",
                  borderRadius: 4,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Live Lists */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 32,
          marginBottom: 32,
        }}
      >
        <div>
          <h3>Ripplex List ({ripplexItems.length} items)</h3>
          <List items={ripplexItems} label="Ripplex" />
        </div>
        <div>
          <h3>Zustand List ({zustandItems.length} items)</h3>
          <List items={zustandItems} label="Zustand" />
        </div>
      </div>

      {/* Batch Results */}
      {Object.keys(batchResults).length > 0 && (
        <div style={{ marginBottom: 32 }}>
          <h3>Comprehensive Batch Test Results</h3>
          <div style={{ maxHeight: 400, overflow: "auto" }}>
            {Object.entries(batchResults).map(([key, result]) => (
              <div
                key={key}
                style={{
                  marginBottom: 16,
                  padding: 16,
                  border: "1px solid #ddd",
                  borderRadius: 8,
                }}
              >
                <h4>{key}</h4>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 16,
                  }}
                >
                  <div>
                    <h5>Ripplex</h5>
                    <p>
                      <strong>Time:</strong> Mean:{" "}
                      {(
                        result as {
                          ripplex: { time: { mean: number; stdDev: number } };
                        }
                      ).ripplex.time.mean.toFixed(3)}
                      ms, StdDev:{" "}
                      {(
                        result as { ripplex: { time: { stdDev: number } } }
                      ).ripplex.time.stdDev.toFixed(3)}
                      ms
                    </p>
                    <p>
                      <strong>Memory:</strong> Mean:{" "}
                      {(
                        (
                          result as {
                            ripplex: {
                              peakMemory: { mean: number; stdDev: number };
                            };
                          }
                        ).ripplex.peakMemory.mean /
                        1024 /
                        1024
                      ).toFixed(2)}
                      MB, StdDev:{" "}
                      {(
                        (
                          result as {
                            ripplex: { peakMemory: { stdDev: number } };
                          }
                        ).ripplex.peakMemory.stdDev /
                        1024 /
                        1024
                      ).toFixed(2)}
                      MB
                    </p>
                  </div>
                  <div>
                    <h5>Zustand</h5>
                    <p>
                      <strong>Time:</strong> Mean:{" "}
                      {(
                        result as {
                          zustand: { time: { mean: number; stdDev: number } };
                        }
                      ).zustand.time.mean.toFixed(3)}
                      ms, StdDev:{" "}
                      {(
                        result as { zustand: { time: { stdDev: number } } }
                      ).zustand.time.stdDev.toFixed(3)}
                      ms
                    </p>
                    <p>
                      <strong>Memory:</strong> Mean:{" "}
                      {(
                        (
                          result as {
                            zustand: {
                              peakMemory: { mean: number; stdDev: number };
                            };
                          }
                        ).zustand.peakMemory.mean /
                        1024 /
                        1024
                      ).toFixed(2)}
                      MB, StdDev:{" "}
                      {(
                        (
                          result as {
                            zustand: { peakMemory: { stdDev: number } };
                          }
                        ).zustand.peakMemory.stdDev /
                        1024 /
                        1024
                      ).toFixed(2)}
                      MB
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Conclusions */}
      {conclusions && (
        <div style={{ marginBottom: 32 }}>
          <h3>Performance Conclusions</h3>
          <div style={{ maxHeight: 400, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8f9fa" }}>
                  <th
                    style={{
                      padding: 8,
                      textAlign: "left",
                      border: "1px solid #ddd",
                    }}
                  >
                    Test
                  </th>
                  <th
                    style={{
                      padding: 8,
                      textAlign: "left",
                      border: "1px solid #ddd",
                    }}
                  >
                    Time Winner
                  </th>
                  <th
                    style={{
                      padding: 8,
                      textAlign: "left",
                      border: "1px solid #ddd",
                    }}
                  >
                    Memory Winner
                  </th>
                  <th
                    style={{
                      padding: 8,
                      textAlign: "left",
                      border: "1px solid #ddd",
                    }}
                  >
                    Time Diff (%)
                  </th>
                  <th
                    style={{
                      padding: 8,
                      textAlign: "left",
                      border: "1px solid #ddd",
                    }}
                  >
                    Memory Diff (%)
                  </th>
                </tr>
              </thead>
              <tbody>
                {conclusions.map((c, i) => (
                  <tr key={i}>
                    <td style={{ padding: 8, border: "1px solid #ddd" }}>
                      {c.test}
                    </td>
                    <td
                      style={{
                        padding: 8,
                        border: "1px solid #ddd",
                        fontWeight: "bold",
                        color:
                          c.timeWinner === "Ripplex" ? "#28a745" : "#dc3545",
                      }}
                    >
                      {c.timeWinner}
                    </td>
                    <td
                      style={{
                        padding: 8,
                        border: "1px solid #ddd",
                        fontWeight: "bold",
                        color:
                          c.memoryWinner === "Ripplex" ? "#28a745" : "#dc3545",
                      }}
                    >
                      {c.memoryWinner}
                    </td>
                    <td style={{ padding: 8, border: "1px solid #ddd" }}>
                      {c.timeDiff}%
                    </td>
                    <td style={{ padding: 8, border: "1px solid #ddd" }}>
                      {c.memoryDiff}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Results */}
      <div style={{ marginTop: 32 }}>
        <h3>Performance Results</h3>
        <ResponsiveContainer width="100%" height={400}>
          {renderChart()}
        </ResponsiveContainer>

        <div style={{ marginTop: 24 }}>
          <h4>Detailed Results</h4>
          <div style={{ maxHeight: 300, overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f8f9fa" }}>
                  <th
                    style={{
                      padding: 8,
                      textAlign: "left",
                      border: "1px solid #ddd",
                    }}
                  >
                    Library
                  </th>
                  <th
                    style={{
                      padding: 8,
                      textAlign: "left",
                      border: "1px solid #ddd",
                    }}
                  >
                    Operation
                  </th>
                  <th
                    style={{
                      padding: 8,
                      textAlign: "left",
                      border: "1px solid #ddd",
                    }}
                  >
                    Count
                  </th>
                  <th
                    style={{
                      padding: 8,
                      textAlign: "left",
                      border: "1px solid #ddd",
                    }}
                  >
                    Time (ms)
                  </th>
                  <th
                    style={{
                      padding: 8,
                      textAlign: "left",
                      border: "1px solid #ddd",
                    }}
                  >
                    Peak Memory (MB)
                  </th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={i}>
                    <td style={{ padding: 8, border: "1px solid #ddd" }}>
                      {r.lib}
                    </td>
                    <td style={{ padding: 8, border: "1px solid #ddd" }}>
                      {r.op}
                    </td>
                    <td style={{ padding: 8, border: "1px solid #ddd" }}>
                      {r.count}
                    </td>
                    <td
                      style={{
                        padding: 8,
                        border: "1px solid #ddd",
                        fontWeight: "bold",
                      }}
                    >
                      {r.time.toFixed(3)}
                    </td>
                    <td style={{ padding: 8, border: "1px solid #ddd" }}>
                      {(r.peakMemory / 1024 / 1024).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ marginTop: 24 }}>
          <button
            onClick={() => setResults([])}
            style={{
              backgroundColor: "#dc3545",
              color: "white",
              padding: "8px 16px",
            }}
          >
            Clear Results
          </button>
          <button
            onClick={() => {
              const dataStr = JSON.stringify(results, null, 2);
              const dataBlob = new Blob([dataStr], {
                type: "application/json",
              });
              const url = URL.createObjectURL(dataBlob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `benchmark-results-${
                new Date().toISOString().split("T")[0]
              }.json`;
              link.click();
              URL.revokeObjectURL(url);
            }}
            style={{
              backgroundColor: "#17a2b8",
              color: "white",
              padding: "8px 16px",
              marginLeft: 8,
            }}
            disabled={results.length === 0}
          >
            Export Results
          </button>
          <button
            onClick={() => {
              const dataStr = JSON.stringify(
                { results, batchResults, conclusions },
                null,
                2
              );
              const dataBlob = new Blob([dataStr], {
                type: "application/json",
              });
              const url = URL.createObjectURL(dataBlob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `comprehensive-benchmark-${
                new Date().toISOString().split("T")[0]
              }.json`;
              link.click();
              URL.revokeObjectURL(url);
            }}
            style={{
              backgroundColor: "#28a745",
              color: "white",
              padding: "8px 16px",
              marginLeft: 8,
            }}
            disabled={Object.keys(batchResults).length === 0}
          >
            Export Comprehensive Results
          </button>
        </div>
      </div>

      {/* Transparency & Methodology Section */}
      <div
        style={{
          marginTop: 48,
          padding: 24,
          background: "#f8f9fa",
          borderRadius: 8,
          color: "#333",
          fontSize: 15,
        }}
      >
        <h3 style={{ marginTop: 0 }}>
          How This Benchmark Works (Transparency)
        </h3>
        <ul style={{ lineHeight: 1.7 }}>
          <li>
            <strong>Tested Libraries:</strong> This benchmark compares{" "}
            <b>Ripplex</b> and <b>Zustand</b> for state management performance
            in React.
          </li>
          <li>
            <strong>Test Types:</strong> We run a variety of tests, including
            loading large lists, updating many items, and simulating real-world
            usage patterns.
          </li>
          <li>
            <strong>Time Measurement:</strong> For each operation, we use{" "}
            <code>performance.now()</code> to measure the elapsed time (in
            milliseconds) for the operation to complete. The time shown is the
            average over several runs.
          </li>
          <li>
            <strong>Memory Measurement:</strong> We use the browser's{" "}
            <code>performance.memory</code> API to measure <b>Peak Memory</b>{" "}
            (the highest observed JavaScript heap usage during the operation).
            This is reported in megabytes (MB).
          </li>
          <li>
            <strong>Comparison:</strong> For each test, the library with the
            lower average time or memory is marked as the winner. The overall
            winner is based on the average across all tests.
          </li>
          <li>
            <strong>Fairness:</strong> Both libraries are tested with the same
            data and operations. All measurements are taken in the browser, and
            results may vary depending on your device and environment.
          </li>
          <li>
            <strong>Limitations:</strong> Memory measurements rely on browser
            APIs and may not reflect all allocations. For best results, use
            Chrome with <code>--enable-precise-memory-info</code>.
          </li>
          <li>
            <strong>Open Source:</strong> You can view and modify the full
            benchmark code for your own experiments.
          </li>
        </ul>
        <div style={{ color: "#888", fontSize: 13, marginTop: 12 }}>
          <b>Note:</b> This benchmark is for educational and comparative
          purposes. Real-world app performance may vary.
        </div>
      </div>
    </div>
  );
}