import type { ApiClient } from "../client";

/**
 * The couriers' areas map for every store (backend platformAdmin/carrierMapRoutes.js):
 * each place of the platform's list, its shared mapping (name-matched or the
 * platform's choice) and what stores picked instead.
 */
export interface AdminCarrierPathNode {
  id: string;
  name: string;
  nameAr: string | null;
}

export interface AdminCarrierAreaMapping {
  source: "auto" | "manual";
  cityId: string;
  districtId: string | null;
  path: AdminCarrierPathNode[];
  carrierPath: string[];
  updatedAt: string;
}

export interface AdminCarrierArea {
  code: string;
  country: string;
  level: "governorate" | "city";
  parentCode: string | null;
  nameAr: string;
  nameEn: string;
  shared: AdminCarrierAreaMapping | null;
  storeChoices: { carrierPath: string[]; path: AdminCarrierPathNode[]; stores: number }[];
  overriddenBy: number;
}

export interface AdminCarrierAreas {
  carrier: { code: string; name: string; countries: string[] };
  country: string;
  regions: AdminCarrierArea[];
  counts: { cities: number; platform: number; auto: number; missing: number; overridden: number };
}

export function adminCarrierAreas(client: ApiClient, code: string, country?: string): Promise<AdminCarrierAreas> {
  return client.request<AdminCarrierAreas>(`/admin/carriers/${code}/regions${country ? `?country=${country}` : ""}`);
}

/** Sets the place's shared mapping to the current one or a path a store picked (422 otherwise). providers.manage. */
export function adminCarrierAreaSet(client: ApiClient, code: string, regionCode: string, carrierPath: string[]): Promise<{ code: string; shared: AdminCarrierAreaMapping }> {
  return client.request(`/admin/carriers/${code}/regions/${regionCode}`, { method: "PUT", body: { carrierPath } });
}

/** Drops the platform's choice: the place goes back to name matching. providers.manage. */
export function adminCarrierAreaReset(client: ApiClient, code: string, regionCode: string): Promise<{ code: string; shared: null }> {
  return client.request(`/admin/carriers/${code}/regions/${regionCode}`, { method: "DELETE" });
}
