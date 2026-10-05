/**
 * Coupon additions (backend: src/modules/discounts/couponExtras.js):
 * bulk code generation, the store's minimum order amount, the public coupon
 * preview, and what the shipping quote now says about automatic discounts and
 * the minimum order.
 *
 * Staff: POST /workspaces/:id/discounts/bulk (discounts.manage) and
 * GET/PUT /workspaces/:id/offers/order-rules (products.view / manage).
 * Shopper: POST /store/:id/coupon-preview. All exported names here start
 * with `coupons` / `Coupon`, or `storefront`.
 *
 * A discount with no code is automatic: the server applies the one that
 * takes the most off when the shopper typed no code. Percentage values are
 * basis points (1000 = 10%); money is minor units.
 *
 * Notable codes: VALIDATION_ERROR (422 — no value, a percentage over 100%),
 * CODE_SPACE_EXHAUSTED (409 — codes too short for that many), and at
 * checkout MIN_ORDER_NOT_MET (422; details carry minimumAmount and
 * remainingAmount).
 */
import type { ApiClient } from "../client";
import type { ShippingQuote } from "../types";

export interface CouponBulkPayload {
  /** 1–500. */
  count: number;
  /** Letters and digits; the code is PREFIX-RANDOM. */
  prefix?: string;
  /** Length of the random part, 4–12 (default 8). */
  length?: number;
  type: "percentage" | "fixed" | "free_shipping";
  value?: number;
  minimumSubtotal?: number;
  productRestrictions?: string[];
  startsAt?: string;
  endsAt?: string;
  /** Uses per code (default 1). */
  usageLimit?: number;
  perCustomerLimit?: number;
}

export interface CouponBulkResult {
  count: number;
  codes: string[];
}

export interface CouponOrderRules {
  /** Minor units; null for no minimum. */
  minOrderAmount: number | null;
}

export interface StorefrontCouponPreview {
  valid: boolean;
  code: string;
  type: string | null;
  /** What the code takes off the items' subtotal. */
  amount: number;
  subtotal: number;
  /** Why not, when invalid: INVALID_DISCOUNT_CODE, DISCOUNT_EXPIRED, DISCOUNT_MINIMUM_NOT_MET… */
  reason: string | null;
}

export interface StorefrontQuoteExtras {
  /** The no-code discount these items will get, or null. */
  automaticDiscount: { amount: number; type: string; value: number } | null;
  /** The store's minimum order and how far these items are from it; null when it has none. */
  minimumOrder: { amount: number; remainingAmount: number; met: boolean } | null;
  /** What quantity bundles took off (already out of the quote's subtotal). */
  bundleDiscountAmount: number;
}

/** Reads the newer fields off a shipping quote, tolerating an older answer. */
export function storefrontQuoteExtras(quote: ShippingQuote | null | undefined): StorefrontQuoteExtras {
  const raw = (quote ?? {}) as Partial<StorefrontQuoteExtras>;
  return {
    automaticDiscount: raw.automaticDiscount ?? null,
    minimumOrder: raw.minimumOrder ?? null,
    bundleDiscountAmount: raw.bundleDiscountAmount ?? 0,
  };
}

export async function couponsBulkGenerate(client: ApiClient, workspaceId: string, payload: CouponBulkPayload): Promise<CouponBulkResult> {
  return client.request<CouponBulkResult>(`/workspaces/${workspaceId}/discounts/bulk`, { method: "POST", body: payload });
}

export async function couponsGetOrderRules(client: ApiClient, workspaceId: string): Promise<CouponOrderRules> {
  return (await client.request<{ orderRules: CouponOrderRules }>(`/workspaces/${workspaceId}/offers/order-rules`)).orderRules;
}

export async function couponsSaveOrderRules(client: ApiClient, workspaceId: string, rules: CouponOrderRules): Promise<CouponOrderRules> {
  return (
    await client.request<{ orderRules: CouponOrderRules }>(`/workspaces/${workspaceId}/offers/order-rules`, { method: "PUT", body: rules })
  ).orderRules;
}

/** What `code` would take off these items. Never throws for a bad code: `valid` is false and `reason` says why. */
export async function storefrontCouponPreview(
  client: ApiClient,
  workspaceId: string,
  code: string,
  items: { variantId: string; offerId?: string; quantity: number }[],
  /** A product A/B test prices the lines for this visitor (catalog/productTests.js); in a funnel, its funnel-limited codes apply. */
  opts: { visitorId?: string; funnelId?: string } = {}
): Promise<StorefrontCouponPreview> {
  const body = await client.request<{ coupon: StorefrontCouponPreview }>(`/store/${workspaceId}/coupon-preview`, {
    method: "POST",
    body: { code, items, ...(opts.funnelId ? { funnelId: opts.funnelId } : {}) },
    auth: false,
    ...(opts.visitorId ? { headers: { "X-Visitor-Id": opts.visitorId } } : {}),
  });
  return body.coupon;
}
