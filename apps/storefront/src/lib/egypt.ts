import type { Locale } from "./i18n";

/** All 27 Egyptian governorates. `code` is stable and what the form stores. */
export const GOVERNORATES = [
  { code: "cairo", ar: "القاهرة", en: "Cairo", zone: "metro" },
  { code: "giza", ar: "الجيزة", en: "Giza", zone: "metro" },
  { code: "alexandria", ar: "الإسكندرية", en: "Alexandria", zone: "delta" },
  { code: "qalyubia", ar: "القليوبية", en: "Qalyubia", zone: "metro" },
  { code: "sharqia", ar: "الشرقية", en: "Sharqia", zone: "delta" },
  { code: "dakahlia", ar: "الدقهلية", en: "Dakahlia", zone: "delta" },
  { code: "gharbia", ar: "الغربية", en: "Gharbia", zone: "delta" },
  { code: "monufia", ar: "المنوفية", en: "Monufia", zone: "delta" },
  { code: "beheira", ar: "البحيرة", en: "Beheira", zone: "delta" },
  { code: "kafr-el-sheikh", ar: "كفر الشيخ", en: "Kafr El Sheikh", zone: "delta" },
  { code: "damietta", ar: "دمياط", en: "Damietta", zone: "delta" },
  { code: "port-said", ar: "بورسعيد", en: "Port Said", zone: "canal" },
  { code: "ismailia", ar: "الإسماعيلية", en: "Ismailia", zone: "canal" },
  { code: "suez", ar: "السويس", en: "Suez", zone: "canal" },
  { code: "faiyum", ar: "الفيوم", en: "Faiyum", zone: "upper" },
  { code: "beni-suef", ar: "بني سويف", en: "Beni Suef", zone: "upper" },
  { code: "minya", ar: "المنيا", en: "Minya", zone: "upper" },
  { code: "asyut", ar: "أسيوط", en: "Asyut", zone: "upper" },
  { code: "sohag", ar: "سوهاج", en: "Sohag", zone: "upper" },
  { code: "qena", ar: "قنا", en: "Qena", zone: "upper" },
  { code: "luxor", ar: "الأقصر", en: "Luxor", zone: "upper" },
  { code: "aswan", ar: "أسوان", en: "Aswan", zone: "upper" },
  { code: "red-sea", ar: "البحر الأحمر", en: "Red Sea", zone: "remote" },
  { code: "new-valley", ar: "الوادي الجديد", en: "New Valley", zone: "remote" },
  { code: "matrouh", ar: "مطروح", en: "Matrouh", zone: "remote" },
  { code: "north-sinai", ar: "شمال سيناء", en: "North Sinai", zone: "remote" },
  { code: "south-sinai", ar: "جنوب سيناء", en: "South Sinai", zone: "remote" },
] as const;

export type Governorate = (typeof GOVERNORATES)[number];
export type GovernorateCode = Governorate["code"];
export type ShippingZone = Governorate["zone"];

export function findGovernorate(code: string): Governorate | undefined {
  return GOVERNORATES.find((g) => g.code === code);
}

export function governorateName(code: string, locale: Locale): string {
  const g = findGovernorate(code);
  return g ? g[locale] : code;
}

export const EGYPT_MOBILE = /^01[0125]\d{8}$/;

/**
 * Canonicalises what people actually type: Arabic-Indic / Persian digits,
 * spaces and dashes, and a +20 / 0020 country prefix.
 */
export function normalizePhone(raw: string): string {
  const latin = raw
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[\s\-().]/g, "");
  if (latin.startsWith("+20")) return `0${latin.slice(3)}`;
  if (latin.startsWith("0020")) return `0${latin.slice(4)}`;
  if (/^201\d{9}$/.test(latin)) return `0${latin.slice(2)}`;
  return latin;
}

export function isEgyptianMobile(raw: string): boolean {
  return EGYPT_MOBILE.test(normalizePhone(raw));
}

/** wa.me wants the international number with no "+" or leading zero. */
export function whatsappNumber(raw: string): string | null {
  const phone = normalizePhone(raw);
  if (EGYPT_MOBILE.test(phone)) return `20${phone.slice(1)}`;
  const digits = phone.replace(/^\+/, "");
  return /^\d{10,15}$/.test(digits) ? digits : null;
}
