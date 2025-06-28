import "./App.css";
import { useRipple, useRippleEffect, emit } from "ripplex";
import { ripple } from "../lib";
import { todoStore } from "./ripples/rippleStore";
import { useNavigate } from "react-router-dom";

interface OrderWrapper {
  order: {
    status: boolean;
  };
}

// Store
const orderStore = {
  orders: ripple<OrderWrapper[]>(
    Array.from({ length: 1000 }, () => ({ order: { status: false } }))
  ),
};

const user = ripple({
  name: "Alice",
  profile: {
    bio: "Developer",
    twitter: "@alice",
  },
});

function UserProfile() {
  const name = useRipple(user, (u) => u.name);
  const bio = useRipple(user, (u) => u.profile.bio);
  return (
    <div>
      {name} - {bio}
    </div>
  );
}

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
  const navigate = useNavigate();

  useRippleEffect(
    "fetch:todos",
    async (_, tools) => {
      const res = await fetch("https://jsonplaceholder.typicode.com/todos");
      if (tools?.aborted()) return;
      if (!res.ok) throw new Error("Failed to fetch todos");
      const data = await res.json();
      todoStore.value = { ...todoStore.value, title: data[0]?.title };
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

  const updateName = () => {
    user.value.profile.bio = "Fullstack Dev " + Math.round(Math.random() * 100);
  };

  const title = useRipple(todoStore, (t: any) => t.title);
  const loading = useRipple(todoStore, (t: any) => t.loading);
  const error = useRipple(todoStore, (t: any) => t.error);

  const user = ripple({
    name: "Rishik",
    profile: {
      bio: "Developer",
      twitter: "@rishik",
    },
  });

  console.log(user.value.name);
  user.value.profile.bio = "Updated";

  // console.log(proxyUser.value.name);
  // console.log(proxyUser.value.profile.bio);
  // proxyUser.value.profile.bio = "Fullstack Dev";
  // console.log(proxyUser.value.profile.bio);

  return (
    <div style={{ padding: "20px", fontFamily: "Arial, sans-serif" }}>
      <button onClick={() => navigate("/compare")}>
        Ripplex vs Zustand Testing
      </button>
      <button onClick={() => navigate("/specific")}>
        Ripplex Specific Testing
      </button>
      <h1>Ripplex Nested Update Test</h1>

      <UserProfile />
      <button onClick={updateName}>Change Bio</button>

      <h2>{title}</h2>
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
      {error && <div style={{ color: "red" }}>{String(error)}</div>}

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
          Mark All as Done
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
