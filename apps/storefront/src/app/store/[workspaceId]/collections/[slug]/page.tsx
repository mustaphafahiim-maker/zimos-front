import type { Metadata } from "next";
import Link from "next/link";
import { cache } from "react";
import { notFound } from "next/navigation";
import type { StorefrontCollection } from "@store-builder/api-client";
import { CatalogSection } from "@/components/catalog/CatalogSection";
import { ArrowIcon } from "@/components/Icons";
import { container } from "@/components/ui";
import { getDictionary } from "@/lib/i18n";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta } from "@/lib/storeMeta";

type Params = Promise<{ workspaceId: string; slug: string }>;
type Search = Promise<{ q?: string | string[] }>;

/**
 * The public API fetches a single collection by id only, so a slug is resolved
 * against the (small, unpaginated) collection list. An id also works.
 */
const getCollections = cache(async (workspaceId: string): Promise<StorefrontCollection[]> => {
  const client = await createServerStorefrontApiClient();
  return client.listStorefrontCollections(workspaceId).catch((): StorefrontCollection[] => []);
});

async function findCollection(workspaceId: string, slug: string) {
  const collections = await getCollections(workspaceId);
  const wanted = decodeURIComponent(slug).toLowerCase();
  return {
    collections,
    collection: collections.find((c) => c.slug?.toLowerCase() === wanted || c.id === wanted) ?? null,
  };
}

function seoString(seo: Record<string, unknown> | null, key: string) {
  const v = seo?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { workspaceId, slug } = await params;
  const { collection } = await findCollection(workspaceId, slug);
  if (!collection) return {};
  const title = seoString(collection.seo, "title") ?? collection.name;
  const description = seoString(collection.seo, "description") ?? collection.description ?? undefined;
  return { title, description, openGraph: { title, description } };
}

export default async function CollectionPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const [{ workspaceId, slug }, query] = await Promise.all([params, searchParams]);
  const [store, { collections, collection }] = await Promise.all([
    getStoreMeta(workspaceId),
    findCollection(workspaceId, slug),
  ]);
  if (!store || !collection) notFound();

  const locale = await getStoreLocale(store);
  const t = getDictionary(locale);
  const q = typeof query.q === "string" ? query.q.trim().slice(0, 200) : "";

  return (
    <main className={`${container} flex-1 py-6 pb-16 sm:py-8`}>
      <Link
        href={`/store/${workspaceId}`}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-lg text-sm font-medium text-ink-soft transition-colors hover:text-primary"
      >
        <ArrowIcon size={16} className="rotate-180 rtl:rotate-0" />
        {t.product.back}
      </Link>
      <header className="mb-8 mt-2">
        <p className="text-sm font-medium text-primary">{t.browse.collection}</p>
        <h1 className="mt-1 text-3xl font-bold text-ink">{collection.name}</h1>
        {collection.description && <p className="mt-2 max-w-2xl text-base text-ink-soft">{collection.description}</p>}
      </header>
      <CatalogSection
        workspaceId={workspaceId}
        locale={locale}
        collections={collections}
        activeCollection={collection}
        q={q}
        title={t.home.shopAll}
        emptyText={t.home.emptyCollection}
      />
    </main>
  );
}
