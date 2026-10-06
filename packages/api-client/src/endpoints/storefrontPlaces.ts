/**
 * The checkout's place pickers — the shopper side of the store's own places
 * and their shipping prices (backend: frontend-handoff items 163 and 164).
 *
 *   GET /store/:ws/places?country=EG                               public
 *     → { country, source: "store" | "platform", places: [...] }
 *     "store":    the store's own regions → cities → areas (hidden ones and
 *                 everything under them left out). Every place has an id.
 *     "platform": no own list — the platform's governorates → cities (ids
 *                 null, no areas), less the places the store does not deliver to.
 *
 * POST /store/:ws/shipping-quote and the checkout's `shippingAddress` also
 * take `city`, `area` and `placeId` (the deepest place picked); the province,
 * city and area travel as names. A quote priced by a place's own price has
 * rule "store_place_rate". At checkout a hidden place is refused with 422
 * SHIPPING_PLACE_UNAVAILABLE and an id not in the list with 422
 * VALIDATION_ERROR, both on `shippingAddress.placeId`.
 */
import type { ApiClient } from "../client";
import type { CheckoutAddress, ShippingQuote, ShippingQuotePayload } from "../types";

export interface StorefrontPlace {
  /** null on the platform's list. */
  id: string | null;
  ar: string;
  en: string;
  /** The platform's code for a known governorate / city ("cairo", "cairo.nasr-city"); null otherwise. */
  code: string | null;
  /** Absent on areas; [] when the place has none. */
  children?: StorefrontPlace[];
}

export interface StorefrontPlaceList {
  country: string;
  source: "store" | "platform";
  places: StorefrontPlace[];
}

/**
 * The answer is cached for a minute (Cache-Control: public, max-age=60);
 * `fresh` asks past the browser's copy — after the checkout learned that a
 * place was hidden a moment ago.
 */
export function storefrontPlaces(
  client: ApiClient,
  workspaceId: string,
  country: string,
  opts: { fresh?: boolean } = {}
): Promise<StorefrontPlaceList> {
  const query = `country=${encodeURIComponent(country)}${opts.fresh ? `&_=${Date.now()}` : ""}`;
  return client.request<StorefrontPlaceList>(`/store/${workspaceId}/places?${query}`, { auth: false });
}

/** The quote body with the picked place: names, and the deepest place's id. */
export type ShippingQuotePlacePayload = ShippingQuotePayload & {
  city?: string | null;
  area?: string | null;
  placeId?: string | null;
};

/** A checkout / lost-order address with the picked place (area ≤ 120 chars, placeId a uuid). */
export type CheckoutAddressWithPlace = CheckoutAddress & {
  area?: string;
  placeId?: string;
};

/** The rule of a quote priced by a city's or area's own price. */
export const STORE_PLACE_RATE_RULE = "store_place_rate";

/** Whether a quote was priced by the store's own place list (its amount is what the order will charge). */
export function isStorePlaceRate(quote: Pick<ShippingQuote, "rule"> | null | undefined): boolean {
  return (quote?.rule as string | undefined) === STORE_PLACE_RATE_RULE;
}
