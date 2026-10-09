"use client";

import { HideInFunnel } from "@/components/HideInFunnel";
import { InviteBanner } from "./InviteBanner";
import { ShopperCartPrices } from "./ShopperCartPrices";

/**
 * What the store layout mounts once for a returning customer's perks: the
 * cart priced for the signed-in shopper (handoff 205), and a friend's invite
 * from a `?ref=` link with its banner (handoff 222). Funnel pages keep their
 * own path and prices, so the banner steps aside there.
 */
export function StoreRewards() {
  return (
    <>
      <ShopperCartPrices />
      <HideInFunnel>
        <InviteBanner />
      </HideInFunnel>
    </>
  );
}
