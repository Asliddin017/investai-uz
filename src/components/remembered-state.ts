import { useCallback, useState } from "react";
import { recall, remember } from "@/lib/nav-memory";

/** useState that is still there when the user leaves the page and comes back. */
export function useRememberedState<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => recall(key, initial));
  const set = useCallback(
    (next: T | ((current: T) => T)) => {
      setValue((current) => {
        const resolved = typeof next === "function" ? (next as (current: T) => T)(current) : next;
        remember(key, resolved);
        return resolved;
      });
    },
    [key],
  );
  return [value, set] as const;
}
