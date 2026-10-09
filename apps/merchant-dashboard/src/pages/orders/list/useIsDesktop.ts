import { useSyncExternalStore } from "react";

/** Tailwind's `md`: from here the orders are a table, under it they are cards. */
const QUERY = "(min-width: 48rem)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia?.(QUERY);
  if (!query) return () => undefined;
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function matches(): boolean {
  return window.matchMedia?.(QUERY).matches === true;
}

/**
 * Whether the screen is wide enough for the table. The list draws ONE of its
 * two shapes (cards or table), never both hidden by CSS: a page of a hundred
 * orders is then a hundred rows in the page, not two hundred.
 */
export function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribe, matches, () => true);
}
