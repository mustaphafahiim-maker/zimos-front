/**
 * Estimated delivery dates (backend handoff 199: src/modules/shipping/deliveryEstimates.js).
 *
 * Staff (shipping.manage, both calls):
 *   GET /workspaces/:ws/delivery-estimates → DeliveryEstimateSettings
 *   PUT /workspaces/:ws/delivery-estimates   DeliveryEstimateSettings (`enabled` required; the
 *       other keys replace what is saved, so send the whole shape) → the saved shape.
 *       Days 0–90 (min) / 0–120 (max), min ≤ max; `regions` keyed by the platform governorate
 *       codes (≤100), `places` by the store's own place ids (≤2000); cutoffHour 0–23 or null;
 *       skipDays 0=Sunday…6=Saturday, at most 6.
 *
 * An address reads its days from the store's own place (area → city → region),
 * else its governorate, else the default. Working days, in the store's time
 * zone, after the cutoff hour, skipping `skipDays`.
 *
 * Shopper:
 *   GET /store/:ws/delivery-estimate?province=&city=&area=&placeId=&country=  (public, cached 5 min)
 *     → { estimate: DeliveryEstimate | null }   (null: the store shows none)
 *   The shipping quote's `deliveryEstimate`, the order's `shippingSnapshot.deliveryEstimate`
 *   (checkout answer, staff order) and the tracking answer's `deliveryEstimate` carry the same window.
 */
import type { ApiClient } from "../client";

export interface DeliveryRange {
  minDays: number;
  maxDays: number;
}

export interface DeliveryEstimateSettings {
  enabled: boolean;
  default: DeliveryRange | null;
  /** By platform governorate code ("cairo"). */
  regions: Record<string, DeliveryRange>;
  /** By the store's own place id (regions, cities, areas). */
  places: Record<string, DeliveryRange>;
  /** Orders from this hour on (store time) count from the next day; null = none. */
  cutoffHour: number | null;
  /** Days that don't count: 0 = Sunday … 6 = Saturday. */
  skipDays: number[];
}

export interface DeliveryEstimate extends DeliveryRange {
  /** "YYYY-MM-DD", in the store's calendar. */
  from: string;
  to: string;
  source: "place:area" | "place:city" | "place:region" | "region" | "default" | string;
}

/** The API's bounds for the day fields. */
export const DELIVERY_MIN_DAYS_MAX = 90;
export const DELIVERY_MAX_DAYS_MAX = 120;
export const DELIVERY_SKIP_DAYS_MAX = 6;

export function deliveryEstimatesGet(client: ApiClient, workspaceId: string): Promise<DeliveryEstimateSettings> {
  return client.request<DeliveryEstimateSettings>(`/workspaces/${workspaceId}/delivery-estimates`);
}

export function deliveryEstimatesSave(
  client: ApiClient,
  workspaceId: string,
  body: DeliveryEstimateSettings
): Promise<DeliveryEstimateSettings> {
  return client.request<DeliveryEstimateSettings>(`/workspaces/${workspaceId}/delivery-estimates`, { method: "PUT", body });
}

// ----------------------------------------------------------------- shopper --

export interface DeliveryEstimateQuery {
  country?: string | null;
  /** The governorate as orders carry it ("القاهرة (Cairo)") or its name. */
  province?: string | null;
  city?: string | null;
  area?: string | null;
  /** The deepest place picked from the store's own list. */
  placeId?: string | null;
}

export async function storefrontDeliveryEstimate(
  client: ApiClient,
  workspaceId: string,
  query: DeliveryEstimateQuery = {}
): Promise<DeliveryEstimate | null> {
  const params = new URLSearchParams();
  for (const key of ["country", "province", "city", "area", "placeId"] as const) {
    const value = query[key];
    if (value) params.set(key, value);
  }
  const qs = params.toString();
  const res = await client.request<{ estimate: DeliveryEstimate | null }>(
    `/store/${workspaceId}/delivery-estimate${qs ? `?${qs}` : ""}`,
    { auth: false }
  );
  return readEstimate(res?.estimate);
}

function readEstimate(value: unknown): DeliveryEstimate | null {
  const e = value as DeliveryEstimate | null | undefined;
  return e && typeof e === "object" && typeof e.from === "string" && typeof e.to === "string" ? e : null;
}

/**
 * The delivery window carried by a shipping quote or a tracking answer
 * (`deliveryEstimate`), or by an order (`shippingSnapshot.deliveryEstimate`);
 * null when there is none.
 */
export function deliveryEstimateOf(source: unknown): DeliveryEstimate | null {
  if (!source || typeof source !== "object") return null;
  const s = source as { deliveryEstimate?: unknown; shippingSnapshot?: { deliveryEstimate?: unknown } | null };
  return readEstimate(s.deliveryEstimate) ?? readEstimate(s.shippingSnapshot?.deliveryEstimate);
}
