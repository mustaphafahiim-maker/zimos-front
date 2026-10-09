/**
 * Multiple stock locations (backend: frontend-handoff item 206, src/modules/stockLocations).
 *
 * The variant's stock stays the store's total. Locations split it: every
 * non-default location keeps its own count and the default holds the rest.
 * The first location is free and becomes the default; a second one needs the
 * plan feature `multi_warehouse` (403 FEATURE_NOT_IN_PLAN, and
 * `multiWarehouse: false` in the list answer).
 *
 * /workspaces/:ws/stock-locations (read inventory.view, change inventory.manage):
 *   GET    /                         → { locations, multiWarehouse }
 *   POST   /  StockLocationInput     → 201 location (409 TOO_MANY_LOCATIONS past 50)
 *   PATCH  /:id StockLocationPatch   → location; `isDefault: true` re-splits the counts.
 *          422 on `isActive` when the default is switched off.
 *   DELETE /:id                      → 204; 409 LOCATION_HAS_STOCK / LOCATION_IS_DEFAULT
 *   GET    /:id/stock?productId=&q=  → { location, variants } (500 at most; `q` matches the product name)
 *   GET    /by-variant?variantIds=   → { variants: [{ variantId, locations }] } (100 ids at most)
 *   POST   /:id/adjust               → the variant's by-variant view; 422 INSUFFICIENT_STOCK below zero
 *   POST   /transfers                → 201 { transfer }; 422 INSUFFICIENT_STOCK with details[0].available
 *   GET    /transfers                → { transfers } (200 latest)
 *   PUT    /orders/:orderId { locationId } (orders.manage) → { orderId, location }
 *
 * An order carries `stockLocationId` (null = the default location).
 */
import type { ApiClient } from "../client";

export interface StockLocation {
  id: string;
  name: string;
  address: string | null;
  isDefault: boolean;
  /** 0–1000; the lowest ships first when an order is assigned. */
  priority: number;
  isActive: boolean;
  /** Units on hand there. Only on the list answer. */
  totals?: { units: number };
  createdAt: string;
}

export interface StockLocationList {
  locations: StockLocation[];
  /** Whether the plan allows more than one location. */
  multiWarehouse: boolean;
}

export interface StockLocationInput {
  /** 1–120 characters. */
  name: string;
  /** Up to 300 characters. */
  address?: string | null;
  priority?: number;
}

export interface StockLocationPatch {
  name?: string;
  address?: string | null;
  priority?: number;
  isActive?: boolean;
  /** Only `true`: another location becomes the default by making it one. */
  isDefault?: true;
}

/** One variant's counts at one location. `available` (on hand − reserved) can be negative. */
export interface LocationStockVariant {
  variantId: string;
  productId: string;
  productName: string | null;
  sku: string | null;
  optionValues: Record<string, string> | null;
  onHand: number;
  reserved: number;
  available: number;
}

export interface LocationStock {
  location: StockLocation;
  variants: LocationStockVariant[];
}

/** Most rows GET /:id/stock answers with. */
export const LOCATION_STOCK_MAX_ROWS = 500;

export interface VariantLocationCount {
  locationId: string;
  name: string;
  isDefault: boolean;
  onHand: number;
  reserved: number;
  available: number;
}

export interface VariantLocations {
  variantId: string;
  locations: VariantLocationCount[];
}

/** Most variant ids GET /by-variant reads in one call. */
export const BY_VARIANT_MAX_IDS = 100;

export interface StockAdjustPayload {
  variantId: string;
  /** ± units, never 0: received (+) or written off (−). */
  delta: number;
  /** 1–200 characters; it names the stock movement. */
  reason: string;
}

export interface StockTransferLine {
  variantId: string;
  /** ≥ 1, at most what is free (on hand − reserved) at the source. */
  quantity: number;
}

