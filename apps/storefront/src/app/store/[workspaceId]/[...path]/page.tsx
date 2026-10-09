import type { Metadata } from "next";
import { cache } from "react";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import { PageRenderer } from "@/components/page-renderer";
import { PageScripts } from "@/components/PageScripts";
import { scriptsOf } from "@/lib/pageScripts";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { storeHref } from "@/lib/storeHref";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta, isStoreUnavailable } from "@/lib/storeMeta";
import type { StorefrontPageResult } from "@store-builder/api-client";
import { getStoreBasePath } from "@/lib/storeRoute";
import { HtmlBlocksProvider } from "@/components/HtmlBlock";
import { htmlBlocksOf } from "@/lib/htmlBlocks";
import { decodeSegment, type RedirectQuery } from "@/lib/urlRedirects";
import { redirectIfMoved } from "@/lib/urlRedirectsServer";

export const revalidate = 60;

type Params = Promise<{ workspaceId: string; path: string[] }>;

/** Deduped so generateMetadata and the page share one API call. */
const getPublishedPage = cache(async (workspaceId: string, pagePath: string): Promise<StorefrontPageResult> => {
  const client = await createServerStorefrontApiClient();
  try {
    return await client.getStorefrontPage(workspaceId, pagePath);
  } catch (err) {
    // The store layout draws the unavailable page; nothing to render here.
    if (isStoreUnavailable(err)) return { kind: "notFound" };
    throw err;
  }
});

function pathOf(path: string[] | undefined) {
  // Next hands the segments already URL-decoded; the API normalises casing and
  // trailing slashes itself.
  return `/${(path ?? []).join("/")}`;
}

/**
 * The page's own metadata, plus its one public address on the store's own
 * subdomain — the canonical stays relative so the store layout's
 * `metadataBase` resolves it there whichever host served this request.
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { workspaceId, path } = await params;
  const canonical = pathOf(path);
  const result = await getPublishedPage(workspaceId, canonical);
  if (result.kind !== "page") return { alternates: { canonical } };

  const { page } = result.data;
  const title = page.og?.title || page.title;
  return {
    title,
    description: page.og?.description || undefined,
    alternates: { canonical },
    // "Hide from search engines" in the page settings.
    ...((page.seo as { noindex?: unknown } | undefined)?.noindex === true ? { robots: { index: false, follow: true } } : {}),
    openGraph: {
      title,
      description: page.og?.description || undefined,
      url: canonical,
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
export default async function CustomStorePage({ params, searchParams }: { params: Params; searchParams?: Promise<RedirectQuery> }) {
  const { workspaceId, path } = await params;
  const [store, result, basePath] = await Promise.all([
    getStoreMeta(workspaceId),
    getPublishedPage(workspaceId, pathOf(path)),
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

  if (result.kind === "notFound") {
    // An address the merchant moved (Store settings → URL redirects, handoff 232) goes on to its new one; anything else is a 404.
    await redirectIfMoved(workspaceId, `/${(path ?? []).map(decodeSegment).join("/")}`, await searchParams);
    notFound();
  }

  const { page } = result.data;
  if ((page.tree?.sections?.length ?? 0) === 0) notFound();

  const locale = await getStoreLocale(store);

  return (
    <main className="flex-1">
      <HtmlBlocksProvider blocks={htmlBlocksOf(page)}>
        <PageRenderer
          tree={page.tree}
          workspaceId={workspaceId}
          currency={store.currency}
          locale={locale}
          siteStyles={result.data.site?.globalStyles}
          pageId={(page as { id?: string | null }).id}
        />
      </HtmlBlocksProvider>
      <PageScripts scripts={scriptsOf(page)} />
    </main>
  );
}
