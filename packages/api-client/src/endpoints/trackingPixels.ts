/**
 * Tracking pixels — Marketing → "Tracking tools" (backend:
 * src/modules/marketing/trackingPixel*.js).
 *
 * Mounted at /workspaces/:workspaceId/tracking-pixels (workspace.manage). A
 * store may have several pixels per platform; each has a scope (whole store,
 * some funnels, some products) and, where the platform has a server API, its
 * own Conversions-API token. All exported names are prefixed
 * `trackingPixels` / `TrackingPixel`.
 *
 * Secrets: `capiToken` is write-only. Reads carry `capiTokenSet` and a mask.
 * On update, leave `capiToken` out to keep the stored token; send "" to
 * remove it.
 *
 * Notable codes: TRACKING_PIXEL_EXISTS (409 — same platform + ID twice),
 * TRACKING_PIXEL_LIMIT (409), VALIDATION_ERROR (422 — `pixelId` not in the
 * platform's format, `capiToken` missing when turning CAPI on, `scope.ids`
 * not this store's funnels/products).
 */
import type { ApiClient } from "../client";

export type TrackingPixelPlatform =
  | "meta"
  | "tiktok"
  | "snapchat"
  | "google"
  | "gtm"
  | "clarity"
  // With STORE_FEATURES extra_pixels (endpoints/pinterestPixel.ts, endpoints/adPlatformPixels.ts):
  // Pinterest, X, Reddit and Microsoft Ads also have a server API.
  | "pinterest"
  | "x"
  | "taboola"
  | "outbrain"
  | "kwai"
  | "reddit"
  | "microsoft";

/**
 * Whether a platform's server events really leave the server: `sandbox` =
 * built and logged only, until the platform is switched on; null = no server
 * API (or a Google `AW-` id).
 */
export type TrackingPixelServerMode = "live" | "sandbox" | null;
export type TrackingPixelScopeType = "all" | "funnels" | "products";

export interface TrackingPixelScope {
  type: TrackingPixelScopeType;
  ids: string[];
}

export interface TrackingPixelConfig {
  /** Google Ads conversion label, used with an `AW-` id. */
  adsConversionLabel?: string | null;
}

export interface TrackingPixelDto {
  id: string;
  platform: TrackingPixelPlatform;
  pixelId: string;
  label: string | null;
  capiEnabled: boolean;
  /** False for platforms/IDs with no server API (GTM, Clarity, a Google Ads id). */
  capiSupported: boolean;
  capiTokenSet: boolean;
  capiTokenMask: string | null;
  testEventCode: string | null;
  scope: TrackingPixelScope;
  config: TrackingPixelConfig;
  isActive: boolean;
  lastSentAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  /** Missing from an older API. */
  serverMode?: TrackingPixelServerMode;
}

export interface TrackingPixelPlatformInfo {
  name: TrackingPixelPlatform;
  capi: boolean;
  testEventCode: boolean;
  /** Missing from an older API. */
  serverMode?: TrackingPixelServerMode;
}

export interface TrackingPixelList {
  pixels: TrackingPixelDto[];
  platforms: TrackingPixelPlatformInfo[];
  limit: number;
}

export interface TrackingPixelCreatePayload {
  platform: TrackingPixelPlatform;
  pixelId: string;
  label?: string | null;
  capiEnabled?: boolean;
  capiToken?: string;
  testEventCode?: string | null;
  scope?: TrackingPixelScope;
  config?: TrackingPixelConfig;
  isActive?: boolean;
}

export type TrackingPixelUpdatePayload = Partial<Omit<TrackingPixelCreatePayload, "platform">>;

const base = (workspaceId: string) => `/workspaces/${workspaceId}/tracking-pixels`;

export async function trackingPixelsList(client: ApiClient, workspaceId: string): Promise<TrackingPixelList> {
  return client.request<TrackingPixelList>(base(workspaceId));
}

