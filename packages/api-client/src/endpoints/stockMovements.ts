/**
 * Stock movement history (backend: frontend-handoff item 389). Read-only, inventory.view.
 *
 *   GET /workspaces/:ws/inventory/movements             → the whole store (filters variantId, productId)
 *   GET /workspaces/:ws/inventory/:variantId/movements  → one variant, with `variantId` and `stock`
 *       (404 for a variant of another store)
 *
 * Both take type (one or a comma list), locationId, from / to (a store-calendar day YYYY-MM-DD,
 * `to` including its whole day, or an ISO timestamp), limit (1–200, default 50), cursor,
 * format=json|csv|xlsx and lang=en|ar (the file's headers and words). 422 for a bad cursor or
 * type, or `from` after `to`. Files hold at most 10,000 rows.
 */
import type { ApiClient } from "../client";

export type StockMovementType = "restock" | "adjustment" | "reserve" | "release" | "commit" | "return_restock";
export const STOCK_MOVEMENT_TYPES: readonly StockMovementType[] = ["restock", "adjustment", "reserve", "release", "commit", "return_restock"];

export type StockMovementSourceType =
  | "order"
  | "purchase_order"
  | "stock_count"
  | "return"
  | "stock_lot"
  | "location_adjustment"
  | "bulk_update"
  | "variant_table"
  | "manual";

export interface StockMovementSource {
  type: StockMovementSourceType;
  id?: string | null;
  /** order, return */
  orderNumber?: string | null;
  /** order: placed, upsell, edited, reconfirmed, reopened, rejected, cancelled, payment_expired, customer_blocked, returned, reshipped */
  event?: string | null;
  /** return: the order it belongs to */
  orderId?: string | null;
  /** purchase_order */
  number?: string | null;
  /** stock_count */
  note?: string | null;
  /** stock_lot */
  lotCode?: string | null;
}

export interface StockMovement {
  id: string;
  at: string;
  /** "2026-10-08 04:21:36" in the store's timezone. */
  localTime: string;
  type: StockMovementType;
  quantityDelta: number;
  reservedDelta: number;
  availableDelta: number;
  variant: { id: string; productId: string; productName: string; sku: string | null; optionValues: Record<string, string> | null };
  /** Null when the store has no stock locations. */
  location: { id: string; name: string } | null;
  reason: string | null;
  source: StockMovementSource | null;
  /** user (name null once the user was removed), customer (a storefront order) or system. */
  actor: { type: "user" | "customer" | "system"; id: string | null; name: string | null } | null;
}

export interface StockMovementPage {
  movements: StockMovement[];
  nextCursor: string | null;
  timezone: string;
  /** The one-variant route only. */
  variantId?: string;
  stock?: { stockOnHand: number; reservedStock: number; availableStock: number };
}

export interface StockMovementQuery {
  variantId?: string;
  productId?: string;
  type?: StockMovementType | StockMovementType[];
  locationId?: string;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}

function queryString(query: StockMovementQuery, extra: Record<string, string> = {}): string {
  const qs = new URLSearchParams();
  if (query.variantId) qs.set("variantId", query.variantId);
  if (query.productId) qs.set("productId", query.productId);
  const types = Array.isArray(query.type) ? query.type : query.type ? [query.type] : [];
  if (types.length > 0) qs.set("type", types.join(","));
  if (query.locationId) qs.set("locationId", query.locationId);
  if (query.from) qs.set("from", query.from);
  if (query.to) qs.set("to", query.to);
  if (query.limit) qs.set("limit", String(query.limit));
  if (query.cursor) qs.set("cursor", query.cursor);
  for (const [key, value] of Object.entries(extra)) qs.set(key, value);
  const text = qs.toString();
  return text ? `?${text}` : "";
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/inventory`;

/** The whole store's movements, newest first. */
export function stockMovementsList(client: ApiClient, workspaceId: string, query: StockMovementQuery = {}): Promise<StockMovementPage> {
  return client.request<StockMovementPage>(`${base(workspaceId)}/movements${queryString(query)}`);
}

/** One variant's movements, with its stock figures. */
export function stockMovementsOfVariant(
  client: ApiClient,
  workspaceId: string,
  variantId: string,
  query: Omit<StockMovementQuery, "variantId" | "productId"> = {}
): Promise<StockMovementPage> {
  return client.request<StockMovementPage>(`${base(workspaceId)}/${variantId}/movements${queryString(query)}`);
}

/**
 * The path of the file export (stock-movements-YYYY-MM-DD.csv|xlsx) for the same filters,
 * relative to the API's base: fetch it with the session's token and save the blob.
 */
export function stockMovementsExportPath(workspaceId: string, query: StockMovementQuery, format: "csv" | "xlsx", lang: "en" | "ar"): string {
  const filters: StockMovementQuery = { ...query, limit: undefined, cursor: undefined };
  return `${base(workspaceId)}/movements${queryString(filters, { format, lang })}`;
}

/** The export as a file, with the name the server gave it (stock-movements-YYYY-MM-DD.csv|xlsx). */
export async function stockMovementsExport(
  client: ApiClient,
  workspaceId: string,
  query: StockMovementQuery,
  format: "csv" | "xlsx",
  lang: "en" | "ar"
): Promise<{ blob: Blob; filename: string }> {
  // `ApiClient.rawFetch` (token, refresh, ApiError) is private to the class; reached through one typed cast, as endpoints/catalog.ts does.
  const raw = client as unknown as { rawFetch(path: string, init: RequestInit): Promise<Response> };
  const res = await raw.rawFetch(stockMovementsExportPath(workspaceId, query, format, lang), { headers: { Accept: "*/*" } });
  const named = /filename="?([^";]+)"?/i.exec(res.headers.get("Content-Disposition") ?? "")?.[1];
  return { blob: await res.blob(), filename: named ?? `stock-movements-${new Date().toISOString().slice(0, 10)}.${format}` };
}
