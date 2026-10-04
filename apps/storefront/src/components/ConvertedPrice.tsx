"use client";

import { useStore } from "@/lib/StoreContext";
import { digits, useDisplayCurrency } from "@/lib/displayCurrency";

/**
 * "≈ 245 SAR" beside a price, in the currency the shopper chose to view
 * (CurrencySwitcher). Nothing when they kept the store's own. The charge is
 * always the price itself.
 */
export function ConvertedPrice({ amountMinor, currency, className = "" }: { amountMinor: number | string; currency: string; className?: string }) {
  const { store, intlLocale } = useStore();
  const { convert } = useDisplayCurrency(store?.id ?? "");
  const converted = store ? convert(Number(amountMinor), currency) : null;
  if (!converted) return null;
  let text: string;
  try {
    text = new Intl.NumberFormat(intlLocale, { style: "currency", currency: converted.currency }).format(
      converted.amountMinor / 10 ** digits(converted.currency)
    );
  } catch {
    text = `${converted.amountMinor / 10 ** digits(converted.currency)} ${converted.currency}`;
  }
  return <span className={`block text-xs text-ink-soft ${className}`}>≈ {text}</span>;
}
