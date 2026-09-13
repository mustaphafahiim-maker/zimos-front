import { cookies } from "next/headers";
import type { StorefrontMeta } from "@store-builder/api-client";
import { DEFAULT_LOCALE, LOCALE_COOKIE, parseLocale, type Locale } from "./i18n";

/**
 * The store's own default language. StorefrontMeta has no `defaultLocale`
 * field today, so it is read from themeSettings (`defaultLocale` / `locale`)
 * when the merchant has saved one, and falls back to Arabic.
 */
export function storeDefaultLocale(store: Pick<StorefrontMeta, "themeSettings"> | null): Locale {
  const meta = store as (Pick<StorefrontMeta, "themeSettings"> & { defaultLocale?: unknown }) | null;
  return (
    parseLocale(meta?.defaultLocale) ??
    parseLocale(meta?.themeSettings?.defaultLocale) ??
    parseLocale(meta?.themeSettings?.locale) ??
    DEFAULT_LOCALE
  );
}

/** Server-only: the shopper's explicit choice (cookie) wins over the store default. */
export async function getStoreLocale(store: Pick<StorefrontMeta, "themeSettings"> | null): Promise<Locale> {
  const jar = await cookies();
  return parseLocale(jar.get(LOCALE_COOKIE)?.value) ?? storeDefaultLocale(store);
}

/** A contact number the merchant saved in themeSettings, if any. */
export function storePhone(store: Pick<StorefrontMeta, "themeSettings">): string | null {
  const ts = store.themeSettings ?? {};
  for (const key of ["whatsapp", "whatsappNumber", "phone", "contactPhone", "supportPhone"]) {
    const v = ts[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}
