/**
 * The merchant's Visitors section (backend: src/modules/analytics/traffic,
 * GET /workspaces/:id/analytics/visitors/*, analytics.view): who visited the
 * store, from where, what they looked at and for how long, the funnel,
 * campaigns and how orders ended per governorate. Always the signed-in
 * store's own visitors; no IP address (raw or hashed) is ever in an answer —
 * a visitor is an anonymous label. All exported names start with `visitors`
 * / `Visitors`.
 */
import type { ApiClient } from "../client";

export type VisitorsRange = "today" | "7d" | "30d";
export type VisitorsOutcomeRange = "30d" | "90d";
export type VisitorsSort = "recent" | "started" | "pages";

export interface VisitorsFilters {
  range?: VisitorsRange;
  /** Two letters, e.g. EG. */
  country?: string;
  /** One of the 27 governorate codes (cairo, giza, …). */
  governorate?: string;
  device?: "mobile" | "tablet" | "laptop" | "desktop";
  /** A UTM source, a referring site, or "direct". */
  source?: string;
}

export interface VisitorsFunnelStep {
  key: "visit" | "product" | "cart" | "checkout" | "order";
  /** Unique visitors who reached the step. */
  visitors: number;
  /** Percent of the step before that did not reach this one; null on the first. */
  dropRate: number | null;
}

export interface VisitorsSummary {
  from: string;
  to: string;
  timeZone: string;
  visits: number;
  visitors: number;
  pageViews: number;
  orders: number;
  /** Visitors who bought ÷ visitors, one decimal; null without visitors. */
  conversionRate: number | null;
  funnel: VisitorsFunnelStep[];
  daily: Array<{ day: string; visits: number; visitors: number }>;
  sources: Array<{ source: string; visits: number; visitors: number; conversionRate: number | null }>;
  countries: Array<{ country: string | null; visits: number }>;
  /** `approximate`: visits placed by the IP's region only; `fromOrders`: by the shopper's own order. */
  governorates: Array<{ governorate: string; visits: number; fromOrders: number; approximate: number }>;
  devices: Array<{ device: string; visits: number }>;
  browsers: Array<{ browser: string; visits: number }>;
  pages: {
    /** Visible time, over the page views that reported one; null when none did. */
    avgDwellMs: number | null;
    timedPageViews: number;
    topPages: Array<{ path: string; views: number; visits: number; avgDwellMs: number | null; timedViews: number }>;
    topProducts: Array<{ productId: string; name: string | null; views: number; visits: number; avgDwellMs: number | null; timedViews: number }>;
  } | null;
  /** Events past the store's daily limit: counted, not kept. */
  overCap: { events: number; pageViews: number } | null;
}

export interface VisitorsVisit {
  sessionId: string;
  /** An anonymous label of the visitor. */
  visitor: string;
  startedAt: string;
  lastSeenAt: string;
  country: string | null;
  city: string | null;
  governorate: string | null;
  /** ip_approx: approximate, from the IP's region; order_address: from the shopper's order. */
  geoSource: "ip_approx" | "order_address" | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  utmContent: string | null;
  utmTerm: string | null;
  referrerDomain: string | null;
  landingPath: string | null;
  /** Only whether each ad click id came with the visit. */
  clickIds: { gclid: boolean; fbclid: boolean; ttclid: boolean };
  pageViews: number;
  dwellMs: number | null;
  reached: { product: boolean; cart: boolean; checkout: boolean; order: boolean };
}

export interface VisitorsVisitPage {
  from: string;
  to: string;
  page: number;
  pageSize: number;
  total: number;
  sessions: VisitorsVisit[];
}

export interface VisitorsTimelineEvent {
  at: string;
  /** page_view, view_product, add_to_cart, begin_checkout, add_payment_info, order, lead, … */
  type: string;
  path: string | null;
  title: string | null;
  dwellMs: number | null;
  productId: string | null;
  productName: string | null;
  orderId: string | null;
  /** Minor units (an order's total). */
  amount: number | null;
}

export interface VisitorsTimeline {
  session: VisitorsVisit;
  quarantined: boolean;
  events: VisitorsTimelineEvent[];
}

export interface VisitorsCampaign {
  source: string | null;
  campaign: string | null;
  visits: number;
  visitors: number;
  carts: number;
  orders: number;
  /** Minor units. */
  revenue: number;
  currency: string;
  conversionRate: number | null;
  /** The spend recorded on the Ads page for the same days and campaign; null when none is. */
  spend: number | null;
  /** Spend ÷ orders; null without spend or orders. */
  cpa: number | null;
}

export interface VisitorsGovernorateOutcome {
  governorate: string;
  finished: number;
  inProgress: number;
  delivered: number;
  returned: number;
  cancelled: number;
  enough: boolean;
  deliveryRate: number | null;
  returnRate: number | null;
  cancelRate: number | null;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/analytics/visitors`;

function query(params: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== "") q.set(key, String(value));
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function visitorsSummary(client: ApiClient, workspaceId: string, filters: VisitorsFilters = {}): Promise<VisitorsSummary> {
  return client.request<VisitorsSummary>(`${base(workspaceId)}/summary${query({ ...filters })}`);
}

export function visitorsList(
  client: ApiClient,
  workspaceId: string,
  filters: VisitorsFilters & { page?: number; pageSize?: number; sort?: VisitorsSort } = {}
): Promise<VisitorsVisitPage> {
  return client.request<VisitorsVisitPage>(`${base(workspaceId)}/sessions${query({ ...filters })}`);
}

export function visitorsVisit(client: ApiClient, workspaceId: string, sessionId: string): Promise<VisitorsTimeline> {
  return client.request<VisitorsTimeline>(`${base(workspaceId)}/sessions/${encodeURIComponent(sessionId)}`);
}

export function visitorsCampaigns(client: ApiClient, workspaceId: string, filters: VisitorsFilters = {}): Promise<{ from: string; to: string; campaigns: VisitorsCampaign[] }> {
  return client.request<{ from: string; to: string; campaigns: VisitorsCampaign[] }>(`${base(workspaceId)}/campaigns${query({ ...filters })}`);
}

export function visitorsOutcomes(
  client: ApiClient,
  workspaceId: string,
  range: VisitorsOutcomeRange = "90d"
): Promise<{ from: string; to: string; minOrders: number; governorates: VisitorsGovernorateOutcome[] }> {
  return client.request<{ from: string; to: string; minOrders: number; governorates: VisitorsGovernorateOutcome[] }>(
    `${base(workspaceId)}/governorates${query({ range })}`
  );
}
