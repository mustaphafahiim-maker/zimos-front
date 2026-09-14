import { Suspense } from "react";
import Link from "next/link";
import type { StorefrontCollection } from "@store-builder/api-client";
import { getDictionary, type Locale } from "@/lib/i18n";
import { PAGE_SIZE } from "@/lib/publicApi";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { CatalogSearch } from "./CatalogSearch";
import { ProductBrowser } from "./ProductBrowser";

const chip = (active: boolean) =>
  `inline-flex min-h-11 shrink-0 items-center rounded-full border px-4 text-sm font-medium transition-colors ${
    active
      ? "border-primary bg-primary text-primary-foreground"
      : "border-line bg-paper-raised text-ink-soft hover:border-primary hover:text-primary"
  }`;

/**
 * Search box + collection chips + paginated grid, shared by the store home
 * and collection pages. Search is server-side via the API's `search` param.
 */
export async function CatalogSection({
  workspaceId,
  locale,
  collections,
  activeCollection,
  q,
  title,
  emptyText,
}: {
  workspaceId: string;
  locale: Locale;
  collections: StorefrontCollection[];
  activeCollection?: StorefrontCollection;
  q: string;
  title: string;
  emptyText: string;
}) {
  const t = getDictionary(locale);
  const base = `/store/${workspaceId}`;
  const client = await createServerStorefrontApiClient();
  const list = await client.listStorefrontProducts(workspaceId, {
    limit: PAGE_SIZE,
    collectionId: activeCollection?.id,
    search: q || undefined,
  });

  return (
    <section id="products" aria-labelledby="products-title" className="scroll-mt-24">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <h2 id="products-title" className="text-2xl font-bold text-ink">
          {q ? t.browse.results(q) : title}
        </h2>
        <Suspense fallback={<div className="h-11 w-full sm:max-w-xs" />}>
          <CatalogSearch />
        </Suspense>
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
                  href={`${base}/collections/${encodeURIComponent(c.slug || c.id)}`}
                  className={chip(activeCollection?.id === c.id)}
                  aria-current={activeCollection?.id === c.id ? "page" : undefined}
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <ProductBrowser
        key={`${activeCollection?.id ?? ""}|${q}`}
        workspaceId={workspaceId}
        initialProducts={list.products}
        initialCursor={list.nextCursor}
        collectionId={activeCollection?.id}
        search={q || undefined}
        emptyText={q ? t.browse.noResults(q) : emptyText}
      />
    </section>
  );
}
