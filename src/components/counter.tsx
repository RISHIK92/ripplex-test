import { useRipple } from "ripplex";
import { countStore } from "../ripples/rippleStore";
import React from "react";

export const RipplexCounter = React.memo(({ index }: { index: number }) => {
  const count = useRipple(countStore.count);
  console.log("Ripplex rendered:", index);
  return (
    <div>
      #{index}: {count}
    </div>
  );
});
