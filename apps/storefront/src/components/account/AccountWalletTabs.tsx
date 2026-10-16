"use client";

import { useEffect, useState } from "react";
import {
  parseMoney,
  shopperLoyalty,
  shopperStoreCredit,
  type ApiClient,
  type ShopperLoyalty,
  type ShopperStoreCredit,
} from "@store-builder/api-client";
import { StoreLink } from "@/components/StoreRoute";
import { btnPrimary, btnSecondary } from "@/components/ui";
import { useTenderCopy } from "@/components/tenders/tenderCopy";
import { LOYALTY_ENABLED, STORE_CREDIT_ENABLED } from "@/lib/features";
import { isShopperSignedOutError, useShopperApi, type ShopperApi } from "@/lib/shopperSession";

/**
 * The account's two extra tabs, «نقطي» and «رصيدي», for
 * the shell's tab list. They show only where they have something to say: a
 * store with a points programme, a shopper who holds (or held) points or
 * store credit. The pages themselves are in AccountWallet.tsx.
 */

export const POINTS_PATH = "/account/points";
export const CREDIT_PATH = "/account/credit";

/** Whether an account path is one of these two pages (the shell's own tabs then stand unselected). */
export function isAccountWalletPath(pathname: string): boolean {
  return pathname.endsWith(POINTS_PATH) || pathname.endsWith(CREDIT_PATH);
}

export type Loaded<T> = { status: "loading" } | { status: "error" } | { status: "ready"; data: T };
type ShopperRead<T> = (client: ApiClient, storeId: string, token: string) => Promise<T>;

/** One signed-in read, run again by the returned reload. A 401 has already dropped the token: the sign-in shows by itself. */
export function useShopperRead<T>(api: ShopperApi, read: ShopperRead<T>, enabled = true): [Loaded<T>, () => void] {
  const [state, setState] = useState<Loaded<T>>({ status: "loading" });
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    // A feature that is switched off (lib/features) is never asked about: it stays "loading", and shows nothing.
    if (!enabled) return;
    let cancelled = false;
    api
      .call(read)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", data });
      })
      .catch((err) => {
        if (!cancelled && !isShopperSignedOutError(err)) setState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
    // The read is one of the API client's own functions at every call site.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, nonce, enabled]);
  return [
    state,
    () => {
      setState({ status: "loading" });
      setNonce((n) => n + 1);
    },
  ];
}

/**
 * The two tabs, as items of the shell's list. «نقطي» shows on a store with a
 * programme, or for a shopper with points or a points history; «رصيدي» for a
 * shopper with credit or a credit history. The tab of the page being read
 * always shows.
 */
export function AccountWalletTabs({ pathname }: { pathname: string }) {
  const copy = useTenderCopy();
  const api = useShopperApi();
  const [loyalty] = useShopperRead<ShopperLoyalty>(api, shopperLoyalty, LOYALTY_ENABLED);
  const [credit] = useShopperRead<ShopperStoreCredit>(api, shopperStoreCredit, STORE_CREDIT_ENABLED);

  const onPoints = LOYALTY_ENABLED && pathname.endsWith(POINTS_PATH);
  const onCredit = STORE_CREDIT_ENABLED && pathname.endsWith(CREDIT_PATH);
  const showPoints =
    onPoints || (loyalty.status === "ready" && (loyalty.data.program !== null || loyalty.data.balance > 0 || loyalty.data.history.length > 0));
  const showCredit = onCredit || (credit.status === "ready" && (parseMoney(credit.data.balance) > 0 || credit.data.history.length > 0));

  const tab = (href: string, selected: boolean, label: string) => (
    <li key={href}>
      <StoreLink href={href} aria-current={selected ? "page" : undefined} className={`${selected ? btnPrimary : btnSecondary} whitespace-nowrap`}>
        {label}
      </StoreLink>
    </li>
  );
  return (
    <>
      {showPoints && tab(POINTS_PATH, onPoints, copy.myPoints)}
      {showCredit && tab(CREDIT_PATH, onCredit, copy.myCredit)}
    </>
  );
}
