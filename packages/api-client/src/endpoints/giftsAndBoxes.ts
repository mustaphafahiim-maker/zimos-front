/**
 * Gifts and boxes at the cart: free gifts with purchase (handoff 208), gift
 * wrap and gift message (handoff 214) and mix-and-match boxes (handoff 215).
 *
 * Every amount is integer minor units and every price is the server's: the
 * cart says which gifts it earns and how far it is from the others, the
 * checkout adds them at 0, and the cart and order price a box together.
 */
import type { ApiClient } from "../client";
import { apiFieldProblems } from "../errors";
import type { Cart, StorefrontProduct } from "../types";
import type { BundleDto, BundlePayload, StorefrontBundleTier } from "./bundles";

// ------------------------------------------------------- 208 free gifts --

/**
 * A free-gift rule (settings.free_gifts). It holds when the cart reaches
 * `minSubtotal` and/or has one of `productIds` (both must hold when both are
 * set); the checkout then adds `quantity` of the gift variant at 0, while it
 * is in stock. `id` is set by the server on the first save — send it back.
 */
export interface FreeGiftRule {
  id?: string;
  name: string;
  giftVariantId: string;
  /** 1–10. */
  quantity: number;
  /** Minor units; null = no amount condition. */
  minSubtotal: number | null;
  /** Any of them in the cart; null = no product condition. */
  productIds: string[] | null;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
}

export const FREE_GIFT_MAX_RULES = 20;

/** GET /workspaces/:ws/free-gifts (products.view). */
export async function freeGiftsList(client: ApiClient, workspaceId: string): Promise<FreeGiftRule[]> {
  const { rules } = await client.request<{ rules: FreeGiftRule[] }>(`/workspaces/${workspaceId}/free-gifts`);
  return rules;
}

/**
 * PUT /workspaces/:ws/free-gifts (discounts.manage): replaces every rule
 * (20 at most). 422 VALIDATION_ERROR on `rules` when a gift variant or a
 * product is not the store's, or a rule ends before it starts — see
 * `freeGiftProblemOf`.
 */
export async function freeGiftsSave(client: ApiClient, workspaceId: string, rules: FreeGiftRule[]): Promise<FreeGiftRule[]> {
  const body = await client.request<{ rules: FreeGiftRule[] }>(`/workspaces/${workspaceId}/free-gifts`, {
    method: "PUT",
    body: { rules },
  });
  return body.rules;
}

/** Which of the save's refusals this is, read from its message (the API sends no code of its own). */
export type FreeGiftProblem = "gift_not_in_store" | "product_not_in_store" | "ends_before_start";

export function freeGiftProblemOf(err: unknown): FreeGiftProblem | null {
  for (const p of apiFieldProblems(err)) {
    if (/gift variant/i.test(p.message)) return "gift_not_in_store";
    if (/product is not/i.test(p.message)) return "product_not_in_store";
    if (/ends before/i.test(p.message)) return "ends_before_start";
  }
  return null;
}

/** One rule as the cart reads it: what it gives and what is still missing. */
export interface CartFreeGift {
  ruleId: string;
  name: string;
  gift: { variantId: string; productName: string | null; optionValues: Record<string, string> | null; quantity: number };
  /** The cart qualifies and the gift is in stock: the checkout adds it at 0. */
  eligible: boolean;
  outOfStock: boolean;
  /** Minor units still to add to reach the rule's amount; "0" when reached or none. */
  missingAmount: string;
  /** The rule also needs one of its products in the cart. */
  needsProduct: boolean;
}

/** The cart's `freeGifts` (GET /store/:ws/cart), [] on an older response. */
export function cartFreeGiftsOf(cart: Cart | null | undefined): CartFreeGift[] {
  const list = (cart as (Cart & { freeGifts?: unknown }) | null | undefined)?.freeGifts;
  return Array.isArray(list) ? (list as CartFreeGift[]).filter((g) => g && g.gift) : [];
}

/** An order line the checkout added as a free gift: priced 0. */
export function isFreeGiftLine(item: { unitPriceAmount?: string | number | null }): boolean {
  return item.unitPriceAmount !== undefined && item.unitPriceAmount !== null && Number(item.unitPriceAmount) === 0;
}

// ------------------------------------------- 214 gift wrap and message --

/**
 * The store's gift options (settings.gift_options). The wrap is a normal
 * product the merchant makes and prices ("Gift wrap"); null = message only.
 */
export interface GiftOptionsSettings {
  enabled: boolean;
  wrapVariantId: string | null;
  /** 20–500, 300 by default. */
  messageMaxLength: number;
}

export const GIFT_MESSAGE_MIN_LENGTH = 20;
export const GIFT_MESSAGE_MAX_LENGTH = 500;

/** GET /workspaces/:ws/gift-options (products.view). */
export async function giftOptionsGet(client: ApiClient, workspaceId: string): Promise<GiftOptionsSettings> {
  return client.request<GiftOptionsSettings>(`/workspaces/${workspaceId}/gift-options`);
}

/** PUT /workspaces/:ws/gift-options (products.manage). 422 on `wrapVariantId` when it is not the store's. */
export async function giftOptionsSave(client: ApiClient, workspaceId: string, settings: GiftOptionsSettings): Promise<GiftOptionsSettings> {
  return client.request<GiftOptionsSettings>(`/workspaces/${workspaceId}/gift-options`, { method: "PUT", body: settings });
}

