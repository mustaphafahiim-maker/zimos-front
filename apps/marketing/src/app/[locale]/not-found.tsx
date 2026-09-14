"use client";

import { NotFoundContent } from "@/components/not-found-content";
import { SiteHeader } from "@/components/site-header";
import { useI18n } from "@/i18n/provider";

/**
 * Localized 404 inside the `[locale]` layout (header, fonts, direction).
 * Not-found components receive no params, so the locale comes from context.
 */
export default function LocaleNotFound() {
  const { locale, dict } = useI18n();
  return (
    <>
      <title>{`${dict.notFound.title} — ZIMOS`}</title>
      <meta name="robots" content="noindex" />
      <SiteHeader />
      <main id="main">
        <NotFoundContent copy={dict.notFound} locale={locale} />
      </main>
    </>
  );
}
