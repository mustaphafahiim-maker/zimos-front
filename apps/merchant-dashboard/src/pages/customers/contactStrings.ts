import { ApiError } from "@store-builder/api-client";
import type { Messages } from "@/i18n/LocaleContext";

/** Wording shared by the contacts screens (list, segments, contact page). */
export const CONTACT_STRINGS = {
  en: {
    type_lead: "Lead",
    type_customer: "Customer",
    source_checkout: "Checkout",
    source_form: "Form",
    source_manual: "Added by hand",
    source_import: "Import",
    consentYes: "Accepts marketing",
    consentNo: "No marketing",
    deliveryRate: "Delivery rate",
    deliveryRateNone: "No parcels closed yet",
    deliveryRateOf: "{delivered} of {closed} parcels delivered",
    phoneTaken: "A contact with that phone number already exists.",
    invalidPhone: "Enter a valid phone number.",
    segmentNameTaken: "A segment with that name already exists.",
  },
  ar: {
    type_lead: "عميل محتمل",
    type_customer: "عميل",
    source_checkout: "طلب من المتجر",
    source_form: "نموذج",
    source_manual: "إضافة يدوية",
    source_import: "استيراد",
    consentYes: "موافق على الرسائل التسويقية",
    consentNo: "بدون رسائل تسويقية",
    deliveryRate: "نسبة الاستلام",
    deliveryRateNone: "لا توجد شحنات منتهية بعد",
    deliveryRateOf: "تم استلام {delivered} من {closed} شحنة",
    phoneTaken: "يوجد جهة اتصال بنفس رقم الهاتف.",
    invalidPhone: "اكتب رقم هاتف صحيح.",
    segmentNameTaken: "توجد شريحة بنفس الاسم.",
  },
} satisfies Messages;

/** The API error code of a failed call, for the codes this lane added. */
export function contactErrorCode(err: unknown): string | undefined {
  return err instanceof ApiError ? err.code : undefined;
}

/** "a, B ,c" → ["a", "b", "c"] — tags are stored trimmed and lower-cased. */
export function parseTagInput(text: string): string[] {
  const seen = new Set<string>();
  for (const part of text.split(/[,،\n]/)) {
    const tag = part.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 60);
    if (tag) seen.add(tag);
  }
  return [...seen];
}

/** Green from 80%, amber from 50%, red below. */
export function deliveryRateTone(rate: number): "success" | "warning" | "danger" {
  if (rate >= 80) return "success";
  if (rate >= 50) return "warning";
  return "danger";
}
