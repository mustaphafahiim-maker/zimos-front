/**
 * Store reports: tax, stock value, slow stock, discount results, order times,
 * sales by collection / option, returns (backend src/modules/storeReports).
 *
 * Mounted at /workspaces/:workspaceId/store-reports. Tax and inventory value
 * need `financial_reports.view`; the others `analytics.view`.
 *
 * Every report answers JSON, or the same table as a CSV file with
 * `?format=csv` (UTF-8 with a BOM, so Excel reads Arabic) — `storeReportCsv`.
 *
 * Dates: `from` / `to` are days, "YYYY-MM-DD", of the store's own
 * calendar, both included. Left out, a report covers the last 90 days.
 * `from` after `to` → 422 VALIDATION_ERROR on `from`.
 *
 * Money is integer minor units of the store currency, sent as a string.
 * Rates and shares are percentages (12.5 = 12.5%).
 *
 * All exported names are prefixed with `storeReport` / `StoreReport`.
 */
import type { ApiClient } from "../client";
import { apiFieldProblems } from "../errors";

// ------------------------------------------------------------------ types --

/** A window of days, "YYYY-MM-DD" in the store's time zone, both included. */
export interface StoreReportRange {
  from?: string;
  to?: string;
}

// 238 — tax

export interface StoreReportTaxNumbers {
  /** Taxed orders (delivered or paid, not cancelled, not test). */
  orders: number;
  /** Subtotal − discount of the taxed orders. */
  taxable: string;
  tax: string;
  /** The refunds' share of the tax. */
  taxRefunded: string;
  netTax: string;
  /** Tax-exempt orders, counted apart. */
  exemptOrders: number;
  exemptSales: string;
}

export interface StoreReportTaxRow extends StoreReportTaxNumbers {
  /** "2026-10", in the store's time zone. */
  month: string;
  /** Governorate of the shipping address; "—" when the order has none. */
  place: string;
}

export interface StoreReportTax {
  from: string;
  to: string;
  timezone: string;
  currency: string;
  totals: StoreReportTaxNumbers;
  /** One row per month × governorate, oldest month first. */
  rows: StoreReportTaxRow[];
}

// 239 — inventory value

export interface StoreReportInventoryVariant {
  variantId: string;
  productId: string;
  productName: string;
  sku: string | null;
  options: Record<string, string> | null;
  onHand: number;
  /** Promised to open orders, still on the shelf. */
  reserved: number;
  /** onHand − reserved. */
  free: number;
  /** null when the variant has no cost. */
  unitCost: string | null;
  /** onHand × unitCost; null without a cost. */
  value: string | null;
  /** Only when the store has stock locations. */
  locations?: Array<{ locationId: string; units: number; reserved: number }>;
}

export interface StoreReportInventoryValue {
  currency: string;
  totals: {
    variants: number;
    units: number;
    value: string;
    /** The value of the free (not reserved) units. */
    freeValue: string;
    /** Variants without a cost: listed, left out of `value`. */
    withoutCost: number;
  };
  /** null when the store has no stock locations. */
  locations: Array<{ locationId: string; name: string; units: number; value: string }> | null;
  variants: StoreReportInventoryVariant[];
  withoutCost: Array<{ variantId: string; productName: string; sku: string | null; onHand: number }>;
}

// 240 — slow-moving stock

export type StoreReportSlowDays = 30 | 60 | 90 | 180;

export const STORE_REPORT_SLOW_DAYS: readonly StoreReportSlowDays[] = [30, 60, 90, 180];

export interface StoreReportSlowVariant {
  variantId: string;
  productId: string;
  productName: string;
  sku: string | null;
  options: Record<string, string> | null;
  /** On hand − reserved. */
  freeUnits: number;
  unitCost: string | null;
  /** freeUnits × unitCost; null without a cost. */
  valueTiedUp: string | null;
  lastSoldAt: string | null;
  daysSinceSale: number | null;
  neverSold: boolean;
}

export interface StoreReportSlowStock {
  days: StoreReportSlowDays;
  currency: string;
  totals: { variants: number; units: number; valueTiedUp: string; neverSold: number; withoutCost: number };
  /** Most money tied up first. */
  variants: StoreReportSlowVariant[];
}

