"use client";

import { useState } from "react";
import type { ShippingQuote } from "@store-builder/api-client";
import type { ShippingLine, ShippingQuoteState } from "./useShippingQuote";

/** One shipping option as the quote lists it (backend: shipping/shippingOptions.js). */
export interface ShippingOptionChoice {
  key: string;
  nameAr: string | null;
  nameEn: string | null;
  /** What this option costs for the cart, minor units. */
  amount: number;
  daysMin: number | null;
  daysMax: number | null;
}

const STANDARD = "standard";

/** The options in a quote answer ([] when the store offers no choice). */
export function quoteOptionsOf(quote: ShippingQuote | null | undefined): ShippingOptionChoice[] {
  const options = (quote as (ShippingQuote & { options?: ShippingOptionChoice[] }) | null | undefined)?.options;
  return Array.isArray(options) ? options : [];
}

/**
 * The shopper's pick among the store's shipping options (SPEC §12.1). Returns
 * the quote's state with the chosen option's amount and line, so every total
 * already built on `shipping.amount` / `shipping.line` follows the choice,
 * plus what the checkout payload needs.
 */
export function useShippingChoice(quote: ShippingQuoteState) {
  const options = quote.options ?? [];
  const [key, setKey] = useState(STANDARD);
  const chosen = options.find((o) => o.key === key) ?? null;
  const custom = chosen && chosen.key !== STANDARD ? chosen : null;
  const line: ShippingLine = custom ? (custom.amount > 0 ? { kind: "amount", amount: custom.amount } : { kind: "free" }) : quote.line;
  const state: ShippingQuoteState = custom ? { ...quote, line, amount: custom.amount } : quote;
  return {
    options,
    value: chosen ? chosen.key : STANDARD,
    choose: setKey,
    state,
    payload: custom ? { shippingOption: custom.key } : {},
  };
}

export type ShippingChoice = ReturnType<typeof useShippingChoice>;
