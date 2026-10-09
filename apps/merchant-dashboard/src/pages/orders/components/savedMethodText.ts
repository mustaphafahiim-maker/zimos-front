import { ApiError, type SavedMethod } from "@store-builder/api-client";
import { getLocale } from "@/i18n/LocaleContext";

/*
 * Saved cards on the real gateways (frontend-handoff 380), for the order
 * page's saved-methods card:
 *
 *  - a saved PayPal has `brand: "PayPal"` and no `last4` / `expiresAt`: it is
 *    named «PayPal», never "PayPal ending ····";
 *  - 422 SAVED_METHOD_NEEDS_SHOPPER is not a decline — the bank wants the
 *    customer to confirm the payment themselves;
 *  - 409 ORDER_ALREADY_PAID: a second charge of the same order.
 */

const TEXT = {
  en: {
    needsShopper: "The card's bank wants the customer to confirm this payment — send them the payment link",
    alreadyPaid: "This order is already paid",
  },
  ar: {
    needsShopper: "البنك عايز العميل يأكد الدفع بنفسه — ابعتله رابط الدفع",
    alreadyPaid: "الطلب ده اتدفع خلاص",
  },
};

/** The method's own name when it has no card number to show (a saved PayPal); null for a card. */
export function savedMethodPlainName(method: Pick<SavedMethod, "brand" | "last4">): string | null {
  return !method.last4 && method.brand ? method.brand : null;
}

/** A refused saved-card charge in the merchant's words; null for any other error. */
export function savedMethodChargeProblem(err: unknown): string | null {
  const code = err instanceof ApiError ? String(err.code ?? "") : "";
  const text = TEXT[getLocale() === "ar" ? "ar" : "en"];
  if (code === "SAVED_METHOD_NEEDS_SHOPPER") return text.needsShopper;
  if (code === "ORDER_ALREADY_PAID") return text.alreadyPaid;
  return null;
}
