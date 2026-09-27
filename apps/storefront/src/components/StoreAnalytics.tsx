"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import {
  configureTracker,
  flush,
  recordNavigation,
  sendContextEvent,
  sendPageView,
  setTrackingContext,
  type EventData,
  type TrackerOptions,
} from "@/lib/analyticsEvents";
import { EVENT_ATTRIBUTE, collectEventData, isExternalClick } from "@/lib/trackerCore";

/**
 * The store's own analytics (lib/analyticsEvents.ts), with the reach of
 * Umami's tracker:
 *  - one `page_view` per navigation, first render included — seen through
 *    Next's router (usePathname / useSearchParams) and, for code that bypasses
 *    it, a one-time patch of history.pushState / replaceState; both go through
 *    recordNavigation, which only reports a changed url, so one navigation is
 *    never counted twice;
 *  - `window.zimos.track(name, data)` for custom events, and click
 *    delegation for `[data-zimos-event]` elements (every `data-zimos-event-*`
 *    attribute becomes event data);
 *  - a flush of whatever is still queued when the page goes away.
 *
 * Reads the search params, so the layout wraps it in <Suspense>. Mounted
 * once, by the store layout (app/store/[workspaceId]/layout.tsx). The funnel
 * layout (`/f/…`) is nested inside that one, so mounting it there too would
 * count every funnel page twice; the funnel side only adds its funnelId to
 * the tracking context (components/funnel/FunnelStep.tsx).
 */

export interface ZimosTracker {
  /** `zimos.track("signup", { plan: "pro" })` or `zimos.track({ name, data })`. */
  track: (nameOrPayload: string | { name: string; data?: EventData }, data?: EventData) => void;
}

declare global {
  interface Window {
    zimos?: ZimosTracker;
  }
}

type HistoryPatch = History & { __zimosPatched?: true };

/** Wrap pushState / replaceState once so in-app navigations outside Next's router still count. */
function patchHistory(onNavigate: (url: string) => void) {
  const history = window.history as HistoryPatch;
  if (history.__zimosPatched) return;
  history.__zimosPatched = true;
  for (const method of ["pushState", "replaceState"] as const) {
    const orig = history[method];
    history[method] = function (this: History, ...args: Parameters<History["pushState"]>) {
      const result = orig.apply(this, args);
      try {
        const url = args[2];
        if (url) onNavigate(String(url));
      } catch {
        /* never break navigation */
      }
      return result;
    };
  }
}

function installGlobal() {
  if (window.zimos) return;
  window.zimos = {
    track(nameOrPayload, data) {
      try {
        if (typeof nameOrPayload === "string") sendContextEvent({ name: nameOrPayload, data });
        else if (nameOrPayload && typeof nameOrPayload === "object" && nameOrPayload.name) sendContextEvent(nameOrPayload);
      } catch {
        /* ignore */
      }
    },
  };
}

function onDocumentClick(e: MouseEvent) {
  try {
    const target = e.target as Element | null;
    const el = target?.closest?.(`[${EVENT_ATTRIBUTE}]`);
    if (!el) return;
    const name = el.getAttribute(EVENT_ATTRIBUTE);
    if (!name) return;
    const data = collectEventData(el.getAttributeNames(), (n) => el.getAttribute(n));
    const send = () => sendContextEvent({ name, data: Object.keys(data).length ? data : undefined });

    if (el.tagName === "A" && (el as HTMLAnchorElement).href) {
      const anchor = el as HTMLAnchorElement;
      const external = isExternalClick({ target: anchor.target, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey, metaKey: e.metaKey, button: e.button });
      if (external) {
        send();
        return;
      }
      // Like Umami: send now (the batch is flushed so the request is in flight
      // with keepalive), then perform the navigation ourselves.
      e.preventDefault();
      send();
      flush(false);
      const dest = anchor.target === "_top" && window.top ? window.top.location : window.location;
      dest.href = anchor.href;
      return;
    }
    send();
  } catch {
    /* a tracking failure must never swallow a click */
  }
}

export function StoreAnalytics({
  workspaceId,
  websiteId,
  tag,
  options,
}: {
  workspaceId: string;
  websiteId?: string;
  tag?: string;
  options?: TrackerOptions;
}) {
  const pathname = usePathname();
  const search = useSearchParams();

  // Set during render, not in an effect: effects run children-first, so a
  // page's own tracking (begin_checkout on mount, a funnel step's
  // view_content) would otherwise fire before this layout-level component
  // had named the store. The call is idempotent and touches no React state.
  if (typeof window !== "undefined") {
    if (options) configureTracker(options);
    setTrackingContext({ workspaceId, websiteId, tag });
  }

  useEffect(() => {
    setTrackingContext({ workspaceId, websiteId, tag });
  }, [workspaceId, websiteId, tag]);

  // `search` is a dependency so a query-only navigation (?page=2) counts too.
  // The first run seeds the referrer chain (document.referrer) and always
  // sends; later runs send only when recordNavigation sees a new url.
  useEffect(() => {
    const first = !seeded;
    seeded = true;
    if (recordNavigation(window.location.href) || first) sendPageView(workspaceId);
  }, [workspaceId, pathname, search]);

  useEffect(() => {
    installGlobal();
    patchHistory((url) => {
      if (recordNavigation(url)) sendPageView(workspaceId);
    });
    document.addEventListener("click", onDocumentClick, true);
    const onHide = () => flush(true);
    window.addEventListener("pagehide", onHide);
    return () => {
      document.removeEventListener("click", onDocumentClick, true);
      window.removeEventListener("pagehide", onHide);
      flush(false);
    };
  }, [workspaceId]);

  return null;
}

// Module-level so React strict mode's double effect run does not send two
// first-page views.
let seeded = false;
