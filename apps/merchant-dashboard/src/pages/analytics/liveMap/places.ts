import { INSET_PROJECTION } from "./worldGeometry";

/**
 * Where the live map puts a place's dot: Egypt's 27 governorates and North
 * Coast, and Saudi Arabia's 13 regions, by the platform's place code (backend
 * geo_regions — the same codes and names as the storefront's lib/places.ts).
 *
 * The coordinates are APPROXIMATE, taken from public geography and rounded to
 * about a tenth of a degree. Each is a representative point inside the
 * governorate or region, placed near where its people live rather than at the
 * exact centre of its area: Giza's or Matrouh's area centre lies far out in the
 * desert, which would put Cairo's west bank in the Western Desert. They are for
 * a dot on a map, never for distances or shipping.
 */
export interface MapPlace {
  code: string;
  country: "EG" | "SA";
  en: string;
  ar: string;
  lat: number;
  lon: number;
}

export const MAP_PLACES: readonly MapPlace[] = [
  { code: "cairo", country: "EG", en: "Cairo", ar: "القاهرة", lat: 30.07, lon: 31.36 },
  { code: "giza", country: "EG", en: "Giza", ar: "الجيزة", lat: 29.93, lon: 31.1 },
  { code: "alexandria", country: "EG", en: "Alexandria", ar: "الإسكندرية", lat: 31.2, lon: 29.95 },
  { code: "qalyubia", country: "EG", en: "Qalyubia", ar: "القليوبية", lat: 30.35, lon: 31.22 },
  { code: "sharqia", country: "EG", en: "Sharqia", ar: "الشرقية", lat: 30.7, lon: 31.62 },
  { code: "dakahlia", country: "EG", en: "Dakahlia", ar: "الدقهلية", lat: 31.08, lon: 31.48 },
  { code: "gharbia", country: "EG", en: "Gharbia", ar: "الغربية", lat: 30.85, lon: 31.0 },
  { code: "monufia", country: "EG", en: "Monufia", ar: "المنوفية", lat: 30.5, lon: 30.95 },
  { code: "beheira", country: "EG", en: "Beheira", ar: "البحيرة", lat: 30.85, lon: 30.35 },
  { code: "kafr-el-sheikh", country: "EG", en: "Kafr El Sheikh", ar: "كفر الشيخ", lat: 31.25, lon: 30.9 },
  { code: "damietta", country: "EG", en: "Damietta", ar: "دمياط", lat: 31.42, lon: 31.81 },
  { code: "port-said", country: "EG", en: "Port Said", ar: "بورسعيد", lat: 31.26, lon: 32.3 },
  { code: "ismailia", country: "EG", en: "Ismailia", ar: "الإسماعيلية", lat: 30.6, lon: 32.27 },
  { code: "suez", country: "EG", en: "Suez", ar: "السويس", lat: 29.97, lon: 32.5 },
  { code: "faiyum", country: "EG", en: "Faiyum", ar: "الفيوم", lat: 29.31, lon: 30.84 },
  { code: "beni-suef", country: "EG", en: "Beni Suef", ar: "بني سويف", lat: 29.07, lon: 31.1 },
  { code: "minya", country: "EG", en: "Minya", ar: "المنيا", lat: 28.1, lon: 30.75 },
  { code: "asyut", country: "EG", en: "Asyut", ar: "أسيوط", lat: 27.18, lon: 31.18 },
  { code: "sohag", country: "EG", en: "Sohag", ar: "سوهاج", lat: 26.56, lon: 31.69 },
  { code: "qena", country: "EG", en: "Qena", ar: "قنا", lat: 26.16, lon: 32.72 },
  { code: "luxor", country: "EG", en: "Luxor", ar: "الأقصر", lat: 25.69, lon: 32.64 },
  { code: "aswan", country: "EG", en: "Aswan", ar: "أسوان", lat: 24.09, lon: 32.9 },
  { code: "red-sea", country: "EG", en: "Red Sea", ar: "البحر الأحمر", lat: 27.0, lon: 33.7 },
  { code: "new-valley", country: "EG", en: "New Valley", ar: "الوادي الجديد", lat: 25.5, lon: 30.0 },
  { code: "matrouh", country: "EG", en: "Matrouh", ar: "مطروح", lat: 31.2, lon: 27.2 },
  { code: "north-sinai", country: "EG", en: "North Sinai", ar: "شمال سيناء", lat: 30.9, lon: 33.6 },
  { code: "south-sinai", country: "EG", en: "South Sinai", ar: "جنوب سيناء", lat: 28.6, lon: 33.95 },
  { code: "north-coast", country: "EG", en: "North Coast", ar: "الساحل الشمالي", lat: 30.9, lon: 28.8 },
  { code: "sa-riyadh", country: "SA", en: "Riyadh Region", ar: "منطقة الرياض", lat: 24.6, lon: 46.4 },
  { code: "sa-makkah", country: "SA", en: "Makkah Region", ar: "منطقة مكة المكرمة", lat: 21.7, lon: 40.1 },
  { code: "sa-madinah", country: "SA", en: "Madinah Region", ar: "منطقة المدينة المنورة", lat: 24.6, lon: 39.4 },
  { code: "sa-eastern", country: "SA", en: "Eastern Province", ar: "المنطقة الشرقية", lat: 26.0, lon: 49.7 },
  { code: "sa-qassim", country: "SA", en: "Al Qassim Region", ar: "منطقة القصيم", lat: 26.33, lon: 43.97 },
  { code: "sa-asir", country: "SA", en: "Asir Region", ar: "منطقة عسير", lat: 18.9, lon: 42.8 },
  { code: "sa-tabuk", country: "SA", en: "Tabuk Region", ar: "منطقة تبوك", lat: 28.0, lon: 36.9 },
  { code: "sa-hail", country: "SA", en: "Hail Region", ar: "منطقة حائل", lat: 27.52, lon: 41.69 },
  { code: "sa-northern-borders", country: "SA", en: "Northern Borders Region", ar: "منطقة الحدود الشمالية", lat: 30.4, lon: 41.9 },
  { code: "sa-jazan", country: "SA", en: "Jazan Region", ar: "منطقة جازان", lat: 17.1, lon: 42.8 },
  { code: "sa-najran", country: "SA", en: "Najran Region", ar: "منطقة نجران", lat: 17.6, lon: 44.4 },
  { code: "sa-al-bahah", country: "SA", en: "Al Bahah Region", ar: "منطقة الباحة", lat: 20.01, lon: 41.47 },
  { code: "sa-al-jouf", country: "SA", en: "Al Jouf Region", ar: "منطقة الجوف", lat: 29.9, lon: 39.6 },
];

const BY_CODE = new Map(MAP_PLACES.map((p) => [p.code, p]));

/** A governorate or region by its code; a city code ("cairo.nasr-city") falls back to its governorate. */
export function mapPlace(code: string | null | undefined): MapPlace | undefined {
  if (!code) return undefined;
  return BY_CODE.get(code) ?? BY_CODE.get(code.split(".")[0]);
}

/** A point in the inset map's units (the projection worldGeometry.ts was drawn with). */
export function insetPoint(lat: number, lon: number): [number, number] {
  const { lonMin, latMax, cosRef, unitsPerDegree } = INSET_PROJECTION;
  return [(lon - lonMin) * cosRef * unitsPerDegree, (latMax - lat) * unitsPerDegree];
}
