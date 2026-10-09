import type { OrderStaffCustomItem, OrderStaffDiscountInput } from "@store-builder/api-client";
import { majorToMinor } from "@/lib/format";
import { asciiDigits } from "@/lib/wholeNumber";
import type { Messages } from "@/i18n/LocaleContext";

/**
 * Staff price changes on a manual order and on «تعديل المنتجات» (handoff 382):
 * a line at the staff's own price, a line that is not in the catalogue, and a
 * discount off the whole order. The pieces both screens share — who may, what
 * is typed, how it is sent. Nothing here prices anything: every figure on
 * screen is the server's preview.
 */
export const STAFF_PRICING_STRINGS = {
  en: {
    changePrice: "Change price",
    changePriceOf: "Change the price of {name}",
    priceOf: "Unit price of {name}",
    storePrice: "Store price {catalogue}",
    backToStorePrice: "Back to the store price",
    priceInvalid: "The price must be 0 or more",
    custom: "Custom",
    priceChanged: "Price changed",
    by: "By {actorName}",
    addCustom: "+ Custom line",
    customTitle: "Title",
    customPrice: "Price",
    customQuantity: "Quantity",
    customSku: "SKU (optional)",
    customWeight: "Weight in grams (optional)",
    customAdd: "Add the line",
    customCancel: "Cancel",
    customTitleMissing: "Write what the line is.",
    customWeightInvalid: "The weight is a whole number of grams.",
    addDiscount: "+ Staff discount",
    discountTitle: "Staff discount",
    discountKind: "Kind of staff discount",
    amount: "Amount",
    percent: "Percent",
    discountValue: "Value",
    reason: "Reason",
    reasonMissing: "Write the reason for the discount",
    percentInvalid: "A percentage from 0 to 100",
    amountInvalid: "A whole amount",
    removeDiscount: "Remove staff discount",
    discountCode: "Discount code",
    staffDiscountRow: "Staff discount ({reason})",
    forbidden: "You can't change prices",
    lineNotOnOrder: "This line isn't on the order",
  },
  ar: {
    changePrice: "تعديل السعر",
    changePriceOf: "تعديل سعر {name}",
    priceOf: "سعر الوحدة من {name}",
    storePrice: "سعر المتجر {catalogue}",
    backToStorePrice: "ارجع لسعر المتجر",
    priceInvalid: "السعر لازم يكون صفر أو أكتر",
    custom: "مخصص",
    priceChanged: "سعر معدّل",
    by: "بواسطة {actorName}",
    addCustom: "+ سطر مخصص",
    customTitle: "الاسم",
    customPrice: "السعر",
    customQuantity: "الكمية",
    customSku: "SKU (اختياري)",
    customWeight: "الوزن بالجرام (اختياري)",
    customAdd: "ضيف السطر",
    customCancel: "إلغاء",
    customTitleMissing: "اكتب اسم السطر.",
    customWeightInvalid: "الوزن رقم صحيح بالجرام.",
    addDiscount: "+ خصم يدوي",
    discountTitle: "خصم يدوي",
    discountKind: "نوع الخصم اليدوي",
    amount: "مبلغ",
    percent: "نسبة ٪",
    discountValue: "القيمة",
    reason: "السبب",
    reasonMissing: "اكتب سبب الخصم",
    percentInvalid: "النسبة من ٠ لـ ١٠٠",
    amountInvalid: "المبلغ رقم صحيح",
    removeDiscount: "إزالة الخصم اليدوي",
    discountCode: "كود الخصم",
    staffDiscountRow: "خصم يدوي ({reason})",
    forbidden: "مش مسموح لك تغيّر الأسعار",
    lineNotOnOrder: "السطر ده مش من الطلب",
  },
} satisfies Messages;

export type StaffPricingStrings = (typeof STAFF_PRICING_STRINGS)["en"];

/**
 * System roles without `orders.price_override`: of the system roles only the
 * owner and the workspace manager hold it. The dashboard only sees the role
 * key, so a custom role (the owner ticked it, or did not) reads as allowed —
 * the server still decides, and its 403 is worded where it happens.
 */
const NO_PRICE_OVERRIDE_ROLES: ReadonlySet<string> = new Set(["editor", "order_operator", "confirmation_agent", "fulfillment", "accountant"]);

export function canOverridePrices(role: string | null | undefined): boolean {
  return !NO_PRICE_OVERRIDE_ROLES.has(role ?? "");
}

/** A custom line as it is typed. `orderItemId` names one the order already has (an edit keeps it by that). */
export interface StaffCustomLine {
  orderItemId?: string;
  title: string;
  /** Major units, as typed. */
  unitPrice: string;
  sku: string;
  /** Whole grams as typed; empty = it weighs nothing. */
  weightGrams: string;
}

/** The staff discount as it is typed. */
export interface StaffDiscountForm {
  type: "amount" | "percent";
  /** Major units for an amount, a percentage for a percent; as typed. */
  value: string;
  reason: string;
}

/** What a money field holds, read with Arabic digits and the Arabic decimal mark. */
export function typedMoney(text: string): string {
  return asciiDigits(text).replace(/٫/g, ".").replace(/[^\d.]/g, "");
}

/** A typed price in minor units: undefined for an empty field, NaN for anything that is not a price of 0 or more. */
export function priceMinorOf(text: string | undefined): number | undefined {
  if (text === undefined || text.trim() === "") return undefined;
  const minor = majorToMinor(typedMoney(text));
  return Number.isFinite(minor) && minor >= 0 ? minor : Number.NaN;
}

/** The request's custom line, or null while what is typed cannot be sent (no title, not a price). */
export function customItemOf(custom: StaffCustomLine, quantity: number): OrderStaffCustomItem | null {
  const title = custom.title.trim();
  const unitPrice = priceMinorOf(custom.unitPrice);
  if (title === "" || unitPrice === undefined || Number.isNaN(unitPrice)) return null;
  const grams = asciiDigits(custom.weightGrams).trim();
  const sku = custom.sku.trim();
  return {
    ...(custom.orderItemId ? { orderItemId: custom.orderItemId } : {}),
    title,
    unitPrice,
    quantity,
    ...(sku ? { sku } : {}),
    ...(/^\d{1,7}$/.test(grams) ? { weightGrams: Number(grams) } : {}),
  };
}

/** What is wrong with the staff discount as typed, by string key, or null when it can be sent. */
export function staffDiscountProblem(form: StaffDiscountForm | null | undefined): "percentInvalid" | "amountInvalid" | "reasonMissing" | null {
  if (!form) return null;
  const text = typedMoney(form.value);
  const number = Number(text);
  if (form.type === "percent") {
    if (text === "" || !Number.isFinite(number) || number < 0 || number > 100 || !/^\d{1,3}(\.\d{1,2})?$/.test(text)) return "percentInvalid";
  } else {
    const minor = majorToMinor(text);
    if (!Number.isFinite(minor) || minor < 0) return "amountInvalid";
  }
  return form.reason.trim() === "" ? "reasonMissing" : null;
}

/** The request's `manualDiscount`, or null when there is none or it cannot be sent yet. */
export function staffDiscountInput(form: StaffDiscountForm | null | undefined): OrderStaffDiscountInput | null {
  if (!form || staffDiscountProblem(form)) return null;
  const text = typedMoney(form.value);
  return {
    type: form.type,
    value: form.type === "percent" ? Number(text) : majorToMinor(text),
    reason: form.reason.trim().slice(0, 500),
  };
}
