import { render, act, screen, waitFor } from "@testing-library/react";
import { emit } from "../lib/core/eventBus";
import React, { useEffect } from "react";
import { ripple, useRipple, useRippleEffect } from "ripplex";

// Create the store outside the component, similar to your working code
const testStore = {
  loading: ripple(false),
  error: ripple(null),
  data: ripple([]),
};

// Reset the store before each test
beforeEach(() => {
  testStore.loading.value = false;
  testStore.error.value = null;
  testStore.data.value = [];
});

// Diagnostic test to understand what's happening
it("should diagnose useRippleEffect behavior", async () => {
  console.log("=== Diagnostic Test ===");

  // Test direct store manipulation first
  console.log("1. Testing direct store manipulation:");
  console.log("Initial loading:", testStore.loading.value);
  testStore.loading.value = true;
  console.log("After setting to true:", testStore.loading.value);
  testStore.loading.value = false;
  console.log("After setting to false:", testStore.loading.value);

  // Test the component
  const TestComponent = () => {
    console.log("2. Component rendering with store:", {
      loading: testStore.loading.value,
      error: testStore.error.value,
    });

    useRippleEffect(
      "DIAGNOSTIC_EVENT",
      async (payload, tools) => {
        console.log("3. Handler called with payload:", payload);
        console.log("4. Tools:", tools);
        console.log("5. Store before handler:", {
          loading: testStore.loading.value,
          error: testStore.error.value,
        });

        // Manual check of what useRippleEffect should be doing
        console.log("6. Checking if loading signal exists...");
        const loadingSignal = testStore?.loading;
        console.log("7. Loading signal:", loadingSignal);

        if (loadingSignal) {
          console.log("8. Setting loading to true manually");
          loadingSignal.value = true;
          console.log("9. Loading after manual set:", loadingSignal.value);
        }

        await new Promise((resolve) => setTimeout(resolve, 10));

        if (loadingSignal) {
          console.log("10. Setting loading to false manually");
          loadingSignal.value = false;
          console.log("11. Loading after manual set:", loadingSignal.value);
        }
      },
      testStore
    );

    const loading = useRipple(testStore.loading);
    const error = useRipple(testStore.error);

    useEffect(() => {
      console.log("12. useEffect - Loading changed:", loading);
    }, [loading]);

    return (
      <div>
        <span data-testid="loading">{loading ? "Loading" : "Idle"}</span>
        <span data-testid="error">{error ? "Error" : "None"}</span>
      </div>
    );
  };

  render(<TestComponent />);

  console.log("13. Initial render complete");
  expect(screen.getByTestId("loading").textContent).toBe("Idle");

  console.log("14. About to emit event");
  emit("DIAGNOSTIC_EVENT", "payload");

  await new Promise((resolve) => setTimeout(resolve, 50));

  console.log("15. After event processing");
  console.log("16. Final store state:", {
    loading: testStore.loading.value,
    error: testStore.error.value,
  });
});

// Test with the exact same pattern as your working code
it("should work exactly like the working app", async () => {
  const WorkingComponent = () => {
    // This is exactly like your working todoStore pattern
    useRippleEffect(
      "fetch:test",
      async (_, tools) => {
        console.log("Working handler called");
        console.log("Store at start:", {
          loading: testStore.loading.value,
          error: testStore.error.value,
        });

        const res = await new Promise((resolve) =>
          setTimeout(() => resolve({ ok: true, json: () => [{ id: 1 }] }), 10)
        );

        if (tools?.aborted()) return;

        console.log("Store at end:", {
          loading: testStore.loading.value,
          error: testStore.error.value,
        });
      },
      testStore // Passing exactly like your working code
    );

    const loading = useRipple(testStore.loading);
    const error = useRipple(testStore.error);

    console.log("Render - loading:", loading, "error:", error);

    return (
      <div>
        <span data-testid="loading">{loading ? "Loading" : "Idle"}</span>
        <span data-testid="error">{error ? "Error" : "None"}</span>
        <button onClick={() => emit("fetch:test")}>Fetch</button>
      </div>
    );
  };

  render(<WorkingComponent />);

  expect(screen.getByTestId("loading").textContent).toBe("Idle");

  // Click the button like in your working app
  const button = screen.getByText("Fetch");
  await act(async () => {
    button.click();
    await Promise.resolve();
  });

  // Check if loading changes
  try {
    await waitFor(
      () => {
        expect(screen.getByTestId("loading").textContent).toBe("Loading");
      },
      { timeout: 100 }
    );

    console.log("SUCCESS: Loading state changed to Loading");
  } catch (error) {
    console.log("FAILED: Loading state never changed");
    console.log("Current loading:", screen.getByTestId("loading").textContent);
    console.log("Store loading value:", testStore.loading.value);
    throw error;
  }
});

// Test to verify the useRippleEffect options parameter structure
it("should test different options structures", async () => {
  console.log("=== Testing Options Structures ===");

  // Test 1: Pass store directly (your current approach)
  const TestComponent1 = () => {
    useRippleEffect(
      "TEST_DIRECT_STORE",
      async () => {
        console.log("Handler 1 called - store direct");
        console.log("Store structure:", Object.keys(testStore));
        console.log("Loading ripple:", testStore.loading);
      },
      testStore
    );

    return <div data-testid="test1">Test 1</div>;
  };

  // Test 2: Pass as options object
  const TestComponent2 = () => {
    useRippleEffect(
      "TEST_OPTIONS_OBJECT",
      async () => {
        console.log("Handler 2 called - options object");
      },
      {
        loading: testStore.loading,
        error: testStore.error,
      }
    );

    return <div data-testid="test2">Test 2</div>;
  };

  // Test 3: Pass with loadingSignal
  const TestComponent3 = () => {
    useRippleEffect(
      "TEST_LOADING_SIGNAL",
      async () => {
        console.log("Handler 3 called - loadingSignal");
      },
      {
        loadingSignal: testStore.loading,
        errorSignal: testStore.error,
      }
    );

    return <div data-testid="test3">Test 3</div>;
  };

  const { rerender } = render(<TestComponent1 />);

  emit("TEST_DIRECT_STORE");
  await Promise.resolve();

  rerender(<TestComponent2 />);
  emit("TEST_OPTIONS_OBJECT");
  await Promise.resolve();

  rerender(<TestComponent3 />);
  emit("TEST_LOADING_SIGNAL");
  await Promise.resolve();

  expect(true).toBe(true);
});
