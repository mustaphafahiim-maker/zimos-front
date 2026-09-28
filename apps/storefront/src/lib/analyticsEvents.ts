/**
 * First-party analytics: the store's own sessions / conversion events, sent
 * to POST /store/:workspaceId/events for the merchant dashboard. Nothing
 * third-party runs here, and nothing here can break the store — every call is
 * fire-and-forget behind try/catch, batched (lib/eventQueue.ts) and carried
 * with the visitor, session and attribution from lib/visitor.ts. The visitor
 * id is the same one the checkout autosave uses (one per store per tab).
 *
 * What goes out matches Umami's tracker (lib/trackerCore.ts has the pure
 * parts): per batch the screen size, language and hostname; per event the
 * url, title, referrer (document.referrer first, then the previous in-app
 * url), an optional tag, and `data` for custom events.
 *
 * Who sends what:
 *  - components/StoreAnalytics.tsx: `page_view` per navigation (router or
 *    history.pushState), `window.zimos.track`, the `[data-zimos-event]`
 *    clicks, the pagehide flush, and the tracking context;
 *  - lib/track.ts: the commerce events (ad pixels there are still stubbed).
 *
 * A failed or refused request (the API down, a store answering 423 while it
 * is unavailable, a rate limit) is dropped silently: analytics are best
 * effort, and never retried in a way that could compete with the cart or
 * checkout.
 */
import { createEventQueue } from "./eventQueue";
import {
  DEFAULT_URL_OPTIONS,
  DISABLED_KEY,
  RESPECT_DNT_KEY,
  createNavigationState,
  hasDoNotTrack,
  isTrackingDisabled,
  pageUrl,
  type NavigationState,
  type UrlOptions,
} from "./trackerCore";
import { captureAttribution, getSessionId, getVisitorId, type Attribution } from "./visitor";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

/** Umami waits this long after a navigation before reading document.title. */
export const TITLE_DELAY_MS = 300;

export type AnalyticsEventName = "page_view" | "view_content" | "add_to_cart" | "begin_checkout" | "purchase";

/** JSON-compatible custom event data (Umami's EventData). */
export type EventDataValue = boolean | number | string | null | EventData | EventDataValue[];
export interface EventData {
  [key: string]: EventDataValue;
}

export interface AnalyticsEvent {
  /** A standard name, or any custom name (truncated to 50 characters). */
  name: AnalyticsEventName | (string & {});
  path?: string;
  /** `/path?search#hash` of the page (see UrlOptions). */
  url?: string;
  title?: string;
  /** document.referrer on the first page of a visit, then the previous in-app url. */
  referrer?: string;
  tag?: string;
  websiteId?: string;
  funnelId?: string;
  orderId?: string;
  /** Integer minor units. */
  revenueAmount?: number;
  /** ISO 4217 code of revenueAmount. */
  currency?: string;
  dedupeId?: string;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
  /** Custom event data (`window.zimos.track(name, data)`, `data-zimos-event-*`). */
  data?: EventData;
}

export interface TrackingContext {
  workspaceId: string;
  websiteId?: string;
  funnelId?: string;
  /** Free-form label carried on every event (Umami `data-tag`). */
  tag?: string;
}

export interface TrackerOptions extends UrlOptions {
  /** Honour the browser's Do Not Track. Off by default — it is the merchant's own store. */
  respectDnt?: boolean;
}

interface Batch {
  visitorId: string;
  sessionId: string;
  attribution?: Attribution;
  /** `${screen.width}x${screen.height}` */
  screen?: string;
  /** navigator.language */
  language?: string;
  /** location.hostname */
  hostname?: string;
  events: AnalyticsEvent[];
}

const MAX_NAME = 50;

// --- context & options ------------------------------------------------------------

