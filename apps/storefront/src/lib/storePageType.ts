import { useSyncExternalStore } from "react";

/**
 * The kinds of store page a store script can be limited to (dashboard →
 * custom code → Scripts; backend customCode/storeScripts.js), told from the
 * address the shopper sees. Code runs only on the store's own host, where the
 * store is served at the root, so the path is the store path itself.
 *
 * A funnel's thank-you step shares the funnel's address, so the funnel page
 * declares it while it is on screen (components/StorePageMark.tsx).
 */
export type StorePageType = "home" | "collection" | "product" | "page" | "funnel" | "cart" | "checkout" | "thank_you";

/** First path segments the store app itself owns; any other path is one of the merchant's own pages. */
const APP_ROUTES = new Set([
  "products",
  "cart",
  "checkout",
  "orders",
  "f",
  "track",
  "policies",
  "learn",
  "looks",
  "affiliate",
  "downloads",
  "subscriptions",
  "unsubscribe",
  "offer",
  "r",
  "pay",
  "preview",
  "account",
]);

export function pageTypesOf(pathname: string): StorePageType[] {
  const parts = pathname.split("/").filter(Boolean);
  const [first, second] = parts;
  if (!first) return ["home"];
  if (first === "products") return second ? ["product"] : ["collection"];
  if (first === "cart") return ["cart"];
  if (first === "checkout") return ["checkout"];
  // The store's own thank-you page: /orders/<id>.
  if (first === "orders") return second ? ["thank_you"] : [];
  if (first === "f") return ["funnel"];
  if (APP_ROUTES.has(first)) return [];
  return ["page"];
}

// The page kinds the page on screen declares about itself.
let marks: StorePageType[] = [];
const listeners = new Set<() => void>();
const NONE: StorePageType[] = [];

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setMarks(next: StorePageType[]) {
  marks = next;
  for (const listener of listeners) listener();
}

/** Adds a declared page kind; the returned function takes it back. Client components only. */
export function declarePageType(type: StorePageType): () => void {
  setMarks([...marks, type]);
  return () => {
    const i = marks.indexOf(type);
    if (i >= 0) setMarks([...marks.slice(0, i), ...marks.slice(i + 1)]);
  };
}

/** The page kinds declared by the page on screen. */
export function useStorePageMarks(): StorePageType[] {
  return useSyncExternalStore(subscribe, () => marks, () => NONE);
}
