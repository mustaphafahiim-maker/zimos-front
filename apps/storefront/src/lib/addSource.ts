/**
 * Where an add-to-cart came from, for the store's analytics (`add_to_cart`
 * with `source`): a click inside the cross-sell strip marks the next add, and
 * a product page opened from it carries `?from=cross_sell` in its address.
 */
let pending: { source: string; id: string | null; at: number } | null = null;
let lastId: string | null = null;
const FRESH_MS = 15_000;
const KNOWN = new Set(["cross_sell"]);

export function markAddSource(source: string, id: string | null = null): void {
  pending = { source, id, at: Date.now() };
}

/** The offer the last taken source names (a cross-sell rule), read right after takeAddSource. */
export function takenAddSourceId(): string | undefined {
  return lastId ?? undefined;
}

/** The source of the add happening now, read once. */
export function takeAddSource(): string | undefined {
  const fresh = pending && Date.now() - pending.at < FRESH_MS ? pending : null;
  const marked = fresh ? fresh.source : null;
  lastId = fresh ? fresh.id : null;
  pending = null;
  if (marked) return marked;
  if (typeof window === "undefined") return undefined;
  const from = new URLSearchParams(window.location.search).get("from");
  return from && KNOWN.has(from) ? from : undefined;
}
