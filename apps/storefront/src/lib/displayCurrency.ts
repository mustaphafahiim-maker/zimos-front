"use client";

import { useEffect, useSyncExternalStore } from "react";
import { storefrontCurrencies, type StorefrontCurrencies } from "@store-builder/api-client";
import { createStorefrontApiClient } from "./apiClient";

/**
 * The currency a shopper chose to view prices in (SPEC §11.5 "displayed
 * currencies"). Display only: every price stays in its own currency, and an
 * approximate converted amount is shown beside it (ConvertedPrice). The
 * choice is remembered per store on this device; with the store's
 * "convert automatically" on, a first visit picks the visitor's own
 * currency when the store lists it.
 */

type State = { data: StorefrontCurrencies | null; chosen: string | null };
const states = new Map<string, State>();
const loading = new Map<string, Promise<void>>();
const CHANGE = "zimos-display-currency";
const keyFor = (workspaceId: string) => `zimos_display_currency_${workspaceId}`;

// A visitor's region → its currency, for "convert automatically".
const REGION_CURRENCY: Record<string, string> = {
  EG: "EGP", SA: "SAR", AE: "AED", KW: "KWD", QA: "QAR", BH: "BHD", OM: "OMR", JO: "JOD", LB: "LBP", IQ: "IQD",
  MA: "MAD", DZ: "DZD", TN: "TND", LY: "LYD", SD: "SDG", US: "USD", GB: "GBP", CA: "CAD", AU: "AUD", TR: "TRY",
  DE: "EUR", FR: "EUR", IT: "EUR", ES: "EUR", NL: "EUR", BE: "EUR", AT: "EUR", IE: "EUR", PT: "EUR", GR: "EUR", FI: "EUR",
};

const empty: State = { data: null, chosen: null };
const emit = () => window.dispatchEvent(new Event(CHANGE));

function readChoice(workspaceId: string): string | null {
  try {
    return window.localStorage.getItem(keyFor(workspaceId));
  } catch {
    return null;
  }
}

function visitorCurrency(): string | null {
  const tags = typeof navigator !== "undefined" ? [...(navigator.languages ?? []), navigator.language] : [];
  for (const tag of tags) {
    const region = /[-_]([A-Za-z]{2})\b/.exec(tag ?? "")?.[1]?.toUpperCase();
    if (region && REGION_CURRENCY[region]) return REGION_CURRENCY[region];
  }
  return null;
}

function load(workspaceId: string) {
  if (states.has(workspaceId) || loading.has(workspaceId)) return;
  const work = storefrontCurrencies(createStorefrontApiClient(), workspaceId)
    .then((data) => {
      const listed = (c: string | null): c is string => Boolean(c && (c === data.baseCurrency || data.displayCurrencies.includes(c)));
      const saved = readChoice(workspaceId);
      const auto = data.autoConvert ? visitorCurrency() : null;
      const chosen = listed(saved) ? saved : listed(auto) ? auto : null;
      states.set(workspaceId, { data, chosen: chosen === data.baseCurrency ? null : chosen });
    })
    .catch(() => {
      // No display currencies: prices show as they are.
      states.set(workspaceId, empty);
    })
    .finally(() => {
      loading.delete(workspaceId);
      emit();
    });
  loading.set(workspaceId, work);
}

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE, callback);
  return () => window.removeEventListener(CHANGE, callback);
}

export function useDisplayCurrency(workspaceId: string) {
  useEffect(() => load(workspaceId), [workspaceId]);
  const state = useSyncExternalStore(subscribe, () => states.get(workspaceId) ?? empty, () => empty);
  const choose = (currency: string | null) => {
    const data = state.data;
    const value = currency && data && currency !== data.baseCurrency ? currency : null;
    states.set(workspaceId, { data, chosen: value });
    try {
      window.localStorage.setItem(keyFor(workspaceId), value ?? (data?.baseCurrency ?? ""));
    } catch {
      // Remembered for this page only.
    }
    emit();
  };
  /** An amount in minor units of `from`, in the chosen currency (minor units of it), or null. */
  const convert = (amountMinor: number, from: string): { amountMinor: number; currency: string } | null => {
    const { data, chosen } = state;
    if (!data || !chosen || chosen === from) return null;
    const rateTo = data.rates[chosen];
    const rateFrom = from === data.baseCurrency ? 1 : data.rates[from];
    if (!rateTo || !rateFrom) return null;
    const major = amountMinor / 10 ** digits(from) / rateFrom * rateTo;
    return { amountMinor: Math.round(major * 10 ** digits(chosen)), currency: chosen };
  };
  return { data: state.data, chosen: state.chosen, choose, convert };
}

export function digits(currency: string): number {
  try {
    return new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
  } catch {
    return 2;
  }
}
