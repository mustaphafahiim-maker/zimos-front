/**
 * Purchase limits per product (backend handoff 198: src/modules/catalog/purchaseLimits.js).
 *
 * Units count every variant and offer line of the product together. Orders
 * staff create are not limited.
 *
 * Staff:
 *   GET /workspaces/:ws/purchase-limits/:productId  products.view   → { productId, limits }
 *   PUT /workspaces/:ws/purchase-limits/:productId  products.manage { min?, max?, maxPerCustomer? }
 *       (1–100000 or null; min ≤ max; maxPerCustomer ≥ max; {} clears them) → same shape.
 *       422 VALIDATION_ERROR naming `max` / `maxPerCustomer` when the order is wrong.
 *
 * Shopper:
 *   `product.purchaseLimits` on GET /store/:ws/products/:id: { min, max, maxPerCustomer } or null.
 *   Cart add / change: 422 PURCHASE_LIMIT, details [{ field: "quantity", message, productId, max }].
 *   Checkout: 422 PURCHASE_LIMIT, details [{ field: "items", message, productId, min | max | maxPerCustomer, left? }].
 *   `message` is English and names the product in double quotes.
 */
import { ApiError, type ApiClient } from "../client";
import { apiErrorDetails } from "../errors";

export interface PurchaseLimits {
  /** Fewest units of the product in one order; null = none. */
  min: number | null;
  /** Most units of the product in one order; null = none. */
  max: number | null;
  /** Most units one customer (by phone) can buy across orders that were not cancelled; null = none. */
  maxPerCustomer: number | null;
}

/** The highest number the API takes for any of the three. */
export const PURCHASE_LIMIT_MAX = 100_000;

export function purchaseLimitsGet(
  client: ApiClient,
  workspaceId: string,
  productId: string
): Promise<{ productId: string; limits: PurchaseLimits }> {
  return client.request<{ productId: string; limits: PurchaseLimits }>(`/workspaces/${workspaceId}/purchase-limits/${productId}`);
}

export function purchaseLimitsSave(
  client: ApiClient,
  workspaceId: string,
  productId: string,
  body: Partial<PurchaseLimits>
): Promise<{ productId: string; limits: PurchaseLimits }> {
  return client.request<{ productId: string; limits: PurchaseLimits }>(`/workspaces/${workspaceId}/purchase-limits/${productId}`, {
    method: "PUT",
    body,
  });
}

// ----------------------------------------------------------------- shopper --

/** A product page's limits (`product.purchaseLimits`); null when it has none. */
export function storefrontPurchaseLimitsOf(product: unknown): PurchaseLimits | null {
  const l = product && typeof product === "object" ? (product as { purchaseLimits?: PurchaseLimits | null }).purchaseLimits : null;
  return l && typeof l === "object" && (l.min || l.max || l.maxPerCustomer) ? l : null;
}

export const PURCHASE_LIMIT_CODE = "PURCHASE_LIMIT";

/** One refused product of a cart change or a checkout. */
export interface PurchaseLimitProblem {
  field: string;
  /** English, naming the product in double quotes. */
  message: string;
  productId: string;
  min?: number;
  max?: number;
  maxPerCustomer?: number;
  /** Per customer: how many more this customer may still buy (0 = none). */
  left?: number;
}

/** The refused products of a PURCHASE_LIMIT answer; [] for any other error. */
export function purchaseLimitProblems(err: unknown): PurchaseLimitProblem[] {
  if (!(err instanceof ApiError) || err.code !== PURCHASE_LIMIT_CODE) return [];
  const details = apiErrorDetails<unknown>(err);
  if (!Array.isArray(details)) return [];
  return details.filter(
    (d): d is PurchaseLimitProblem => Boolean(d) && typeof d === "object" && typeof (d as { productId?: unknown }).productId === "string"
  );
}

/** The product's name as the API's English message quotes it ("…"), or "". */
export function purchaseLimitProductName(problem: PurchaseLimitProblem): string {
  const match = /"(.+)"/.exec(problem.message ?? "");
  return match ? match[1] : "";
}
