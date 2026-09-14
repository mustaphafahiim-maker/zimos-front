import type { Metadata } from "next";
import { cache } from "react";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { StorePage } from "@/components/StoreRenderer";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { isReservedThemePath } from "@/lib/themePages";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta } from "@/lib/storeMeta";

export const revalidate = 60;

type Params = Promise<{ workspaceId: string; path: string[] }>;

/** Deduped so generateMetadata and the page share one API call. */
const getPublishedPage = cache(async (workspaceId: string, pagePath: string) => {
  const client = await createServerStorefrontApiClient();
  return client.getStorefrontPage(workspaceId, pagePath);
});

function pathOf(path: string[] | undefined) {
  // Next hands the segments already URL-decoded; the API normalises casing and
  // trailing slashes itself.
  return `/${(path ?? []).join("/")}`;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { workspaceId, path } = await params;
  // Theme product/collection blocks only render around their templates.
  if (isReservedThemePath(pathOf(path))) notFound();
  const result = await getPublishedPage(workspaceId, pathOf(path));
  if (result.kind !== "page") return {};
  const { page } = result.data;
  const title = page.og?.title || page.title;
  return {
    title,
    description: page.og?.description || undefined,
    openGraph: {
      title,
      description: page.og?.description || undefined,
      ...(page.og?.image ? { images: [page.og.image] } : {}),
    },
  };
}

/**
 * Any page the merchant built in the website editor that isn't the home page —
 * "/about", "/contact", "/help/shipping".
 *
 * This is the lowest-priority route under /store/[workspaceId]: Next resolves
 * the app's own routes first (`/cart`, `/checkout`, `/products/…`, `/orders/…`,
 * `/offer/…`, `/track`), so those keep their commerce logic and only paths the
 * app doesn't claim reach the page builder. An unpublished path is a plain 404.
 */
export default async function CustomStorePage({ params }: { params: Params }) {
  const { workspaceId, path } = await params;
  // Theme product/collection blocks only render around their templates.
  if (isReservedThemePath(pathOf(path))) notFound();
  const [store, result] = await Promise.all([
    getStoreMeta(workspaceId),
    getPublishedPage(workspaceId, pathOf(path)),
  ]);

  if (!store) notFound();

  // The page was renamed and the backend kept a redirect for its old path.
  // `to` is a store-relative path, so it needs the /store/:workspaceId prefix.
  // A renamed page is a 301 server-side; keep it permanent so search engines
  // move with it rather than holding on to the old path.
  if (result.kind === "redirect") {
    const target = `/store/${workspaceId}${result.to}`;
    if (result.statusCode === 301 || result.statusCode === 308) permanentRedirect(target);
    redirect(target);
  }

  if (result.kind === "notFound") notFound();

  const { page } = result.data;
  if ((page.tree?.sections?.length ?? 0) === 0) notFound();

  const locale = await getStoreLocale(store);

  return (
    <main className="flex-1">
      <StorePage tree={page.tree} workspaceId={workspaceId} currency={store.currency} locale={locale} />
    </main>
  );
}