export interface StockTransferPayload {
  fromLocationId: string;
  toLocationId: string;
  /** 1–500 lines, one per variant. */
  lines: StockTransferLine[];
  /** Up to 300 characters. */
  note?: string | null;
}

export interface StockTransfer {
  id: string;
  fromLocationId: string;
  toLocationId: string;
  lines: StockTransferLine[];
  note: string | null;
  actorUserId?: string | null;
  createdAt: string;
}

/** `details[0]` of a transfer's 422 INSUFFICIENT_STOCK: the line that asked for too much. */
export interface StockTransferShortage {
  field: "lines";
  variantId: string;
  available: number;
}

/** The field an order answer carries since item 206 (null = the default location). */
export interface OrderStockLocationField {
  stockLocationId?: string | null;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/stock-locations`;

export function stockLocationsList(client: ApiClient, workspaceId: string): Promise<StockLocationList> {
  return client.request<StockLocationList>(base(workspaceId));
}

export function stockLocationCreate(client: ApiClient, workspaceId: string, body: StockLocationInput): Promise<StockLocation> {
  return client.request<StockLocation>(base(workspaceId), { method: "POST", body });
}

export function stockLocationUpdate(
  client: ApiClient,
  workspaceId: string,
  locationId: string,
  body: StockLocationPatch
): Promise<StockLocation> {
  return client.request<StockLocation>(`${base(workspaceId)}/${locationId}`, { method: "PATCH", body });
}

export function stockLocationDelete(client: ApiClient, workspaceId: string, locationId: string): Promise<void> {
  return client.request<void>(`${base(workspaceId)}/${locationId}`, { method: "DELETE" });
}

export function stockLocationStock(
  client: ApiClient,
  workspaceId: string,
  locationId: string,
  query: { productId?: string; q?: string } = {}
): Promise<LocationStock> {
  const qs = new URLSearchParams();
  if (query.productId) qs.set("productId", query.productId);
  if (query.q && query.q.trim()) qs.set("q", query.q.trim());
  const s = qs.toString();
  return client.request<LocationStock>(`${base(workspaceId)}/${locationId}/stock${s ? `?${s}` : ""}`);
}

/** Counts at every location for up to 100 variants; variants of another store are left out. */
export async function stockLocationsByVariant(client: ApiClient, workspaceId: string, variantIds: string[]): Promise<VariantLocations[]> {
  if (variantIds.length === 0) return [];
  const ids = variantIds.slice(0, BY_VARIANT_MAX_IDS).join(",");
  const { variants } = await client.request<{ variants: VariantLocations[] }>(`${base(workspaceId)}/by-variant?variantIds=${ids}`);
  return variants;
}

/** Receive or write off units at a location; answers with that variant's counts everywhere. */
export async function stockLocationAdjust(
  client: ApiClient,
  workspaceId: string,
  locationId: string,
  body: StockAdjustPayload
): Promise<VariantLocations | null> {
  const { variants } = await client.request<{ variants: VariantLocations[] }>(`${base(workspaceId)}/${locationId}/adjust`, {
    method: "POST",
    body,
  });
  return variants[0] ?? null;
}

export async function stockTransferCreate(client: ApiClient, workspaceId: string, body: StockTransferPayload): Promise<StockTransfer> {
  const { transfer } = await client.request<{ transfer: StockTransfer }>(`${base(workspaceId)}/transfers`, { method: "POST", body });
  return transfer;
}

export async function stockTransfersList(client: ApiClient, workspaceId: string): Promise<StockTransfer[]> {
  const { transfers } = await client.request<{ transfers: StockTransfer[] }>(`${base(workspaceId)}/transfers`);
  return transfers;
}

/** Where an order ships from (orders.manage). */
export function orderStockLocationSet(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  locationId: string
): Promise<{ orderId: string; location: StockLocation }> {
  return client.request<{ orderId: string; location: StockLocation }>(`${base(workspaceId)}/orders/${orderId}`, {
    method: "PUT",
    body: { locationId },
  });
}
