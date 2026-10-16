import type { Locale } from "@/i18n/config";

/**
 * The link-preview image of a locale (public/og/, made by
 * scripts/generate-og-images.mjs). The path is relative: the root layout's
 * `metadataBase` turns it into an absolute URL in the tags.
 *
 * A page that sets its own `openGraph` replaces the layout's whole object, so
 * it passes this again to keep the image.
 */
export function ogImage(locale: Locale) {
  return {
    url: `/og/zimos-og-${locale}.png`,
    width: 1200,
    height: 630,
    type: "image/png",
    alt: "ZIMOS",
  };
}
