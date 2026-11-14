import { dirFor, getDictionary, intlLocaleFor, type Locale } from "@/lib/i18n";
import { DocumentLocale } from "@/lib/StoreContext";
import type { UnavailableStore } from "@/lib/storeMeta";
import { PoweredByZimos } from "./PoweredByZimos";

/**
 * Every page of a store that is not serving — suspended by the platform, or
 * its subscription lapsed past its grace day. The API answers
 * STORE_UNAVAILABLE on every public route of such a store, so the store
 * layout draws this in place of the header, the page and the footer: no
 * products, prices or pages, only the store's name.
 *
 * The message is in the store's language, with the same message in the other
 * language underneath, as the store's 404 does. Deliberately says nothing
 * about why: that is between the store and Zimos.
 */
export function StoreUnavailable({ store, locale }: { store: UnavailableStore; locale: Locale }) {
  const t = getDictionary(locale);
  const otherLocale: Locale = locale === "ar" ? "en" : "ar";
  const other = getDictionary(otherLocale);
  const name = store.name || "";

  return (
    <div
      lang={intlLocaleFor(locale)}
      dir={dirFor(locale)}
      className="flex min-h-full flex-1 flex-col bg-paper font-sans text-ink"
      data-testid="store-unavailable"
    >
      <DocumentLocale locale={locale} />
      <main className="flex flex-1 flex-col items-center justify-center px-6 py-24 text-center">
        {store.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- the merchant's own logo, any host
          <img src={store.logoUrl} alt={name} className="mb-6 h-14 w-auto max-w-48 object-contain opacity-80" />
        ) : name ? (
          <p className="mb-6 font-display text-xl font-medium text-ink-soft">{name}</p>
        ) : null}
        <h1 className="font-display text-2xl font-medium text-ink">{t.unavailable.title}</h1>
        <p className="mt-3 max-w-md text-sm text-ink-soft">{t.unavailable.body(name || t.unavailable.metaTitle)}</p>
        <p className="mt-2 max-w-md text-sm text-ink-soft">{t.unavailable.orders}</p>

        <div
          lang={intlLocaleFor(otherLocale)}
          dir={dirFor(otherLocale)}
          className="mt-8 max-w-md border-t border-line pt-6 text-xs text-ink-soft"
        >
          <p className="font-medium">{other.unavailable.title}</p>
          <p className="mt-1">{other.unavailable.body(name || other.unavailable.metaTitle)}</p>
        </div>
      </main>
      <footer className="flex justify-center pb-8">
        <PoweredByZimos label={t.footer.poweredBy} />
      </footer>
    </div>
  );
}