let context: TrackingContext | null = null;
// Set while a merchant looks at a preview (StoreAnalytics): nothing is sent.
let paused = false;
let options: TrackerOptions = { ...DEFAULT_URL_OPTIONS, respectDnt: false };
let navigation: NavigationState | null = null;

/**
 * Which store (and website / funnel / tag) later events belong to. Partial
 * updates merge, so the store layout sets the workspace once and a funnel
 * step adds or removes its funnelId without touching the rest. `undefined`
 * clears a key.
 */
export function setTrackingContext(next: Partial<TrackingContext>) {
  const merged = { ...(context ?? {}), ...next };
  context = merged.workspaceId ? (merged as TrackingContext) : null;
}

export function getTrackingContext(): TrackingContext | null {
  return context;
}

/** Stop (or resume) sending anything — a merchant's preview is not a visit. */
export function setTrackingPaused(value: boolean) {
  paused = value;
}

/**
 * Url and opt-out options. Defaults: keep `?search`, drop `#hash`, ignore
 * DNT. Changing the url options resets the referrer chain so the next
 * page_view is measured with the new rules.
 */
export function configureTracker(next: TrackerOptions) {
  const before = options;
  options = { ...options, ...next };
  if (before.excludeSearch !== options.excludeSearch || before.excludeHash !== options.excludeHash) navigation = null;
}

export function getTrackerOptions(): Readonly<TrackerOptions> {
  return options;
}

