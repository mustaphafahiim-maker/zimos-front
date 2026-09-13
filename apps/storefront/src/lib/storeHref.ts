/**
 * Link building for a store, shared by server and client components — no
 * imports, so either side can use it.
 *
 * Pages are written as if their store sat at the root of its own site
 * (`/cart`, `/products/mug`), which is exactly what a shopper sees on
 * `<slug>.zimos.co`. Reached through the internal `/store/<workspaceId>` path
 * instead, the same links need that prefix, and `basePath` carries it.
 */

/** A store-relative path resolved against how the store is currently served. */
export function storeHref(basePath: string, path: string): string {
  if (path === "" || path === "/") return basePath || "/";
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${basePath}${normalized}`;
}
