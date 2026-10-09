/**
 * First-touch / last-touch attribution (SPEC §13.4): how the shopper reached
 * the store, kept in a 30-day cookie so it survives between visits.
 *
 *   first  the first arrival that carried a campaign, click id, referral or
 *          an outside referrer — written once per 30 days
 *   last   the most recent such arrival — rewritten each time
 *
 * A plain direct visit changes neither, so "came from a Facebook ad last
 * week, typed the address today" still credits the ad. The pair rides on
 * every analytics batch (lib/analyticsEvents.ts); the API copies it onto the
 * order when the order's purchase event arrives. No personal data.
 */

export interface Touch {
  source?: string;
  medium?: string;
  campaign?: string;
  content?: string;
  term?: string;
  /** The ad's id: the ad_id the suggested ad links carry (dashboard → Ad spend), matched to spend. */
  adId?: string;
  fbclid?: string;
  ttclid?: string;
  gclid?: string;
  scCid?: string;
  /** The click ids X, Reddit, Microsoft Ads and Taboola add to their ad links (handoff 254). */
  twclid?: string;
  rdt_cid?: string;
  msclkid?: string;
  tblci?: string;
  ref?: string;
  referrer?: string;
  landingPage?: string;
  /** ISO time of the arrival. */
  at?: string;
}

export interface Touches {
  first?: Touch;
  last?: Touch;
}

const COOKIE = "zimos_touch";
const MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const MAX = 200;

const clip = (value: string | null | undefined, max = MAX): string | undefined => {
  const v = value?.trim();
  return v ? v.slice(0, max) : undefined;
};

/** What this arrival says about where the visit came from, or null for a plain direct one. */
export function touchFrom(input: { search: string; pathname: string; referrer: string; host: string; now?: Date }): Touch | null {
  const params = new URLSearchParams(input.search);
  let referrer: string | undefined;
  let referrerHost: string | undefined;
  try {
    if (input.referrer) {
      const url = new URL(input.referrer);
      if (url.host && url.host !== input.host) {
        referrer = input.referrer.slice(0, 300);
        referrerHost = url.host;
      }
    }
  } catch {
    /* not a URL */
  }
  const touch: Touch = {
    source: clip(params.get("utm_source")) ?? referrerHost,
    medium: clip(params.get("utm_medium")),
    campaign: clip(params.get("utm_campaign")),
    content: clip(params.get("utm_content")),
    term: clip(params.get("utm_term")),
    adId: clip(params.get("ad_id"), 100),
    fbclid: clip(params.get("fbclid")),
    ttclid: clip(params.get("ttclid")),
    gclid: clip(params.get("gclid")),
    scCid: clip(params.get("ScCid")),
    twclid: clip(params.get("twclid")),
    rdt_cid: clip(params.get("rdt_cid")),
    msclkid: clip(params.get("msclkid")),
    tblci: clip(params.get("tblci")),
    ref: clip(params.get("ref")),
    referrer,
  };
  for (const key of Object.keys(touch) as Array<keyof Touch>) if (touch[key] === undefined) delete touch[key];
  if (Object.keys(touch).length === 0) return null;
  touch.landingPage = `${input.pathname}${input.search}`.slice(0, 300);
  touch.at = (input.now ?? new Date()).toISOString();
  return touch;
}

function readCookie(): Touches {
  try {
    const match = document.cookie.match(new RegExp("(?:^|; )" + COOKIE + "=([^;]*)"));
    if (!match) return {};
    const parsed: unknown = JSON.parse(decodeURIComponent(match[1]));
    return parsed && typeof parsed === "object" ? (parsed as Touches) : {};
  } catch {
    return {};
  }
}

function writeCookie(touches: Touches) {
  try {
    const value = encodeURIComponent(JSON.stringify(touches));
    // Two touches of clipped fields stay well under the 4 KB cookie limit; if a
    // pathological URL still overflows, keep the campaign fields and drop the URLs.
    if (value.length > 3500) {
      for (const t of [touches.first, touches.last]) {
        if (t) {
          delete t.referrer;
          delete t.landingPage;
        }
      }
    }
    document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(touches))}; Max-Age=${MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
  } catch {
    /* cookies blocked: attribution falls back to the session's */
  }
}

let capturedFor: string | null = null;

/**
 * The stored touches, after recording this page load if it is a new arrival.
 * Each landing URL is looked at once per page load, so client-side navigation
 * does not turn an internal page into a "touch".
 */
export function currentTouches(): Touches | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const touches = readCookie();
    const key = window.location.pathname + window.location.search + "|" + document.referrer;
    if (capturedFor === null) {
      capturedFor = key;
      const touch = touchFrom({
        search: window.location.search,
        pathname: window.location.pathname,
        referrer: document.referrer,
        host: window.location.host,
      });
      if (touch) {
        if (!touches.first) touches.first = touch;
        touches.last = touch;
        writeCookie(touches);
      }
    }
    return touches.first || touches.last ? touches : undefined;
  } catch {
    return undefined;
  }
}