export interface StoreReportSlowStockParams {
  days?: StoreReportSlowDays;
  /** Also list variants created inside the window (left out by default: too new to judge). */
  includeNew?: boolean;
  /** 1–2000, default 500. */
  limit?: number;
}

// 241 — discount code results

export interface StoreReportDiscountRow {
  discountId: string;
  /** null for an automatic discount. */
  code: string | null;
  automatic: boolean;
  type: string;
  /** Orders placed in the window that used it, cancelled ones included. */
  orders: number;
  cancelled: number;
  /** cancelled ÷ orders, in percent. */
  cancelRate: number;
  /** Live orders (not cancelled / rejected). */
  revenue: string;
  /** Delivered orders, refunds off. */
  deliveredRevenue: string;
  discountGiven: string;
  averageOrder: string;
  /** Live orders that were the customer's first in the store. */
  newCustomers: number;
  returningCustomers: number;
}

export interface StoreReportDiscounts {
  from: string;
  to: string;
  currency: string;
  /** Highest revenue first. A discount nobody used in the window is not listed. */
  discounts: StoreReportDiscountRow[];
}

// 242 — orders by weekday and hour

export interface StoreReportHeatmapCell {
  /** 0 = Sunday … 6 = Saturday, in the store's time zone. */
  weekday: number;
  /** 0–23. */
  hour: number;
  orders: number;
  revenue: string;
  /** Confirmed ÷ cash-on-delivery orders of the cell; null without COD orders. */
  confirmationRate: number | null;
}

export interface StoreReportOrderHeatmap {
  from: string;
  to: string;
  timezone: string;
  currency: string;
  /** Always 168 cells (7 × 24). */
  cells: StoreReportHeatmapCell[];
  /** Orders per weekday, index 0 = Sunday. */
  byWeekday: number[];
  /** Orders per hour, 24 entries. */
  byHour: number[];
  busiest: { weekday: number; hour: number; orders: number } | null;
}

// 245 — sales by collection

export interface StoreReportCollectionRow {
  collectionId: string;
  name: string;
  units: number;
  orders: number;
  products: number;
  revenue: string;
  deliveredRevenue: string;
}

export interface StoreReportSalesByCollection {
  from: string;
  to: string;
  currency: string;
  /** Highest revenue first. A product in several collections counts in each. */
  collections: StoreReportCollectionRow[];
  /** Lines whose product is in no collection. */
  uncollected: { units: number; revenue: string };
}

// 246 — sales by variant option

export interface StoreReportOptionValue {
  option: string;
  value: string;
  units: number;
  orders: number;
  products: number;
  revenue: string;
  /** % of the option's units. */
  share: number;
}

export interface StoreReportOptionGroup {
  /** The option's name as first written ("Size"). */
  option: string;
  units: number;
  /** Most units first. */
  values: StoreReportOptionValue[];
}

export interface StoreReportSalesByOption {
  from: string;
  to: string;
  currency: string;
  options: StoreReportOptionGroup[];
}

// 247 — returns

/** The reason codes the storefront and the staff forms send; anything else is shown as written. */
export type StoreReportReturnReason =
  | "damaged"
  | "defective"
  | "wrong_item"
  | "not_as_described"
  | "no_longer_wanted"
  | "arrived_late"
  | "other"
  | (string & {});

export interface StoreReportReturnReasonRow {
  reason: StoreReportReturnReason;
  requests: number;
  rejected: number;
  /** Received or refunded. */
  completed: number;
  units: number;
}

export interface StoreReportReturnProduct {
  productId: string | null;
  name: string | null;
  /** Units delivered, for orders placed in the window. */
  delivered: number;
  /** Units in return requests that were not rejected. */
  returned: number;
  /** returned ÷ delivered, in percent; null when nothing was delivered. */
  returnRate: number | null;
  reasons: StoreReportReturnReason[];
}

