import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { StorefrontCollection } from "@store-builder/api-client";
import { ArrowIcon } from "@/components/Icons";
import { ProductCard } from "@/components/ProductCard";
import { StoreLink } from "@/components/StoreRoute";
import { btnSecondary, container } from "@/components/ui";
import { getDictionary } from "@/lib/i18n";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta } from "@/lib/storeMeta";

export const revalidate = 60;

type Params = Promise<{ workspaceId: string }>;
type Query = Promise<{ collection?: string | string[]; after?: string | string[] }>;

const PAGE_SIZE = 24;

function one(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { workspaceId } = await params;
  const store = await getStoreMeta(workspaceId);
  if (!store) return {};
  const t = getDictionary(await getStoreLocale(store));
  return { title: t.home.shopAll, alternates: { canonical: "/products" } };
}

/**
 * Every published product, the page the templates' "Shop now" buttons open.
 * Always the catalogue — it never depends on a website being published — with
 * the store's collections as chips and a link on to the next page.
 */
export default async function ProductsPage({ params, searchParams }: { params: Params; searchParams: Query }) {
  const [{ workspaceId }, query] = await Promise.all([params, searchParams]);
  const store = await getStoreMeta(workspaceId);
  if (!store) notFound();

  const locale = await getStoreLocale(store);
  const t = getDictionary(locale);
  const client = await createServerStorefrontApiClient();

  const activeCollection = one(query.collection);
  const after = one(query.after);
  const [productList, collections] = await Promise.all([
    client
      .listStorefrontProducts(workspaceId, { limit: PAGE_SIZE, collectionId: activeCollection, cursor: after })
      // An unknown collection or a stale cursor is simply an empty page.
      .catch(() => ({ products: [], nextCursor: null })),
    client.listStorefrontCollections(workspaceId).catch((): StorefrontCollection[] => []),
  ]);

  const chip = (active: boolean) =>
    `zt-chip inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors ${
      active
        ? "border-primary bg-primary text-on-primary"
        : "border-line bg-paper-raised text-ink-soft hover:border-primary hover:text-primary"
    }`;
  const listHref = (collection?: string, cursor?: string) => {
    const qs = new URLSearchParams();
    if (collection) qs.set("collection", collection);
    if (cursor) qs.set("after", cursor);
    const s = qs.toString();
    return `/products${s ? `?${s}` : ""}`;
  };

  return (
    <main className="flex-1">
      <section aria-labelledby="products-title" className={`${container} py-10 sm:py-12`}>
        <h1 id="products-title" className="font-display text-3xl font-bold text-ink">
          {t.home.shopAll}
        </h1>

        {collections.length > 0 && (
          <nav aria-label={t.home.collections} className="-mx-4 mt-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <ul className="flex gap-2 pb-1">
              <li>
                <StoreLink
                  href={listHref()}
                  className={chip(!activeCollection)}
                  aria-current={!activeCollection ? "page" : undefined}
                >
                  {t.home.allCollections}
                </StoreLink>
              </li>
              {collections.map((c) => (
                <li key={c.id}>
                  <StoreLink
                    href={listHref(c.id)}
                    className={chip(activeCollection === c.id)}
                    aria-current={activeCollection === c.id ? "page" : undefined}
                  >
                    {c.name}
                  </StoreLink>
                </li>
              ))}
            </ul>
          </nav>
        )}

        {productList.products.length === 0 ? (
          <p className="mt-8 rounded-2xl border border-dashed border-line bg-paper-raised py-16 text-center text-sm text-ink-soft">
            {activeCollection ? t.home.emptyCollection : t.home.empty}
          </p>
        ) : (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-3 lg:grid-cols-4">
            {productList.products.map((product) => (
              <ProductCard key={product.id} product={product} currency={store.currency} locale={locale} />
            ))}
          </div>
        )}

        {(after || productList.nextCursor) && (
          <nav aria-label={t.home.pages} className="mt-8 flex flex-wrap justify-center gap-3">
            {after && (
              <StoreLink href={listHref(activeCollection)} className={btnSecondary}>
                {t.home.firstPage}
              </StoreLink>
            )}
            {productList.nextCursor && (
              <StoreLink href={listHref(activeCollection, productList.nextCursor)} className={btnSecondary} rel="next">
                {t.home.morePage}
                <ArrowIcon size={18} className="rtl:rotate-180" />
              </StoreLink>
            )}
          </nav>
        )}
      </section>
    </main>
  );
}
