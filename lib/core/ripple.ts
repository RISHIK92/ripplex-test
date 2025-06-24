export { computed, effect } from "@preact/signals";
import { useSyncExternalStore } from "react";

export interface Ripple<T> {
  value: T;
  subscribe: (cb: () => void, selector?: (v: T) => unknown) => () => void;
  peek: () => T;
  brand: symbol;
}

const RIPPLE_BRAND = Symbol("signal");

export function ripple<T>(initial: T): Ripple<T> {
  let _value = initial;

  const subscribers = new Set<{
    callback: () => void;
    selector: (v: T) => unknown;
    prevValue: unknown;
  }>();

  const subscribe = (
    callback: () => void,
    selector: (v: T) => unknown = (v) => v
  ) => {
    const subscriber = {
      callback,
      selector,
      prevValue: selector(_value),
    };
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  };

  return {
    get value() {
      return _value;
    },
    set value(val: T) {
      if (Object.is(_value, val)) return;
      _value = val;
      for (const sub of subscribers) {
        const nextVal = sub.selector(_value);
        if (!Object.is(nextVal, sub.prevValue)) {
          sub.prevValue = nextVal;
          sub.callback();
        }
      }
    },
    subscribe,
    peek: () => _value,
    brand: RIPPLE_BRAND,
  };
}

export function useRipple<T, S = T>(
  ripple: Ripple<T>,
  selector: (value: T) => S = (v) => v as unknown as S,
  isEqual: (a: S, b: S) => boolean = Object.is
): S {
  return useSyncExternalStore(
    (cb) => ripple.subscribe(cb, selector),
    () => selector(ripple.value),
    () => selector(ripple.peek())
  );
}
