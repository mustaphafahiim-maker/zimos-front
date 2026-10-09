"use client";

import { pickText } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";
import { catalogHref, type CatalogState } from "@/lib/catalogQuery";
import { useCatalogNavigate } from "./useCatalogNavigate";

/** Sold-out products in the store's lists (handoff 390): the card's badge and the sidebar's switch. */
export const SOLD_OUT_COPY = {
  en: { badge: "Sold out", inStockOnly: "In stock only" },
  ar: { badge: "نفدت الكمية", inStockOnly: "المتاح بس" },
  fr: { badge: "Épuisé", inStockOnly: "En stock uniquement" },
};

/**
 * «المتاح بس» at the top of the listing's filters: leaves out the products
 * nobody can buy right now (`available=true` on the listing). Kept in the URL
 * like every other filter. The page leaves it out when the store already hides
 * sold-out products (settings.storefront_catalog.sold_out = "hide"): there is
 * nothing for it to take away.
 */
export function InStockOnly({ state }: { state: CatalogState }) {
  const { locale } = useStore();
  const { go } = useCatalogNavigate();
  const on = state.available === true;
  return (
    <label
      data-slot="in-stock-only"
      className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-2 text-sm font-medium text-ink hover:bg-primary-soft/50 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary"
    >
      <span className="min-w-0 flex-1">{pickText(SOLD_OUT_COPY, locale).inStockOnly}</span>
      <input type="checkbox" role="switch" className="peer sr-only" checked={on} onChange={() => go(catalogHref(state, { available: !on }))} />
      <span
        aria-hidden
        className="relative h-6 w-10 shrink-0 rounded-full bg-line transition-colors after:absolute after:start-0.5 after:top-0.5 after:size-5 after:rounded-full after:bg-paper-raised after:shadow-sm after:transition-transform peer-checked:bg-primary peer-checked:after:translate-x-4 rtl:peer-checked:after:-translate-x-4 motion-reduce:transition-none motion-reduce:after:transition-none"
      />
    </label>
  );
}
