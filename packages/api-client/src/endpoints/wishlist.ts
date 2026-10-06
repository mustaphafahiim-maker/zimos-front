/**
 * Wishlist for signed-in shoppers (backend shopperAccounts/wishlist.js,
 * frontend-handoff 188). Only when the store has shopper accounts on (185):
 * otherwise 404 SHOPPER_ACCOUNTS_OFF. Every shopper call carries the
 * account token in X-Shopper-Token (401 SHOPPER_NOT_SIGNED_IN without one).
 *
 * Storefront, under /store/:ws/account/wishlist:
 *   GET    /                → Wishlist (newest first)
 *   POST   / { productId, variantId? }      → 201 Wishlist (a repeat is a no-op;
 *                                             404 not for sale, 422 WISHLIST_FULL at 200)
 *   DELETE /:itemId         → Wishlist (404 when not theirs)
 *   POST   /merge { items } → Wishlist (a guest's hearts after sign-in; gone products ignored)
 *
 * Dashboard (permission products.view):
 *   GET /workspaces/:ws/wishlists/top?limit=20 → { products: MostWishedProduct[] }
 */
import type { ApiClient } from "../client";
import type { ProductStatus } from "../types";

/** A wishlist holds up to this many products (422 WISHLIST_FULL beyond). */
export const WISHLIST_MAX_ITEMS = 200;

export interface WishlistItem {
  id: string;
  productId: string;
  /** Null when the product itself was saved, not one of its variants. */
  variantId: string | null;
  addedAt: string;
  /** Null once the product is gone. */
  product: { name: string; slug: string; imageUrl: string | null } | null;
  /** Integer minor units as strings; the saved variant's, else the product's first. */
  price: { amount: string; compareAt: string | null; currency: string } | null;
  /** False when archived, sold out or no longer for sale: shown greyed, "Unavailable". */
  available: boolean;
}

export interface Wishlist {
  items: WishlistItem[];
  count: number;
}

export interface WishlistEntry {
  productId: string;
  variantId?: string | null;
}

const base = (workspaceRef: string) => `/store/${workspaceRef}/account/wishlist`;
const signed = (token: string) => ({ auth: false, headers: { "X-Shopper-Token": token } }) as const;

export function shopperWishlist(client: ApiClient, workspaceRef: string, token: string): Promise<Wishlist> {
  return client.request<Wishlist>(`${base(workspaceRef)}`, signed(token));
}

export function shopperWishlistAdd(client: ApiClient, workspaceRef: string, token: string, entry: WishlistEntry): Promise<Wishlist> {
  return client.request<Wishlist>(`${base(workspaceRef)}`, { ...signed(token), method: "POST", body: entry });
}

export function shopperWishlistRemove(client: ApiClient, workspaceRef: string, token: string, itemId: string): Promise<Wishlist> {
  return client.request<Wishlist>(`${base(workspaceRef)}/${encodeURIComponent(itemId)}`, { ...signed(token), method: "DELETE" });
}

export function shopperWishlistMerge(client: ApiClient, workspaceRef: string, token: string, items: WishlistEntry[]): Promise<Wishlist> {
  return client.request<Wishlist>(`${base(workspaceRef)}/merge`, {
    ...signed(token),
    method: "POST",
    body: { items: items.slice(0, WISHLIST_MAX_ITEMS) },
  });
}

// ---------------------------------------------------------------- staff --

export interface MostWishedProduct {
  productId: string;
  name: string;
  slug: string;
  status: ProductStatus;
  /** Shoppers who have it on their wishlist. */
  shoppers: number;
  lastAddedAt: string;
}

export function wishlistTopProducts(client: ApiClient, workspaceId: string, limit = 20): Promise<{ products: MostWishedProduct[] }> {
  return client.request<{ products: MostWishedProduct[] }>(`/workspaces/${workspaceId}/wishlists/top?limit=${limit}`);
}