export async function trackingPixelsCreate(
  client: ApiClient,
  workspaceId: string,
  payload: TrackingPixelCreatePayload
): Promise<TrackingPixelDto> {
  const { pixel } = await client.request<{ pixel: TrackingPixelDto }>(base(workspaceId), { method: "POST", body: payload });
  return pixel;
}

export async function trackingPixelsUpdate(
  client: ApiClient,
  workspaceId: string,
  pixelId: string,
  payload: TrackingPixelUpdatePayload
): Promise<TrackingPixelDto> {
  const { pixel } = await client.request<{ pixel: TrackingPixelDto }>(`${base(workspaceId)}/${pixelId}`, {
    method: "PATCH",
    body: payload,
  });
  return pixel;
}

export async function trackingPixelsDelete(client: ApiClient, workspaceId: string, pixelId: string): Promise<void> {
  await client.request(`${base(workspaceId)}/${pixelId}`, { method: "DELETE" });
}

// ------------------------------------------------------------- event log --

export type TrackingPixelEventStatus = "sent" | "failed";

/** One server-side event sent to one pixel. The store keeps its latest 500. */
export interface TrackingPixelEventDto {
  id: string;
  /** Null once the pixel has been deleted; `platform` and `pixelId` still say which it was. */
  trackingPixelId: string | null;
  platform: TrackingPixelPlatform;
  pixelId: string;
  /** purchase, view_content, add_to_cart, begin_checkout, add_payment_info, lead, page_view (tests). */
  eventName: string;
  eventId: string | null;
  orderId: string | null;
  status: TrackingPixelEventStatus;
  error: string | null;
  isTest: boolean;
  createdAt: string;
}

export interface TrackingPixelEventList {
  events: TrackingPixelEventDto[];
  nextCursor: string | null;
  keep: number;
}

export async function trackingPixelsListEvents(
  client: ApiClient,
  workspaceId: string,
  params: { limit?: number; cursor?: string | null; status?: TrackingPixelEventStatus; trackingPixelId?: string } = {}
): Promise<TrackingPixelEventList> {
  const query = new URLSearchParams();
  if (params.limit) query.set("limit", String(params.limit));
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.status) query.set("status", params.status);
  if (params.trackingPixelId) query.set("trackingPixelId", params.trackingPixelId);
  const qs = query.toString();
  return client.request<TrackingPixelEventList>(`${base(workspaceId)}/events${qs ? `?${qs}` : ""}`);
}

export interface TrackingPixelTestResult {
  ok: boolean;
  /** The platform's own words when it refused the event. */
  error: string | null;
  eventId: string;
  /** True when a Meta test event code was used: look under Test events. */
  usedTestCode: boolean;
  /** True when the platform has no test event to send (X): nothing went out, its keys are checked by the first order. */
  skipped?: boolean;
}

/**
 * Sends one page view (never a conversion) to the pixel's server API now.
 * 422 TRACKING_PIXEL_NO_SERVER_API when the pixel has no Conversions API token.
 */
export async function trackingPixelsSendTest(
  client: ApiClient,
  workspaceId: string,
  pixelId: string
): Promise<TrackingPixelTestResult> {
  return client.request<TrackingPixelTestResult>(`${base(workspaceId)}/${pixelId}/test`, { method: "POST" });
}

// -------------------------------------------------------- purchase timing --

/** When an order is reported to the ad platforms as a Purchase (SPEC §13.3). */
export type TrackingPurchaseEventTiming = "on_order" | "on_confirmed" | "on_delivered";

export interface TrackingSettings {
  purchaseEventTiming: TrackingPurchaseEventTiming;
  options: TrackingPurchaseEventTiming[];
}

export async function trackingPixelsGetSettings(client: ApiClient, workspaceId: string): Promise<TrackingSettings> {
  return client.request<TrackingSettings>(`${base(workspaceId)}/settings`);
}

export async function trackingPixelsUpdateSettings(
  client: ApiClient,
  workspaceId: string,
  payload: { purchaseEventTiming: TrackingPurchaseEventTiming }
): Promise<TrackingSettings> {
  return client.request<TrackingSettings>(`${base(workspaceId)}/settings`, { method: "PUT", body: payload });
}
