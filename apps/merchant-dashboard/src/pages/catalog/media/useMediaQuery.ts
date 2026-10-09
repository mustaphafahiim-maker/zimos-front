import { useCallback, useSyncExternalStore } from "react";

/** Tailwind's `lg`: the first guess at "is there room for the variants grid", before its box has been measured. */
export const DESKTOP_QUERY = "(min-width: 64rem)";
/** A mouse or a trackpad: where a right-click menu exists and nothing is pressed and held. */
export const FINE_POINTER_QUERY = "(hover: hover) and (pointer: fine)";
/** People who asked for less motion: tiles change place without sliding. */
export const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

/**
 * Whether a media query matches right now, kept up to date. `fallback` is the
 * answer where there is no `matchMedia` (a test, a server render).
 */
export function useMediaQuery(query: string, fallback = false): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const list = typeof window.matchMedia === "function" ? window.matchMedia(query) : null;
      if (!list) return () => undefined;
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    [query]
  );
  const read = useCallback(
    () => (typeof window.matchMedia === "function" ? window.matchMedia(query).matches : fallback),
    [query, fallback]
  );
  return useSyncExternalStore(subscribe, read, () => fallback);
}
