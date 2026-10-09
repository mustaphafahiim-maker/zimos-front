import { AD_PLATFORM_PIXEL_IDS, type TrackingPixelPlatform } from "@store-builder/api-client";

/**
 * What each platform is called and what its ID looks like. The patterns are
 * the backend's (trackingPixelService.PLATFORMS), so a bad ID is caught before
 * the request.
 */
export const PLATFORM_META: Record<TrackingPixelPlatform, { name: string; pattern: RegExp; example: string }> = {
  meta: { name: "Meta (Facebook & Instagram)", pattern: /^\d{5,20}$/, example: "123456789012345" },
  tiktok: { name: "TikTok", pattern: /^[A-Z0-9]{10,30}$/, example: "C4ABCDEF1234567890" },
  snapchat: { name: "Snapchat", pattern: /^[a-f0-9-]{20,40}$/i, example: "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d" },
  google: { name: "Google (GA4 / Ads)", pattern: /^(G|AW|GT)-[A-Z0-9]{4,20}$/, example: "G-ABC123XYZ" },
  gtm: { name: "Google Tag Manager", pattern: /^GTM-[A-Z0-9]{4,12}$/, example: "GTM-ABC1234" },
  clarity: { name: "Microsoft Clarity", pattern: /^[a-z0-9]{6,20}$/, example: "abcd1234ef" },
  pinterest: { name: "Pinterest", pattern: /^\d{10,16}$/, example: "2612345678901" },
  // X, Taboola, Outbrain, Kwai, Reddit, Microsoft Ads (handoff 251).
  ...AD_PLATFORM_PIXEL_IDS,
};

/** The platform's name, or its key when this dashboard does not know it yet. */
export function pixelPlatformName(platform: TrackingPixelPlatform): string {
  return PLATFORM_META[platform]?.name ?? platform;
}
