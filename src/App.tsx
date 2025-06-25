import "./App.css";
import { ripple, useRipple, useRippleEffect, emit } from "ripplex";
import { todoStore } from "./ripples/rippleStore";

interface OrderWrapper {
  order: {
    status: boolean;
  };
}

const orderStore = {
  orders: ripple<OrderWrapper[]>(
    Array.from({ length: 1000 }, () => ({ order: { status: false } }))
  ),
};

function OrderStatus({ index }: { index: number }) {
  const status = useRipple(
    orderStore.orders,
    (orders) => orders[index].order.status
  );

  return (
    <p>
      #{index}: <strong>{status ? "Done" : "Pending"}</strong>
    </p>
  );
}

function App() {
  useRippleEffect(
    "fetch:todos",
    async (_, tools) => {
      const res = await fetch("https://jsonplaceholder.typicode.com/todos");
      if (tools?.aborted()) return;

      if (!res.ok) throw new Error("Failed to fetch todos");
      const data = await res.json();

      todoStore.todos.value = data;
    },
    todoStore
  );

  const handleReset = () => {
    orderStore.orders.value.forEach((order) => {
      order.order.status = false;
    });
  };

  const handleMarkFirst10 = () => {
    for (let i = 0; i < 2000 && i < orderStore.orders.value.length; i++) {
      orderStore.orders.value[i].order.status = true;
    }
  };

  const todos = useRipple(todoStore.todos);
  const loading = useRipple(todoStore.loading);
  const error = useRipple(todoStore.error);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <h1>Ripplex Nested Update Test</h1>
      <ul>
        {todos.map((todo) => (
          <li key={todo.id}>
            {todo.title} {todo.completed ? "(Done)" : "(Pending)"}
          </li>
        ))}
      </ul>
      <button
        onClick={() => emit("fetch:todos")}
        style={{
          padding: "10px 20px",
          backgroundColor: "#007bff",
          color: "white",
          border: "none",
          borderRadius: "5px",
          cursor: "pointer",
        }}
      >
        Fetch Todos
      </button>
      {loading && "loading..."}
      {error && String(error)}
      <div style={{ marginBottom: "20px", display: "flex", gap: "10px" }}>
        <button
          onClick={handleMarkFirst10}
          style={{
            padding: "10px 20px",
            backgroundColor: "#28a745",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Mark First All as Done
        </button>
        <button
          onClick={handleReset}
          style={{
            padding: "10px 20px",
            backgroundColor: "#dc3545",
            color: "white",
            border: "none",
            borderRadius: "5px",
            cursor: "pointer",
          }}
        >
          Reset All
        </button>
      </div>
      <div
        style={{
          maxHeight: "80vh",
          overflowY: "scroll",
          border: "1px solid #ddd",
          borderRadius: "5px",
          padding: "10px",
        }}
      >
        {Array.from({ length: 1000 }, (_, i) => (
          <OrderStatus key={i} index={i} />
        ))}
      </div>
    </div>
  );
}

export default App;
