import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { getStoreMeta } from "@/lib/storeMeta";
import { getStoreBasePath } from "@/lib/storeRoute";
import { storeHref } from "@/lib/storeHref";
import { PageRenderer } from "@/components/page-renderer";
import { StoreHeader } from "@/components/StoreHeader";

export const revalidate = 60;

/**
 * The page's one public address, on the store's own subdomain — resolved
 * against the `metadataBase` the store layout sets.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ path: string[] }>;
}): Promise<Metadata> {
  const { path } = await params;
  return { alternates: { canonical: `/${(path ?? []).join("/")}` } };
}

/**
 * Any page the merchant built in the website editor that isn't the home page —
 * "/about", "/contact", "/help/shipping".
 *
 * This is the lowest-priority route under /store/[workspaceId]: Next resolves
 * the app's own routes first (`/cart`, `/checkout`, `/products/…`, `/orders/…`),
 * so those keep their commerce logic and only paths the app doesn't claim reach
 * the page builder. A path the merchant hasn't published is a plain 404.
 */
export default async function CustomStorePage({
  params,
}: {
  params: Promise<{ workspaceId: string; path: string[] }>;
}) {
  const { workspaceId, path } = await params;
  // Next hands the segments already URL-decoded; the API normalises casing and
  // trailing slashes itself.
  const pagePath = `/${(path ?? []).join("/")}`;

  const client = await createServerStorefrontApiClient();
  const [store, result, basePath] = await Promise.all([
    getStoreMeta(workspaceId),
    client.getStorefrontPage(workspaceId, pagePath),
    getStoreBasePath(workspaceId),
  ]);

  if (!store) notFound();

  // The page was renamed and the backend kept a redirect for its old path.
  // `to` is store-relative, which is already the shape a subdomain serves; on
  // the shared host it still needs the /store/:workspaceId prefix.
  // A renamed page is a 301 server-side; keep it permanent so search engines
  // move with it rather than holding on to the old path.
  if (result.kind === "redirect") {
    const target = storeHref(basePath, result.to);
    if (result.statusCode === 301 || result.statusCode === 308) permanentRedirect(target);
    redirect(target);
  }

  if (result.kind === "notFound") notFound();

  const { page } = result.data;
  if ((page.tree?.sections?.length ?? 0) === 0) notFound();

  return (
    <main className="flex-1">
      <StoreHeader store={store} />
      <PageRenderer tree={page.tree} workspaceId={workspaceId} currency={store.currency} />
    </main>
  );
}
