import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FunnelHeader } from "@/components/funnel/FunnelHeader";
import { PoweredByZimos } from "@/components/PoweredByZimos";
import { TrackingPixels } from "@/components/TrackingPixels";
import { container } from "@/components/ui";
import { getDictionary } from "@/lib/i18n";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta } from "@/lib/storeMeta";
import { hasPixels, pixelIdsOf } from "@/lib/track";

/**
 * Funnel pages are one path to one order, not a place to browse — keep them
 * out of search results whatever a step's own SEO says.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Wraps every funnel page (`/f/<funnel>` and its steps). It sits inside the
 * store layout, so the brand colours, language and link prefix are already in
 * place; the store's own header and footer step aside here (ShopChrome) and
 * this draws a minimal masthead instead — the store's logo and name, and
 * nothing that leads off the path.
 *
 * It also loads the merchant's ad pixels, and only when at least one is set.
 */
export default async function FunnelLayout({
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
  const t = getDictionary(locale);
  const pixels = pixelIdsOf(store);

  return (
    <>
      {hasPixels(pixels) && (
        // Reads the search params to send page views on navigation.
        <Suspense fallback={null}>
          <TrackingPixels ids={pixels} />
        </Suspense>
      )}
      <FunnelHeader store={store} />
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="border-t border-line">
        <div className={`${container} flex justify-center py-3`}>
          <PoweredByZimos label={t.footer.poweredBy} />
        </div>
      </footer>
    </>
  );
}
