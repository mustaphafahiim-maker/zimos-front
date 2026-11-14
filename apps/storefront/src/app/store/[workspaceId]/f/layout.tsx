import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FunnelHeader } from "@/components/funnel/FunnelHeader";
import { FunnelPolicies } from "@/components/funnel/FunnelPolicies";
import { PoweredByZimos, brandingRemoved } from "@/components/PoweredByZimos";
import { container } from "@/components/ui";
import { getDictionary } from "@/lib/i18n";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta } from "@/lib/storeMeta";

/**
 * Funnel pages are one path to one order, not a place to browse — keep them
 * out of search results whatever a step's own SEO says.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Wraps every funnel page (`/f/<funnel>` and its steps). It sits inside the
 * store layout, so the brand colours, language and link prefix are already in
 * place; the store's own header and footer step aside here (HideInFunnel) and
 * this draws a minimal masthead instead — the store's logo and name, and
 * nothing that leads off the path.
 *
 * The store's own analytics (components/StoreAnalytics) are NOT mounted here:
 * the store layout's tracker already sees every funnel page, and a second one
 * would count each of them twice. A funnel step adds its funnelId to that
 * tracker's context instead (components/funnel/FunnelStep.tsx).
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

  const t = getDictionary(await getStoreLocale(store));

  return (
    <>
      <FunnelHeader store={store} />
      <div className="flex flex-1 flex-col">{children}</div>
      <footer className="mt-auto border-t border-line bg-paper-raised">
        <div className={`${container} flex flex-col items-center gap-2 py-3`}>
          {/* The store's policies: required by ad platforms, and the store footer is hidden here. */}
          <FunnelPolicies />
          {/* Not for a store whose plan removes the branding (Plan.features.remove_branding). */}
          {!brandingRemoved(store) && <PoweredByZimos label={t.footer.poweredBy} />}
        </div>
      </footer>
    </>
  );
}
