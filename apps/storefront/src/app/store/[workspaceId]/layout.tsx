import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { StoreFooter } from "@/components/StoreFooter";
import { StoreHeader } from "@/components/StoreHeader";
import { dirFor, getDictionary, intlLocaleFor } from "@/lib/i18n";
import { DocumentLocale, StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import { getStoreLocale, storePhone } from "@/lib/storeLocale";
import { brandStyle, getStoreMeta } from "@/lib/storeMeta";

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
 *  - the merchant's brand colours as CSS custom properties (`.brand-theme`),
 *  - the store language: `lang`/`dir` on this wrapper, mirrored onto <html> by
 *    <DocumentLocale> because the root layout can't know the store,
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

  const locale = await getStoreLocale(store);
  const info: StoreInfo = {
    workspaceId,
    name: store.name,
    currency: store.currency,
    logoUrl: store.logoUrl,
    phone: storePhone(store),
  };

  return (
    <StoreContextProvider locale={locale} store={info}>
      <div
        lang={intlLocaleFor(locale)}
        dir={dirFor(locale)}
        className="brand-theme flex min-h-full flex-1 flex-col bg-paper font-sans text-ink"
        style={brandStyle(store.themeSettings)}
      >
        <DocumentLocale locale={locale} />
        <StoreHeader store={store} workspaceId={workspaceId} locale={locale} />
        <div className="flex flex-1 flex-col">{children}</div>
        <StoreFooter store={store} workspaceId={workspaceId} locale={locale} />
      </div>
    </StoreContextProvider>
  );
}
