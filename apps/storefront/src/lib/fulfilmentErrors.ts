import { checkoutDeliverySlotProblemOf, checkoutPickupProblemOf, type DeliverySlotProblem, type PickupProblem } from "@store-builder/api-client";
import { fulfilmentCopy, type FulfilmentCopy } from "./fulfilmentCopy";
import { holidayRefusalText } from "./holidayText";
import { parseLocale, type Locale } from "./i18n";

/** A delivery slot refusal in the shopper's words (handoff 221). */
export function deliverySlotProblemText(kind: DeliverySlotProblem, copy: FulfilmentCopy): string {
  if (kind === "full") return copy.slotTaken;
  if (kind === "unavailable") return copy.slotUnavailable;
  if (kind === "not_offered") return copy.slotNotOffered;
  return copy.slotRequired;
}

/** A pickup refusal in the shopper's words (handoff 225). */
export function pickupProblemText(problem: PickupProblem, copy: FulfilmentCopy): string {
  return problem.kind === "stock" ? copy.pickupOutOfStock : copy.pickupPlaceRefused;
}

/**
 * A checkout refused over the store's holiday (423 STORE_ON_HOLIDAY, handoff
 * 216), a delivery slot (221) or a pickup (225), in the shopper's words — the
 * API words these in English only. For the banner of any order form
 * (lib/placeOrder `orderErrorMessage`), so the forms that mount no picker of
 * their own still say what happened. null for any other error.
 */
export function fulfilmentRefusal(err: unknown, locale?: Locale): string | null {
  // The page's language: the one asked for, else <html lang> (set from the store's), else Arabic.
  const lang: Locale = locale ?? (typeof document !== "undefined" ? parseLocale(document.documentElement.lang) : null) ?? "ar";
  const holiday = holidayRefusalText(err, lang);
  if (holiday) return holiday;
  const copy = fulfilmentCopy(lang);
  const slot = checkoutDeliverySlotProblemOf(err);
  if (slot) return deliverySlotProblemText(slot, copy);
  const pickup = checkoutPickupProblemOf(err);
  if (pickup) return pickupProblemText(pickup, copy);
  return null;
}
