import { API_BASE_URL, DASHBOARD_URL } from "@/lib/urls";

/**
 * Anonymous visit counting for this site, shown in the platform console.
 * No cookies and no third-party code: a random id in localStorage (the API
 * keeps only a daily hash of it), a random id per tab session in
 * sessionStorage, and nothing at all when the browser asks not to be tracked
 * (Do Not Track or Global Privacy Control). Every failure is silent.
 *
 * Off unless NEXT_PUBLIC_SITE_ANALYTICS_ENABLED is exactly "true".
 */

export const SITE_ANALYTICS_ENABLED = process.env.NEXT_PUBLIC_SITE_ANALYTICS_ENABLED === "true";

const VISITOR_KEY = "zimos.site.visitor";
const SESSION_KEY = "zimos.site.session";
export const PING_MS = 15_000;

type SiteEvent = "view" | "ping" | "cta_click";

type Payload = {
  visitorId: string;
  sessionId: string;
  event: SiteEvent;
  path: string;
  locale?: "ar" | "en";
  referrer?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};

function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function stored(storage: Storage, key: string): string {
  const existing = storage.getItem(key);
  if (existing && /^[A-Za-z0-9-]{8,64}$/.test(existing)) return existing;
  const fresh = randomId();
  storage.setItem(key, fresh);
  return fresh;
}

/** Do Not Track or Global Privacy Control: the visitor asked not to be counted. */
export function trackingRefused(): boolean {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean; msDoNotTrack?: string };
  const win = window as Window & { doNotTrack?: string };
  const dnt = nav.doNotTrack ?? win.doNotTrack ?? nav.msDoNotTrack;
  return nav.globalPrivacyControl === true || dnt === "1" || dnt === "yes";
}

let ids: { visitorId: string; sessionId: string } | null = null;

/** The visitor and session ids, or null when counting is off or refused. */
export function siteIds(): { visitorId: string; sessionId: string } | null {
  if (!SITE_ANALYTICS_ENABLED || typeof window === "undefined") return null;
  if (ids) return ids;
  try {
    if (trackingRefused()) return null;
    ids = { visitorId: stored(window.localStorage, VISITOR_KEY), sessionId: stored(window.sessionStorage, SESSION_KEY) };
    return ids;
  } catch {
    return null;
  }
}

const clip = (value: string | null | undefined, max: number) => (value ? value.slice(0, max) : undefined);

function localeOf(path: string): "ar" | "en" | undefined {
  const first = path.split("/")[1];
  return first === "ar" || first === "en" ? first : undefined;
}

let firstViewSent = false;

export function sendSiteEvent(event: SiteEvent, path = window.location.pathname): void {
  const current = siteIds();
  if (!current) return;
  const body: Payload = { ...current, event, path: clip(path, 300) || "/", locale: localeOf(path) };

  // Where the visit came from goes with the session's first view only.
  if (event === "view" && !firstViewSent) {
    firstViewSent = true;
    const params = new URLSearchParams(window.location.search);
    body.utmSource = clip(params.get("utm_source"), 100);
    body.utmMedium = clip(params.get("utm_medium"), 100);
    body.utmCampaign = clip(params.get("utm_campaign"), 100);
    try {
      if (document.referrer && new URL(document.referrer).host !== window.location.host) {
        body.referrer = clip(document.referrer, 500);
      }
    } catch {
      // An unreadable referrer is left out.
    }
  }

  try {
    // text/plain keeps this a simple request: no CORS preflight.
    void fetch(`${API_BASE_URL}/public/site-events`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(body),
      keepalive: true,
      credentials: "omit",
      mode: "cors",
    }).catch(() => undefined);
  } catch {
    // Never surfaces.
  }
}

/** A sign-up or sign-in link into the dashboard, or null for any other link. */
export function dashboardCta(href: string): "register" | "login" | null {
  if (href.startsWith(`${DASHBOARD_URL}/register`)) return "register";
  if (href.startsWith(`${DASHBOARD_URL}/login`)) return "login";
  return null;
}

/** The sign-up link with this session's id as ?sv=, so the account links to it. */
export function withSiteSession(href: string, sessionId: string): string {
  try {
    const url = new URL(href);
    url.searchParams.set("sv", sessionId);
    return url.toString();
  } catch {
    return href;
  }
}
