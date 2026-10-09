import type { Product } from "@store-builder/api-client";

/**
 * What the products list last showed, kept for the session so the list a
 * merchant comes back to is on screen at once and refreshes behind
 * (docs/ux/REDESIGN_PROMPT.md §7) — the same idea as the orders list's
 * memory (pages/orders/list/ordersListCache.ts).
 *
 * One small map: the first page of a list, by store + status tab + the
 * filters sent to the API. Nothing here is read as the truth: every visit
 * still asks the server, and the answer replaces what was kept. The status
 * chips count from these pages too, when a page is the whole list.
 */
export interface CachedProductsPage {
  items: Product[];
  nextCursor: string | null;
  /** When it was read. */
  at: number;
}

const MAX_ENTRIES = 48;
const pages = new Map<string, CachedProductsPage>();

/** `filterKey` is the JSON of the filters as they go to the API. */
export function catalogCacheKey(workspaceId: string, tab: string, filterKey: string): string {
  return `${workspaceId}|${tab}|${filterKey}`;
}

export function cachedProductsPage(key: string): CachedProductsPage | undefined {
  return pages.get(key);
}

export function rememberProductsPage(key: string, page: { items: Product[]; nextCursor: string | null }): void {
  // Re-inserted, so the map stays in order of last use and the oldest entry is the first.
  pages.delete(key);
  pages.set(key, { items: page.items, nextCursor: page.nextCursor, at: Date.now() });
  if (pages.size > MAX_ENTRIES) {
    const oldest = pages.keys().next();
    if (!oldest.done) pages.delete(oldest.value);
  }
}

/**
 * After something changed the store's products (a bulk edit, an archive, an
 * import): every other kept list of that store is out of date. The ones named
 * in `keep` stay — they are on screen and are being re-read right now.
 */
export function forgetProductsOf(workspaceId: string, keep: readonly string[] = []): void {
  const prefix = `${workspaceId}|`;
  for (const key of Array.from(pages.keys())) {
    if (key.startsWith(prefix) && !keep.includes(key)) pages.delete(key);
  }
}

/**
 * An edit made in place (a price, a stock count, a status) written through to
 * every kept list of the store that holds the product, so a list shown from
 * memory never brings the old value back.
 */
export function patchCachedProducts(workspaceId: string, productId: string, change: (product: Product) => Product): void {
  const prefix = `${workspaceId}|`;
  for (const [key, page] of Array.from(pages.entries())) {
    if (!key.startsWith(prefix)) continue;
    if (!page.items.some((product) => product.id === productId)) continue;
    pages.set(key, { ...page, items: page.items.map((product) => (product.id === productId ? change(product) : product)) });
  }
}
