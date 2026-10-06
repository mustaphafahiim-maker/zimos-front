/**
 * Live View on a world map (backend analytics/liveMap.js): who is on the store,
 * checking out and ordering in the last few minutes, by country and by place.
 * Needs analytics.view.
 *
 *   GET /workspaces/:workspaceId/analytics/web/live-map?minutes=10[&funnelId=…]
 *
 * `minutes` is 1–60 (default 10). Visitors are located by their session's IP
 * lookup, checkouts by IP country and the governorate typed, orders by the
 * shipping address. `country` is ISO 3166-1 alpha-2, "ZZ" when unknown.
 * `places[].code` is the platform place code (geo_regions) for Egypt's
 * governorates and Saudi Arabia's regions, null elsewhere (then `region` /
 * `city` are the names as received). Places are sorted by activity, at most 300.
 */
import type { ApiClient } from "../client";

export interface LiveMapCounts {
  visitors: number;
  checkouts: number;
  orders: number;
}

export interface LiveMapCountry extends LiveMapCounts {
  country: string;
}

export interface LiveMapPlace extends LiveMapCounts {
  country: string;
  region: string | null;
  city: string | null;
  code: string | null;
}

export interface LiveMap {
  minutes: number;
  since: string;
  totals: LiveMapCounts;
  countries: LiveMapCountry[];
  places: LiveMapPlace[];
}

/** The windows the dashboard offers, in minutes. */
export const LIVE_MAP_WINDOWS = [5, 10, 30, 60] as const;

export async function liveMapGet(
  client: ApiClient,
  workspaceId: string,
  options: { minutes?: number; funnelId?: string } = {}
): Promise<LiveMap> {
  const query = new URLSearchParams();
  if (options.minutes) query.set("minutes", String(options.minutes));
  if (options.funnelId) query.set("funnelId", options.funnelId);
  const qs = query.toString();
  return client.request<LiveMap>(`/workspaces/${workspaceId}/analytics/web/live-map${qs ? `?${qs}` : ""}`);
}
