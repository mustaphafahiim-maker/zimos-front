import { EMPTY_ORDER_FORM, type OrderFormValues } from "./orderForm";
import { useStore } from "./StoreContext";

/**
 * The country the store sells in (SPEC §8.8: dashboard → Store design →
 * General → Country, GET /store/:ws `general.country`). It is what the order
 * form starts on, what an order is placed for when the form has no country
 * field, and what the shipping quote is asked for. Egypt when the merchant
 * never set it — the forms' behaviour before the setting existed.
 */
export const FALLBACK_COUNTRY = "EG";

export function normalizeCountry(value: unknown): string | null {
  return typeof value === "string" && /^[A-Za-z]{2}$/.test(value.trim()) ? value.trim().toUpperCase() : null;
}

/** The store's country from the StoreContext; Egypt when unset. */
export function useStoreCountry(): string {
  const { store } = useStore();
  return normalizeCountry(store?.country) ?? FALLBACK_COUNTRY;
}

/** An empty order form already on the store's country. */
export function emptyOrderFormFor(country: string): OrderFormValues {
  return { ...EMPTY_ORDER_FORM, country };
}

/** A country's name in the shopper's language, for a country the form's own list does not have. */
export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}