function readFlag(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** `zimos.analytics.disabled=1`, or Do Not Track when the store (or the shopper) asked for it. */
export function trackingDisabled(): boolean {
  if (typeof window === "undefined" || paused) return true;
  const w = window as Window & { doNotTrack?: string | number | null };
  const nav = navigator as Navigator & { msDoNotTrack?: string | number | null };
  return isTrackingDisabled({
    disabledFlag: readFlag(DISABLED_KEY),
    dntFlag: readFlag(RESPECT_DNT_KEY),
    respectDnt: options.respectDnt,
    doNotTrack: hasDoNotTrack(w.doNotTrack, nav.doNotTrack, nav.msDoNotTrack),
  });
}

// --- page state -------------------------------------------------------------------

function nav(): NavigationState {
  if (!navigation) {
    navigation = createNavigationState({
      href: window.location.href,
      referrer: document.referrer,
      origin: window.location.origin,
      options,
    });
  }
  return navigation;
}

/**
 * The page moved to `href` (or a path). True when the url actually changed —
 * only then does the caller send a page_view, so a navigation seen by both
 * Next's router and the history patch is counted once.
 */
export function recordNavigation(href: string = window.location.href): boolean {
  if (typeof window === "undefined") return false;
  try {
    return nav().navigate(href);
  } catch {
    return false;
  }
}

/** The tracked url of the current page, by the current options. */
export function currentUrl(): string {
  try {
    return nav().url();
  } catch {
    return pageUrl(window.location.href, window.location.origin, options);
  }
}

function currentReferrer(): string {
  try {
    return nav().referrer();
  } catch {
    return "";
  }
}

function pageTitle(): string | undefined {
  try {
    const t = document.title;
    return t ? t.slice(0, 500) : undefined;
  } catch {
    return undefined;
  }
}

// --- delivery ---------------------------------------------------------------------

function eventsUrl(workspaceId: string) {
  return `${baseUrl}/store/${encodeURIComponent(workspaceId)}/events`;
}

function deliver(workspaceId: string, events: AnalyticsEvent[], urgent: boolean) {
  const body: Batch = {
    visitorId: getVisitorId(workspaceId),
    sessionId: getSessionId(),
    events,
  };
  const attribution = captureAttribution();
  if (Object.keys(attribution).length > 0) body.attribution = attribution;
  try {
    if (window.screen) body.screen = `${window.screen.width}x${window.screen.height}`;
    if (navigator.language) body.language = navigator.language;
    if (window.location.hostname) body.hostname = window.location.hostname;
  } catch {
    /* fields are optional */
  }
  const json = JSON.stringify(body);
  const url = eventsUrl(workspaceId);

  // Leaving the page: sendBeacon survives the unload where fetch may not. Some
  // browsers refuse (or throw on) a cross-origin JSON beacon; fetch with
  // keepalive is the fallback either way.
  if (urgent && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    try {
      if (navigator.sendBeacon(url, new Blob([json], { type: "application/json" }))) return;
    } catch {
      /* fall through to fetch */
    }
  }
  try {
    void fetch(url, {
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
      body: json,
    }).catch(() => {
      /* the API being down is not the shopper's problem */
    });
  } catch {
    /* ignore */
  }
}

// One queue per workspace: a batch is one request to one store.
const queues = new Map<string, ReturnType<typeof createEventQueue<AnalyticsEvent>>>();

function queueFor(workspaceId: string) {
  let q = queues.get(workspaceId);
  if (!q) {
    q = createEventQueue<AnalyticsEvent>({ send: (events, urgent) => deliver(workspaceId, events, urgent) });
    queues.set(workspaceId, q);
  }
  return q;
}

/**
 * Queues one event for the store; it goes out with whatever else is queued in
 * the next second. `path`, `url`, `title`, `referrer`, `tag`, `websiteId` and
 * `funnelId` default to the current page and the tracking context. Silent
 * no-op on the server, when tracking is disabled, or on any failure.
 */
export function sendEvent(workspaceId: string, event: AnalyticsEvent) {
  if (typeof window === "undefined" || !workspaceId) return;
  try {
    if (trackingDisabled()) return;
    const ctx = context && context.workspaceId === workspaceId ? context : null;
    const full: AnalyticsEvent = {
      ...event,
      name: String(event.name).slice(0, MAX_NAME),
      path: event.path ?? window.location.pathname,
      url: event.url ?? currentUrl(),
      title: event.title ?? pageTitle(),
      referrer: event.referrer ?? currentReferrer(),
      occurredAt: event.occurredAt ?? new Date().toISOString(),
    };
    if (full.tag === undefined && ctx?.tag) full.tag = ctx.tag;
    if (full.websiteId === undefined && ctx?.websiteId) full.websiteId = ctx.websiteId;
    if (full.funnelId === undefined && ctx?.funnelId) full.funnelId = ctx.funnelId;
    for (const key of Object.keys(full) as Array<keyof AnalyticsEvent>) {
      if (full[key] === undefined || full[key] === "") delete full[key];
    }
    queueFor(workspaceId).push(full);
  } catch {
    /* never break the store */
  }
}

/**
 * The same, for callers that only know the tracking context (lib/track.ts,
 * window.zimos). Without a context — a tracking call before StoreAnalytics
 * mounted, or on a page outside any store — the event is dropped with a
 * debug line.
 */
export function sendContextEvent(event: AnalyticsEvent) {
  if (!context) {
    if (typeof console !== "undefined") console.debug("[analytics] no tracking context; dropped", event.name);
    return;
  }
  sendEvent(context.workspaceId, event);
}

/**
 * A page_view for the current page. The title is read TITLE_DELAY_MS later,
 * like Umami, because a client-side navigation updates document.title after
 * the url; the url and referrer are captured now, so a second navigation in
 * that window still reports the right page.
 */
export function sendPageView(workspaceId: string) {
  if (typeof window === "undefined") return;
  const url = currentUrl();
  const referrer = currentReferrer();
  const path = window.location.pathname;
  const occurredAt = new Date().toISOString();
  setTimeout(() => sendEvent(workspaceId, { name: "page_view", path, url, referrer, occurredAt }), TITLE_DELAY_MS);
}

/** Send everything queued now — used on pagehide, when a request may not get another chance. */
export function flush(urgent = true) {
  for (const q of queues.values()) {
    try {
      q.flush(urgent);
    } catch {
      /* ignore */
    }
  }
}
