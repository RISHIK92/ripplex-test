import React from "react";
import { useEffect, useRef } from "react";
import { useRipple, emit, ripple, useRippleEffect } from "ripplex-core";

const counter = ripple(0);
const doubled = ripple(0);

const BasicReactivityTest = () => {
  const renderCount = useRef(0);
  renderCount.current += 1;
  doubled.value = counter.value * 2;
  return (
    <div style={{ padding: "10px", border: "1px solid #ccc", margin: "10px" }}>
      <h4>Basic Reactivity Test</h4>
      <p>Counter: {useRipple(counter)}</p>
      <p>Doubled: {useRipple(doubled)}</p>
      <p>Renders: {renderCount.current}</p>
      <button onClick={() => (counter.value += 1)}>Increment</button>
    </div>
  );
};

const SelectiveSubscriptionTest = () => {
  const product = ripple({
    id: 1,
    name: "Test Product",
    price: 100,
    description: "A test product",
  });

  const NameComponent = React.memo(() => {
    const name = useRipple(product, (p) => p.name);
    const renderCount = useRef(0);
    renderCount.current += 1;

    return (
      <div style={{ padding: "5px", border: "1px solid #ddd", margin: "5px" }}>
        Name: {name} (Renders: {renderCount.current})
      </div>
    );
  });

  const PriceComponent = React.memo(() => {
    const price = useRipple(product, (p) => p.price);
    const renderCount = useRef(0);
    renderCount.current += 1;

    return (
      <div style={{ padding: "5px", border: "1px solid #ddd", margin: "5px" }}>
        Price: ${price} (Renders: {renderCount.current})
      </div>
    );
  });

  return (
    <div style={{ padding: "10px", border: "1px solid #ccc", margin: "10px" }}>
      <h4>Selective Subscription Test</h4>
      <NameComponent />
      <PriceComponent />
      <button
        onClick={() => {
          product.value = { ...product.value, name: `Product ${Date.now()}` };
        }}
      >
        Update Name (should only re-render NameComponent)
      </button>
      <button
        onClick={() => {
          product.value = {
            ...product.value,
            price: Math.floor(Math.random() * 1000),
          };
        }}
      >
        Update Price (should only re-render PriceComponent)
      </button>
      <button
        onClick={() => {
          product.value = {
            ...product.value,
            description: `Desc ${Date.now()}`,
          };
        }}
      >
        Update Description (should re-render neither)
      </button>
    </div>
  );
};

export const loadingStore = ripple<{
  message: string[];
  fruit: { theme: string }[];
  loading: boolean;
  error: any;
}>({
  message: [],
  fruit: [{ theme: "dark" }],
  loading: false,
  error: null,
});

const EventBasedTest = () => {
  useRippleEffect(
    "user-action",
    async (payload: any) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      loadingStore.value.message = [
        ...loadingStore.value.message,
        `Action: ${payload} at ${new Date().toLocaleTimeString()}`,
      ];
    },
    loadingStore
  );
  const toggleTheme = () => {
    const toggleTheme = () => {
      loadingStore.value.fruit = loadingStore.value.fruit.map((f, i) =>
        i === 0 ? { ...f, theme: f.theme === "dark" ? "light" : "dark" } : f
      );
    };
  };

  const loading = useRipple(loadingStore, (s) => s.loading);
  const error = useRipple(loadingStore, (s) => s.error);
  const messageLog = useRipple(loadingStore, (s) => s.message);
  const fruit = useRipple(loadingStore, (s) => s.fruit);

  const triggerAction = (action: string) => {
    emit("user-action", action);
  };

  return (
    <div style={{ padding: "10px", border: "1px solid #ccc", margin: "10px" }}>
      <h4>Event-Based Communication Test</h4>
      <p>Status: {loading ? "Processing..." : "Ready"}</p>
      {error && <p style={{ color: "red" }}>Error: {String(error)}</p>}
      <div>
        <button onClick={() => triggerAction("login")} disabled={loading}>
          Trigger Login Event
        </button>
        <ul>
          {fruit.map((item, i) => (
            <li key={i}>{JSON.stringify(item)}</li>
          ))}
        </ul>
        <button onClick={toggleTheme}>click</button>
        <button onClick={() => triggerAction("logout")} disabled={loading}>
          Trigger Logout Event
        </button>
      </div>
      <div style={{ marginTop: "10px", maxHeight: "150px", overflow: "auto" }}>
        <h5>Message Log:</h5>
        {messageLog.map(
          (
            msg:
              | string
              | number
              | bigint
              | boolean
              | React.ReactElement<
                  unknown,
                  string | React.JSXElementConstructor<any>
                >
              | Iterable<React.ReactNode>
              | React.ReactPortal
              | Promise<
                  | string
                  | number
                  | bigint
                  | boolean
                  | React.ReactPortal
                  | React.ReactElement<
                      unknown,
                      string | React.JSXElementConstructor<any>
                    >
                  | Iterable<React.ReactNode>
                >,
            i: React.Key
          ) => (
            <div key={i} style={{ fontSize: "12px", padding: "2px" }}>
              {msg}
            </div>
          )
        )}
      </div>
    </div>
  );
};

