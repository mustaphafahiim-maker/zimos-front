/**
 * Product specifications and comparison (backend: src/modules/productSpecs).
 *
 * The store defines its specification keys (a name in Arabic / English, an optional unit,
 * whether shoppers can filter by it, an order) — up to 100 — and each product has one short
 * value per key.
 *
 * Dashboard, /workspaces/:ws/product-specs (read products.view, change products.manage):
 *   GET    /keys                    → { keys: SpecKey[] } (in the store's order)
 *   POST   /keys   SpecKeyInput     → 201 { key } (422 on `name` past 100 keys)
 *   PUT    /keys/:keyId             → { key }
 *   DELETE /keys/:keyId             → 204 (its values go too)
 *   GET    /keys/:keyId/values      → { values: SpecValueCount[] } — suggestions while typing
 *   GET    /products/:productId     → { values: { "<keyId>": "128" } }
 *   PUT    /products/:productId { values } → { values } — replaces them all ("" = none); unknown key → 422
 *
 * Storefront (public), /store/:ws/specs:
 *   GET /products/:productId        → { specs: StorefrontSpec[] } (only keys with a value)
 *   GET /filters?collectionId=      → { filters: StorefrontSpecFilter[] } (filterable keys, active products)
 *   GET /products?f=<keyId>:<value>&f=…&collectionId=&page=&limit≤48 → StorefrontSpecProducts
 *       (values of one key are OR, different keys AND)
 *   GET /compare?productIds=a,b,c   → StorefrontCompare (2–4 products; else 422)
 */
import type { ApiClient } from "../client";
import type { StorefrontProduct } from "../types";

/** A key's name: at least one language is set. */
export interface SpecKeyName {
  ar?: string;
  en?: string;
}

export interface SpecKey {
  id: string;
  name: SpecKeyName;
  /** "GB", "سم" — shown after the value. */
  unit: string | null;
  /** Shoppers can filter the store by it. */
  filterable: boolean;
  /** Lowest first. */
  position: number;
}

export interface SpecKeyInput {
  name: SpecKeyName;
  unit?: string | null;
  filterable?: boolean;
  position?: number;
}

/** A value already used for a key, and how many products have it. */
export interface SpecValueCount {
  value: string;
  products: number;
}

/** What the API accepts (productSpecs/index.js). */
export const SPEC_LIMITS = { keys: 100, name: 60, unit: 20, value: 200, position: 10000, compareMin: 2, compareMax: 4 } as const;

const base = (workspaceId: string) => `/workspaces/${workspaceId}/product-specs`;

export async function specKeysList(client: ApiClient, workspaceId: string): Promise<SpecKey[]> {
  return (await client.request<{ keys: SpecKey[] }>(`${base(workspaceId)}/keys`)).keys;
}

export async function specKeyCreate(client: ApiClient, workspaceId: string, body: SpecKeyInput): Promise<SpecKey> {
  return (await client.request<{ key: SpecKey }>(`${base(workspaceId)}/keys`, { method: "POST", body })).key;
}

export async function specKeyUpdate(client: ApiClient, workspaceId: string, keyId: string, body: SpecKeyInput): Promise<SpecKey> {
  return (await client.request<{ key: SpecKey }>(`${base(workspaceId)}/keys/${keyId}`, { method: "PUT", body })).key;
}

export async function specKeyDelete(client: ApiClient, workspaceId: string, keyId: string): Promise<void> {
  await client.request<unknown>(`${base(workspaceId)}/keys/${keyId}`, { method: "DELETE" });
}

export async function specKeyValues(client: ApiClient, workspaceId: string, keyId: string): Promise<SpecValueCount[]> {
  return (await client.request<{ values: SpecValueCount[] }>(`${base(workspaceId)}/keys/${keyId}/values`)).values;
}

/** A product's values by key id. */
export async function productSpecsGet(client: ApiClient, workspaceId: string, productId: string): Promise<Record<string, string>> {
  return (await client.request<{ values: Record<string, string> }>(`${base(workspaceId)}/products/${productId}`)).values;
}

/** Replaces the product's values: a key left out, or sent empty, has none. */
export async function productSpecsSave(
  client: ApiClient,
  workspaceId: string,
  productId: string,
  values: Record<string, string>
): Promise<Record<string, string>> {
  return (await client.request<{ values: Record<string, string> }>(`${base(workspaceId)}/products/${productId}`, { method: "PUT", body: { values } })).values;
}

// ----------------------------------------------------------- storefront --

export interface StorefrontSpec extends SpecKey {
  value: string;
}

export interface StorefrontSpecFilter extends SpecKey {
  values: SpecValueCount[];
}

export interface StorefrontSpecProducts {
  products: StorefrontProduct[];
  total: number;
  page: number;
  limit: number;
}

export interface StorefrontCompareKey extends SpecKey {
  /** True when the compared products do not all have the same value. */
  differs: boolean;
}

export interface StorefrontCompare {
  /** Every key any of the products has, in the store's order. */
  keys: StorefrontCompareKey[];
  products: Array<{ product: StorefrontProduct; values: Record<string, string> }>;
}

const storeBase = (workspaceRef: string) => `/store/${workspaceRef}/specs`;

/** A product's specifications, in the store's order; only the keys it has a value for. */
export async function storefrontProductSpecs(client: ApiClient, workspaceRef: string, productId: string): Promise<StorefrontSpec[]> {
  return (await client.request<{ specs: StorefrontSpec[] }>(`${storeBase(workspaceRef)}/products/${productId}`, { auth: false })).specs;
}

/** The keys shoppers can filter by, each with its values and product counts — within a collection when one is given. */
export async function storefrontSpecFilters(client: ApiClient, workspaceRef: string, collectionId?: string | null): Promise<StorefrontSpecFilter[]> {
  const query = collectionId ? `?collectionId=${collectionId}` : "";
  return (await client.request<{ filters: StorefrontSpecFilter[] }>(`${storeBase(workspaceRef)}/filters${query}`, { auth: false })).filters;
}

/** Products that have the chosen values: any of one key's values, and every chosen key. */
export function storefrontSpecProducts(
  client: ApiClient,
  workspaceRef: string,
  query: { filters: Array<{ keyId: string; value: string }>; collectionId?: string | null; page?: number; limit?: number }
): Promise<StorefrontSpecProducts> {
  const qs = new URLSearchParams();
  for (const f of query.filters) qs.append("f", `${f.keyId}:${f.value}`);
  if (query.collectionId) qs.set("collectionId", query.collectionId);
  if (query.page) qs.set("page", String(query.page));
  if (query.limit) qs.set("limit", String(query.limit));
  return client.request<StorefrontSpecProducts>(`${storeBase(workspaceRef)}/products?${qs.toString()}`, { auth: false });
}

/** Two to four products side by side. */
export function storefrontCompare(client: ApiClient, workspaceRef: string, productIds: string[]): Promise<StorefrontCompare> {
  return client.request<StorefrontCompare>(`${storeBase(workspaceRef)}/compare?productIds=${productIds.slice(0, SPEC_LIMITS.compareMax).join(",")}`, {
    auth: false,
  });
}
