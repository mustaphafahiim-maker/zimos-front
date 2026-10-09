/**
 * Cart offers (backend: frontend-handoff item 253, src/modules/cartOffers):
 * "add the matching socks for 20% off" in the cart.
 *
 * Staff, /workspaces/:ws/cart-offers:
 *   GET /  (products.view)              → { rules: CartOfferRule[] }
 *   PUT /  (discounts.manage) { rules } → { rules } — replaces the whole list (20 at most).
 *     A rule takes `discountPercent` (1–100) or `offerPriceAmount` (minor units), exactly one,
 *     and at least one of `productIds` (the cart has one of them) and `minSubtotal` (the rest
 *     of the cart reaches it); with both, both are needed.
 *     422 VALIDATION_ERROR on `rules` when a variant or product is not the store's, when the
 *     only trigger is the offered product itself, or when a rule ends before it starts — see
 *     `cartOfferProblemOf`.
 *
 * Storefront: every cart answer (GET / POST / PATCH /store/:ws/cart…) carries `cartOffers`:
 * the offers that hold now and the ones a little more in the cart would unlock. The shopper
 * adds an offer with the normal POST /cart/items { variantId, quantity: 1 }; the server then
 * prices that line at the offer (`applied`), in the cart and on the order.
 *
 * Every amount is integer minor units, and every price here is the server's.
 */
import type { ApiClient } from "../client";
import { apiFieldProblems } from "../errors";
import type { Cart } from "../types";

// ------------------------------------------------------------------ staff --

/**
 * A cart-offer rule (settings.cart_offers). While it holds, the offered
 * variant is shown in the cart at its offer price, for up to `maxQuantity`
 * units. `id` is set by the server on the first save — send it back.
 */
export interface CartOfferRule {
  id?: string;
  name: string;
  /** The variant offered. */
  variantId: string;
  /** 1–100. Exactly one of this and `offerPriceAmount` is set. */
  discountPercent: number | null;
  /** The price it is offered at, minor units. */
  offerPriceAmount: number | null;
  /** 1–10: how many units get the offer price. */
  maxQuantity: number;
  /** Minor units the rest of the cart has to reach; null = no amount condition. */
  minSubtotal: number | null;
  /** Any of them in the cart; null = no product condition. */
  productIds: string[] | null;
  startsAt: string | null;
  endsAt: string | null;
  active: boolean;
}

export const CART_OFFER_MAX_RULES = 20;
export const CART_OFFER_MAX_QUANTITY = 10;

/** GET /workspaces/:ws/cart-offers (products.view). */
export async function cartOffersList(client: ApiClient, workspaceId: string): Promise<CartOfferRule[]> {
  const { rules } = await client.request<{ rules: CartOfferRule[] }>(`/workspaces/${workspaceId}/cart-offers`);
  return rules;
}

/**
 * A rule as the save takes it. The list answers with both discount fields
 * (the unused one null), but the save refuses a null in either: only the one
 * in use is sent.
 */
function ruleBody(rule: CartOfferRule): Record<string, unknown> {
  const discount =
    rule.discountPercent !== null && rule.discountPercent !== undefined
      ? { discountPercent: rule.discountPercent }
      : rule.offerPriceAmount !== null && rule.offerPriceAmount !== undefined
        ? { offerPriceAmount: rule.offerPriceAmount }
        : {};
  return {
    ...(rule.id ? { id: rule.id } : {}),
    name: rule.name,
    variantId: rule.variantId,
    ...discount,
    maxQuantity: rule.maxQuantity,
    minSubtotal: rule.minSubtotal ?? null,
    productIds: rule.productIds && rule.productIds.length > 0 ? rule.productIds : null,
    startsAt: rule.startsAt ?? null,
    endsAt: rule.endsAt ?? null,
    active: rule.active,
  };
}

/** PUT /workspaces/:ws/cart-offers (discounts.manage): replaces every rule. */
export async function cartOffersSave(client: ApiClient, workspaceId: string, rules: CartOfferRule[]): Promise<CartOfferRule[]> {
  const body = await client.request<{ rules: CartOfferRule[] }>(`/workspaces/${workspaceId}/cart-offers`, {
    method: "PUT",
    body: { rules: rules.map(ruleBody) },
  });
  return body.rules;
}

/** Which of the save's refusals this is, read from its message (the API sends no code of its own). */
export type CartOfferProblem = "variant_not_in_store" | "product_not_in_store" | "own_product_only" | "ends_before_start";

export function cartOfferProblemOf(err: unknown): CartOfferProblem | null {
  for (const p of apiFieldProblems(err)) {
    if (/offered variant/i.test(p.message)) return "variant_not_in_store";
    if (/offered product itself/i.test(p.message)) return "own_product_only";
    if (/product is not/i.test(p.message)) return "product_not_in_store";
    if (/ends before/i.test(p.message)) return "ends_before_start";
  }
  return null;
}

// -------------------------------------------------------------- storefront --

/** An offer the cart can take now. */
export interface CartOffer {
  ruleId: string;
  name: string;
  variant: {
    variantId: string;
    productId: string;
    productName: string;
    slug: string;
    optionValues: Record<string, string> | null;
    /** The variant's own picture; null when the product's pictures are not per variant. */
    imageUrl: string | null;
  };
  /** Minor units. */
  regularPrice: string;
  offerPrice: string;
  /** null for an offer at a fixed price. */
  discountPercent: number | null;
  maxQuantity: number;
  /** The offered variant is a line of the cart. */
  inCart: boolean;
  /** That line is priced at `offerPrice`. */
  applied: boolean;
  /** More than `maxQuantity` in the cart: the line is back at the normal price. */
  overMaxQuantity: boolean;
}

/** An offer the cart has not reached yet. */
export interface CartLockedOffer {
  ruleId: string;
  name: string;
  variant: { variantId: string; productName: string; slug: string };
  regularPrice: string;
  offerPrice: string;
  /** Minor units still to add; "0" when the amount is reached or there is none. */
  missingAmount: string;
  /** The rule also needs one of its products in the cart. */
  needsProduct: boolean;
}

export interface CartOffers {
  offers: CartOffer[];
  locked: CartLockedOffer[];
}

/** The cart's `cartOffers` (GET /store/:ws/cart), empty on an older response. */
export function cartOffersOf(cart: Cart | null | undefined): CartOffers {
  const value = (cart as (Cart & { cartOffers?: { offers?: unknown; locked?: unknown } | null }) | null | undefined)?.cartOffers ?? {};
  const offers = Array.isArray(value.offers) ? (value.offers as CartOffer[]).filter((o) => o && o.variant && o.variant.variantId) : [];
  const locked = Array.isArray(value.locked) ? (value.locked as CartLockedOffer[]).filter((o) => o && o.variant) : [];
  return { offers, locked };
}
