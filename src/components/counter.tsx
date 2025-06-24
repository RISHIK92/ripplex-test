import { useRipple } from "ripplex";
import { countNewStore, countStore } from "../ripples/rippleStore";
import React from "react";

export const RipplexCounter = ({ index }: { index: number }) => {
  const count = useRipple(countNewStore, (c) => c.countNew);
  return (
    <div>
      #{index}: {count}
    </div>
  );
};
