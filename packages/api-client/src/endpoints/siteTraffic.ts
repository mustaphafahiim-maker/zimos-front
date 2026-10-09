import type { ApiClient } from "../client";

/**
 * Marketing-site traffic for the platform console
 * (siteAnalytics/siteTrafficAdminRoutes.js). Nothing identifies a person: the
 * server keeps an HMAC of the browser's random id and the day, no IP, no cookie.
 */

export type SiteTrafficRange = "today" | "7d" | "30d";

export interface SiteTrafficSummary {
  /** Whether the server is collecting (SITE_ANALYTICS_ENABLED). The numbers are answered either way. */
  enabled: boolean;
  range: SiteTrafficRange;
  since: string;
  /** Page views. */
  visits: number;
  /** A visitor is counted once per day. */
  uniqueVisitors: number;
  avgSecondsOnSite: number;
  /** At most 10. */
  topPages: { path: string; visits: number }[];
  /** At most 10. `source` is the session's first utmSource, else the referrer's host, else "direct". */
  topSources: { source: string; sessions: number }[];
  /** Sessions: viewed, clicked a sign-up button, signed up. */
  funnel: { visit: number; ctaClick: number; signup: number };
  /** One row per UTC day of the range. */
  daily: { day: string; visits: number; uniqueVisitors: number }[];
}

/** Where an account came from, on GET /admin/users/:id (`user.acquisition`). */
export interface SiteAcquisition {
  landingPath: string | null;
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  firstVisitAt: string | null;
  signedUpAt: string | null;
  secondsBeforeSignup: number | null;
}

/** GET /admin/site-traffic/summary — `overview.view`. Days are UTC days, today included. */
export function adminSiteTrafficSummary(client: ApiClient, range: SiteTrafficRange = "today"): Promise<SiteTrafficSummary> {
  return client.request<SiteTrafficSummary>(`/admin/site-traffic/summary?range=${range}`);
}

/** The acquisition of a console user detail; null when the account did not come through the site. */
export function siteAcquisitionOfUser(user: unknown): SiteAcquisition | null {
  return (user as { acquisition?: SiteAcquisition | null }).acquisition ?? null;
}
