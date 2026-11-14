import { apiClient } from "@/lib/apiClient";

/**
 * Every store's storefront visitors (backend analytics/traffic,
 * /admin/store-traffic/*, workspaces.view): the same numbers the merchant's
 * Visitors section shows, across stores or for one, plus what the events guard
 * kept out. Visits are the ones written with TRAFFIC_DETAILS_ENABLED; a visit
 * the guard flagged is in the protection tab, not in these numbers.
 */

export type TrafficRange = "today" | "7d" | "30d";
export const TRAFFIC_RANGES: TrafficRange[] = ["today", "7d", "30d"];
export type OutcomeRange = "30d" | "90d";
export const OUTCOME_RANGES: OutcomeRange[] = ["30d", "90d"];
export type VisitSort = "recent" | "started" | "pages";
export const VISIT_SORTS: VisitSort[] = ["recent", "started", "pages"];
export const DEVICES = ["mobile", "tablet", "laptop", "desktop"] as const;

export interface TrafficFilters {
  range: TrafficRange;
  workspaceId?: string;
  country?: string;
  governorate?: string;
  device?: string;
  source?: string;
}

/** ip_approx: placed by the IP's region (approximate); order_address: the shopper's own order. */
export type GeoSource = "ip_approx" | "order_address";

export interface FunnelStep {
  key: "visit" | "product" | "cart" | "checkout" | "order";
  /** Unique visitors who reached the step. */
  visitors: number;
  /** Percent of the step before that did not reach this one (null on the first). */
  dropRate: number | null;
}

export interface PagePanels {
  avgDwellMs: number | null;
  timedPageViews: number;
  topPages: Array<{ path: string; views: number; visits: number; avgDwellMs: number | null; timedViews: number }>;
  topProducts: Array<{ productId: string; name: string | null; views: number; visits: number; avgDwellMs: number | null; timedViews: number }>;
}

export interface TrafficSummary {
  from: string;
  to: string;
  timeZone: string;
  visits: number;
  visitors: number;
  pageViews: number;
  orders: number;
  conversionRate: number | null;
  funnel: FunnelStep[];
  daily: Array<{ day: string; visits: number; visitors: number }>;
  sources: Array<{ source: string; visits: number; visitors: number; conversionRate: number | null }>;
  countries: Array<{ country: string | null; visits: number }>;
  governorates: Array<{ governorate: string; visits: number; fromOrders: number; approximate: number }>;
  devices: Array<{ device: string; visits: number }>;
  browsers: Array<{ browser: string; visits: number }>;
  /** Page and product panels: one store at a time (null across every store). */
  pages: PagePanels | null;
  overCap: { events: number; pageViews: number } | null;
}

export interface VisitRow {
  sessionId: string;
  /** An anonymous label of the visitor id. */
  visitor: string;
  startedAt: string;
  lastSeenAt: string;
  country: string | null;
  city: string | null;
  governorate: string | null;
  geoSource: GeoSource | null;
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
  /** Only whether the visit came with each ad click id; the id itself is never kept. */
  clickIds: { gclid: boolean; fbclid: boolean; ttclid: boolean };
  pageViews: number;
  dwellMs: number | null;
  reached: { product: boolean; cart: boolean; checkout: boolean; order: boolean };
  workspaceId: string;
  storeName: string | null;
  /** The visitor's IP hashed with that day's salt: same network, same day, same value. */
  ipHash: string | null;
  flagged: string | null;
}

export interface VisitPage {
  from: string;
  to: string;
  page: number;
  pageSize: number;
  total: number;
  sessions: VisitRow[];
}

export interface VisitEvent {
  at: string;
  type: string;
  path: string | null;
  title: string | null;
  dwellMs: number | null;
  productId: string | null;
  productName: string | null;
  orderId: string | null;
  amount: number | null;
}

export interface VisitTimeline {
  session: VisitRow;
  /** The visit was flagged by the guard: these events are the quarantined ones. */
  quarantined: boolean;
  events: VisitEvent[];
}

export interface CampaignRow {
  workspaceId?: string;
  storeName?: string;
  source: string | null;
  campaign: string | null;
  visits: number;
  visitors: number;
  carts: number;
  orders: number;
  revenue: number;
  currency: string;
  conversionRate: number | null;
  /** Recorded ad spend for the same days (the store's Ads page); null when none is recorded. */
  spend: number | null;
  cpa: number | null;
}

export interface GovernorateOutcome {
  governorate: string;
  finished: number;
  inProgress: number;
  delivered: number;
  returned: number;
  cancelled: number;
  /** At least `minOrders` finished orders: only then are the rates given. */
  enough: boolean;
  deliveryRate: number | null;
  returnRate: number | null;
  cancelRate: number | null;
}

export interface GovernorateOutcomes {
  from: string;
  to: string;
  minOrders: number;
  governorates: GovernorateOutcome[];
}

export interface FilterCounts {
  bot: number;
  rejected: number;
  suspicious: number;
  capped: number;
}

export interface ProtectionSummary {
  enabled: boolean;
  originCheck: "off" | "report" | "enforce";
  dailyCap: number;
  range: TrafficRange;
  totals: FilterCounts;
  byReason: Array<{ kind: string; reason: string; count: number }>;
  bySource: Array<{ kind: string; reason: string; label: string; count: number }>;
  byCountry: Array<FilterCounts & { country: string | null }>;
  byStore: Array<FilterCounts & { workspaceId: string | null; name: string | null; slug: string | null }>;
  daily: Array<FilterCounts & { day: string }>;
  cappedStores: Array<{ workspaceId: string; name: string; slug: string; day: string; stored: number; overflow: number; capReachedAt: string }>;
  flaggedSessions: Array<{
    workspaceId: string;
    storeName: string;
    sessionId: string;
    reason: string;
    isBot: boolean;
    flaggedAt: string;
    excludedEvents: number;
    ipHash: string | null;
    country: string | null;
    device: string | null;
    browser: string | null;
    os: string | null;
  }>;
}

/** The query string of a filter set: empty values are left out. */
export function trafficQuery(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") q.set(key, String(value));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

const get = <T>(path: string, params: Record<string, string | number | undefined | null> = {}) =>
  apiClient.request<T>(`/admin/store-traffic/${path}${trafficQuery(params)}`);

export const getSummary = (f: TrafficFilters) => get<TrafficSummary>("summary", { ...f });
export const getVisits = (f: TrafficFilters & { page: number; pageSize: number; sort: VisitSort }) => get<VisitPage>("sessions", { ...f });
export const getVisit = (workspaceId: string, sessionId: string) =>
  get<VisitTimeline>(`sessions/${encodeURIComponent(workspaceId)}/${encodeURIComponent(sessionId)}`);
export const getCampaigns = (f: TrafficFilters) => get<{ from: string; to: string; campaigns: CampaignRow[] }>("campaigns", { ...f });
export const getOutcomes = (range: OutcomeRange, workspaceId?: string) => get<GovernorateOutcomes>("governorates", { range, workspaceId });
export const getProtection = (range: TrafficRange, workspaceId?: string) => get<ProtectionSummary>("protection", { range, workspaceId });
