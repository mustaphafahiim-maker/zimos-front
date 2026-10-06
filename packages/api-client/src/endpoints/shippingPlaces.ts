/**
 * The places a store prices shipping by (backend: shipping/shippingPlaces.js,
 * SPEC §12.1): the platform's list for the store's country — Egypt's
 * governorates with North Coast, Saudi Arabia's regions. GET
 * /workspaces/:ws/shipping/settings lists them as `governorates` (with the
 * store's `country`), and PATCH takes, besides the prices:
 *
 *   hiddenPlaces  the place codes the store does not deliver to (the whole
 *                 list; [] = none). The storefront leaves them out of its
 *                 list, and a shopper's order to one is refused
 *                 (SHIPPING_PLACE_UNAVAILABLE).
 *
 * The public store (GET /store/:ws) carries the same list as `hiddenPlaces`.
 */
import type { ShippingSettings, ShippingSettingsResponse, UpdateShippingSettingsPayload } from "../types";

export type ShippingSettingsWithPlaces = ShippingSettings & { hiddenPlaces?: string[] };
export type ShippingSettingsResponseWithPlaces = ShippingSettingsResponse & { country?: string; settings: ShippingSettingsWithPlaces };
export type ShippingPlacesPayload = UpdateShippingSettingsPayload & { hiddenPlaces?: string[] };

/** The hidden places of a store payload or of the shipping settings ([] when none). */
export function hiddenPlacesOf(value: unknown): string[] {
  const list = value && typeof value === "object" ? (value as { hiddenPlaces?: unknown }).hiddenPlaces : null;
  return Array.isArray(list) ? list.filter((c): c is string => typeof c === "string") : [];
}
