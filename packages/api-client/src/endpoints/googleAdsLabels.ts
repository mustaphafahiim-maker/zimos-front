/**
 * Google Ads conversions on a `google` tracking pixel with an AW- id (backend
 * handoff item 169; item 132 added the purchase label).
 *
 * Same endpoints as every pixel (trackingPixels.ts, workspace.manage):
 *   POST /workspaces/:ws/tracking-pixels, PATCH …/:pixelId
 *     { platform: "google", pixelId: "AW-…", config: { adsConversionLabel, adsLeadLabel } }
 *
 * - `config.adsConversionLabel`: the purchase conversion action's label.
 * - `config.adsLeadLabel`: the lead conversion action's label, used when the
 *   store or a funnel reports orders as leads (item 167, conversionEvent.ts).
 * - Both: 4–60 of A–Z a–z 0–9 _ -. Refused on a non-Ads tag with 422 field
 *   `config.adsConversionLabel` / `config.adsLeadLabel`: "A conversion label
 *   needs a Google Ads id (AW-…)". An update replaces the whole config.
 *
 * Shoppers: GET /store/:ws `trackingPixels[]` carries, for an AW- pixel with
 * labels, `sendTo: { purchase?: "AW-…/label", lead?: "AW-…/label" }`.
 */
import type { TrackingPixelConfig, TrackingPixelDto } from "./trackingPixels";

/** A Google pixel's config with both conversion labels. */
export type GoogleAdsPixelConfig = TrackingPixelConfig & { adsLeadLabel?: string | null };

/** The backend's check for both labels. */
export const GOOGLE_ADS_LABEL = /^[A-Za-z0-9_-]{4,60}$/;

/** A Google Ads (AW-) tag id, which is the only Google id labels belong to. */
export function isGoogleAdsId(pixelId: string): boolean {
  return /^AW-/i.test(pixelId.trim());
}

export interface GoogleAdsLabels {
  purchase: string;
  lead: string;
}

/** The labels saved on a pixel ("" when unset). */
export function googleAdsLabelsOf(pixel: Pick<TrackingPixelDto, "config"> | null | undefined): GoogleAdsLabels {
  const config = (pixel?.config ?? {}) as GoogleAdsPixelConfig;
  return {
    purchase: typeof config.adsConversionLabel === "string" ? config.adsConversionLabel : "",
    lead: typeof config.adsLeadLabel === "string" ? config.adsLeadLabel : "",
  };
}

/** The config to send for a Google pixel: the labels on an AW- id, none otherwise. */
export function googleAdsPixelConfig(pixelId: string, labels: GoogleAdsLabels): GoogleAdsPixelConfig {
  const ads = isGoogleAdsId(pixelId);
  return {
    adsConversionLabel: ads ? labels.purchase.trim() || null : null,
    adsLeadLabel: ads ? labels.lead.trim() || null : null,
  };
}
