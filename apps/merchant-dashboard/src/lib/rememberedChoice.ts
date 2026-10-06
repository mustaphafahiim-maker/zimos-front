import { useCallback, useState } from "react";
import { useWorkspaceId } from "@/lib/useWorkspaceId";

/**
 * A page filter kept per store in this browser, so the page opens as it was
 * left (SPEC §15.1: the home's period). `allowed`, when given, whitelists the
 * values; anything else stored (an old build, a hand edit) falls back to
 * `fallback`. Storage that can't be read or written (a private tab) just
 * means the choice lasts until the page is left.
 */
export function useRememberedChoice<T extends string>(name: string, fallback: T, allowed?: readonly T[]): [T, (next: T) => void] {
  const workspaceId = useWorkspaceId();
  const key = `zimos.${name}.${workspaceId}`;
  const read = (): T => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored !== null && (!allowed || (allowed as readonly string[]).includes(stored))) return stored as T;
    } catch {
      // Storage blocked: the default.
    }
    return fallback;
  };
  const [state, setState] = useState(() => ({ key, value: read() }));
  // Another store: its own remembered choice.
  const value = state.key === key ? state.value : read();
  if (state.key !== key) setState({ key, value });

  const set = useCallback(
    (next: T) => {
      setState({ key, value: next });
      try {
        if (next === fallback) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, next);
      } catch {
        // Storage blocked: kept for this visit only.
      }
    },
    [key, fallback]
  );
  return [value, set];
}
