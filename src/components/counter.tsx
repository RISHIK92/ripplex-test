import { useRipple } from "ripplex-core";
import { countStore } from "../ripples/rippleStore";

export const RipplexCounter = ({ index }: { index: number }) => {
  const count = useRipple(countStore.count);
  return (
    <div>
      #{index}: {count}
    </div>
  );
};
