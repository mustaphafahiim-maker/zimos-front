import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import type { PagePath } from "./routes";

export type LocaleParams = Promise<{ locale: string }>;

/** Resolve and validate the `[locale]` param; unknown locales are a 404. */
export async function resolveLocale(params: LocaleParams): Promise<Locale> {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return locale;
}

/** Per-page metadata with canonical + hreflang alternates for both locales. */
export function pageMetadata(
  locale: Locale,
  path: PagePath,
  title: string,
  description: string,
): Metadata {
  const fullTitle = `${title} — ZIMOS`;
  return {
    title: fullTitle,
    description,
    alternates: {
      canonical: `/${locale}${path}`,
      languages: { ar: `/ar${path}`, en: `/en${path}` },
    },
    openGraph: {
      title: fullTitle,
      description,
      siteName: "ZIMOS",
      locale: locale === "ar" ? "ar_EG" : "en_US",
      type: "website",
      url: `/${locale}${path}`,
    },
  };
}
