/**
 * Pre-orders (backend: src/modules/preorders/index.js).
 *
 * A product with `preorder.enabled` keeps selling a variant after it runs
 * out, up to `limit` units beyond its stock per variant (no limit when null).
 * Checkout refuses past that with 409 INSUFFICIENT_STOCK, as before.
 *
 * Staff:
 *   GET /workspaces/:ws/preorders/:productId   products.view   → ProductPreorders
 *   PUT /workspaces/:ws/preorders/:productId   products.manage { enabled, shipsAt?, limit?, message? } → ProductPreorders
 *   GET /workspaces/:ws/preorders              products.view   → { products: PreorderListRow[] }
 * The staff product (catalog list and page) also carries the saved `preorder`.
 *
 * Shopper: `product.preorder` on GET /store/:ws/products/:id is
 * { shipsAt, message, limited } or null. A line sold beyond stock gets
 * `preorderShipsAt` on the order's items (the checkout answer and the staff
 * order), and the order the tag `preorder`.
 */
import type { ApiClient } from "../client";

export interface PreorderSettings {
  enabled: boolean;
  /** "YYYY-MM-DD", or null. */
  shipsAt: string | null;
  /** Units per variant beyond its stock (1–1,000,000); null = no limit. */
  limit: number | null;
  /** Shown on the product page (≤ 200 characters). */
  message: string | null;
}

export interface PreorderVariant {
  id: string;
  sku: string | null;
  optionValues: Record<string, string> | null;
  /** On hand − held by open orders; negative once pre-ordered. */
  available: number;
  /** Units sold beyond stock and not yet covered. */
  preordered: number;
}

export interface ProductPreorders {
  productId: string;
  name: string;
  preorder: PreorderSettings;
  variants: PreorderVariant[];
}

export interface PreorderSave {
  enabled: boolean;
  shipsAt?: string | null;
  limit?: number | null;
  message?: string | null;
}

export interface PreorderListRow {
  productId: string;
  name: string;
  shipsAt: string | null;
  limit: number | null;
  preordered: number;
}

/** The longest message the API keeps. */
export const PREORDER_MESSAGE_MAX = 200;
/** The highest per-variant limit the API takes. */
export const PREORDER_LIMIT_MAX = 1_000_000;

const base = (workspaceId: string) => `/workspaces/${workspaceId}/preorders`;

export function preordersGet(client: ApiClient, workspaceId: string, productId: string): Promise<ProductPreorders> {
  return client.request<ProductPreorders>(`${base(workspaceId)}/${productId}`);
}

export function preordersSave(
  client: ApiClient,
  workspaceId: string,
  productId: string,
  body: PreorderSave
): Promise<ProductPreorders> {
  return client.request<ProductPreorders>(`${base(workspaceId)}/${productId}`, { method: "PUT", body });
}

/** The store's products taking pre-orders. */
export function preordersList(client: ApiClient, workspaceId: string): Promise<{ products: PreorderListRow[] }> {
  return client.request<{ products: PreorderListRow[] }>(base(workspaceId));
}

/** The saved setting on a staff product (catalog list / product page); null when off or absent. */
export function productPreorderOf(product: unknown): PreorderSettings | null {
  const p = product && typeof product === "object" ? (product as { preorder?: PreorderSettings | null }).preorder : null;
  return p && p.enabled ? p : null;
}

/** Units sold beyond stock across a staff product's variants (stockOnHand / reservedStock on each). */
export function productPreorderedUnits(product: unknown): number {
  const variants = product && typeof product === "object" ? (product as { variants?: unknown }).variants : null;
  if (!Array.isArray(variants)) return 0;
  return variants.reduce((sum: number, v: { stockOnHand?: unknown; reservedStock?: unknown }) => {
    const short = Number(v?.reservedStock ?? 0) - Number(v?.stockOnHand ?? 0);
    return sum + (Number.isFinite(short) && short > 0 ? short : 0);
  }, 0);
}

// ----------------------------------------------------------------- shopper --

/** The product page's pre-order: null when the product takes none. */
export interface StorefrontPreorder {
  shipsAt: string | null;
  message: string | null;
  /** The merchant set a per-variant limit (the remaining room is not public). */
  limited: boolean;
}

export function storefrontPreorderOf(product: unknown): StorefrontPreorder | null {
  const p = product && typeof product === "object" ? (product as { preorder?: StorefrontPreorder | null }).preorder : null;
  return p && typeof p === "object" ? p : null;
}

/** An order line's expected ship date when it was taken as a pre-order, else null. */
export function preorderShipsAtOf(item: unknown): string | null {
  const v = item && typeof item === "object" ? (item as { preorderShipsAt?: unknown }).preorderShipsAt : null;
  return typeof v === "string" && v ? v : null;
}

/** The tag the API puts on an order holding a pre-ordered line. */
export const PREORDER_TAG = "preorder";
