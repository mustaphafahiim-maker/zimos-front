import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ComparePage } from "@/components/specs/ComparePage";
import { SPEC_TEXT } from "@/components/specs/specText";
import { PRODUCT_SPECS_ENABLED } from "@/lib/features";
import { pickText } from "@/lib/i18n";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta } from "@/lib/storeMeta";

// The shopper's compare list, side by side. The list lives in the browser, so the page is not one to index.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}): Promise<Metadata> {
  if (!PRODUCT_SPECS_ENABLED) return {};
  const { workspaceId } = await params;
  const store = await getStoreMeta(workspaceId);
  const text = pickText(SPEC_TEXT, await getStoreLocale(store));
  return { title: text.pageTitle, robots: { index: false } };
}

export default function CompareRoute() {
  // Specifications are switched off (lib/features): there is no compare page.
  if (!PRODUCT_SPECS_ENABLED) notFound();
  return <ComparePage />;
}
