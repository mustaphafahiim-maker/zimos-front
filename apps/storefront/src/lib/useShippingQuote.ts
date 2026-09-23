"use client";

import { useEffect, useState } from "react";
import { createStorefrontApiClient } from "./apiClient";
import { findGovernorate } from "./egypt";
import { shippingRegionOf } from "./orderForm";

export type ShippingQuote =
  /** No governorate chosen yet — nothing to quote. */
  | { status: "idle" }
  | { status: "loading" }
  /** What checkout will charge for this destination, in minor units. */
  | { status: "ready"; amount: number; currency: string }
  /** The API has no quote (older backend, or the call failed): shown as "confirmed when we call you". */
  | { status: "unavailable" };

/**
 * The shipping fee for the chosen governorate, asked of the same calculation
 * checkout runs, so the total the shopper sees is the total the order gets.
 * Re-asked whenever the destination or the basket changes; a short debounce
 * keeps a quick change of mind from firing two requests.
 */
export function useShippingQuote(
  workspaceId: string | undefined,
  { governorate, subtotal, quantity }: { governorate: string; subtotal: number; quantity: number }
): ShippingQuote {
  const [quote, setQuote] = useState<ShippingQuote>({ status: "loading" });
  const gov = findGovernorate(governorate);
  const region = gov ? shippingRegionOf(gov) : "";

  useEffect(() => {
    if (!workspaceId || !region) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setQuote({ status: "loading" });
      try {
        const res = await createStorefrontApiClient().quoteStorefrontShipping(workspaceId, {
          country: "EG",
          region,
          subtotal,
          quantity: Math.max(1, quantity),
        });
        if (!cancelled) setQuote({ status: "ready", amount: res.amount, currency: res.currency });
      } catch {
        // A 404 is a backend without the endpoint; any other failure reads the same to the shopper.
        if (!cancelled) setQuote({ status: "unavailable" });
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [workspaceId, region, subtotal, quantity]);

  // Without a destination there is nothing to quote, whatever was quoted before.
  return region ? quote : { status: "idle" };
}
