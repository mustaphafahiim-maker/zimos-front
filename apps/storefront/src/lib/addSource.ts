/**
 * Where an add-to-cart came from, for the store's analytics (`add_to_cart`
 * with `source`): a click inside the cross-sell strip marks the next add, and
 * a product page opened from it carries `?from=cross_sell` in its address.
 */
let pending: { source: string; at: number } | null = null;
const FRESH_MS = 15_000;
const KNOWN = new Set(["cross_sell"]);

export function markAddSource(source: string): void {
  pending = { source, at: Date.now() };
}

/** The source of the add happening now, read once. */
export function takeAddSource(): string | undefined {
  const marked = pending && Date.now() - pending.at < FRESH_MS ? pending.source : null;
  pending = null;
  if (marked) return marked;
  if (typeof window === "undefined") return undefined;
  const from = new URLSearchParams(window.location.search).get("from");
  return from && KNOWN.has(from) ? from : undefined;
}
