/**
 * The ad platforms the dashboard names in more than one place: tracking
 * pixels, ad spend, sales sources, ad accounts and the product feeds
 * (handoffs 251, 254, 261, 264).
 *
 * Brand names are written the same in both languages here; a screen that
 * already says them in Arabic (pages/ads/AdsPage.tsx) keeps its own words.
 */

/** Short names, also the source of the lettermark in components/AdPlatformMark. */
export const AD_PLATFORM_NAMES: Record<string, string> = {
  meta: "Meta",
  tiktok: "TikTok",
  snapchat: "Snapchat",
  google: "Google",
  gtm: "Google Tag Manager",
  clarity: "Microsoft Clarity",
  pinterest: "Pinterest",
  x: "X",
  taboola: "Taboola",
  outbrain: "Outbrain",
  kwai: "Kwai",
  reddit: "Reddit",
  microsoft: "Microsoft Ads",
};

export function adPlatformName(platform: string): string {
  return AD_PLATFORM_NAMES[platform] ?? platform;
}

/**
 * A utm_source as shoppers' links spell it → the platform it means. The same
 * table as the backend's (analytics/attributionService.PLATFORM_OF_SOURCE),
 * so a source row and its ad spend carry the same mark.
 */
const PLATFORM_OF_SOURCE: Record<string, string> = {
  facebook: "meta",
  fb: "meta",
  instagram: "meta",
  ig: "meta",
  meta: "meta",
  tiktok: "tiktok",
  snapchat: "snapchat",
  google: "google",
  pinterest: "pinterest",
  twitter: "x",
  x: "x",
  "t.co": "x",
  taboola: "taboola",
  outbrain: "outbrain",
  kwai: "kwai",
  reddit: "reddit",
  bing: "microsoft",
  microsoft: "microsoft",
  msads: "microsoft",
  "microsoft ads": "microsoft",
};

/** The ad platform behind a source value, or null when it is not one we know. */
export function adPlatformOfSource(source: string | null | undefined): string | null {
  if (!source) return null;
  return PLATFORM_OF_SOURCE[source.trim().toLowerCase()] ?? null;
}

/**
 * The utm_source to put on an ad link per platform (handoff 254). Outbrain and
 * Kwai add no click id of their own, so their links are only credited through
 * this value.
 */
export const AD_LINK_SOURCES: ReadonlyArray<{ platform: string; source: string; needsSource?: boolean }> = [
  { platform: "meta", source: "facebook" },
  { platform: "tiktok", source: "tiktok" },
  { platform: "snapchat", source: "snapchat" },
  { platform: "google", source: "google" },
  { platform: "pinterest", source: "pinterest" },
  { platform: "x", source: "x" },
  { platform: "taboola", source: "taboola" },
  { platform: "outbrain", source: "outbrain", needsSource: true },
  { platform: "kwai", source: "kwai", needsSource: true },
  { platform: "reddit", source: "reddit" },
  { platform: "microsoft", source: "bing" },
];
