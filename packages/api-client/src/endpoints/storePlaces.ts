/**
 * The store's own places — regions → cities → areas — and their shipping
 * prices (backend: frontend-handoff items 163 and 164).
 *
 *   GET    /workspaces/:ws/store-places?country=EG        shipping.manage
 *   POST   /workspaces/:ws/store-places                   shipping.manage
 *   PATCH  /workspaces/:ws/store-places/:id               shipping.manage
 *   DELETE /workspaces/:ws/store-places/:id               shipping.manage (children too)
 *   PUT    /workspaces/:ws/store-places/prices            shipping.manage
 *   POST   /workspaces/:ws/store-places/import            multipart: file, country, mode
 *   POST   /workspaces/:ws/store-places/copy-platform     { country }
 *
 * `shippingAmount` is integer minor units of the store's currency, or null
 * (not priced here: the parent's price, then the governorate prices apply).
 * At most 5000 places per country.
 */
import type { ApiClient } from "../client";

export type StorePlaceLevel = "region" | "city" | "area";

export interface StorePlace {
  id: string;
  level: StorePlaceLevel;
  parentId: string | null;
  nameAr: string;
  nameEn: string;
  /** The platform's code for a known governorate / city; keeps governorate prices and courier maps working. */
  geoCode: string | null;
  sortOrder: number;
  hidden: boolean;
  shippingAmount: number | null;
  /** Absent on areas. */
  children?: StorePlace[];
}

export interface StorePlaceList {
  country: string;
  counts: Record<StorePlaceLevel, number>;
  max: number;
  places: StorePlace[];
}

export interface StorePlaceCreate {
  country: string;
  level: StorePlaceLevel;
  parentId?: string | null;
  nameAr: string;
  nameEn?: string;
  hidden?: boolean;
  shippingAmount?: number | null;
}

export interface StorePlacePatch {
  nameAr?: string;
  nameEn?: string;
  hidden?: boolean;
  sortOrder?: number;
  shippingAmount?: number | null;
}

export interface StorePlaceImportResult {
  country: string;
  mode: "merge" | "replace";
  created: number;
  total: number;
  /** Rows whose price was set from the sheet's shipping column. */
  priced?: number;
  errors: { row: number; message: string }[];
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/store-places`;

/** ApiClient.rawFetch is private to the class (multipart needs it); reached through one typed cast, like catalog.ts. */
function rawFetch(client: ApiClient, path: string, init: RequestInit): Promise<Response> {
  return (client as unknown as { rawFetch(path: string, init: RequestInit): Promise<Response> }).rawFetch(path, init);
}

export function storePlacesList(client: ApiClient, workspaceId: string, country?: string): Promise<StorePlaceList> {
  const query = country ? `?country=${encodeURIComponent(country)}` : "";
  return client.request<StorePlaceList>(`${base(workspaceId)}${query}`);
}

export async function storePlacesCreate(client: ApiClient, workspaceId: string, body: StorePlaceCreate): Promise<StorePlace> {
  const { place } = await client.request<{ place: StorePlace }>(base(workspaceId), { method: "POST", body });
  return place;
}

export async function storePlacesUpdate(
  client: ApiClient,
  workspaceId: string,
  placeId: string,
  body: StorePlacePatch
): Promise<StorePlace> {
  const { place } = await client.request<{ place: StorePlace }>(`${base(workspaceId)}/${placeId}`, { method: "PATCH", body });
  return place;
}

export async function storePlacesDelete(client: ApiClient, workspaceId: string, placeId: string): Promise<void> {
  await client.request(`${base(workspaceId)}/${placeId}`, { method: "DELETE" });
}

/** Saves the prices table in one go (null clears a price). */
export async function storePlacesSavePrices(
  client: ApiClient,
  workspaceId: string,
  prices: { id: string; shippingAmount: number | null }[]
): Promise<{ changed: number }> {
  return client.request<{ changed: number }>(`${base(workspaceId)}/prices`, { method: "PUT", body: { prices } });
}

/** A CSV or .xlsx sheet (≤ 2MB, ≤ 5000 rows): region_ar, region_en, city_ar, city_en, area_ar, area_en[, shipping]. */
export async function storePlacesImport(
  client: ApiClient,
  workspaceId: string,
  file: File,
  country: string,
  mode: "merge" | "replace"
): Promise<StorePlaceImportResult> {
  const form = new FormData();
  form.append("country", country);
  form.append("mode", mode);
  form.append("file", file, file.name);
  const res = await rawFetch(client, `${base(workspaceId)}/import`, { method: "POST", body: form });
  return (await res.json()) as StorePlaceImportResult;
}

/** Copies the platform's governorates and cities for a country into the store's list. */
export function storePlacesCopyPlatform(client: ApiClient, workspaceId: string, country: string): Promise<StorePlaceImportResult> {
  return client.request<StorePlaceImportResult>(`${base(workspaceId)}/copy-platform`, { method: "POST", body: { country } });
}
