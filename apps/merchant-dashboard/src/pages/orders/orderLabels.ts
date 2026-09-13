/**
 * Bilingual labels for order-domain enum values (confirmation, payment,
 * fulfilment, payment method, shipment/return status, return reasons, risk
 * flags). Used wherever the orders pages render an enum value as text directly.
 * Unknown values fall back to `humanize()`.
 */
import { useCallback } from "react";
import { humanize } from "@/lib/format";
import { useLocale, type Locale } from "@/i18n/LocaleContext";

const ENUM_LABELS: Record<Locale, Record<string, string>> = {
  en: {
    // confirmation
    pending: "Pending",
    confirmed: "Confirmed",
    rejected: "Rejected",
    unreachable: "Unreachable",
    postponed: "Postponed",
    // financial
    partially_paid: "Partially paid",
    paid: "Paid",
    failed: "Failed",
    refunded: "Refunded",
    partially_refunded: "Partially refunded",
    // fulfilment
    unfulfilled: "Unfulfilled",
    partially_fulfilled: "Partially fulfilled",
    fulfilled: "Fulfilled",
    returned: "Returned",
    // payment method
    cod: "Cash on delivery",
    card: "Card",
    wallet: "Wallet",
    bank_transfer: "Bank transfer",
    // shipment
    created: "Created",
    picked_up: "Picked up",
    in_transit: "In transit",
    out_for_delivery: "Out for delivery",
    delivered: "Delivered",
    cancelled: "Cancelled",
    // return status
    requested: "Requested",
    approved: "Approved",
    received: "Received",
    // return reasons
    damaged: "Damaged",
    defective: "Defective",
    wrong_item: "Wrong item",
    not_as_described: "Not as described",
    no_longer_wanted: "No longer wanted",
    arrived_late: "Arrived late",
    other: "Other",
    // risk flags
    duplicate_order_window: "Duplicate order",
    max_orders_per_phone_per_day: "Too many orders from this phone today",
  },
  ar: {
    pending: "قيد الانتظار",
    confirmed: "مؤكَّد",
    rejected: "مرفوض",
    unreachable: "تعذّر الوصول",
    postponed: "مؤجَّل",
    partially_paid: "مدفوع جزئيًا",
    paid: "مدفوع",
    failed: "فشل",
    refunded: "مُسترد",
    partially_refunded: "مُسترد جزئيًا",
    unfulfilled: "لم يُشحن",
    partially_fulfilled: "مشحون جزئيًا",
    fulfilled: "تم الشحن",
    returned: "مرتجع",
    cod: "الدفع عند الاستلام",
    card: "بطاقة",
    wallet: "محفظة إلكترونية",
    bank_transfer: "تحويل بنكي",
    created: "تم الإنشاء",
    picked_up: "تم الاستلام من المتجر",
    in_transit: "في الطريق",
    out_for_delivery: "خرج للتوصيل",
    delivered: "تم التسليم",
    cancelled: "ملغي",
    requested: "مطلوب",
    approved: "مقبول",
    received: "تم الاستلام",
    damaged: "تالف",
    defective: "به عيب",
    wrong_item: "منتج خاطئ",
    not_as_described: "غير مطابق للوصف",
    no_longer_wanted: "لم يعد مطلوبًا",
    arrived_late: "وصل متأخرًا",
    other: "سبب آخر",
    duplicate_order_window: "طلب مكرر",
    max_orders_per_phone_per_day: "طلبات كثيرة من نفس الرقم اليوم",
  },
};

/**
 * Wraps a value (order number, phone, tracking code) in Unicode LTR isolate
 * marks so it doesn't scramble when interpolated into a plain string that is
 * rendered in an RTL context (toasts, dialog titles, descriptions).
 */
export function ltr(value: string): string {
  return `⁦${value}⁩`;
}

export function enumLabel(locale: Locale, value: string): string {
  return ENUM_LABELS[locale][value] ?? humanize(value);
}

/** Returns a stable `label(value)` function for the active locale. */
export function useEnumLabel(): (value: string) => string {
  const { locale } = useLocale();
  return useCallback((value: string) => enumLabel(locale, value), [locale]);
}
