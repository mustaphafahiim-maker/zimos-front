/**
 * Where each place of the platform's list (governorates and their cities) is
 * on a connected courier's own address list (backend:
 * src/modules/shipping/carrierRegionMap.js, table carrier_region_map).
 *
 *   GET    /workspaces/:ws/carriers/:code/regions?country=EG   shipping.manage or orders.manage
 *   POST   /workspaces/:ws/carriers/:code/regions/auto-match   shipping.manage
 *   PUT    /workspaces/:ws/carriers/:code/regions/:regionCode  shipping.manage
 *   DELETE /workspaces/:ws/carriers/:code/regions/:regionCode  shipping.manage
 *
 * A place is matched by name automatically (`source: "auto"`, the same for
 * every store); the store can choose another place on the courier's list
 * (`source: "manual"`), which wins until it is reset. Booking an order uses
 * the order's place here before trying the order's own text. All exported
 * names are prefixed `carrierRegion` / `CarrierRegion`.
 */
import type { ApiClient } from "../client";
import type { CarrierPlaceRef } from "../types";

export type CarrierRegionCountry = "EG" | "SA";

export interface CarrierRegionMapping {
  source: "auto" | "manual";
  /** The courier's top-level id (its city) and leaf id (its district; null on a one-level list). */
  cityId: string;
  districtId: string | null;
  /** The courier's place, top first. */
  path: CarrierPlaceRef[];
  updatedAt: string;
}

export interface CarrierRegion {
  code: string;
  country: CarrierRegionCountry;
  /** `governorate`: a governorate, North Coast or a Saudi region; `city`: a place under one. */
  level: "governorate" | "city";
  parentCode: string | null;
  nameAr: string;
  nameEn: string;
  /** Null: not found on the courier's list — orders from here need the merchant to choose. */
  mapping: CarrierRegionMapping | null;
}

export interface CarrierRegionList {
  carrierCode: string;
  country: CarrierRegionCountry;
  /** The courier's address levels, top first (e.g. ["city", "district"]). */
  levels: string[];
  regions: CarrierRegion[];
  /** Over the cities: how many are set by the store, matched by name, or missing. */
  counts: { cities: number; manual: number; auto: number; missing: number };
}

const base = (workspaceId: string, carrierCode: string) =>
  `/workspaces/${workspaceId}/carriers/${encodeURIComponent(carrierCode)}/regions`;

export function carrierRegionsList(
  client: ApiClient,
  workspaceId: string,
  carrierCode: string,
  country: CarrierRegionCountry = "EG",
): Promise<CarrierRegionList> {
  return client.request<CarrierRegionList>(
    `${base(workspaceId, carrierCode)}?country=${country}`,
  );
}

/** Matches every place by name again now (it also happens on its own once a day). */
export function carrierRegionsRematch(
  client: ApiClient,
  workspaceId: string,
  carrierCode: string,
  country: CarrierRegionCountry = "EG",
): Promise<{ matched: number; places: number }> {
  return client.request(
    `${base(workspaceId, carrierCode)}/auto-match?country=${country}`,
    { method: "POST", body: {} },
  );
}

/** The store's own choice: the courier's ids, one per level, top first. 422 when not on the courier's list. */
export function carrierRegionSet(
  client: ApiClient,
  workspaceId: string,
  carrierCode: string,
  regionCode: string,
  path: string[],
): Promise<{ code: string; mapping: CarrierRegionMapping }> {
  return client.request(
    `${base(workspaceId, carrierCode)}/${encodeURIComponent(regionCode)}`,
    {
      method: "PUT",
      body: { path },
    },
  );
}

/** Drops the store's choice; answers the name-matched place (or null). */
export function carrierRegionReset(
  client: ApiClient,
  workspaceId: string,
  carrierCode: string,
  regionCode: string,
): Promise<{ code: string; mapping: CarrierRegionMapping | null }> {
  return client.request(
    `${base(workspaceId, carrierCode)}/${encodeURIComponent(regionCode)}`,
    { method: "DELETE" },
  );
}
