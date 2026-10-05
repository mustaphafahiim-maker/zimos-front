import type { Metadata } from "next";
import { cache } from "react";
import { notFound } from "next/navigation";
import { ApiError, funnelGenericPageGet, type FunnelGenericPage } from "@store-builder/api-client";
import { FunnelCurrencyProvider } from "@/components/funnel/FunnelCurrency";
import { StoreLink } from "@/components/StoreRoute";
import { container } from "@/components/ui";
import { PageRenderer } from "@/components/page-renderer";
import { pickText } from "@/lib/i18n";
import { createServerStorefrontApiClient } from "@/lib/serverApiClient";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta } from "@/lib/storeMeta";

type Params = Promise<{ workspaceId: string; ref: string; key: string }>;

const TEXT = {
  en: { back: "Back to the offer", more: "More pages" },
  ar: { back: "رجوع للعرض", more: "صفحات أخرى" },
  fr: { back: "Retour à l'offre", more: "Autres pages" },
};

/** Deduped so generateMetadata and the page share one lookup. Null when the funnel or page isn't published. */
const loadPage = cache(async (workspaceId: string, ref: string, key: string): Promise<FunnelGenericPage | null> => {
  const client = await createServerStorefrontApiClient();
  try {
    return await funnelGenericPageGet(client, workspaceId, ref, key);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
});

function seoString(seo: Record<string, unknown> | undefined, key: string) {
  const v = seo?.[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { workspaceId, ref, key } = await params;
  const data = await loadPage(workspaceId, ref, key);
  if (!data) return {};
  const own = data.funnel.settings;
  return {
    title: seoString(data.step.seo, "title") ?? data.step.name,
    description: seoString(data.step.seo, "description") ?? own?.description ?? undefined,
    ...(own?.faviconUrl ? { icons: { icon: own.faviconUrl, apple: own.faviconUrl } } : {}),
  };
}

/**
 * A funnel's generic page — contact us, about us, policies (SPEC §9.2;
 * backend funnels/genericPages.js): /f/<funnel>/p/<key>. Off the path, so no
 * session: the page is just shown, inside the funnel's own masthead and
 * footer (f/layout.tsx), with a way back to the offer and to the funnel's
 * other generic pages.
 */
export default async function FunnelGenericPageView({ params }: { params: Params }) {
  const { workspaceId, ref, key } = await params;
  const [store, data] = await Promise.all([getStoreMeta(workspaceId), loadPage(workspaceId, ref, key)]);
  if (!store || !data) notFound();

  const locale = await getStoreLocale(store);
  const text = pickText(TEXT, locale);
  const currency = data.funnel.settings?.currency || store.currency;
  const others = data.pages.filter((p) => p.key !== key);
  const funnelPath = `/f/${encodeURIComponent(ref)}`;

  return (
    <main className="flex-1">
      <FunnelCurrencyProvider currency={currency}>
          <PageRenderer tree={data.step.tree} workspaceId={workspaceId} currency={currency} locale={locale} />
      </FunnelCurrencyProvider>
      <nav aria-label={text.more} className={`${container} flex flex-wrap items-center gap-x-4 gap-y-2 py-6 text-sm`}>
        <StoreLink href={funnelPath} className="font-semibold text-primary hover:underline">
          <span aria-hidden className="inline-block rtl:rotate-180">
            ←
          </span>{" "}
          {text.back}
        </StoreLink>
        {others.map((page) => (
          <StoreLink key={page.key} href={`${funnelPath}/p/${encodeURIComponent(page.key)}`} className="text-ink-soft hover:text-ink hover:underline" dir="auto">
            {page.name}
          </StoreLink>
        ))}
      </nav>
    </main>
  );
}