const appState = ripple.immer({
  user: { name: "John", age: 30 },
  settings: {
    theme: {
      themeInside: { theme2: { theme3: { theme4: "dark" } } },
      notifications: true,
    },
    loading: [],
  },
});

const ObjectMutationTest = () => {
  const renderCount = useRef(0);
  renderCount.current += 1;
  const userName = useRipple(appState, (s) => s.user.name);
  const userAge = useRipple(appState, (s) => s.user.age);
  const theme = useRipple(
    appState,
    (s) => s.settings.theme.themeInside.theme2.theme3.theme4
  );

  return (
    <div style={{ padding: "10px", border: "1px solid #ccc", margin: "10px" }}>
      <h4>Object Mutation Test (Renders: {renderCount.current})</h4>
      <p>
        User: {userName}, Age: {userAge}
      </p>
      <p>Theme: {theme}</p>
      <button
        onClick={() => {
          appState.value = {
            ...appState.value,
            user: {
              ...appState.value.user,
              name: `User${Math.floor(Math.random() * 100)}`,
            },
          };
        }}
      >
        Mutate User Name
      </button>

      {/* <button
        onClick={() => {
          appState.value = {
            ...appState.value,
            user: {
              ...appState.value.user,
              age: Math.floor(Math.random() * 100),
            },
          };
        }}
      >
        Mutate User Age
      </button> */}

      <button
        onClick={() => {
          appState.update((draft) => {
            draft.user.age = Math.floor(Math.random() * 100);
          });
        }}
      >
        Mutate User Age
      </button>

      <button
        onClick={() =>
          appState.update((draft) => {
            draft.settings.theme.themeInside.theme2.theme3.theme4 =
              draft.settings.theme.themeInside.theme2.theme3.theme4 === "dark"
                ? "light"
                : "dark";
          })
        }
      >
        Toggle Theme
      </button>
    </div>
  );
};

const items = ripple(
  Array.from({ length: 1000 }, (_, i) => ({ id: i, value: i }))
);
const filter = ripple("");
type Item = { id: number; value: number };

const filteredItems = ripple<Item[]>([]);

const PerformanceTest = () => {
  const itemsList = useRipple(items);
  const filtered = useRipple(filteredItems);
  const currentFilter = useRipple(filter);

  useEffect(() => {
    const filterValue = currentFilter.toLowerCase();
    filteredItems.value = itemsList.filter((item) =>
      item.value.toString().includes(filterValue)
    );
  }, [currentFilter, itemsList]);

  return (
    <div style={{ padding: "10px", border: "1px solid #ccc", margin: "10px" }}>
      <h4>Performance Test</h4>
      <input
        type="text"
        placeholder="Filter items..."
        value={currentFilter}
        onChange={(e) => (filter.value = e.target.value)}
      />
      <p>
        Showing {filtered.length} of {itemsList.length} items
      </p>
      <div style={{ maxHeight: "200px", overflow: "auto" }}>
        {filtered.slice(0, 50).map((item: any) => (
          <div key={item.id} style={{ padding: "2px" }}>
            Item {item.id}: {item.value}
          </div>
        ))}
      </div>
      <button
        onClick={() => {
          const newItems = [...items.value]; // trigger reactivity
          const randomIndex = Math.floor(Math.random() * newItems.length);
          newItems[randomIndex] = {
            ...newItems[randomIndex],
            value: Math.floor(Math.random() * 1000),
          };
          items.value = newItems;
        }}
      >
        Update Random Item
      </button>
    </div>
  );
};

// Main Component
export default function RipplexTests() {
  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Corrected Ripplex Tests</h1>
      <p style={{ color: "#666", marginBottom: "20px" }}>
        These tests properly demonstrate Ripplex features using the correct
        APIs.
      </p>

      <BasicReactivityTest />
      <SelectiveSubscriptionTest />
      <EventBasedTest />
      <ObjectMutationTest />
      <PerformanceTest />

      <div
        style={{
          marginTop: "30px",
          padding: "15px",
          backgroundColor: "#e8f5e8",
          border: "1px solid #28a745",
        }}
      >
        <h3>Expected Behaviors:</h3>
        <ul>
          <li>Selective subscriptions should prevent unnecessary re-renders</li>
          <li>
            Events should properly handle async operations with loading states
          </li>
          <li>Object mutations should be detected through the proxy system</li>
          <li>Performance should remain good even with many items</li>
          <li>
            Derived state should update automatically when dependencies change
          </li>
        </ul>
      </div>
    </div>
  );
}
