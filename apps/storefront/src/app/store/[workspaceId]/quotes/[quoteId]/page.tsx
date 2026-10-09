import type { Metadata } from "next";
import { QuotePage } from "@/components/quotes/QuotePage";
import { QUOTE_TEXT } from "@/components/quotes/quoteText";
import { pickText } from "@/lib/i18n";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta } from "@/lib/storeMeta";

// A shopper's quote: status, the store's prices, accept or decline (handoff 219, 275).
// The email "your quote is ready" links here; the page opens with the token the browser kept.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ workspaceId: string; quoteId: string }>;
}): Promise<Metadata> {
  const { workspaceId } = await params;
  const store = await getStoreMeta(workspaceId);
  const text = pickText(QUOTE_TEXT, await getStoreLocale(store));
  return { title: text.metaTitle, robots: { index: false } };
}

export default function QuoteRoute() {
  return <QuotePage />;
}
