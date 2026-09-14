import type { Metadata } from "next";
import { FunnelStart } from "@/components/funnel/FunnelStart";
import { getDictionary } from "@/lib/i18n";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta } from "@/lib/storeMeta";

type Params = Promise<{ workspaceId: string; ref: string }>;

/**
 * Funnel entry: /store/:workspaceId/f/:ref, where `ref` is the funnel id or
 * its subdomain. There is no public "get funnel" endpoint and starting a
 * session needs the visitor id (kept in the browser), so the step's own SEO is
 * only known once a session exists — see ./[sessionId]/page.tsx.
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { workspaceId } = await params;
  const store = await getStoreMeta(workspaceId);
  const t = getDictionary(await getStoreLocale(store));
  return { title: t.funnel.metaTitle, robots: { index: false, follow: false } };
}

export default async function FunnelEntryPage({ params }: { params: Params }) {
  const { workspaceId, ref } = await params;
  return <FunnelStart workspaceId={workspaceId} funnelRef={ref} />;
}
