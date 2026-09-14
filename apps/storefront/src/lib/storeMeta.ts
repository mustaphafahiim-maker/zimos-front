import { cache } from "react";
import type { CSSProperties } from "react";
import { ApiError, type StorefrontMeta, type StorefrontProductDetail } from "@store-builder/api-client";
import { createServerStorefrontApiClient } from "./serverApiClient";

/**
 * Store metadata, deduped per request. The layout needs it for the brand
 * colours and every page under it needs the name/currency, so `cache()` keeps
 * that to a single API call per render instead of one per component.
 *
 * Returns null for an unknown workspace so callers can `notFound()`.
 */
export const getStoreMeta = cache(async (workspaceId: string): Promise<StorefrontMeta | null> => {
  const client = await createServerStorefrontApiClient();
  try {
    return await client.getStorefrontMeta(workspaceId);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
});

/**
 * One product, deduped per request so `generateMetadata` and the page share a
 * single API call. Null on 404.
 */
export const getStorefrontProduct = cache(
  async (workspaceId: string, idOrSlug: string): Promise<StorefrontProductDetail | null> => {
    const client = await createServerStorefrontApiClient();
    try {
      return await client.getStorefrontProduct(workspaceId, idOrSlug);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) return null;
      throw err;
    }
  }
);

/** Matches the keys the dashboard's Settings page writes into themeSettings. */
const HEX = /^#[0-9a-f]{6}$/i;

function hex(themeSettings: Record<string, unknown> | undefined, key: string): string | null {
  const raw = themeSettings?.[key];
  return typeof raw === "string" && HEX.test(raw.trim()) ? raw.trim() : null;
}

/**
 * Inline custom properties for the store wrapper. Anything the merchant has not
 * set is left out entirely, so the stylesheet's own default palette (which is
 * light/dark aware) still applies — a single inline hex could not be.
 */
export function brandStyle(themeSettings: Record<string, unknown> | undefined): CSSProperties {
  const style: Record<string, string> = {};
  const primary = hex(themeSettings, "primaryColor");
  const secondary = hex(themeSettings, "secondaryColor");
  if (primary) {
    style["--brand-primary"] = primary;
    // Text on the merchant's primary must stay readable (WCAG AA) whatever hex
    // they pick: white on dark brands, navy ink on light ones (yellow, mint …).
    style["--brand-on-primary"] = onColor(primary);
  }
  if (secondary) style["--brand-secondary"] = secondary;
  return style as CSSProperties;
}

function luminance(hexColor: string): number {
  const channel = (i: number) => {
    const c = parseInt(hexColor.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** White or ZIMOS navy — whichever contrasts more with `hexColor`. */
export function onColor(hexColor: string): string {
  const l = luminance(hexColor);
  const vsWhite = 1.05 / (l + 0.05);
  const vsNavy = (l + 0.05) / (luminance("#0b1f66") + 0.05);
  return vsWhite >= vsNavy ? "#ffffff" : "#0b1f66";
}
