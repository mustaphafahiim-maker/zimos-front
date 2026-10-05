/**
 * The page builder's product list sources (SPEC §8.2; backend
 * storefront/productSearch.js): `newest`, `featured` (the merchant's picks — a
 * display priority above 0 or the tag "featured" / "مميز" — first, then the
 * rest newest first) and `best_selling` (units sold in the last 90 days,
 * cancelled orders left out). Public, like every storefront listing.
 */
import type { ApiClient } from "../client";
import type { StorefrontListing } from "../types";

export type ProductListSource = "newest" | "featured" | "best_selling";

export const PRODUCT_LIST_SOURCES: readonly ProductListSource[] = ["newest", "featured", "best_selling"];

/** The first `limit` products of the store in the source's order. */
export async function storefrontProductsBySource(
  client: ApiClient,
  workspaceId: string,
  { source, limit }: { source: ProductListSource; limit: number }
): Promise<StorefrontListing> {
  const query = new URLSearchParams({ sort: source, limit: String(limit) });
  return client.request<StorefrontListing>(`/store/${workspaceId}/products?${query.toString()}`, { auth: false });
}
