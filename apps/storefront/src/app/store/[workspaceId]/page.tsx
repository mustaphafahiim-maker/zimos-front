import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { StorefrontCollection } from "@store-builder/api-client";
import { CatalogSection } from "@/components/catalog/CatalogSection";
import { PageRenderer } from "@/components/page-renderer";
import { TrustStrip } from "@/components/TrustStrip";
import { ArrowIcon } from "@/components/Icons";
import { btnPrimary, btnSecondary, container } from "@/components/ui";
import { getDictionary } from "@/lib/i18n";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta } from "@/lib/storeMeta";

export const revalidate = 60;

/**
 * The store's front page.
 *
 * If the merchant has published a website, its home page ("/") is what a
 * shopper gets, rendered from the published page tree — unless they are
 * searching (`?q=` or `?search=1` from the header search button), which always
 * shows the catalogue.
 *
 * If they haven't — no site built yet, or built but never published — the
 * catalogue below stands in (hero from store meta, trust strip, search,
 * collection chips, paginated product grid). That fallback is deliberate: a
 * workspace with products but no published site is the normal state during
 * onboarding. The public pages API can't distinguish "no published site" from
 * "no such page", but publishing *requires* a page at "/", so any 404 here
 * means no live site.
 */
export default async function StoreHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ collection?: string | string[]; q?: string | string[]; search?: string | string[] }>;
}) {
  const [{ workspaceId }, query] = await Promise.all([params, searchParams]);
  const client = await createServerStorefrontApiClient();
  const q = typeof query.q === "string" ? query.q.trim().slice(0, 200) : "";
  const searching = !!q || query.search === "1";

  // getStoreMeta is React-cached, so this shares the layout's single fetch.
  const [store, published] = await Promise.all([
    getStoreMeta(workspaceId),
    client.getStorefrontPage(workspaceId, "/"),
  ]);
  if (!store) notFound();

  if (published.kind === "redirect") {
    redirect(`/store/${workspaceId}${published.to}`);
  }

  const locale = await getStoreLocale(store);
  const t = getDictionary(locale);

  const tree = published.kind === "page" ? published.data.page.tree : null;
  if (!searching && (tree?.sections?.length ?? 0) > 0) {
    return (
      <main className="flex-1">
        <PageRenderer tree={tree} workspaceId={workspaceId} currency={store.currency} locale={locale} />
      </main>
    );
  }

  const collections = await client.listStorefrontCollections(workspaceId).catch((): StorefrontCollection[] => []);

  // Legacy `?collection=<id>` links now live at /collections/<slug>.
  const legacy = typeof query.collection === "string" ? collections.find((c) => c.id === query.collection) : undefined;
  if (legacy) redirect(`/store/${workspaceId}/collections/${encodeURIComponent(legacy.slug || legacy.id)}`);

  const base = `/store/${workspaceId}`;

  return (
    <main className="flex-1">
      {!searching && (
        <>
          {/* Hero */}
          <section className="border-b border-line bg-paper-raised">
            <div className={`${container} flex flex-col items-center py-12 text-center sm:py-16`}>
              {store.logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={store.logoUrl}
                  alt=""
                  width={72}
                  height={72}
                  className="mb-5 h-18 w-18 rounded-2xl border border-line object-contain"
                />
              )}
              <p className="text-sm font-medium text-primary">{t.home.welcome}</p>
              <h1 className="mt-2 text-3xl font-bold text-ink sm:text-5xl">{store.name}</h1>
              {store.tagline && (
                <p className="mt-4 max-w-xl text-base leading-relaxed text-ink-soft sm:text-lg">{store.tagline}</p>
              )}
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                <a href="#products" className={btnPrimary}>
                  {t.home.heroCta}
                  <ArrowIcon size={18} className="rtl:rotate-180" />
                </a>
                <Link href={`${base}/track`} className={btnSecondary}>
                  {t.common.trackOrder}
                </Link>
              </div>
            </div>
          </section>

          <div className={`${container} py-8`}>
            <TrustStrip t={t} />
          </div>
        </>
      )}

      <div className={`${container} pb-16 ${searching ? "pt-8" : ""}`}>
        <CatalogSection
          workspaceId={workspaceId}
          locale={locale}
          collections={collections}
          q={q}
          title={t.home.shopAll}
          emptyText={t.home.empty}
        />
      </div>
    </main>
  );
}
