import { apiClient } from "@/lib/apiClient";

/** Anonymous visits to the marketing site (backend siteAnalytics/siteTrafficService). */
export type SiteTrafficRange = "today" | "7d" | "30d";
export const SITE_TRAFFIC_RANGES: SiteTrafficRange[] = ["today", "7d", "30d"];

export interface SiteTrafficSummary {
  /** Whether the API is collecting (SITE_ANALYTICS_ENABLED); the numbers are shown either way. */
  enabled: boolean;
  range: SiteTrafficRange;
  since: string;
  visits: number;
  /** A visitor's id changes every UTC day, so over several days this is the sum of each day's. */
  uniqueVisitors: number;
  avgSecondsOnSite: number;
  topPages: Array<{ path: string; visits: number }>;
  topSources: Array<{ source: string; sessions: number }>;
  /** Sessions that viewed a page, clicked sign-up / sign-in, and signed up. */
  funnel: { visit: number; ctaClick: number; signup: number };
  /** One row per UTC day, oldest first. */
  daily: Array<{ day: string; visits: number; uniqueVisitors: number }>;
}

export function getSummary(range: SiteTrafficRange) {
  return apiClient.request<SiteTrafficSummary>(`/admin/site-traffic/summary?range=${encodeURIComponent(range)}`);
}
