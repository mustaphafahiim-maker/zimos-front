/**
 * Analytics reports — sales, products, delivery (the cash-on-delivery
 * reality), customers, insights and CSV export (backend:
 * src/modules/analytics/reportsService.js).
 *
 * Mounted at /workspaces/:workspaceId/analytics/reports (analytics.view). All
 * exported names in this file are prefixed with `reports` / `Reports`.
 *
 * Money is integer minor units in the store's base currency. Rates are
 * percentages (12.5 = 12.5%) and null when the denominator is zero.
 */
import type { ApiClient } from "../client";

// ------------------------------------------------------------------ types --

export interface ReportsRange {
  from: string;
  to: string;
  timeZone: string;
}

export type ReportsCompare = "previous" | "year" | "none";
export type ReportsUnit = "hour" | "day" | "week" | "month";

export interface ReportsRangeParams {
  from?: string;
  to?: string;
}

export interface ReportsSalesParams extends ReportsRangeParams {
  compare?: ReportsCompare;
  unit?: ReportsUnit;
}

export type ReportsKpiKey =
  | "totalSales"
  | "orders"
  | "averageOrderValue"
  | "sessions"
  | "conversionRate"
  | "grossSales"
  | "discounts"
  | "refunds"
  | "netSales"
  | "shipping"
  | "unitsSold"
  | "deliveredSales"
  | "confirmationRate"
  | "deliveryRate"
  | "returnRate"
  | "newCustomers"
  | "returningCustomers"
  | "returningCustomerRate"
  | "newCustomerSales"
  | "returningCustomerSales"
  | "abandonedCheckouts"
  | "abandonedValue"
  | "recoveredCheckouts"
  | "recoveryRate"
  | "uncontactedCheckouts";

export interface ReportsKpi {
  value: number | null;
  previous: number | null;
}

export interface ReportsSeriesPoint {
  /** Start of the bucket in the store's time zone, "YYYY-MM-DDTHH:mm". */
  bucket: string;
  sales: number;
  deliveredSales: number;
  orders: number;
  sessions: number;
  averageOrderValue: number;
  conversionRate: number | null;
}

export type ReportsFunnelStepKey = "sessions" | "product" | "cart" | "checkout" | "purchase";

export interface ReportsFunnelStep {
  step: ReportsFunnelStepKey;
  sessions: number;
  previous: number | null;
  rateOfSessions: number | null;
  rateOfPrevious: number | null;
}

export interface ReportsChannelRow {
  source: string;
  medium: string | null;
  sessions: number;
  orders: number;
  sales: number;
  conversionRate: number | null;
}

export interface ReportsDeviceRow {
  device: string;
  sessions: number;
  orders: number;
  sales: number;
  conversionRate: number | null;
}

export interface ReportsSales {
  range: ReportsRange;
  previousRange: { from: string; to: string } | null;
  compare: ReportsCompare;
  unit: ReportsUnit;
  currency: string;
  kpis: Record<ReportsKpiKey, ReportsKpi>;
  series: ReportsSeriesPoint[];
  previousSeries: ReportsSeriesPoint[] | null;
  funnel: ReportsFunnelStep[];
  channels: ReportsChannelRow[];
  devices: ReportsDeviceRow[];
  paymentMethods: Array<{ method: string; orders: number; sales: number }>;
  /** Orders by weekday (0 = Sunday) and hour, store time. Empty cells are left out. */
  heatmap: Array<{ dow: number; hour: number; orders: number }>;
}

export interface ReportsProductRow {
  productId: string;
  name: string;
  views: number;
  addToCarts: number;
  orders: number;
  units: number;
  sales: number;
  margin: number;
  addToCartRate: number | null;
  conversionRate: number | null;
  deliveryRate: number | null;
  returnRate: number | null;
}

export interface ReportsLandingRow {
  path: string;
  sessions: number;
  orders: number;
  sales: number;
  conversionRate: number | null;
}

export interface ReportsProducts {
  range: ReportsRange;
  currency: string;
  products: ReportsProductRow[];
  landingPages: ReportsLandingRow[];
}

export interface ReportsDeliveryNumbers {
  orders: number;
  codOrders: number;
  confirmed: number;
  shipped: number;
  delivered: number;
  returned: number;
  sales: number;
  deliveredSales: number;
  confirmationRate: number | null;
  deliveryRate: number | null;
  returnRate: number | null;
}

