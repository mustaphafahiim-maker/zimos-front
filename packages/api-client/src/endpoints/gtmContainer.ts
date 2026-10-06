/**
 * Google Tag Manager: a ready-made container and the dataLayer events it
 * listens to (backend handoff item 170; src/modules/marketing/gtmContainer.js).
 *
 *   GET /workspaces/:ws/tracking-pixels/gtm/events                workspace.manage
 *     { events: [{ event, when }], fields: [{ name, type, note }] }
 *   GET /workspaces/:ws/tracking-pixels/gtm/container[?download=true]
 *     A GTM export (format v2) to import: Admin → Import container → Merge.
 *     Optional query: ga4=G-…, ads=AW-…, purchaseLabel, leadLabel; without
 *     them the store's own Google pixels are used (the first active G- tag;
 *     the first active AW- tag with its labels, item 169). 422 for a value
 *     not in the shape below.
 *
 * The storefront pushes { ecommerce: null } then
 * { event, event_id, ecommerce: { value, currency, transaction_id, items } }
 * for each event when the store has a GTM pixel (apps/storefront lib/adPixels.ts).
 * Meta, TikTok and Snapchat are left out of the container on purpose.
 */
import type { ApiClient } from "../client";

export interface GtmDataLayerEvent {
  /** view_item, add_to_cart, begin_checkout, add_payment_info, purchase, generate_lead. */
  event: string;
  /** When the store pushes it, in English (the server's words). */
  when: string;
}

export interface GtmDataLayerField {
  /** e.g. ecommerce.value, event_id. */
  name: string;
  type: string;
  note: string;
}

export interface GtmEventsReference {
  events: GtmDataLayerEvent[];
  fields: GtmDataLayerField[];
}

/** Ids for the container when the store has no Google pixel of its own; each is optional. */
export interface GtmContainerParams {
  ga4?: string;
  ads?: string;
  purchaseLabel?: string;
  leadLabel?: string;
}

/** The file name the backend gives the download. */
export const GTM_CONTAINER_FILENAME = "zimos-gtm-container.json";

/** The backend's checks for the optional query values. */
export const GTM_GA4_ID = /^G-[A-Z0-9]{4,20}$/;
export const GTM_ADS_ID = /^AW-\d{5,20}$/;
export const GTM_ADS_LABEL = /^[A-Za-z0-9_-]{4,60}$/;

const base = (workspaceId: string) => `/workspaces/${workspaceId}/tracking-pixels/gtm`;

/** ApiClient.rawFetch is private to the class (a file download needs it); reached through one typed cast, like storeFonts.ts. */
function rawFetch(client: ApiClient, path: string, init: RequestInit): Promise<Response> {
  return (client as unknown as { rawFetch(path: string, init: RequestInit): Promise<Response> }).rawFetch(path, init);
}

export async function trackingPixelsGtmEvents(client: ApiClient, workspaceId: string): Promise<GtmEventsReference> {
  return client.request<GtmEventsReference>(`${base(workspaceId)}/events`);
}

/** The container file, ready to save as zimos-gtm-container.json. Blank values are left out. */
export async function trackingPixelsGtmContainerDownload(
  client: ApiClient,
  workspaceId: string,
  params: GtmContainerParams = {}
): Promise<Blob> {
  const query = new URLSearchParams({ download: "true" });
  for (const key of ["ga4", "ads", "purchaseLabel", "leadLabel"] as const) {
    const value = params[key]?.trim();
    if (value) query.set(key, value);
  }
  const res = await rawFetch(client, `${base(workspaceId)}/container?${query.toString()}`, { headers: { Accept: "application/json" } });
  return res.blob();
}
