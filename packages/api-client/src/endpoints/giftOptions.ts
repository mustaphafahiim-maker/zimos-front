/**
 * Gift wrap and a gift message at checkout (backend: src/modules/giftOptions,
 * STORE_FEATURES gift_options). The wrap is one of the store's own products,
 * added to the order as a line; the message is printed with the order.
 *
 * Every amount is integer minor units and every price is the server's: the
 * storefront shows what the API quotes and never works a price out itself.
 */
import type { ApiClient } from "../client";
import { apiFieldProblems } from "../errors";

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
