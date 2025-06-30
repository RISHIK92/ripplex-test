import { useSyncExternalStore } from "react";
import { createImmerStore } from "./immer";
import type { Draft } from "immer";

const IS_RIPPLE_PROXY = Symbol("isRippleProxy");

const proxyCache = new WeakMap<object, any>();

let isBatching = false;
const dirtyStores = new Set<() => void>();

export function batch(fn: () => void) {
  isBatching = true;
  fn();
  isBatching = false;

  for (const notify of dirtyStores) notify();
  dirtyStores.clear();
}

export interface Ripple<T> {
  value: T;
  subscribe: (cb: () => void, selector?: (v: T) => unknown) => () => void;
  peek: () => T;
  brand: symbol;
}

function isObject(value: unknown): value is object | any[] {
  return typeof value === "object" && value !== null;
}

export const RIPPLE_BRAND = Symbol("signal");

interface RippleWithImmerUpdate<T> extends Ripple<T> {
  update(recipe: (draft: Draft<T>) => void | Promise<void>): Promise<void>;
}

interface RippleFunction {
  <T>(initial: T): Ripple<T>;
  proxy: <T extends object>(initial: T) => Ripple<T>;
  signal: typeof ripplePrimitive;
  immer: <T extends object>(initial: T) => RippleWithImmerUpdate<T>;
}

export const ripple = function <T>(initial: T): Ripple<T> {
  return isObject(initial) ? rippleObject(initial) : ripplePrimitive(initial);
} as RippleFunction;

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
    const sub = { callback, selector, prevValue: selector(_value) };
    subscribers.add(sub);
    return () => subscribers.delete(sub);
  };

  return {
    get value() {
      return _value;
    },
    set value(val: T) {
      if (Object.is(_value, val)) return;
      _value = val;
      for (const sub of subscribers) {
        const next = sub.selector(_value);
        if (!Object.is(next, sub.prevValue)) {
          sub.prevValue = next;
          sub.callback();
        }
      }
    },
    subscribe,
    peek: () => _value,
    brand: RIPPLE_BRAND,
  };
}

export function rippleProxy<T extends object>(target: T): Ripple<T> {
  const listeners = new Set<() => void>();

  const notify = () => {
    if (isBatching) dirtyStores.add(notify);
    else listeners.forEach((l) => l());
  };

  const proxy = createProxy(target, notify);

  return {
    value: proxy,
    peek: () => proxy,
    subscribe: (cb: () => void) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    brand: RIPPLE_BRAND,
  };
}

Object.assign(ripple, {
  proxy: rippleProxy,
  signal: ripplePrimitive,
  object: rippleObject,
  immer: createImmerStore,
});

function rippleObject<T extends object>(initial: T): Ripple<T> {
  let raw = initial;
  let proxyValue = createProxy(initial, notify);

  const subs = new Set<{
    cb: () => void;
    sel: (v: T) => unknown;
    prev: unknown;
  }>();

  function notify() {
    if (isBatching) {
      dirtyStores.add(notify);
      return;
    }
    for (const s of subs) {
      const next = s.sel(proxyValue);
      if (!Object.is(next, s.prev)) {
        s.prev = next;
        s.cb();
      }
    }
  }

  const subscribe = (cb: () => void, sel: (v: T) => unknown = (v) => v) => {
    const sub = { cb, sel, prev: sel(proxyValue) };
    subs.add(sub);
    return () => subs.delete(sub);
  };

  return {
    get value() {
      return proxyValue;
    },
    set value(v: T) {
      if (Object.is(raw, v)) return;
      raw = v;
      proxyValue = createProxy(v, notify);
      notify();
    },
    subscribe,
    peek: () => proxyValue,
    brand: RIPPLE_BRAND,
  };
}

export function createProxy<T extends object>(
  target: T,
  notify: () => void
): T {
  if ((target as any)[IS_RIPPLE_PROXY]) return target;
  const cached = proxyCache.get(target);
  if (cached) return cached;

  const proxy: any = new Proxy(target, {
    get(obj, key, receiver) {
      const val = Reflect.get(obj, key, receiver);
      if (isObject(val) && !(RIPPLE_BRAND in val)) {
        if (!proxyCache.has(val)) {
          const nestedProxy = createProxy(val as any, notify);
          proxyCache.set(val, nestedProxy);
          return nestedProxy;
        }
        return proxyCache.get(val);
      }
      return val;
    },
    set(obj, key, value) {
      const old = obj[key as keyof T];
      const newVal =
        isObject(value) && !(RIPPLE_BRAND in value)
          ? createProxy(value as any, notify)
          : value;
      const res = Reflect.set(obj, key, newVal);
      if (!Object.is(old, newVal)) notify();
      return res;
    },
    deleteProperty(obj, key) {
      const res = Reflect.deleteProperty(obj, key);
      notify();
      return res;
    },
  });

  Object.defineProperty(proxy, IS_RIPPLE_PROXY, {
    value: true,
    enumerable: false,
  });
  proxyCache.set(target, proxy);
  return proxy;
}

export function useRipple<T, S = T>(
  sig: Ripple<T>,
  selector: (v: T) => S = (v) => v as unknown as S
): S {
  return useSyncExternalStore(
    (cb) => sig.subscribe(cb, selector),
    () => selector(sig.value),
    () => selector(sig.peek())
  );
}

// export function useRipple<T, S = T>(
//   ripple: Ripple<T>,
//   selector: (value: T) => S = (v) => v as unknown as S,
//   isEqual: (a: S, b: S) => boolean = Object.is
// ): S {
//   const cache = useMemo(() => {
//     let lastValue: T | undefined;
//     let lastResult: S;
//     let isInitialized = false;

//     return {
//       getSnapshot: () => {
//         const currentValue = ripple.value;

//         if (!isInitialized || !Object.is(lastValue, currentValue)) {
//           lastValue = currentValue;
//           lastResult = selector(currentValue);
//           isInitialized = true;
//         }

//         return lastResult;
//       },
//       getServerSnapshot: () => {
//         const currentValue = ripple.peek();
//         return selector(currentValue);
//       },
//     };
//   }, [ripple, selector]);

//   const subscribe = useCallback(
//     (callback: () => void) => {
//       return ripple.subscribe(callback, selector);
//     },
//     [ripple, selector]
//   );

//   return useSyncExternalStore(
//     subscribe,
//     cache.getSnapshot,
//     cache.getServerSnapshot
//   );
// }