export interface ReportsDelivery {
  range: ReportsRange;
  currency: string;
  totals: ReportsDeliveryNumbers;
  stages: Array<{ stage: string; orders: number; sales: number }>;
  governorates: Array<ReportsDeliveryNumbers & { name: string }>;
  carriers: Array<ReportsDeliveryNumbers & { name: string; averageDeliveryDays: number | null }>;
  averageConfirmationHours: number | null;
  averageDeliveryDays: number | null;
}

export interface ReportsCustomers {
  range: ReportsRange;
  currency: string;
  window: {
    newCustomers: number;
    returningCustomers: number;
    returningCustomerRate: number | null;
    newOrders: number;
    returningOrders: number;
    newSales: number;
    returningSales: number;
  };
  lifetime: {
    customers: number;
    repeatCustomers: number;
    repeatRate: number | null;
    averageOrders: number;
    averageLifetimeValue: number;
    averageDaysToSecondOrder: number | null;
  };
  topCustomers: Array<{ customerId: string; name: string | null; orders: number; delivered: number; sales: number }>;
  /** Monthly cohorts by first order; `retention[i]` is the share that ordered again in month i + 1. */
  cohorts: Array<{ cohort: string; size: number; retention: Array<number | null> }>;
}

export type ReportsInsightKey =
  | "sales_up"
  | "sales_down"
  | "conversion_up"
  | "conversion_down"
  | "funnel_leak"
  | "low_confirmation"
  | "weak_governorate"
  | "strong_governorate"
  | "carrier_gap"
  | "low_converting_product"
  | "high_return_product"
  | "abandoned_uncontacted"
  | "peak_time"
  | "returning_share";

export interface ReportsInsight {
  key: ReportsInsightKey;
  tone: "good" | "bad" | "warn" | "info";
  params: Record<string, string | number | null>;
}

export interface ReportsInsights {
  range: ReportsRange;
  currency: string;
  insights: ReportsInsight[];
}

export type ReportsExportName =
  | "sales"
  | "channels"
  | "products"
  | "landing_pages"
  | "governorates"
  | "carriers"
  | "customers";

// -------------------------------------------------------------- functions --

const base = (workspaceId: string) => `/workspaces/${workspaceId}/analytics/reports`;

function reportsQuery(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export async function reportsGetSales(
  client: ApiClient,
  workspaceId: string,
  params: ReportsSalesParams = {}
): Promise<ReportsSales> {
  const { report } = await client.request<{ report: ReportsSales }>(`${base(workspaceId)}/sales${reportsQuery(params)}`);
  return report;
}

export async function reportsGetProducts(
  client: ApiClient,
  workspaceId: string,
  params: ReportsRangeParams & { limit?: number } = {}
): Promise<ReportsProducts> {
  const { report } = await client.request<{ report: ReportsProducts }>(
    `${base(workspaceId)}/products${reportsQuery(params)}`
  );
  return report;
}

export async function reportsGetDelivery(
  client: ApiClient,
  workspaceId: string,
  params: ReportsRangeParams = {}
): Promise<ReportsDelivery> {
  const { report } = await client.request<{ report: ReportsDelivery }>(
    `${base(workspaceId)}/delivery${reportsQuery(params)}`
  );
  return report;
}

export async function reportsGetCustomers(
  client: ApiClient,
  workspaceId: string,
  params: ReportsRangeParams = {}
): Promise<ReportsCustomers> {
  const { report } = await client.request<{ report: ReportsCustomers }>(
    `${base(workspaceId)}/customers${reportsQuery(params)}`
  );
  return report;
}

export async function reportsGetInsights(
  client: ApiClient,
  workspaceId: string,
  params: ReportsRangeParams = {}
): Promise<ReportsInsights> {
  const { insights } = await client.request<{ insights: ReportsInsights }>(
    `${base(workspaceId)}/insights${reportsQuery(params)}`
  );
  return insights;
}

/** A report table as a CSV file (UTF-8 with a BOM, so Excel reads Arabic names). */
export async function reportsExportCsv(
  client: ApiClient,
  workspaceId: string,
  report: ReportsExportName,
  params: ReportsRangeParams = {}
): Promise<Blob> {
  // `rawFetch` is private on ApiClient; it carries the token, refresh and ApiError.
  const raw = client as unknown as { rawFetch(path: string, init: RequestInit): Promise<Response> };
  const res = await raw.rawFetch(`${base(workspaceId)}/export${reportsQuery({ ...params, report })}`, {
    headers: { Accept: "text/csv" },
  });
  return res.blob();
}
