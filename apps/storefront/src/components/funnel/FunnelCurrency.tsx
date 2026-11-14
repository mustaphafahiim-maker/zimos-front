"use client";

import { createContext, useContext } from "react";

const FunnelCurrencyContext = createContext<string | null>(null);

/**
 * The currency the running funnel sells in (its own settings, else the
 * store's), for the client islands of a funnel step: the amounts they show
 * and the currency their pixel events report.
 */
export function FunnelCurrencyProvider({ currency, children }: { currency: string | null; children: React.ReactNode }) {
  return <FunnelCurrencyContext.Provider value={currency}>{children}</FunnelCurrencyContext.Provider>;
}

/** The funnel's currency, or null outside a funnel step (callers fall back to the store's). */
export function useFunnelCurrency(): string | null {
  return useContext(FunnelCurrencyContext);
}
