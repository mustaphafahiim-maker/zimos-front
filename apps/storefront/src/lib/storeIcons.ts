import type { Metadata } from "next";

/** The value when it is an absolute http(s) URL; anything else (relative, data:, javascript:) is null. */
export function httpUrlOrNull(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * A store's browser-tab icons, for its layout's metadata (every page of the
 * store, funnels included, inherits them; a funnel with its own favicon still
 * sets its own).
 *
 * The favicon the merchant set in Settings wins, exactly as before. Without
 * one, the store's logo is the tab, shortcut and home-screen icon, as its
 * plain URL — no image optimisation. Without either, undefined: the storefront's
 * default icons (app/icon.png, favicon.ico, apple-icon.png) stay as they are.
 */
export function storeIcons({
  faviconUrl,
  logoUrl,
}: {
  faviconUrl?: string | null;
  logoUrl?: string | null;
}): Metadata["icons"] | undefined {
  if (faviconUrl) return { icon: faviconUrl, shortcut: faviconUrl };
  const logo = httpUrlOrNull(logoUrl);
  if (logo) return { icon: logo, shortcut: logo, apple: logo };
  return undefined;
}
