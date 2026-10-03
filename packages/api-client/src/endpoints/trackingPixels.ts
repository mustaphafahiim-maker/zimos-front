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

export type TrackingPixelPlatform = "meta" | "tiktok" | "snapchat" | "google" | "gtm" | "clarity";
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
}

export interface TrackingPixelPlatformInfo {
  name: TrackingPixelPlatform;
  capi: boolean;
  testEventCode: boolean;
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
