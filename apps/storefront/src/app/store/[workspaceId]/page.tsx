import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { StorefrontCollection } from "@store-builder/api-client";
import { PageRenderer } from "@/components/page-renderer";
import { ProductCard } from "@/components/ProductCard";
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
 * shopper gets, rendered from the published page tree.
 *
 * If they haven't — no site built yet, or built but never published — the
 * catalogue below stands in (hero from store meta, trust strip, collection
 * chips, product grid). That fallback is deliberate: a workspace with products
 * but no published site is the normal state during onboarding. The public
 * pages API can't distinguish "no published site" from "no such page", but
 * publishing *requires* a page at "/", so any 404 here means no live site.
 */
export default async function StoreHomePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ collection?: string | string[] }>;
}) {
  const [{ workspaceId }, query] = await Promise.all([params, searchParams]);
  const client = await createServerStorefrontApiClient();

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
  if ((tree?.sections?.length ?? 0) > 0) {
    return (
      <main className="flex-1">
        <PageRenderer tree={tree} workspaceId={workspaceId} currency={store.currency} locale={locale} />
      </main>
    );
  }

  const activeCollection = typeof query.collection === "string" ? query.collection : undefined;
  const [productList, collections] = await Promise.all([
    client.listStorefrontProducts(workspaceId, { limit: 24, collectionId: activeCollection }),
    client.listStorefrontCollections(workspaceId).catch((): StorefrontCollection[] => []),
  ]);
  const base = `/store/${workspaceId}`;

  const chip = (active: boolean) =>
    `inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors ${
      active
        ? "border-primary bg-primary text-white"
        : "border-line bg-paper-raised text-ink-soft hover:border-primary hover:text-primary"
    }`;

  return (
    <main className="flex-1">
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

      <section id="products" aria-labelledby="products-title" className={`${container} scroll-mt-24 pb-16`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h2 id="products-title" className="text-2xl font-bold text-ink">
            {t.home.shopAll}
          </h2>
        </div>

        {collections.length > 0 && (
          <nav aria-label={t.home.collections} className="-mx-4 mt-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <ul className="flex gap-2 pb-1">
              <li>
                <Link href={`${base}#products`} className={chip(!activeCollection)} aria-current={!activeCollection ? "page" : undefined}>
                  {t.home.allCollections}
                </Link>
              </li>
              {collections.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`${base}?collection=${encodeURIComponent(c.id)}#products`}
                    className={chip(activeCollection === c.id)}
                    aria-current={activeCollection === c.id ? "page" : undefined}
                  >
                    {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {productList.products.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-line-strong bg-paper-raised py-16 text-center text-sm text-ink-soft">
            {activeCollection ? t.home.emptyCollection : t.home.empty}
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {productList.products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                workspaceId={workspaceId}
                currency={store.currency}
                locale={locale}
              />
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
