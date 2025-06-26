export { computed, effect } from "@preact/signals";
import { useSyncExternalStore } from "react";

let isBatching = false;
let dirtyStores = new Set<() => void>();

export function batch(fn: () => void) {
  isBatching = true;
  fn(); // perform updates
  isBatching = false;

  for (const notify of dirtyStores) {
    notify();
  }

  dirtyStores.clear();
}

export interface Ripple<T> {
  value: T;
  subscribe: (cb: () => void, selector?: (v: T) => unknown) => () => void;
  peek: () => T;
  brand: symbol;
}

const RIPPLE_BRAND = Symbol("signal");

export function ripple<T>(initial: T): Ripple<T> {
  if (typeof initial === "object" && initial !== null) {
    return rippleObject(initial as any) as Ripple<T>;
  }
  return ripplePrimitive(initial);
}

export function createProxy<T extends object>(
  target: T,
  notify: () => void
): T {
  const proxy = new Proxy(target, {
    get(obj, key, receiver) {
      const value = Reflect.get(obj, key, receiver);
      if (
        typeof value === "object" &&
        value !== null &&
        !(RIPPLE_BRAND in value)
      ) {
        return createProxy(value as any, notify);
      }
      return value;
    },
    set(obj, key, value) {
      const old = obj[key as keyof T];
      const newVal =
        typeof value === "object" && value !== null && !(RIPPLE_BRAND in value)
          ? createProxy(value as any, notify)
          : value;

      const result = Reflect.set(obj, key, newVal);
      if (!Object.is(old, value)) {
        if (isBatching) {
          dirtyStores.add(notify);
        } else {
          notify();
        }
      }
      return result;
    },
    deleteProperty(obj, key) {
      const result = Reflect.deleteProperty(obj, key);
      if (isBatching) {
        dirtyStores.add(notify);
      } else {
        notify();
      }
      return result;
    },
  });
  return proxy;
}

function rippleObject<T extends object>(initial: T): Ripple<T> {
  let rawValue = initial;

  const subscribers = new Set<{
    callback: () => void;
    selector: (v: T) => unknown;
    prevValue: unknown;
  }>();

  const notify = () => {
    for (const sub of subscribers) {
      const nextVal = sub.selector(proxyValue);
      if (!Object.is(nextVal, sub.prevValue)) {
        sub.prevValue = nextVal;
        sub.callback();
      }
    }
  };

  let proxyValue = createProxy(initial, notify);

  const subscribe = (
    callback: () => void,
    selector: (v: T) => unknown = (v) => v
  ) => {
    const subscriber = {
      callback,
      selector,
      prevValue: selector(proxyValue),
    };
    subscribers.add(subscriber);
    return () => subscribers.delete(subscriber);
  };

  return {
    get value() {
      return proxyValue;
    },
    set value(newVal: T) {
      if (!Object.is(rawValue, newVal)) {
        rawValue = newVal;
        proxyValue = createProxy(newVal, notify);
        notify();
      }
    },
    subscribe,
    peek: () => proxyValue,
    brand: RIPPLE_BRAND,
  };
}

export function ripplePrimitive<T>(initial: T): Ripple<T> {
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
