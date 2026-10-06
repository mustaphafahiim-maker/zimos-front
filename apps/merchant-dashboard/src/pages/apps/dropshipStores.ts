import type { Locale } from "@/i18n/LocaleContext";

/*
 * The merchant's own store elsewhere (frontend-handoff 181): the dropship
 * providers `shopify` and `woocommerce`. They use the dropship endpoints like
 * a supplier does, but the dashboard groups and words them as "your other
 * store": orders go there, the shipping status comes back.
 */

export const STORE_PROVIDER_CODES: ReadonlySet<string> = new Set(["shopify", "woocommerce"]);

export function isStoreProvider(code: string | null | undefined): boolean {
  return Boolean(code && STORE_PROVIDER_CODES.has(code));
}

const NAMES: Record<string, Record<Locale, string>> = {
  shopify: { en: "Shopify store", ar: "متجر شوبيفاي" },
  woocommerce: { en: "WooCommerce store", ar: "متجر ووكومرس" },
};

/** "Shopify store" / «متجر شوبيفاي»; any other provider keeps the name the server gave it. */
export function dropshipProviderName(code: string, fallback: string, locale: Locale): string {
  return NAMES[code]?.[locale] ?? fallback;
}

/** True when a product came from the merchant's other store (its variant SKUs are that store's ids). */
export function isFromStoreProvider(product: { externalRefs?: Array<{ platform: string }> | null } | null | undefined): boolean {
  return Boolean(product?.externalRefs?.some((ref) => isStoreProvider(ref.platform)));
}
