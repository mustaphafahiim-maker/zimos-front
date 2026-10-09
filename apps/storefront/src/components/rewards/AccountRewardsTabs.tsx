"use client";

import { shopperReferral, shopperVip, type ShopperReferral, type ShopperVip } from "@store-builder/api-client";
import { StoreLink } from "@/components/StoreRoute";
import { btnPrimary, btnSecondary } from "@/components/ui";
import { useShopperRead } from "@/components/account/AccountWalletTabs";
import { useShopperApi } from "@/lib/shopperSession";
import { useRewardsCopy } from "./rewardsCopy";

/**
 * Two more tabs of the shopper's account: «مستواي» (VIP level, handoff 218)
 * and «ادعي صحابك» (invite friends, handoff 222), for the shell's tab list.
 * Each shows only on a store that runs it, and always on its own page. The
 * pages themselves are AccountVip.tsx and AccountInvite.tsx.
 */

export const VIP_PATH = "/account/vip";
export const INVITE_PATH = "/account/invite";

/** Whether an account path is one of these two pages (the shell's own tabs then stand unselected). */
export function isAccountRewardsPath(pathname: string): boolean {
  return pathname.endsWith(VIP_PATH) || pathname.endsWith(INVITE_PATH);
}

export function AccountRewardsTabs({ pathname }: { pathname: string }) {
  const copy = useRewardsCopy();
  const api = useShopperApi();
  const [vip] = useShopperRead<ShopperVip>(api, shopperVip);
  const [referral] = useShopperRead<ShopperReferral>(api, shopperReferral);

  const onVip = pathname.endsWith(VIP_PATH);
  const onInvite = pathname.endsWith(INVITE_PATH);
  const showVip = onVip || (vip.status === "ready" && vip.data.enabled);
  const showInvite = onInvite || (referral.status === "ready" && referral.data.enabled);

  const tab = (href: string, selected: boolean, label: string) => (
    <li key={href}>
      <StoreLink href={href} aria-current={selected ? "page" : undefined} className={`${selected ? btnPrimary : btnSecondary} whitespace-nowrap`}>
        {label}
      </StoreLink>
    </li>
  );
  return (
    <>
      {showVip && tab(VIP_PATH, onVip, copy.vipTab)}
      {showInvite && tab(INVITE_PATH, onInvite, copy.inviteTab)}
    </>
  );
}
