/**
 * Sold-out products in store listings (backend: frontend-handoff item 390).
 *
 * settings.storefront_catalog.sold_out: "show" (default) | "last" | "hide": what the shop,
 * collection and search lists do with products nobody can buy right now. The storefront reads
 * it as store.catalog.sold_out (always filled). Every listed product carries
 * `available: boolean` (any variant can be bought: stock, selling past stock, untracked stock,
 * or pre-orders under their limit). `available=true` on GET /store/:ws/products hides the
 * sold-out ones whatever the setting ("In stock only").
 */
import type { ApiClient } from "../client";

export type SoldOutMode = "show" | "last" | "hide";
export const SOLD_OUT_MODES: readonly SoldOutMode[] = ["show", "last", "hide"];

/** The mode in a catalog settings object (dashboard or storefront); "show" when never set. */
export function soldOutModeOf(catalog: unknown): SoldOutMode {
  const value = (catalog as { sold_out?: unknown } | null | undefined)?.sold_out;
  return value === "last" || value === "hide" ? value : "show";
}

/**
 * Whether a listed product can be bought. Reads `available`; an older answer without it falls
 * back to "some variant is in stock".
 */
export function storefrontProductAvailable(product: object & { variants?: ReadonlyArray<{ inStock?: boolean }> }): boolean {
  const flag = (product as { available?: unknown }).available;
  if (typeof flag === "boolean") return flag;
  return (product.variants ?? []).some((v) => v.inStock);
}

/** The same client, asking every product listing for the available ones only. */
export function withAvailableOnly(client: ApiClient): ApiClient {
  const wrapped = Object.create(client) as ApiClient;
  wrapped.request = ((path: string, opts?: Parameters<ApiClient["request"]>[1]) =>
    client.request(/^\/store\/[^/]+\/products\?/.test(path) ? `${path}&available=true` : path, opts)) as ApiClient["request"];
  return wrapped;
}
