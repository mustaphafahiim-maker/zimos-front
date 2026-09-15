"use client";

import { useEffect, useState } from "react";
import { createStorefrontApiClient } from "./apiClient";
import { findGovernorate } from "./egypt";

/**
 * Region name as the merchant's shipping zones store it. The dashboard
 * onboarding and shipping screens save Egyptian governorates as
 * "<Arabic> (<English>)", and the backend matches zone regions by exact name.
 */
export function regionForGovernorate(code: string): string | null {
  const g = findGovernorate(code);
  return g ? `${g.ar} (${g.en})` : null;
}

/**
 * Live shipping price from the store's real zones/rates
 * (GET /store/:id/shipping/quote). `null` until a governorate is chosen or
 * while loading; the order itself is still priced by the backend at checkout.
 */
export function useShippingQuote(workspaceId: string, governorateCode: string, subtotal: number, quantity = 1) {
  const [amount, setAmount] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const region = regionForGovernorate(governorateCode);

  useEffect(() => {
    if (!workspaceId || !region) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      setLoading(true);
      createStorefrontApiClient()
        .quoteStorefrontShipping(workspaceId, { country: "EG", region, subtotal: Math.max(0, Math.round(subtotal)), quantity: Math.max(1, quantity) })
        .then((q) => !cancelled && setAmount(q.amount))
        .catch(() => !cancelled && setAmount(null))
        .finally(() => !cancelled && setLoading(false));
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [workspaceId, region, subtotal, quantity]);

  // No governorate chosen → no quote (a stale amount is never shown).
  return { amount: region ? amount : null, loading: region ? loading : false };
}
