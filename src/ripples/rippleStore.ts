import { ripple } from "ripplex";

export const countStore = {
  count: ripple(0),
  loading: ripple(false),
  error: ripple<string | null>(null),
};

export let countNewStore = ripple({
  countNew: 0,
});
