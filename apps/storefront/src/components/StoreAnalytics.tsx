"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { flush, sendEvent, setTrackingContext } from "@/lib/analyticsEvents";

/**
 * The store's own analytics (lib/analyticsEvents.ts): one `page_view` per
 * client-side navigation, first render included, and a flush of whatever is
 * still queued when the page goes away. Reads the search params, so the
 * layout wraps it in <Suspense>.
 *
 * Mounted once, by the store layout (app/store/[workspaceId]/layout.tsx).
 * The funnel layout (`/f/…`) is nested inside that one, so mounting it there
 * too would count every funnel page twice; the funnel side only adds its
 * funnelId to the tracking context (components/funnel/FunnelStep.tsx).
 */
export function StoreAnalytics({ workspaceId, websiteId }: { workspaceId: string; websiteId?: string }) {
  const pathname = usePathname();
  const search = useSearchParams();

  // Set during render, not in an effect: effects run children-first, so a
  // page's own tracking (begin_checkout on mount, a funnel step's
  // view_content) would otherwise fire before this layout-level component
  // had named the store. The call is idempotent and touches no React state.
  if (typeof window !== "undefined") setTrackingContext({ workspaceId, websiteId });

  useEffect(() => {
    setTrackingContext({ workspaceId, websiteId });
  }, [workspaceId, websiteId]);

  // `search` is a dependency so a query-only navigation (?page=2) counts too;
  // the path itself stays the pathname, as the API expects.
  useEffect(() => {
    sendEvent(workspaceId, { name: "page_view", path: pathname });
  }, [workspaceId, pathname, search]);

  useEffect(() => {
    const onHide = () => flush(true);
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      flush(false);
    };
  }, []);

  return null;
}
