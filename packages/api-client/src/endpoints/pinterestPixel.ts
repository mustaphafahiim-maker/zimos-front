/**
 * Pinterest Conversions API on a `pinterest` tracking pixel (backend handoff
 * item 168; contract: src/modules/marketing/pixelProviders/README-pinterest.md).
 *
 * Same endpoints as every pixel (trackingPixels.ts, workspace.manage):
 *   POST /workspaces/:ws/tracking-pixels, PATCH …/:pixelId
 *     { platform: "pinterest", pixelId, capiEnabled, capiToken, testEventCode, config: { adAccountId } }
 *
 * - `config.adAccountId`: 6–20 digits, required while `capiEnabled` is true
 *   (422 field `config.adAccountId`).
 * - `capiToken` (the conversion access token) is sealed and never returned:
 *   reads carry `capiTokenSet` / `capiTokenMask`.
 * - `testEventCode`: any non-empty value sends the events as test events.
 * - POST …/:pixelId/test sends a test page visit.
 *
 * The backend's mode is sandbox (nothing leaves the server) until the owner
 * sets PINTEREST_CAPI_MODE=live.
 */
import type { TrackingPixelConfig, TrackingPixelDto } from "./trackingPixels";

/** A pixel's config with the Pinterest ad account. */
export type PinterestPixelConfig = TrackingPixelConfig & { adAccountId?: string | null };

/** The backend's check for `config.adAccountId`. */
export const PINTEREST_AD_ACCOUNT_ID = /^\d{6,20}$/;

/** What `testEventCode` is set to for "Send as test events" (any non-empty value works). */
export const PINTEREST_TEST_EVENTS = "on";

/** Where the merchant generates the conversion access token. */
export const PINTEREST_CONVERSIONS_HELP_URL = "https://ads.pinterest.com/";

export function pinterestAdAccountIdOf(pixel: Pick<TrackingPixelDto, "config"> | null | undefined): string {
  const id = (pixel?.config as PinterestPixelConfig | undefined)?.adAccountId;
  return typeof id === "string" ? id : "";
}

/** The config to send for a Pinterest pixel. */
export function pinterestPixelConfig(adAccountId: string): PinterestPixelConfig {
  const id = adAccountId.trim();
  return { adAccountId: id || null };
}
