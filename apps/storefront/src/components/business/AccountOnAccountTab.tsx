"use client";

import { shopperOnAccount, shopperOnAccountStatement, type ShopperOnAccount } from "@store-builder/api-client";
import { useShopperRead } from "@/components/account/AccountWalletTabs";
import { StoreLink } from "@/components/StoreRoute";
import { btnPrimary, btnSecondary } from "@/components/ui";
import { useShopperApi } from "@/lib/shopperSession";
import { useBusinessCopy } from "./businessCopy";
import { ON_ACCOUNT_PATH, isAccountOnAccountPath } from "./paths";

/**
 * The account's «حسابي الآجل» tab (handoff 229), for the shell's tab list. It
 * shows only where it has something to say: a shopper the store approved to
 * pay later, or one who still has orders on account — and always on its own
 * page. The page itself is in AccountOnAccount.tsx.
 */

export { ON_ACCOUNT_PATH, isAccountOnAccountPath };

export function AccountOnAccountTab({ pathname }: { pathname: string }) {
  const copy = useBusinessCopy();
  const api = useShopperApi();
  const [state] = useShopperRead<ShopperOnAccount>(api, shopperOnAccount);

  const selected = isAccountOnAccountPath(pathname);
  const show = selected || (state.status === "ready" && shopperOnAccountStatement(state.data) !== null);
  if (!show) return null;
  return (
    <li>
      <StoreLink href={ON_ACCOUNT_PATH} aria-current={selected ? "page" : undefined} className={`${selected ? btnPrimary : btnSecondary} whitespace-nowrap`}>
        {copy.onAccountTab}
      </StoreLink>
    </li>
  );
}
