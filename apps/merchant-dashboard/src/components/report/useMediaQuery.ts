import { useCallback, useSyncExternalStore } from "react";

/** Below Tailwind's `sm`: a phone held upright. */
export const PHONE_QUERY = "(max-width: 39.99rem)";

/** Whether a media query matches, kept current as the screen changes. False where `matchMedia` is missing. */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (notify: () => void) => {
      const list = typeof window.matchMedia === "function" ? window.matchMedia(query) : null;
      if (!list) return () => undefined;
      list.addEventListener("change", notify);
      return () => list.removeEventListener("change", notify);
    },
    [query]
  );
  return useSyncExternalStore(
    subscribe,
    () => typeof window.matchMedia === "function" && window.matchMedia(query).matches,
    () => false
  );
}
