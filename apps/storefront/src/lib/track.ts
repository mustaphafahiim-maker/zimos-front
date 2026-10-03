import { sendContextEvent, setTrackingContext, type AnalyticsEventName } from "./analyticsEvents";
import { sendToAdPixels } from "./adPixels";

/**
 * Commerce events. Two destinations:
 *
 *  - Ad pixels (Meta, TikTok, Snapchat, Google): lib/adPixels.ts, for the
 *    pixels the merchant configured (components/TrackingPixels loads them);
 *    nothing is sent on a store with none.
 *  - The store's own analytics (lib/analyticsEvents.ts): sent now, once
 *    components/StoreAnalytics has named the store in the tracking context
 *    (setTrackingContext, re-exported for the funnel side).
 *
 * Nothing here can break the store: every call is fire-and-forget.
 */
export { setTrackingContext };

export type TrackEvent = "PageView" | "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase";

export interface TrackData {
  /** Integer minor units, like every amount the API returns. */
  valueMinor?: number;
  currency?: string;
  contentIds?: string[];
  contentName?: string;
  numItems?: number;
  orderId?: string;
}

/**
 * First-party names. PageView is absent on purpose: StoreAnalytics sends
 * `page_view` per navigation itself, so nothing here double counts it.
 */
const FIRST_PARTY: Partial<Record<TrackEvent, AnalyticsEventName>> = {
  ViewContent: "view_content",
  AddToCart: "add_to_cart",
  InitiateCheckout: "begin_checkout",
  Purchase: "purchase",
};

export function track(event: TrackEvent, data: TrackData = {}): void {
  if (typeof window === "undefined") return;
  sendToAdPixels(event, data);
  const own = FIRST_PARTY[event];
  if (!own) return;
  try {
    // Ids and amounts only — no name, phone or email ever leaves here. The
    // API values a purchase from the stored order, never from this amount.
    sendContextEvent({
      name: own,
      orderId: data.orderId,
      revenueAmount: data.valueMinor !== undefined ? Math.round(data.valueMinor) : undefined,
      currency: data.currency,
      dedupeId: own === "purchase" && data.orderId ? `purchase:${data.orderId}` : undefined,
      metadata: {
        ...(data.currency ? { currency: data.currency } : {}),
        ...(data.contentIds?.length ? { contentIds: data.contentIds } : {}),
        ...(data.numItems !== undefined ? { numItems: data.numItems } : {}),
      },
    });
  } catch {
    /* our own analytics never break the store */
  }
}

/** A Purchase that must be reported once per order, however often the page renders. */
export function trackPurchaseOnce(orderId: string, data: TrackData): void {
  if (typeof window === "undefined") return;
  const key = `zimos_purchase_tracked_${orderId}`;
  try {
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "1");
  } catch {
    /* storage blocked — still send once for this render; the API dedupes it */
  }
  track("Purchase", { ...data, orderId });
}
