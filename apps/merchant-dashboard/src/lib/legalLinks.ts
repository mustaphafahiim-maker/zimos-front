import { getLocale } from "@/i18n/LocaleContext";
import { ROOT_DOMAIN } from "@/lib/storeAddress";

/**
 * The marketing site (apps/marketing) at the root domain — derived from
 * VITE_PUBLIC_ROOT_DOMAIN exactly as the storefront derives it from
 * NEXT_PUBLIC_ROOT_DOMAIN — which publishes the terms, the refund policy and
 * the privacy policy at fixed addresses under each language.
 */
export const MARKETING_URL = `https://${ROOT_DOMAIN}`;

export type LegalPage = "terms" | "refund-policy" | "privacy" | "contact";

/** The page in the dashboard's current language. */
export function legalUrl(page: LegalPage): string {
  return `${MARKETING_URL}/${getLocale() === "ar" ? "ar" : "en"}/${page}`;
}
