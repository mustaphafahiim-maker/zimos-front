/**
 * What a shopper pays an order with beside its payment method: a gift card
 * (frontend-handoff items 189 and 201), loyalty points (203) and store credit
 * (204). The three ride on POST /store/:ws/checkout the same way:
 *
 *   body:    giftCardCode, loyaltyPoints, useStoreCredit — with cash on delivery or an
 *            online payment, never bank transfer. Points and credit need the signed-in
 *            shopper's token in X-Shopper-Token.
 *   answer:  `giftCard`, `loyalty`, `storeCredit`, each { applied, held, amount, … }.
 *            Cash on delivery: paid at once, the courier collects the rest.
 *            Online: held, and `payment.redirectUrl` charges only the rest; the hold is
 *            taken when the gateway is paid (or on a switch to cash on delivery) and
 *            given back when the order expires or is cancelled.
 *   Covering the whole order: no gateway at all — 201 with `paidInStore: true`
 *            (`paidByGiftCard: true` when a card took part), `order.paymentMethod: "cod"`,
 *            `financialState: "paid"` and no `payment` object.
 *
 * The shopper's payment status (GET /store/:ws/orders/:id/payment) adds what is
 * held and what is left to pay: `giftCardHeld`, `pointsHeld`, `storeCreditHeld`, `amountDue`.
 */
import type { ApiClient } from "../client";
import type { CheckoutPayload, CheckoutResult, ShopperPaymentStatus } from "../types";
import type { GiftCardRedemption } from "./giftCards";
import type { LoyaltyRedemption } from "./loyalty";
import type { StoreCreditRedemption } from "./storeCredit";

/** The checkout's 201 with everything the three tenders add to it. */
export interface TenderCheckoutResult extends CheckoutResult {
  giftCard?: GiftCardRedemption;
  loyalty?: LoyaltyRedemption;
  storeCredit?: StoreCreditRedemption;
  /** A gift card took part in covering the whole order (always with `paidInStore`). */
  paidByGiftCard?: boolean;
  /** Card, points and credit covered the whole order: nothing for a gateway or a courier to collect. */
  paidInStore?: boolean;
  /** The thank-you page's proof for the tracking page. */
  trackingToken?: string;
}

export interface TenderCheckoutOptions {
  cartToken?: string;
  /** X-Store-Preview: unlocks test-mode methods for the merchant. */
  previewToken?: string;
  /** Whose uploaded photos the order may take (custom fields). */
  visitorId?: string;
  /** The signed-in shopper (X-Shopper-Token): needed for points and store credit. */
  shopperToken?: string | null;
}

/**
 * POST /store/:ws/checkout with the full answer, as `ApiClient.placeCheckout`,
 * plus the signed-in shopper's token when there is one.
 */
export function checkoutWithTenders(
  client: ApiClient,
  workspaceId: string,
  payload: CheckoutPayload,
  opts: TenderCheckoutOptions = {}
): Promise<TenderCheckoutResult> {
  const headers: Record<string, string> = {};
  if (opts.cartToken) headers["X-Cart-Token"] = opts.cartToken;
  if (opts.previewToken) headers["X-Store-Preview"] = opts.previewToken;
  if (opts.visitorId) headers["X-Visitor-Id"] = opts.visitorId;
  if (opts.shopperToken) headers["X-Shopper-Token"] = opts.shopperToken;
  return client.request<TenderCheckoutResult>(`/store/${workspaceId}/checkout`, {
    method: "POST",
    body: payload,
    auth: false,
    idempotent: true,
    headers,
  });
}

/** What an unpaid online order has on hold, and what the gateway is still asked for (minor units). */
export interface PaymentTenderHolds {
  giftCardHeld: number;
  pointsHeld: number;
  storeCreditHeld: number;
  /** Total − paid − held. */
  amountDue: number;
}

/** The held amounts of a payment status; an API without them reads as nothing held. */
export function paymentTenderHolds(status: ShopperPaymentStatus): PaymentTenderHolds {
  const extra = status as ShopperPaymentStatus & Partial<PaymentTenderHolds>;
  const n = (value: unknown) => (typeof value === "number" && Number.isFinite(value) && value > 0 ? value : 0);
  const giftCardHeld = n(extra.giftCardHeld);
  const pointsHeld = n(extra.pointsHeld);
  const storeCreditHeld = n(extra.storeCreditHeld);
  const amountDue =
    typeof extra.amountDue === "number" && Number.isFinite(extra.amountDue)
      ? Math.max(0, extra.amountDue)
      : Math.max(0, status.totalAmount - status.amountPaid - giftCardHeld - pointsHeld - storeCreditHeld);
  return { giftCardHeld, pointsHeld, storeCreditHeld, amountDue };
}
