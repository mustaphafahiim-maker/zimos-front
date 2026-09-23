"use client";

import { useEffect, useState } from "react";
import { createStorefrontApiClient } from "./apiClient";

/** The online methods a store takes, or null while unknown / when none are connected. */
export interface OnlinePaymentOptions {
  card: boolean;
  wallet: boolean;
}

/**
 * Asks the API once whether this store takes online payment (Paymob). Until
 * the answer arrives — and whenever the answer is "not connected", or the
 * call fails — this is null and the storefront shows nothing about paying
 * online: cash on delivery is the one method every store has.
 */
export function usePaymentOptions(workspaceId: string | undefined): OnlinePaymentOptions | null {
  const [options, setOptions] = useState<OnlinePaymentOptions | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    createStorefrontApiClient()
      .getStorefrontPaymentOptions(workspaceId)
      .then(({ paymob }) => {
        if (cancelled || !paymob.connected || (!paymob.card && !paymob.wallet)) return;
        setOptions({ card: paymob.card, wallet: paymob.wallet });
      })
      .catch(() => {
        /* no answer — the page keeps to cash on delivery */
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  return options;
}
