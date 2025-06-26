import React from "react";
import { onRipple } from "../../lib/core/onRipple";
import { ripplePrimitive } from "../../lib/core/ripple";

export function TestComponent() {
  const loading = ripplePrimitive(false);
  const error = ripplePrimitive(null);

  onRipple(
    "FETCH_DATA",
    () => {
      return new Promise((resolve) => setTimeout(resolve, 10));
    },
    { loadingSignal: loading, errorSignal: error }
  );

  return (
    <div>
      <span data-testid="loading">{loading.value ? "Loading" : "Idle"}</span>
      <span data-testid="error">{error.value ? "Error" : "None"}</span>
    </div>
  );
}
