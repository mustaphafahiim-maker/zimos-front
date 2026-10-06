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
import type { Cart } from "../types";

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
