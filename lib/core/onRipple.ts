import { useEffect, useRef } from "react";
import { on } from "./eventBus";
import type { Ripple } from "./ripple";

type Handler = (
  payload?: any,
  tools?: { aborted: () => boolean }
) => void | Promise<any>;

interface Options {
  loadingSignal?: Ripple<boolean>;
  errorSignal?: Ripple<any>;
  [key: string]: any;
}

export function useRippleEffect(
  event: string,
  handler: Handler,
  options?: Options | Ripple<any>
) {
  const stableHandler = useRef(handler);
  useEffect(() => {
    stableHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    let cancelled = false;
    const tools = { aborted: () => cancelled };

    const wrapped = async (payload?: any) => {
      if (cancelled) return;

      let loadingSignal: Ripple<boolean> | undefined;
      let errorSignal: Ripple<any> | undefined;

      if (
        options &&
        typeof options === "object" &&
        "value" in options &&
        typeof options.value === "object"
      ) {
        const obj = options.value;
        if ("loading" in obj && typeof obj.loading === "boolean") {
          loadingSignal = {
            get value() {
              return options.value.loading;
            },
            set value(val: boolean) {
              options.value = { ...options.value, loading: val };
            },
          } as Ripple<boolean>;
        }
        if ("error" in obj) {
          errorSignal = {
            get value() {
              return options.value.error;
            },
            set value(val: any) {
              options.value = { ...options.value, error: val };
            },
          } as Ripple<any>;
        }
      } else {
        loadingSignal =
          (options as Options)?.loadingSignal ??
          ((options as Options)?.loading as Ripple<boolean>);
        errorSignal =
          (options as Options)?.errorSignal ??
          ((options as Options)?.error as Ripple<any>);
      }

      loadingSignal && (loadingSignal.value = true);
      errorSignal && (errorSignal.value = null);

      try {
        const result = stableHandler.current(payload, tools);
        if (result instanceof Promise) {
          const awaited = await result;

          if (awaited instanceof Response && !awaited.ok) {
            throw new Error(`HTTP ${awaited.status}: ${awaited.statusText}`);
          }
        }
      } catch (error) {
        if (errorSignal) {
          errorSignal.value = error;
        }
      } finally {
        if (loadingSignal) {
          loadingSignal.value = false;
        }
      }
    };

    const unsubscribe = on(event, wrapped);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [event]);
}
