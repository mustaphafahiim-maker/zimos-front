import type { Metadata } from "next";
import { GiftCardBalanceCheck } from "@/components/giftCards/GiftCardBalanceCheck";
import { getDictionary } from "@/lib/i18n";
import { getStoreLocale } from "@/lib/storeLocale";
import { getStoreMeta } from "@/lib/storeMeta";

// "Check your gift card balance" (handoff 189).
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
  return <GiftCardBalanceCheck />;
}
