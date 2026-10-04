/**
 * Offer rules — order bumps per product, cross-sell, the thank-you page
 * upsell and the exit popup (backend: src/modules/offers; lane 3).
 *
 * Staff: /workspaces/:workspaceId/offers/{bumps,cross-sell,upsells} and
 * /offers/exit-downsell (products.view to read, products.manage to change).
 * A rule's PATCH takes the whole rule. Shopper: under /store/:workspaceId.
 * All exported names here start with `offers` / `Offer`, `storefront`, or
 * name one of these rule types.
 *
 * A bump and an upsell sell an existing catalog Offer: its price is theirs,
 * and the browser only ever names the offer id.
 *
 * Notable codes: ORDER_BUMP_LIMIT (409 — three active bumps per product),
 * VALIDATION_ERROR (422 — an offer that cannot be a bump, a bump of the
 * product itself, an unknown product), ORDER_BUMP_INVALID (422, checkout),
 * ORDER_BUMP_UNAVAILABLE (409, checkout), UPSELL_CLOSED (409 — the order can
 * no longer be added to, or already took an upsell), UPSELL_INVALID (422).
 */
import type { ApiClient } from "../client";
import type { StorefrontOrderBump, StorefrontProduct } from "../types";

// ------------------------------------------------------------------ types --

export interface OfferRuleOfferRef {
  id: string;
  name: string;
  priceAmount: number;
  currency: string;
  productName: string | null;
  /** False when the offer or its product is no longer active: the rule shows nothing. */
  usable: boolean;
}

export interface OfferRuleProductRef {
  id: string;
  name: string;
}

export interface OrderBumpRule {
  id: string;
  /** Null: offered on every product. */
  productId: string | null;
  offerId: string;
  headline: string | null;
  description: string | null;
  preChecked: boolean;
  position: number;
  isActive: boolean;
  offer: OfferRuleOfferRef | null;
  product: OfferRuleProductRef | null;
}

export type OrderBumpRulePayload = Pick<OrderBumpRule, "productId" | "offerId" | "headline" | "description" | "preChecked" | "position" | "isActive">;

export type CrossSellPlacement = "cart" | "checkout" | "thank_you";
export const CROSS_SELL_PLACEMENTS: CrossSellPlacement[] = ["cart", "checkout", "thank_you"];

export interface CrossSellRule {
  id: string;
  name: string;
  /** Both trigger lists empty: the rule applies to every cart. */
  triggerProductIds: string[];
  triggerCollectionIds: string[];
  offerProductIds: string[];
  placement: CrossSellPlacement;
  maxItems: number;
  isActive: boolean;
}

export type CrossSellRulePayload = Omit<CrossSellRule, "id">;

export interface UpsellRule {
  id: string;
  /** Null: after any order. */
  triggerProductId: string | null;
  offerId: string;
  headline: string | null;
  description: string | null;
  position: number;
  isActive: boolean;
  offer: OfferRuleOfferRef | null;
  product: OfferRuleProductRef | null;
}

export type UpsellRulePayload = Pick<UpsellRule, "triggerProductId" | "offerId" | "headline" | "description" | "position" | "isActive">;

export interface ExitDownsellSettings {
  enabled: boolean;
  trigger: "exit_intent" | "delay";
  delaySeconds: number;
  title: string | null;
  message: string | null;
  /** A discount with a code; null shows the message without a coupon. */
  discountId: string | null;
  pages: "product" | "cart" | "all";
}

/** A product's bump as the storefront draws it (the store bump's shape plus the rule). */
export interface StorefrontProductBump extends StorefrontOrderBump {
  id: string;
  preChecked: boolean;
}

export interface StorefrontCrossSell {
  /** "rule" (the merchant's), "bought_together" (from real orders) or null (nothing to show). */
  source: "rule" | "bought_together" | null;
  products: StorefrontProduct[];
}

export interface StorefrontUpsell extends StorefrontOrderBump {
  ruleId: string;
  /** The offer's real countdown from the order (offers/offerCountdown.js); null without one. */
  countdownMinutes?: number | null;
  expiresAt?: string | null;
  /** The order was paid online: taking it places a linked order rather than adding a line. */
  followOn?: boolean;
}

export interface StorefrontUpsellAccepted {
  id: string;
  orderNumber: string;
  subtotalAmount: number;
  shippingAmount: number;
  totalAmount: number;
  currency: string;
  added: { name: string; productName: string; amount: number };
  /** A linked order after an order paid online (the fields above are that order's). */
  followOn?: boolean;
  paymentMethod?: string;
  /** paid: charged to the saved card; declined: it waits for payment; cod: paid on delivery. */
  payment?: { status: "paid" | "declined" | "cod"; amount?: number; currency?: string; code?: string };
}

export interface StorefrontExitDownsell {
  trigger: "exit_intent" | "delay";
  delaySeconds: number;
  title: string | null;
  message: string | null;
  code: string | null;
  pages: "product" | "cart" | "all";
}

// ------------------------------------------------------------------ staff --

const base = (workspaceId: string) => `/workspaces/${workspaceId}/offers`;

export async function offersListBumps(client: ApiClient, workspaceId: string): Promise<OrderBumpRule[]> {
  return (await client.request<{ bumps: OrderBumpRule[] }>(`${base(workspaceId)}/bumps`)).bumps;
}

