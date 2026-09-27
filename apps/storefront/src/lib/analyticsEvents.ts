/**
 * First-party analytics: the store's own sessions / conversion events, sent
 * to POST /store/:workspaceId/events for the merchant dashboard. Nothing
 * third-party runs here, and nothing here can break the store — every call is
 * fire-and-forget behind try/catch, batched (lib/eventQueue.ts) and carried
 * with the visitor, session and attribution from lib/visitor.ts.
 *
 * Who sends what:
 *  - components/StoreAnalytics.tsx: `page_view` per navigation, the pagehide
 *    flush, and the tracking context (which store the events belong to);
 *  - lib/track.ts: the commerce events, alongside the ad pixels.
 */
import { createEventQueue } from "./eventQueue";
import { captureAttribution, getSessionId, getVisitorId, type Attribution } from "./visitor";

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000/api/v1";

export type AnalyticsEventName = "page_view" | "view_content" | "add_to_cart" | "begin_checkout" | "purchase";

export interface AnalyticsEvent {
  name: AnalyticsEventName;
  path?: string;
  websiteId?: string;
  funnelId?: string;
  orderId?: string;
  /** Integer minor units. */
  revenueAmount?: number;
  dedupeId?: string;
  occurredAt?: string;
  metadata?: Record<string, unknown>;
}

export interface TrackingContext {
  workspaceId: string;
  websiteId?: string;
  funnelId?: string;
}

interface Batch {
  visitorId: string;
  sessionId: string;
  attribution?: Attribution;
  events: AnalyticsEvent[];
}

// --- context ----------------------------------------------------------------------

let context: TrackingContext | null = null;

/**
 * Which store (and website / funnel) later events belong to. Partial updates
 * merge, so the store layout sets the workspace once and a funnel step adds
 * or removes its funnelId without touching the rest. `undefined` clears a key.
 */
export function setTrackingContext(next: Partial<TrackingContext>) {
  const merged = { ...(context ?? {}), ...next };
  context = merged.workspaceId ? (merged as TrackingContext) : null;
}

export function getTrackingContext(): TrackingContext | null {
  return context;
}

// --- delivery ---------------------------------------------------------------------

function eventsUrl(workspaceId: string) {
  return `${baseUrl}/store/${encodeURIComponent(workspaceId)}/events`;
}

function deliver(workspaceId: string, events: AnalyticsEvent[], urgent: boolean) {
  const body: Batch = {
    visitorId: getVisitorId(),
    sessionId: getSessionId(),
    events,
  };
  const attribution = captureAttribution();
  if (Object.keys(attribution).length > 0) body.attribution = attribution;
  const json = JSON.stringify(body);
  const url = eventsUrl(workspaceId);

  try {
    // Leaving the page: sendBeacon survives the unload where fetch may not.
    if (urgent && typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      if (navigator.sendBeacon(url, new Blob([json], { type: "application/json" }))) return;
    }
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
 * the next second. `path`, `websiteId` and `funnelId` default to the current
 * page and the tracking context. Silent no-op on the server or on any failure.
 */
export function sendEvent(workspaceId: string, event: AnalyticsEvent) {
  if (typeof window === "undefined" || !workspaceId) return;
  try {
    const ctx = context && context.workspaceId === workspaceId ? context : null;
    const full: AnalyticsEvent = {
      ...event,
      path: event.path ?? window.location.pathname,
      occurredAt: event.occurredAt ?? new Date().toISOString(),
    };
    if (full.websiteId === undefined && ctx?.websiteId) full.websiteId = ctx.websiteId;
    if (full.funnelId === undefined && ctx?.funnelId) full.funnelId = ctx.funnelId;
    queueFor(workspaceId).push(full);
  } catch {
    /* never break the store */
  }
}

/**
 * The same, for callers that only know the tracking context (lib/track.ts).
 * Without a context — a tracking call before StoreAnalytics mounted, or on a
 * page outside any store — the event is dropped with a debug line.
 */
export function sendContextEvent(event: AnalyticsEvent) {
  if (!context) {
    if (typeof console !== "undefined") console.debug("[analytics] no tracking context; dropped", event.name);
    return;
  }
  sendEvent(context.workspaceId, event);
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
