import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { googleFontsHref, normalizeThemeSettings, themeClassName, themeCssVariables } from "@store-builder/store-renderer";
import { StoreFooter } from "@/components/StoreFooter";
import { StoreHeader } from "@/components/StoreHeader";
import { dirFor, getDictionary, intlLocaleFor } from "@/lib/i18n";
import { DocumentLocale, StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import { getStoreLocale, storePhone } from "@/lib/storeLocale";
import { getStoreCollections, getStoreMeta } from "@/lib/storeMeta";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}): Promise<Metadata> {
  const { workspaceId } = await params;
  const store = await getStoreMeta(workspaceId);
  if (!store) return {};
  const locale = await getStoreLocale(store);
  const t = getDictionary(locale);
  const description = store.tagline || t.meta.storeDescription(store.name);

  return {
    title: { default: store.name, template: `%s | ${store.name}` },
    description,
    openGraph: {
      type: "website",
      siteName: store.name,
      title: store.name,
      description,
      locale: intlLocaleFor(locale).replace("-", "_"),
      ...(store.logoUrl ? { images: [{ url: store.logoUrl, alt: store.name }] } : {}),
    },
  };
}

/**
 * Wraps every page of one store. It establishes:
 *  - the merchant's ThemeSettings (normalized; Nile when nothing is saved) as
 *    `--zr-*` CSS variables + modifier classes on `.zr-theme`, which globals.css
 *    also maps onto the Tailwind tokens so app pages follow the theme,
 *  - only the two Google font families the theme selected,
 *  - the store language: `lang`/`dir` here, mirrored onto <html>,
 *  - the shared header/footer and the client-side store context.
 */
export default async function StoreLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  const store = await getStoreMeta(workspaceId);
  if (!store) notFound();

  const [locale, collections] = await Promise.all([getStoreLocale(store), getStoreCollections(workspaceId)]);
  const t = getDictionary(locale);
  const theme = normalizeThemeSettings(store.themeSettings);
  const info: StoreInfo = {
    workspaceId,
    name: store.name,
    currency: store.currency,
    logoUrl: store.logoUrl,
    phone: storePhone(store),
  };

  return (
    <StoreContextProvider locale={locale} store={info}>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link rel="stylesheet" href={googleFontsHref(theme)} precedence="default" />
      <div
        lang={intlLocaleFor(locale)}
        dir={dirFor(locale)}
        className={`${themeClassName(theme)} brand-theme flex min-h-full flex-1 flex-col bg-paper font-sans text-ink`}
        style={themeCssVariables(theme) as CSSProperties}
      >
        <DocumentLocale locale={locale} />
        <a
          href="#store-main"
          className="sr-only z-50 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground focus:not-sr-only focus:fixed focus:start-3 focus:top-3"
        >
          {t.store.skipToContent}
        </a>
        <StoreHeader store={store} workspaceId={workspaceId} locale={locale} theme={theme} collections={collections} />
        <div id="store-main" tabIndex={-1} className="flex flex-1 flex-col outline-none">
          {children}
        </div>
        <StoreFooter store={store} workspaceId={workspaceId} locale={locale} theme={theme} collections={collections} />
      </div>
    </StoreContextProvider>
  );
}
