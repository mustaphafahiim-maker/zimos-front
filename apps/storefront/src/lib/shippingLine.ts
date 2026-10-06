import type { FreeShippingProgress, ShippingQuote } from "@store-builder/api-client";

/**
 * What the shipping row of a cart or checkout says, from a shipping quote.
 * Import-free (types only), so Node's test runner loads it as is:
 * shippingLine.test.mjs.
 */

export type ShippingLine =
  /** Price shown and added to the total. */
  | { kind: "amount"; amount: number }
  /** Nothing to pay for shipping (a free rule, or a zero price). */
  | { kind: "free" }
  /** The price depends on the governorate, and none is chosen yet. */
  | { kind: "pick_governorate" }
  | { kind: "calculating" }
  /** The store prices no shipping (or the quote failed): the old "confirmed on the call" line. */
  | { kind: "on_confirmation" };

/**
 * Whether a quote answer means "this store prices shipping". A backend from
 * before `configured` existed only priced tier-priced stores for the
 * storefront, so that is what an answer without it means. A place-priced
 * answer always prices it.
 */
export function quotePricesShipping(quote: ShippingQuote): boolean {
  // A city's or area's own price (frontend-handoff 164) is charged even where
  // the store prices nothing else, so `configured` may still read false.
  if ((quote.rule as string | undefined) === "store_place_rate") return true;
  return quote.configured ?? quote.pricingMode === "weight_tiers";
}

/**
 * The shipping line for a quote answer:
 *
 *   - a store that prices no shipping keeps its "confirmed on the call" line;
 *   - without a governorate, only a destination-free answer (free threshold
 *     reached, every product free, an offer's own price) is shown; anything
 *     else asks for the governorate — never a number that may be wrong;
 *   - an answer for another governorate or basket (`fresh: false`) is being
 *     replaced: calculating;
 *   - 0 reads "Free".
 */
export function shippingLineFor(
  quote: ShippingQuote,
  { hasGovernorate, fresh }: { hasGovernorate: boolean; fresh: boolean }
): ShippingLine {
  if (!quotePricesShipping(quote)) return { kind: "on_confirmation" };
  if (!hasGovernorate && !(fresh && quote.destinationRequired === false)) return { kind: "pick_governorate" };
  if (!fresh) return { kind: "calculating" };
  return quote.amount > 0 ? { kind: "amount", amount: quote.amount } : { kind: "free" };
}

/** The "add X more for free shipping" amount, or null when there is nothing to add. */
export function freeShippingRemaining(progress: FreeShippingProgress | null | undefined): number | null {
  if (!progress || progress.qualified || progress.remainingAmount <= 0) return null;
  return progress.remainingAmount;
}
