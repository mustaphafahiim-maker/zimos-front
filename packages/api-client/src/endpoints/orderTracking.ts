/**
 * The shopper's order tracking page — what the API adds to `TrackResult`
 * (backend: src/modules/storefront/orderTrackingExtras.js) and the signed
 * tracking link. Public, no auth. All exported names are prefixed
 * `orderTracking` / `OrderTracking`.
 *
 * `GET /store/:ws/orders/track` (phone + number) and
 * `GET /store/:ws/orders/track-link?token=` return the same result; both
 * answer `result: null` for a miss.
 */
import type { ApiClient } from "../client";
import type { TrackResult } from "../types";

export type OrderTrackingStepKey = "placed" | "confirmed" | "shipped" | "out_for_delivery" | "delivered";

export interface OrderTrackingStep {
  key: OrderTrackingStepKey;
  reached: boolean;
  /** When it was reached, when known (couriers give no time for "out for delivery"). */
  at: string | null;
}

/** `active` while the order is moving; the others mean it stopped. */
export type OrderTrackingState = "active" | "cancelled" | "returned" | "delivery_failed";

export interface OrderTrackingShipment {
  carrier: string | null;
  waybillNumber: string | null;
  /** The courier's own tracking page, when it has one. */
  trackingUrl: string | null;
}

/** The fields newer backends add to a TrackResult. All optional: an older API omits them. */
export interface OrderTrackingExtras {
  steps?: OrderTrackingStep[];
  state?: OrderTrackingState;
  shipment?: OrderTrackingShipment | null;
  /** Put in `?t=` of the store's track page to open this order without a phone number. */
  trackingToken?: string;
}

export type OrderTrackingResult = TrackResult & OrderTrackingExtras;

export function orderTrackingExtras(result: TrackResult): OrderTrackingExtras {
  return result as OrderTrackingResult;
}

/** Opens an order from its signed tracking link. Null when the token does not name an order of this store. */
export async function orderTrackingByToken(client: ApiClient, workspaceRef: string, token: string): Promise<OrderTrackingResult | null> {
  const { result } = await client.request<{ result: OrderTrackingResult | null }>(
    `/store/${workspaceRef}/orders/track-link?token=${encodeURIComponent(token)}`,
    { auth: false }
  );
  return result;
}
