import { GOVERNORATES } from "./egypt";

/**
 * The places a checkout offers to ship to, per country (SPEC §12.1): the
 * platform's list (backend geo_regions, shipping/shippingPlaces.js) — Egypt's
 * governorates with North Coast, Saudi Arabia's 13 regions. The form stores
 * the code; the order carries "<ar> (<en>)" (orderForm.provinceFor), which the
 * server reads back to the same place to price it. A country with no list
 * keeps a free-text field. The store's hidden places are left out by
 * useShippingPlaces.
 */

export interface Place {
  code: string;
  ar: string;
  en: string;
}

/** Saudi Arabia's regions, as the platform lists them (codes sa-*). */
export const SAUDI_REGIONS = [
  { code: "sa-riyadh", ar: "منطقة الرياض", en: "Riyadh Region" },
  { code: "sa-makkah", ar: "منطقة مكة المكرمة", en: "Makkah Region" },
  { code: "sa-madinah", ar: "منطقة المدينة المنورة", en: "Madinah Region" },
  { code: "sa-eastern", ar: "المنطقة الشرقية", en: "Eastern Province" },
  { code: "sa-qassim", ar: "منطقة القصيم", en: "Al Qassim Region" },
  { code: "sa-asir", ar: "منطقة عسير", en: "Asir Region" },
  { code: "sa-tabuk", ar: "منطقة تبوك", en: "Tabuk Region" },
  { code: "sa-hail", ar: "منطقة حائل", en: "Hail Region" },
  { code: "sa-northern-borders", ar: "منطقة الحدود الشمالية", en: "Northern Borders Region" },
  { code: "sa-jazan", ar: "منطقة جازان", en: "Jazan Region" },
  { code: "sa-najran", ar: "منطقة نجران", en: "Najran Region" },
  { code: "sa-al-bahah", ar: "منطقة الباحة", en: "Al Bahah Region" },
  { code: "sa-al-jouf", ar: "منطقة الجوف", en: "Al Jouf Region" },
] as const satisfies readonly Place[];

const BY_COUNTRY: Record<string, readonly Place[]> = { EG: GOVERNORATES, SA: SAUDI_REGIONS };

/** The platform's places for a country; [] when it has none (a free-text field then). */
export function placesFor(country: string | null | undefined): readonly Place[] {
  return BY_COUNTRY[(country || "EG").toUpperCase()] ?? [];
}

/** A place of any country by its code. */
export function findPlace(code: string): Place | undefined {
  if (!code) return undefined;
  for (const list of Object.values(BY_COUNTRY)) {
    const hit = list.find((p) => p.code === code);
    if (hit) return hit;
  }
  return undefined;
}
