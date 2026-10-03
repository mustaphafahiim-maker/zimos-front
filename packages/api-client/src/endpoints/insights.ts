/**
 * Insights — the dashboard home overview, sales attribution, real profit and
 * ad spend (backend: src/modules/analytics/overviewService.js and the files
 * next to it).
 *
 * Mounted at /workspaces/:workspaceId/analytics (analytics.view). All exported
 * names in this file are prefixed with `insights` / `Insights`.
 *
 * Money is integer minor units in `currency`. Rates are percentages
 * (12.5 = 12.5%) and null when the denominator is zero.
 */
import type { ApiClient } from "../client";

// ------------------------------------------------------------------ types --

export type InsightsMetricKey =
  | "visits"
  | "orders"
  | "sales"
  | "averageOrderValue"
  | "addToCart"
  | "checkouts"
  | "crossSellAdds"
  | "newOrders"
  | "lostOrders"
  | "conversionRate"
  | "lostRate"
  | "netProfit"
  | "newCustomers"
  | "returningCustomers"
  | "leads"
  | "confirmationRate"
  | "deliveryRate";

export interface InsightsMetric {
  value: number | null;
  /** The same metric for the window before; null when compare=none. */
  previous: number | null;
}

export interface InsightsDay {
  /** YYYY-MM-DD in the store's time zone. */
  date: string;
  visits: number;
  orders: number;
  sales: number;
  addToCart: number;
  checkouts: number;
  crossSell: number;
  lost: number;
  leads: number;
  confirmed: number;
  delivered: number;
}

export interface InsightsFunnelStep {
  step: "visits" | "cart" | "checkout" | "purchase";
  sessions: number;
  rateOfVisits: number | null;
  rateOfPrevious: number | null;
}

export interface InsightsOverview {
  range: { from: string; to: string; timeZone: string };
  previousRange: { from: string; to: string } | null;
  funnelId: string | null;
  currency: string;
  moneyMetrics: InsightsMetricKey[];
  metrics: Record<InsightsMetricKey, InsightsMetric>;
  series: InsightsDay[];
  funnel: InsightsFunnelStep[];
  offers: { type: "bundle" | "bump" | "upsell"; orders: number; quantity: number; total: number }[];
  topSources: { source: string; medium: string | null; visits: number; orders: number; sales: number }[];
  topGovernorates: { name: string; orders: number; sales: number }[];
  devices: { device: string; visits: number }[];
  topProducts: { productId: string | null; name: string | null; quantity: number; sales: number }[];
  topFunnels: { funnelId: string; name: string; orders: number; sales: number }[];
}

export interface InsightsOverviewParams {
  from?: string;
  to?: string;
  compare?: "previous" | "none";
  funnelId?: string;
  currency?: string;
}

// -------------------------------------------------------------- functions --

const base = (workspaceId: string) => `/workspaces/${workspaceId}/analytics`;

/** `?a=1&b=2` from the defined values of `params`; "" when there are none. */
export function insightsQuery(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export async function insightsGetOverview(
  client: ApiClient,
  workspaceId: string,
  params: InsightsOverviewParams = {}
): Promise<InsightsOverview> {
  const { overview } = await client.request<{ overview: InsightsOverview }>(
    `${base(workspaceId)}/overview${insightsQuery(params)}`
  );
  return overview;
}

// ------------------------------------------------------------ attribution --

export type InsightsAttributionGroup = "source" | "medium" | "campaign" | "content";

export interface InsightsAttributionRow {
  /** The UTM value, lower-cased; "" for visits and orders that carry none. */
  key: string;
  visitors: number;
  orders: number;
  confirmed: number;
  sales: number;
  /** Orders the courier actually delivered, and their sales. */
  delivered: number;
  deliveredSales: number;
  conversionRate: number | null;
  averageOrderValue: number;
  /** Null until ad spend is recorded for this key. */
  spend: number | null;
  /** Delivered sales ÷ spend. */
  roas: number | null;
  /** Spend ÷ delivered orders. */
  costPerDelivered: number | null;
}

export interface InsightsAttribution {
  range: { from: string; to: string; timeZone: string };
  currency: string;
  groupBy: InsightsAttributionGroup;
  funnelId: string | null;
  totals: {
    visitors: number;
    orders: number;
    sales: number;
    delivered: number;
    deliveredSales: number;
    spend: number | null;
    roas: number | null;
  };
  rows: InsightsAttributionRow[];
  series: { date: string; visitors: number; orders: number; sales: number }[];
}

export interface InsightsAttributionParams {
  from?: string;
  to?: string;
  groupBy?: InsightsAttributionGroup;
  funnelId?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
}

export async function insightsGetAttribution(
  client: ApiClient,
  workspaceId: string,
  params: InsightsAttributionParams = {}
): Promise<InsightsAttribution> {
  const { attribution } = await client.request<{ attribution: InsightsAttribution }>(
    `${base(workspaceId)}/attribution${insightsQuery(params)}`
  );
  return attribution;
}