export async function offersSaveBump(
  client: ApiClient,
  workspaceId: string,
  bumpId: string | null,
  payload: OrderBumpRulePayload
): Promise<OrderBumpRule> {
  const path = bumpId ? `${base(workspaceId)}/bumps/${bumpId}` : `${base(workspaceId)}/bumps`;
  return (await client.request<{ bump: OrderBumpRule }>(path, { method: bumpId ? "PATCH" : "POST", body: payload })).bump;
}

export async function offersDeleteBump(client: ApiClient, workspaceId: string, bumpId: string): Promise<void> {
  await client.request(`${base(workspaceId)}/bumps/${bumpId}`, { method: "DELETE" });
}

export async function offersListCrossSell(client: ApiClient, workspaceId: string): Promise<CrossSellRule[]> {
  return (await client.request<{ rules: CrossSellRule[] }>(`${base(workspaceId)}/cross-sell`)).rules;
}

export async function offersSaveCrossSell(
  client: ApiClient,
  workspaceId: string,
  ruleId: string | null,
  payload: CrossSellRulePayload
): Promise<CrossSellRule> {
  const path = ruleId ? `${base(workspaceId)}/cross-sell/${ruleId}` : `${base(workspaceId)}/cross-sell`;
  return (await client.request<{ rule: CrossSellRule }>(path, { method: ruleId ? "PATCH" : "POST", body: payload })).rule;
}

export async function offersDeleteCrossSell(client: ApiClient, workspaceId: string, ruleId: string): Promise<void> {
  await client.request(`${base(workspaceId)}/cross-sell/${ruleId}`, { method: "DELETE" });
}

export async function offersListUpsells(client: ApiClient, workspaceId: string): Promise<UpsellRule[]> {
  return (await client.request<{ upsells: UpsellRule[] }>(`${base(workspaceId)}/upsells`)).upsells;
}

export async function offersSaveUpsell(
  client: ApiClient,
  workspaceId: string,
  ruleId: string | null,
  payload: UpsellRulePayload
): Promise<UpsellRule> {
  const path = ruleId ? `${base(workspaceId)}/upsells/${ruleId}` : `${base(workspaceId)}/upsells`;
  return (await client.request<{ upsell: UpsellRule }>(path, { method: ruleId ? "PATCH" : "POST", body: payload })).upsell;
}

export async function offersDeleteUpsell(client: ApiClient, workspaceId: string, ruleId: string): Promise<void> {
  await client.request(`${base(workspaceId)}/upsells/${ruleId}`, { method: "DELETE" });
}

export async function offersGetExitDownsell(client: ApiClient, workspaceId: string): Promise<ExitDownsellSettings> {
  return (await client.request<{ exitDownsell: ExitDownsellSettings }>(`${base(workspaceId)}/exit-downsell`)).exitDownsell;
}

export async function offersSaveExitDownsell(
  client: ApiClient,
  workspaceId: string,
  payload: ExitDownsellSettings
): Promise<ExitDownsellSettings> {
  return (
    await client.request<{ exitDownsell: ExitDownsellSettings }>(`${base(workspaceId)}/exit-downsell`, { method: "PUT", body: payload })
  ).exitDownsell;
}

// ---------------------------------------------------------------- shopper --

const store = (workspaceId: string) => `/store/${workspaceId}`;

/** The order bumps of a product page (at most three). Sent back at checkout as `orderBumps: [{ offerId }]`. */
export async function storefrontProductBumps(client: ApiClient, workspaceId: string, productId: string): Promise<StorefrontProductBump[]> {
  const body = await client.request<{ bumps: StorefrontProductBump[] }>(`${store(workspaceId)}/products/${productId}/bumps`, { auth: false });
  return body.bumps;
}

export async function storefrontCrossSell(
  client: ApiClient,
  workspaceId: string,
  productIds: string[],
  placement: CrossSellPlacement
): Promise<StorefrontCrossSell> {
  const query = new URLSearchParams({ productIds: productIds.join(","), placement });
  return client.request<StorefrontCrossSell>(`${store(workspaceId)}/cross-sell?${query.toString()}`, { auth: false });
}

/** The offer to show on an order's thank-you page, or null. */
export async function storefrontOrderUpsell(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  orderNumber: string
): Promise<StorefrontUpsell | null> {
  const query = new URLSearchParams({ number: orderNumber });
  const body = await client.request<{ upsell: StorefrontUpsell | null }>(
    `${store(workspaceId)}/orders/${orderId}/upsell?${query.toString()}`,
    { auth: false }
  );
  return body.upsell;
}

/** Adds the offer to the order; the answer carries the order's new total. */
export async function storefrontAcceptUpsell(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  orderNumber: string,
  offerId: string,
  /** The option the shopper chose for a one-line offer. */
  variantId?: string
): Promise<StorefrontUpsellAccepted> {
  const body = await client.request<{ order: StorefrontUpsellAccepted }>(`${store(workspaceId)}/orders/${orderId}/upsell`, {
    method: "POST",
    body: { number: orderNumber, offerId, ...(variantId ? { variantId } : {}) },
    auth: false,
  });
  return body.order;
}

export async function storefrontExitDownsell(client: ApiClient, workspaceId: string): Promise<StorefrontExitDownsell | null> {
  const body = await client.request<{ exitDownsell: StorefrontExitDownsell | null }>(`${store(workspaceId)}/exit-downsell`, { auth: false });
  return body.exitDownsell;
}
