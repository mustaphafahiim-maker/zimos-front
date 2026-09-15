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

/** WCAG relative luminance of a #rrggbb colour. */
function luminance(color: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

/** Ink used on brand surfaces too light for white text. Matches --color-ink. */
const ON_LIGHT = "#16211f";
const ON_DARK = "#ffffff";

/**
 * A readable foreground for text sitting on `color`, picked by contrast.
 *
 * The utilities that paint brand surfaces used to hardcode `text-paper-raised`,
 * which is white in light mode and near-black in dark mode. That assumes the
 * brand colour flips with the theme — but it does not: a merchant who saves a
 * deep blue gets near-black text on deep blue in dark mode (measured 1.97:1).
 * Choosing the foreground from the brand colour itself keeps the pair legible
 * whatever hex the merchant picks, in either theme.
 */
function onColor(color: string): string {
  const l = luminance(color);
  const contrast = (other: number) => {
    const [hi, lo] = l > other ? [l, other] : [other, l];
    return (hi + 0.05) / (lo + 0.05);
  };
  return contrast(luminance(ON_DARK)) >= contrast(luminance(ON_LIGHT)) ? ON_DARK : ON_LIGHT;
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
    style["--brand-primary-foreground"] = onColor(primary);
  }
  if (secondary) {
    style["--brand-secondary"] = secondary;
    style["--brand-secondary-foreground"] = onColor(secondary);
  }
  return style as CSSProperties;
}