/** The save refused the wrap product (not one of the store's). */
export function isGiftWrapRefused(err: unknown): boolean {
  return apiFieldProblems(err).some((p) => p.field === "wrapVariantId");
}

/** What the storefront offers (GET /store/:ws → `store.giftOptions`); null when off. */
export interface StoreGiftOptions {
  messageMaxLength: number;
  /** null: a message only (no wrap set, or the wrap product is not on sale). */
  wrap: { variantId: string; name: string; priceAmount: string; currency: string; imageUrl: string | null } | null;
}

export function storeGiftOptionsOf(store: unknown): StoreGiftOptions | null {
  const value = (store as { giftOptions?: StoreGiftOptions | null } | null | undefined)?.giftOptions;
  return value && typeof value.messageMaxLength === "number" ? value : null;
}

/** The checkout body's `gift`: a wrap line at its price, the message and "hide the prices" kept on the order. */
export interface CheckoutGiftChoice {
  wrap?: true;
  message?: string;
  hidePrices?: true;
}

export interface GiftCheckoutFields {
  gift?: CheckoutGiftChoice;
}

/** Which gift choice the checkout refused (422 on `gift`, `gift.wrap` or `gift.message`). */
export type CheckoutGiftProblem = "not_offered" | "wrap_unavailable" | "message_too_long";

export function checkoutGiftProblemOf(err: unknown): CheckoutGiftProblem | null {
  for (const p of apiFieldProblems(err)) {
    if (p.field === "gift") return "not_offered";
    if (p.field === "gift.wrap") return "wrap_unavailable";
    if (p.field === "gift.message") return "message_too_long";
  }
  return null;
}

/** What the order keeps (`order.giftOptions`); null when it is not a gift. */
export interface OrderGiftOptions {
  wrapped: boolean;
  message: string | null;
  hidePrices: boolean;
}

export function orderGiftOptionsOf(order: unknown): OrderGiftOptions | null {
  const value = (order as { giftOptions?: OrderGiftOptions | null } | null | undefined)?.giftOptions;
  return value && typeof value === "object" ? value : null;
}

// ------------------------------------------------ 215 mix-and-match box --

/**
 * A quantity bundle with `mixAndMatch` (POST / PATCH /workspaces/:ws/bundles
 * take it, default false): all its products are priced together — "any 3
 * of these for EGP 400" is a tier { quantity: 3, discountType: "fixed_price",
 * discountValue: 40000 }. Products are attached as before.
 */
export type MixAndMatchBundlePayload = BundlePayload & { mixAndMatch?: boolean };

/** Whether a bundle prices its products together (false on an older response). */
export function bundleIsMixAndMatch(bundle: BundleDto | null | undefined): boolean {
  return Boolean((bundle as (BundleDto & { mixAndMatch?: boolean }) | null | undefined)?.mixAndMatch);
}

/** The box's bundle on the storefront; its tiers carry no per-variant prices here. */
export interface StoreBoxBundle {
  id: string;
  name: string;
  displayStyle: string;
  mixAndMatch: true;
  tiers: StorefrontBundleTier[];
}

export interface StoreBoxProduct {
  id: string;
  name: string;
  slug: string;
  imageUrl: string | null;
  variants: { id: string; optionValues: Record<string, string> | null; priceAmount: string; currency: string; available: boolean }[];
}

/**
 * GET /store/:ws/bundles/:bundleId/products — what can go in the box (404
 * unless the bundle is active and mix-and-match). The shopper adds the
 * pieces as ordinary cart lines; the cart and the order price them together.
 */
export async function storeBoxGet(client: ApiClient, workspaceId: string, bundleId: string): Promise<{ bundle: StoreBoxBundle; products: StoreBoxProduct[] }> {
  return client.request<{ bundle: StoreBoxBundle; products: StoreBoxProduct[] }>(`/store/${workspaceId}/bundles/${bundleId}/products`, { auth: false });
}

/** The box a public product belongs to (its `bundle` with `mixAndMatch`), or null. */
export function productBoxOf(product: StorefrontProduct): { id: string; name: string } | null {
  const bundle = (product as StorefrontProduct & { bundle?: { id?: string; name?: string; mixAndMatch?: boolean } | null }).bundle;
  return bundle && bundle.mixAndMatch && bundle.id ? { id: bundle.id, name: bundle.name ?? "" } : null;
}

/** One bundle's saving in the cart (`cart.bundles`): its lines already carry it. */
export interface CartBundleSaving {
  bundleId: string;
  name: string;
  productId: string | null;
  mixAndMatch?: boolean;
  productIds?: string[];
  /** Minor units taken off the covered lines. */
  amount: number;
  freeShipping: boolean;
}

/** The cart's bundle savings, [] on an older response or none. */
export function cartBundleSavingsOf(cart: Cart | null | undefined): CartBundleSaving[] {
  const list = (cart as (Cart & { bundles?: unknown }) | null | undefined)?.bundles;
  return Array.isArray(list) ? (list as CartBundleSaving[]).filter((b) => b && Number(b.amount) > 0) : [];
}
