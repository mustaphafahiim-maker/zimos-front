/**
 * More ad platforms on a tracking pixel: X (Twitter), Taboola, Outbrain, Kwai,
 * Reddit and Microsoft Ads (backend
 * src/modules/marketing/browserPixelEvents.js, trackingPixelService.js and
 * pixelProviders/README-{x,reddit,microsoft}.md).
 *
 * Same endpoints as every pixel (trackingPixels.ts, workspace.manage):
 *   POST /workspaces/:ws/tracking-pixels, PATCH …/:pixelId
 *     { platform, pixelId, capiEnabled, capiToken, testEventCode, config: { eventIds } }
 *
 * - Taboola, Outbrain and Kwai are browser tags only (`capi: false`): no token,
 *   and POST …/:pixelId/test answers 422 TRACKING_PIXEL_NO_SERVER_API.
 * - X, Reddit and Microsoft Ads also send from the server:
 *     Reddit     `capiToken` = the Conversions access token; `testEventCode`
 *                (any text) = test mode.
 *     Microsoft  `capiToken` = the UET tag's Conversions API token.
 *     X          `capiToken` = four keys joined by colons,
 *                consumerKey:consumerSecret:accessToken:accessTokenSecret
 *                (422 on `capiToken` otherwise). POST …/test answers
 *                `skipped: true`: X has no test event.
 * - X only: `config.eventIds` — one X Ads Manager event id ("tw-<pixel>-<event>")
 *   per standard event; an event without an id is not sent to X, from the
 *   browser or the server (422 on `config.eventIds.<event>` for another shape).
 * - `serverMode` on the list's `platforms[]` and on every pixel:
 *   "sandbox" until the platform is switched on (events are built and logged,
 *   not sent), "live", or null without a server API.
 *
 * The token is sealed and never returned: reads carry `capiTokenSet` and
 * `capiTokenMask` only.
 */
import type { TrackingPixelConfig, TrackingPixelDto, TrackingPixelPlatform } from "./trackingPixels";

export type AdPlatformPixel = "x" | "taboola" | "outbrain" | "kwai" | "reddit" | "microsoft";

export const AD_PLATFORM_PIXELS: readonly AdPlatformPixel[] = ["x", "taboola", "outbrain", "kwai", "reddit", "microsoft"];

export function isAdPlatformPixel(platform: TrackingPixelPlatform | string): platform is AdPlatformPixel {
  return (AD_PLATFORM_PIXELS as readonly string[]).includes(platform);
}

/** Each platform's name and the backend's own check for its ID (trackingPixelService.PLATFORMS). */
export const AD_PLATFORM_PIXEL_IDS: Record<AdPlatformPixel, { name: string; pattern: RegExp; example: string }> = {
  x: { name: "X (Twitter)", pattern: /^[a-z0-9]{4,12}$/i, example: "o1abc" },
  taboola: { name: "Taboola", pattern: /^\d{4,10}$/, example: "1234567" },
  outbrain: { name: "Outbrain", pattern: /^[a-f0-9]{20,40}$/i, example: "00a1b2c3d4e5f60718293a4b5c6d7e8f" },
  kwai: { name: "Kwai", pattern: /^\d{10,25}$/, example: "248123456789012345" },
  reddit: { name: "Reddit", pattern: /^(t2|a2)_[a-z0-9]{4,20}$/i, example: "a2_abc123def" },
  microsoft: { name: "Microsoft Ads (Bing UET)", pattern: /^\d{5,12}$/, example: "187654321" },
};

// ------------------------------------------------------------ X event ids --

/** The store's standard events, in the order the form lists them. */
export const X_PIXEL_EVENTS = [
  "purchase",
  "lead",
  "add_to_cart",
  "begin_checkout",
  "add_payment_info",
  "view_content",
  "page_view",
] as const;
export type XPixelEvent = (typeof X_PIXEL_EVENTS)[number];

/** The backend's check for one X event id (browserPixelEvents.X_EVENT_ID). */
export const X_EVENT_ID = /^tw-[a-z0-9]{3,12}-[a-z0-9]{3,12}$/i;

export type XPixelEventIds = Partial<Record<XPixelEvent, string | null>>;

/** A pixel's config with X's event ids. */
export type XPixelConfig = TrackingPixelConfig & { eventIds?: XPixelEventIds };

/** The saved X event ids as form values ("" where none is saved). */
export function xEventIdsOf(pixel: Pick<TrackingPixelDto, "config"> | null | undefined): Record<XPixelEvent, string> {
  const saved = (pixel?.config as XPixelConfig | undefined)?.eventIds ?? {};
  const out = {} as Record<XPixelEvent, string>;
  for (const event of X_PIXEL_EVENTS) {
    const id = saved[event];
    out[event] = typeof id === "string" ? id : "";
  }
  return out;
}

/** The events whose id is filled in but is not an X event id. */
export function xEventIdProblems(ids: Record<XPixelEvent, string>): XPixelEvent[] {
  return X_PIXEL_EVENTS.filter((event) => ids[event].trim() !== "" && !X_EVENT_ID.test(ids[event].trim()));
}

/** The config to send for an X pixel: the filled ids only (a missing one is "don't send"). */
export function xPixelConfig(ids: Record<XPixelEvent, string>): XPixelConfig {
  const eventIds: XPixelEventIds = {};
  for (const event of X_PIXEL_EVENTS) {
    const id = ids[event].trim();
    if (id) eventIds[event] = id;
  }
  return { eventIds };
}

// -------------------------------------------------------- X's four keys --

export const X_CAPI_KEYS = ["consumerKey", "consumerSecret", "accessToken", "accessTokenSecret"] as const;
export type XCapiKey = (typeof X_CAPI_KEYS)[number];
export type XCapiKeys = Record<XCapiKey, string>;

export const emptyXCapiKeys = (): XCapiKeys => ({ consumerKey: "", consumerSecret: "", accessToken: "", accessTokenSecret: "" });

/** "empty" (nothing typed), "partial" (some missing, or a key holds a space or a colon) or "complete". */
export function xCapiKeysState(keys: XCapiKeys): "empty" | "partial" | "complete" {
  const values = X_CAPI_KEYS.map((key) => keys[key].trim());
  if (values.every((v) => v === "")) return "empty";
  return values.every((v) => v !== "" && !/[\s:]/.test(v)) ? "complete" : "partial";
}

/** The `capiToken` X takes: the four keys joined by colons; "" while nothing is typed (keep the saved keys). */
export function xCapiToken(keys: XCapiKeys): string {
  return xCapiKeysState(keys) === "empty" ? "" : X_CAPI_KEYS.map((key) => keys[key].trim()).join(":");
}

/** A complete X token: four parts, none empty, no space inside (xCapi.parseToken on the backend). */
export const X_CAPI_TOKEN = /^[^\s:]+(?::[^\s:]+){3}$/;

// ------------------------------------------------------------- Reddit ----

/** What `testEventCode` is set to for Reddit's "Test mode" (any non-empty text works). */
export const REDDIT_TEST_MODE = "on";
