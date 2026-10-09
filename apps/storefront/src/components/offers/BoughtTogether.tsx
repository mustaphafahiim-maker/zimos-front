"use client";

import { pickText } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";
import { CrossSellStrip } from "./StoreOffers";

/**
 * «بيتشروا مع بعض» on the product page (frontend-handoff 223): the cross-sell
 * strip asked for this product's page (`placement=product`) — the merchant's
 * pinned products when a rule of theirs fits, else what real orders show the
 * product was bought with. Each card adds to the cart in one tap (a product
 * with options opens its page); the strip is not drawn when there is nothing
 * to suggest.
 */

const TEXT = {
  en: { title: "Frequently bought together" },
  ar: { title: "بيتشروا مع بعض" },
};

export function BoughtTogetherStrip({ workspaceId, productId }: { workspaceId: string; productId: string }) {
  const { locale } = useStore();
  return <CrossSellStrip workspaceId={workspaceId} productIds={[productId]} placement="product" title={pickText(TEXT, locale).title} />;
}