export interface StoreReportReturns {
  from: string;
  to: string;
  currency: string;
  totals: {
    requests: number;
    units: number;
    returnRate: number | null;
    /** Refunds processed in the window. */
    refunds: number;
    refunded: string;
  };
  /** Return requests opened in the window, most requests first. */
  reasons: StoreReportReturnReasonRow[];
  /** Most returned units first (at most 500). */
  products: StoreReportReturnProduct[];
}

/** The report's path segment, also what `storeReportCsv` takes. */
export type StoreReportName =
  | "tax"
  | "inventory-value"
  | "slow-stock"
  | "discounts"
  | "order-heatmap"
  | "sales-by-collection"
  | "sales-by-option"
  | "returns";

/** Any report's query: its window, or the report's own filters. */
export type StoreReportQuery = Record<string, string | number | boolean | null | undefined>;

// -------------------------------------------------------------- functions --

const base = (workspaceId: string) => `/workspaces/${workspaceId}/store-reports`;

function storeReportQuery(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

function get<T>(client: ApiClient, workspaceId: string, report: StoreReportName, params: object): Promise<T> {
  return client.request<T>(`${base(workspaceId)}/${report}${storeReportQuery(params)}`);
}

export function storeReportTax(client: ApiClient, workspaceId: string, range: StoreReportRange = {}): Promise<StoreReportTax> {
  return get(client, workspaceId, "tax", range);
}

/** A snapshot of the stock on hand at cost; `locationId` narrows it to one stock location, on a store that has them. */
export function storeReportInventoryValue(
  client: ApiClient,
  workspaceId: string,
  params: { locationId?: string } = {}
): Promise<StoreReportInventoryValue> {
  return get(client, workspaceId, "inventory-value", params);
}

/** Variants with free stock and no sale in the last `days` (30, 60, 90 or 180; anything else → 422). */
export function storeReportSlowStock(
  client: ApiClient,
  workspaceId: string,
  params: StoreReportSlowStockParams = {}
): Promise<StoreReportSlowStock> {
  return get(client, workspaceId, "slow-stock", params);
}

export function storeReportDiscounts(
  client: ApiClient,
  workspaceId: string,
  range: StoreReportRange = {}
): Promise<StoreReportDiscounts> {
  return get(client, workspaceId, "discounts", range);
}

export function storeReportOrderHeatmap(
  client: ApiClient,
  workspaceId: string,
  range: StoreReportRange = {}
): Promise<StoreReportOrderHeatmap> {
  return get(client, workspaceId, "order-heatmap", range);
}

export function storeReportSalesByCollection(
  client: ApiClient,
  workspaceId: string,
  range: StoreReportRange = {}
): Promise<StoreReportSalesByCollection> {
  return get(client, workspaceId, "sales-by-collection", range);
}

/** `option` narrows to one option name (trimmed, case-insensitive: "size" = " Size "). */
export function storeReportSalesByOption(
  client: ApiClient,
  workspaceId: string,
  params: StoreReportRange & { option?: string } = {}
): Promise<StoreReportSalesByOption> {
  return get(client, workspaceId, "sales-by-option", params);
}

export function storeReportReturns(
  client: ApiClient,
  workspaceId: string,
  range: StoreReportRange = {}
): Promise<StoreReportReturns> {
  return get(client, workspaceId, "returns", range);
}

/**
 * A report as a CSV file, under the same query as its JSON. The file needs the
 * Authorization header, so it is fetched here and handed back as a Blob to save.
 */
export async function storeReportCsv(
  client: ApiClient,
  workspaceId: string,
  report: StoreReportName,
  params: StoreReportQuery = {}
): Promise<Blob> {
  // `rawFetch` is private on ApiClient; it carries the token, refresh and ApiError.
  const raw = client as unknown as { rawFetch(path: string, init: RequestInit): Promise<Response> };
  const res = await raw.rawFetch(`${base(workspaceId)}/${report}${storeReportQuery({ ...params, format: "csv" })}`, {
    headers: { Accept: "text/csv" },
  });
  return res.blob();
}

/** Whether a failed report says its window is upside down (422 VALIDATION_ERROR on `from`). */
export function storeReportRangeRefused(err: unknown): boolean {
  return apiFieldProblems(err).some((problem) => problem.field === "from");
}
