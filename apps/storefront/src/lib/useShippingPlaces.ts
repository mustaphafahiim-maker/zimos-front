"use client";

import { placesFor, type Place } from "./places";
import { useStore } from "./StoreContext";

/** The places the checkout offers for a country: the platform's, less the ones the store does not deliver to. */
export function useShippingPlaces(country: string | null | undefined): readonly Place[] {
  const { store } = useStore();
  const hidden = store?.hiddenPlaces ?? [];
  const list = placesFor(country);
  return hidden.length ? list.filter((p) => !hidden.includes(p.code)) : list;
}
