/**
 * Stock forecast (backend: frontend-handoff item 224, src/modules/stockForecast).
 * Read inventory.view, change inventory.manage.
 *
 * Per stock-tracked variant of a product that is not archived: what can still
 * be sold, what is on its way (purchase orders ordered, not received yet), how
 * fast it sells over the last `windowDays`, how many days that lasts, and how
 * many to order now so the stock covers the supplier's lead time, the days to
 * cover and a safety margin.
 *
 * /workspaces/:ws/stock-forecast:
 *   GET  /?status=&productId=&limit=  → StockForecast, most urgent first (limit ≤ 1000, default 200).
 *        `counts` and `total` are of the whole store / the filter, before `limit` cuts the list.
 *   PUT  /settings StockForecastSettings (all four required) → the saved settings
 *   POST /purchase-order StockForecastOrderInput → 201 the draft purchase order (as GET
 *        /purchasing/purchase-orders/:id). A line without `quantity` takes `suggested`, and
 *        without `unitCost` the variant's cost. 422 on `lines.N.quantity` when there is
 *        nothing to order for it, on `lines.N.variantId` for a product that is not
 *        stock-tracked or not this store's; 404 for a supplier or location that is gone.
 *
 * All exported names are prefixed `stockForecast` / `StockForecast`.
 */
import type { ApiClient } from "../client";
import { apiFieldProblems } from "../errors";
import type { PurchaseOrder } from "./purchasing";

/** out: nothing left to sell; reorder_now: lasts no longer than lead time + safety; soon: within a week of that. */
export type StockForecastStatus = "out" | "reorder_now" | "soon" | "ok" | "no_sales";

/** In the server's order of urgency. */
export const STOCK_FORECAST_STATUSES: readonly StockForecastStatus[] = ["out", "reorder_now", "soon", "ok", "no_sales"];

/** What the list can be narrowed to: a status, or every variant with something to order (`suggested > 0`). */
export type StockForecastFilter = StockForecastStatus | "needs_order";

/** Most rows one read answers with. */
export const STOCK_FORECAST_MAX_ROWS = 1000;

export interface StockForecastSettings {
  /** Sales are averaged over the last this many days: 7–180 (30). */
  windowDays: number;
  /** How long the supplier takes to deliver: 0–180 (7). */
  leadTimeDays: number;
  /** How many days of sales an order should cover: 1–365 (30). */
  coverDays: number;
  /** Extra days kept as a margin: 0–90 (7). */
  safetyDays: number;
}

/** The allowed range of each setting, as the API checks it. */
export const STOCK_FORECAST_LIMITS: Record<keyof StockForecastSettings, { min: number; max: number }> = {
  windowDays: { min: 7, max: 180 },
  leadTimeDays: { min: 0, max: 180 },
  coverDays: { min: 1, max: 365 },
  safetyDays: { min: 0, max: 90 },
};

export interface StockForecastVariant {
  variantId: string;
  productId: string;
  productName: string;
  sku: string | null;
  optionValues: Record<string, string> | null;
  /** On hand − reserved: what can still be sold. Can be negative. */
  available: number;
  /** Units on purchase orders that were ordered and not received yet. */
  incoming: number;
  soldInWindow: number;
  /** Units sold per day over the window, to two decimals. */
  perDay: number;
  /** Whole days the available stock lasts; null without sales. */
  daysLeft: number | null;
  /** "YYYY-MM-DD"; null without sales. */
  runsOutOn: string | null;
  /** "YYYY-MM-DD": the last day to order so it arrives in time; null without sales. */
  reorderBy: string | null;
  /** Units to order now; 0 when nothing is needed. */
  suggested: number;
  /** The variant's cost in minor units, as a string; null when it has none. */
  unitCost: string | null;
  status: StockForecastStatus;
}

export interface StockForecast {
  settings: StockForecastSettings;
  /** Variants per status, over the whole store (or product); a status with none is left out. */
  counts: Partial<Record<StockForecastStatus, number>>;
  /** Rows matching the filter, before `limit`. */
  total: number;
  variants: StockForecastVariant[];
}

export interface StockForecastQuery {
  status?: StockForecastFilter;
  /** Only this product's variants. */
  productId?: string;
  /** 1–1000; the API's default is 200. */
  limit?: number;
}

export interface StockForecastOrderLine {
  variantId: string;
  /** 1–1,000,000; left out, the line takes the forecast's `suggested`. */
  quantity?: number;
  /** Minor units, ≥ 0; left out, the line takes the variant's cost. */
  unitCost?: number;
}

export interface StockForecastOrderInput {
  supplierId: string;
  /** The stock location the order is received at; null = the default. */
  locationId?: string | null;
  /** "YYYY-MM-DD" */
  expectedAt?: string | null;
  /** Up to 500 characters; left out, the order says it came from the forecast. */
  note?: string | null;
  /** 1–500 lines, one per variant. */
  lines: StockForecastOrderLine[];
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/stock-forecast`;

export function stockForecastGet(client: ApiClient, workspaceId: string, query: StockForecastQuery = {}): Promise<StockForecast> {
  const qs = new URLSearchParams();
  if (query.status) qs.set("status", query.status);
  if (query.productId) qs.set("productId", query.productId);
  if (query.limit) qs.set("limit", String(query.limit));
  const s = qs.toString();
  return client.request<StockForecast>(`${base(workspaceId)}${s ? `?${s}` : ""}`);
}

export function stockForecastSaveSettings(client: ApiClient, workspaceId: string, settings: StockForecastSettings): Promise<StockForecastSettings> {
  return client.request<StockForecastSettings>(`${base(workspaceId)}/settings`, { method: "PUT", body: settings });
}

/** A draft purchase order for one supplier from the chosen variants. */
export function stockForecastCreatePurchaseOrder(client: ApiClient, workspaceId: string, body: StockForecastOrderInput): Promise<PurchaseOrder> {
  return client.request<PurchaseOrder>(`${base(workspaceId)}/purchase-order`, { method: "POST", body });
}

/** What a refused line of `stockForecastCreatePurchaseOrder` was refused for. */
export interface StockForecastLineProblem {
  /** Position in the `lines` that were sent. */
  index: number;
  /** quantity: nothing to order for it, type one; variantId: not a stock-tracked product of this store. */
  field: "quantity" | "variantId";
}

/** The lines a 422 of `stockForecastCreatePurchaseOrder` names (`lines.N.quantity` / `lines.N.variantId`); [] for any other error. */
export function stockForecastLineProblems(err: unknown): StockForecastLineProblem[] {
  const out: StockForecastLineProblem[] = [];
  for (const problem of apiFieldProblems(err)) {
    const match = /^lines\.(\d+)\.(quantity|variantId)$/.exec(problem.field);
    if (match) out.push({ index: Number(match[1]), field: match[2] as "quantity" | "variantId" });
  }
  return out;
}
