/**
 * The pure half of the store's own tracker (lib/analyticsEvents.ts,
 * components/StoreAnalytics.tsx): URL normalisation, referrer chaining, the
 * data-attribute collection and the opt-out rules — everything that Umami's
 * tracker does that does not need a browser. No imports, no globals, so it
 * runs under Node's test runner (`node --test src/lib/trackerCore.test.mjs`).
 * The values come in as arguments; the browser side reads them and passes
 * them here.
 */

export interface UrlOptions {
  /** Drop `?query` from tracked urls (Umami `data-exclude-search`). */
  excludeSearch?: boolean;
  /** Drop `#hash` from tracked urls (Umami `data-exclude-hash`). */
  excludeHash?: boolean;
}

/** The store's defaults: keep the search (a `?page=2` is a page), drop the hash. */
export const DEFAULT_URL_OPTIONS: Required<UrlOptions> = { excludeSearch: false, excludeHash: true };

/**
 * Umami's `normalize`: resolves `raw` against `base` and applies the
 * exclude options. Returns the absolute href, or `raw` untouched when it is
 * empty or not a URL.
 */
export function normalizeUrl(raw: string, base: string, options: UrlOptions = {}): string {
  if (!raw) return raw;
  try {
    const u = new URL(raw, base);
    if (options.excludeSearch) u.search = "";
    if (options.excludeHash) u.hash = "";
    return u.toString();
  } catch {
    return raw;
  }
}

/**
 * Umami's `stripOrigin`: a same-origin url becomes its path (`/a?b#c`) so the
 * store's own hostname is never stored as a referrer; anything else — another
 * site, an already-relative path, an empty string — is returned as is.
 */
export function stripOrigin(url: string, origin: string): string {
  if (!url || !origin) return url;
  return url === origin || url.startsWith(origin + "/") ? url.slice(origin.length) : url;
}

/** `/path?search#hash` for the current page — the tracked `url`. */
export function pageUrl(href: string, origin: string, options: UrlOptions = {}): string {
  const normalized = normalizeUrl(href, href, options);
  const stripped = stripOrigin(normalized, origin);
  return stripped || "/";
}

export interface NavigationState {
  /** The tracked url of the current page. */
  url: () => string;
  /** What to report as `referrer`: origin-stripped, like Umami. */
  referrer: () => string;
  /**
   * The page changed to `next` (any href or path). Returns true when the url
   * differs from the current one — the caller sends a page_view only then, so
   * Next's router effect and the history patch never both count one
   * navigation. On a change the old url becomes the referrer.
   */
  navigate: (next: string) => boolean;
}

/**
 * Referrer chaining exactly like Umami's `currentUrl` / `currentRef` pair:
 * the first page reports `document.referrer`, every later page reports the
 * previous in-app url.
 */
export function createNavigationState(input: {
  href: string;
  referrer: string;
  origin: string;
  options?: UrlOptions;
}): NavigationState {
  const options = input.options ?? {};
  const base = input.href;
  let currentUrl = pageUrl(input.href, input.origin, options);
  let currentRef = normalizeUrl(input.referrer, base, options);

  return {
    url: () => currentUrl,
    referrer: () => stripOrigin(currentRef, input.origin),
    navigate(next) {
      if (!next) return false;
      // Relative inputs resolve against the current page, as pushState does:
      // `?page=2` on /shop yields /shop?page=2.
      const resolved = pageUrl(normalizeUrl(next, absolute(currentUrl, input.origin), options), input.origin, options);
      if (resolved === currentUrl) return false;
      currentRef = currentUrl;
      currentUrl = resolved;
      return true;
    },
  };
}

function absolute(path: string, origin: string) {
  return path.startsWith("/") ? origin + path : path;
}

// --- custom events ---------------------------------------------------------------

/** The click-delegation attribute (Umami: `data-umami-event`). */
export const EVENT_ATTRIBUTE = "data-zimos-event";
const EVENT_DATA_ATTRIBUTE = /^data-zimos-event-([\w-]+)$/;

/**
 * Every `data-zimos-event-*` attribute of an element, keyed by the suffix:
 * `data-zimos-event-plan="pro"` → `{ plan: "pro" }`. The plain
 * `data-zimos-event` (the name) is not included.
 */
export function collectEventData(
  attributeNames: readonly string[],
  getAttribute: (name: string) => string | null,
): Record<string, string> {
  const data: Record<string, string> = {};
  for (const name of attributeNames) {
    const match = name.match(EVENT_DATA_ATTRIBUTE);
    if (match) data[match[1]] = getAttribute(name) ?? "";
  }
  return data;
}

/** Umami's rule for anchors: leave the browser alone when the click opens elsewhere. */
export function isExternalClick(input: {
  target?: string | null;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  button?: number;
}): boolean {
  return (
    input.target === "_blank" ||
    Boolean(input.ctrlKey) ||
    Boolean(input.shiftKey) ||
    Boolean(input.metaKey) ||
    input.button === 1
  );
}

// --- opt-out ---------------------------------------------------------------------

/** localStorage flag that switches the tracker off entirely (Umami: `umami.disabled`). */
export const DISABLED_KEY = "zimos.analytics.disabled";
/** localStorage flag that makes the tracker honour the browser's Do Not Track. */
export const RESPECT_DNT_KEY = "zimos.dnt";

/** True when any of the browser's Do Not Track signals is on. */
export function hasDoNotTrack(...signals: Array<string | number | null | undefined>): boolean {
  return signals.some((v) => v === 1 || v === "1" || v === "yes");
}

/**
 * Whether nothing should be sent at all. DNT only counts when the store
 * opted in (`respectDnt`) or the shopper set `zimos.dnt` — it is the
 * merchant's own store, so the default is Umami's: off.
 */
export function isTrackingDisabled(input: {
  disabledFlag?: string | null;
  dntFlag?: string | null;
  respectDnt?: boolean;
  doNotTrack: boolean;
}): boolean {
  if (input.disabledFlag === "1") return true;
  const respect = Boolean(input.respectDnt) || input.dntFlag === "1";
  return respect && input.doNotTrack;
}
