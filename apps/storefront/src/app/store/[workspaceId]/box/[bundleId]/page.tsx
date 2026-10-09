import type { Metadata } from "next";
import { BoxBuilder } from "@/components/gifts/BoxBuilder";
import { getDictionary } from "@/lib/i18n";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta } from "@/lib/storeMeta";

// "Build your box" for a mix-and-match bundle (handoff 215).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ workspaceId: string; bundleId: string }>;
}): Promise<Metadata> {
  const { workspaceId } = await params;
  const store = await getStoreMeta(workspaceId);
  const t = getDictionary(await getStoreLocale(store));
  return { title: t.giftBox.entryTitle };
}

export default async function BoxPage({ params }: { params: Promise<{ workspaceId: string; bundleId: string }> }) {
  const { bundleId } = await params;
  return <BoxBuilder bundleId={bundleId} />;
}
