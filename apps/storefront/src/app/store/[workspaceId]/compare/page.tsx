import type { Metadata } from "next";
import { ComparePage } from "@/components/specs/ComparePage";
import { SPEC_TEXT } from "@/components/specs/specText";
import { pickText } from "@/lib/i18n";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta } from "@/lib/storeMeta";

// The shopper's compare list, side by side (handoff 231). The list lives in the browser, so the page is not one to index.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}): Promise<Metadata> {
  const { workspaceId } = await params;
  const store = await getStoreMeta(workspaceId);
  const text = pickText(SPEC_TEXT, await getStoreLocale(store));
  return { title: text.pageTitle, robots: { index: false } };
}

export default function CompareRoute() {
  return <ComparePage />;
}
