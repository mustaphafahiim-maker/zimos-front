/**
 * Sends a standard commerce event to every ad pixel the merchant configured
 * (loaded by components/TrackingPixels.tsx). Each platform is only called if
 * its script is on the page, so a store with no pixels sends nothing.
 */
export type TrackEvent = "PageView" | "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase";

export interface TrackData {
  /** Integer minor units, e.g. piastres. */
  valueMinor?: number;
  currency?: string;
  contentIds?: string[];
  contentName?: string;
  numItems?: number;
  orderId?: string;
}

type Fn = (...args: unknown[]) => void;
type PixelWindow = Window & {
  fbq?: Fn;
  ttq?: { track: Fn; page: Fn };
  snaptr?: Fn;
  gtag?: Fn;
};

const TIKTOK: Record<TrackEvent, string> = {
  PageView: "Pageview",
  ViewContent: "ViewContent",
  AddToCart: "AddToCart",
  InitiateCheckout: "InitiateCheckout",
  Purchase: "CompletePayment",
};
const SNAP: Record<TrackEvent, string> = {
  PageView: "PAGE_VIEW",
  ViewContent: "VIEW_CONTENT",
  AddToCart: "ADD_CART",
  InitiateCheckout: "START_CHECKOUT",
  Purchase: "PURCHASE",
};
const GOOGLE: Record<TrackEvent, string> = {
  PageView: "page_view",
  ViewContent: "view_item",
  AddToCart: "add_to_cart",
  InitiateCheckout: "begin_checkout",
  Purchase: "purchase",
};

export function track(event: TrackEvent, data: TrackData = {}) {
  if (typeof window === "undefined") return;
  const w = window as PixelWindow;
  const value = data.valueMinor !== undefined ? Math.round(data.valueMinor) / 100 : undefined;
  const common = { value, currency: data.currency };

  try {
    if (w.fbq) {
      if (event === "PageView") w.fbq("track", "PageView");
      else
        w.fbq("track", event, {
          ...common,
          content_ids: data.contentIds,
          content_name: data.contentName,
          content_type: "product",
          num_items: data.numItems,
        }, data.orderId ? { eventID: `${event}-${data.orderId}` } : undefined);
    }
    if (w.ttq) {
      if (event === "PageView") w.ttq.page();
      else w.ttq.track(TIKTOK[event], { ...common, content_id: data.contentIds?.[0], content_type: "product", quantity: data.numItems });
    }
    if (w.snaptr) {
      w.snaptr("track", SNAP[event], { price: value, currency: data.currency, item_ids: data.contentIds, number_items: data.numItems, transaction_id: data.orderId });
    }
    if (w.gtag && event !== "PageView") {
      w.gtag("event", GOOGLE[event], { ...common, transaction_id: data.orderId, items: data.contentIds?.map((id) => ({ item_id: id })) });
    }
  } catch {
    /* a broken third-party script must never break the store */
  }
}

/** Fires a Purchase once per order on this device (thank-you page reloads don't double count). */
export function trackPurchaseOnce(orderId: string, data: TrackData) {
  if (typeof window === "undefined") return;
  const key = `zimos_purchase_tracked_${orderId}`;
  try {
    if (window.localStorage.getItem(key)) return;
    window.localStorage.setItem(key, "1");
  } catch {
    /* storage blocked — still send once for this render */
  }
  track("Purchase", { ...data, orderId });
}

/** The pixel IDs components/TrackingPixels loads. */
export interface PixelIds {
  meta?: string;
  tiktok?: string;
  snapchat?: string;
  googleTag?: string;
}

/**
 * The pixel IDs from store metadata. GET /store/:workspaceId sends a `tracking`
 * block that StorefrontMeta doesn't name yet, so it is read defensively: only
 * non-empty strings, and `{}` when the merchant configured none. Plain module
 * code, so server components can call it.
 */
export function pixelIdsOf(store: unknown): PixelIds {
  const tracking = (store as { tracking?: unknown } | null)?.tracking;
  if (!tracking || typeof tracking !== "object") return {};
  const pick = (key: keyof PixelIds) => {
    const v = (tracking as Record<string, unknown>)[key];
    return typeof v === "string" && v.trim() ? v.trim() : undefined;
  };
  return { meta: pick("meta"), tiktok: pick("tiktok"), snapchat: pick("snapchat"), googleTag: pick("googleTag") };
}

/** True when at least one pixel is configured — nothing loads or fires otherwise. */
export function hasPixels(ids: PixelIds): boolean {
  return Boolean(ids.meta || ids.tiktok || ids.snapchat || ids.googleTag);
}
