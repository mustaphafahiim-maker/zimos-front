"use client";

import { useId } from "react";
import { useStore } from "@/lib/StoreContext";
import { useDisplayCurrency } from "@/lib/displayCurrency";

/**
 * Lets the shopper view prices in another of the store's currencies (the
 * header, and the builder's `currency_converter` element). Shows nothing
 * when the store lists no other currency. Display only.
 */
export function CurrencySwitcher({ workspaceId, inline = false, label, note }: { workspaceId?: string; inline?: boolean; label: string; note?: string }) {
  const { store } = useStore();
  const id = useId();
  // Keyed by the store's UUID, as ConvertedPrice is, so a choice anywhere shows everywhere.
  const { data, chosen, choose } = useDisplayCurrency(workspaceId ?? store?.id ?? "");
  if (!data || data.displayCurrencies.length === 0) return null;
  const options = [data.baseCurrency, ...data.displayCurrencies];
  return (
    <span className={inline ? "inline-flex flex-col gap-1" : "inline-flex items-center"}>
      <label htmlFor={id} className={inline ? "text-sm text-ink-soft" : "sr-only"}>
        {label}
      </label>
      <select
        id={id}
        value={chosen ?? data.baseCurrency}
        onChange={(e) => choose(e.target.value)}
        className="min-h-11 rounded-lg border border-line bg-paper-raised px-2 text-sm text-ink"
      >
        {options.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      {inline && note && <span className="text-xs text-ink-soft">{note}</span>}
    </span>
  );
}
