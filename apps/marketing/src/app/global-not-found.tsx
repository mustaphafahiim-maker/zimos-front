import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { fontVariables } from "./fonts";
import { NotFoundContent } from "@/components/not-found-content";
import { ZimosLogo } from "@/components/zimos-logo";
import { container } from "@/components/ui";
import { getDictionary } from "@/i18n/dictionaries";
import { defaultLocale } from "@/i18n/config";

/**
 * Root 404 for URLs that match no route at all. The root layout lives under
 * `[locale]`, so this page brings its own <html>, styles and fonts. It renders
 * in the default locale (Arabic, RTL) with a link to the English home page.
 */
export const metadata: Metadata = {
  title: "404 — ZIMOS",
  robots: { index: false },
};

export default function GlobalNotFound() {
  const locale = defaultLocale;
  const dict = getDictionary(locale);
  const en = getDictionary("en");

  return (
    <html lang={locale} dir="rtl" className={`${fontVariables} lang-${locale} antialiased`}>
      <body className="min-h-dvh bg-paper text-ink">
        <header className="border-b border-line bg-paper-raised">
          <div className={`${container} flex h-16 items-center justify-between`}>
            <Link href={`/${locale}`} aria-label={dict.nav.homeAria} className="rounded-lg">
              <ZimosLogo height={32} />
            </Link>
            <Link
              href="/en"
              lang="en"
              hrefLang="en"
              className="rounded-lg border border-line px-3 py-1.5 text-sm font-medium text-ink-soft hover:text-ink"
            >
              English
            </Link>
          </div>
        </header>
        <main id="main">
          <NotFoundContent copy={dict.notFound} locale={locale} />
          <p lang="en" dir="ltr" className={`${container} pb-16 text-sm text-ink-soft`}>
            {en.notFound.heading}.{" "}
            <Link href="/en" className="text-primary hover:underline">
              {en.notFound.home}
            </Link>
          </p>
        </main>
      </body>
    </html>
  );
}
