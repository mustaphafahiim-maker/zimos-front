import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GIFT_CARDS_ENABLED } from "@/lib/features";
import { GiftCardBalanceCheck } from "@/components/giftCards/GiftCardBalanceCheck";
import { getDictionary } from "@/lib/i18n";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta } from "@/lib/storeMeta";

// "Check your gift card balance".
export async function generateMetadata({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}): Promise<Metadata> {
  const { workspaceId } = await params;
  const store = await getStoreMeta(workspaceId);
  const t = getDictionary(await getStoreLocale(store));
  return { title: t.giftCards.checkBalance, robots: { index: false } };
}

export default function GiftCardBalancePage() {
  // Gift cards are a feature switched on per deploy (lib/features): off, this address is not there.
  if (!GIFT_CARDS_ENABLED) notFound();
  return <GiftCardBalanceCheck />;
}
