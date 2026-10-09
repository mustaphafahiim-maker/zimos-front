import type { PaymentMethod, Product, Variant } from "@store-builder/api-client";
import { asciiDigits } from "@/lib/wholeNumber";
import type { StaffCustomLine, StaffDiscountForm } from "../staffPricing/staffPricing";

/**
 * The shape of the create-order sheet's form and the small pure rules around
 * it: which step needs what, what an Egyptian mobile looks like, how a product
 * is found by a few typed letters. Nothing here prices anything — every amount
 * on the sheet comes from the server's preview.
 */

/** The three steps, in order: the customer, the products, delivery and payment. */
export type StepIndex = 0 | 1 | 2;
export const STEP_COUNT = 3;

/** One product line of the order being typed. Ids and a quantity: the names are read from the catalog. */
export interface Line {
  key: string;
  productId: string;
  variantId: string;
  offerId?: string;
  /** Kept beside the id so a restored draft can name the offer before the product's offers are fetched again. */
  offerName?: string;
  quantity: number;
  /** Handoff 382: the staff's own unit price, major units as typed; unset = the store's price. */
  unitPrice?: string;
  /** Handoff 382: a line that is not in the catalogue (`productId` and `variantId` are then empty). */
  custom?: StaffCustomLine;
}

export interface OrderForm {
  // customer
  phone: string;
  fullName: string;
  email: string;
  // address
  province: string;
  city: string;
  addressLine: string;
  // items
  lines: Line[];
  // payment
  paymentMethod: PaymentMethod;
  notes: string;
  /** As typed. */
  coupon: string;
  /** The code the preview is priced with: `coupon` once the field is left or Enter is pressed. */
  appliedCoupon: string;
  /** Major units as typed; empty = calculated by the server. */
  shipping: string;
  /** The language of the customer's messages; empty or unset = the store's default (handoff 383). */
  locale?: string;
  /** Handoff 382: a discount off the whole order, with its reason; unset = none. */
  staffDiscount?: StaffDiscountForm | null;
}

export const EMPTY_FORM: OrderForm = {
  phone: "",
  fullName: "",
  email: "",
  province: "",
  city: "",
  addressLine: "",
  lines: [],
  paymentMethod: "cod",
  notes: "",
  coupon: "",
  appliedCoupon: "",
  shipping: "",
};

export const PAYMENT_METHODS: PaymentMethod[] = ["cod", "bank_transfer", "card", "wallet"];

/** A line never holds more than this: four digits fit the stepper, and a larger order is typed as two lines. */
export const MAX_QUANTITY = 9999;

/** A quantity from anything typed or stepped: a whole number from 1 up. */
export function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_QUANTITY, Math.max(1, Math.floor(value)));
}

/** Nothing worth keeping: no text anywhere and no product (the payment method alone is not a draft). */
export function isFormEmpty(form: OrderForm): boolean {
  return (
    form.lines.length === 0 &&
    [form.phone, form.fullName, form.email, form.province, form.city, form.addressLine, form.notes, form.coupon, form.shipping].every(
      (text) => text.trim() === ""
    )
  );
}

// ------------------------------------------------------------------ phone --

/** Where a number being typed stands: nothing yet, still on its way to a mobile, a mobile, or never one. */
export type PhoneCheck = "empty" | "typing" | "valid" | "invalid";

const LOCAL_FULL = /^01\d{9}$/;
const LOCAL_PREFIX = /^0(1\d{0,8})?$/;
/** 20 1X… and, as people often write it, 20 01X… */
const INTL_FULL = /^200?1\d{9}$/;
const INTL_PREFIX = /^(2|20|200|200?1\d{0,8})$/;

/** The digits of what was typed, and whether it was written with a country prefix (+ or 00). */
function phoneDigits(raw: string): { digits: string; international: boolean; other: boolean } {
  const text = asciiDigits(raw).trim();
  const plus = text.startsWith("+");
  let digits = text.replace(/\D/g, "");
  let international = plus;
  if (!plus && digits.startsWith("00")) {
    digits = digits.slice(2);
    international = true;
  }
  // Spaces, dashes, dots and brackets are how people write numbers; a letter is not.
  const other = /[^\d\s+().\-–]/.test(text) || text.lastIndexOf("+") > 0;
  return { digits, international, other };
}

/**
 * Is this an Egyptian mobile — 01 and nine more digits, also written +20 / 0020 /
 * 20, with Arabic-Indic digits, spaces or dashes? Checked as it is typed:
 * `typing` while it can still become one, so nothing is called wrong early.
 */
export function checkEgyptianMobile(raw: string): PhoneCheck {
  if (raw.trim() === "") return "empty";
  const { digits, international, other } = phoneDigits(raw);
  if (other) return "invalid";
  if (digits === "") return "typing";
  if (international) return INTL_FULL.test(digits) ? "valid" : INTL_PREFIX.test(digits) ? "typing" : "invalid";
  if (LOCAL_FULL.test(digits) || INTL_FULL.test(digits)) return "valid";
  return LOCAL_PREFIX.test(digits) || INTL_PREFIX.test(digits) ? "typing" : "invalid";
}

/** The number in its local form (01XXXXXXXXX), for comparing two ways of writing it; null when it is not a mobile. */
export function localMobile(raw: string): string | null {
  if (checkEgyptianMobile(raw) !== "valid") return null;
  const { digits } = phoneDigits(raw);
  return `0${digits.slice(-10)}`;
}

// ------------------------------------------------------------------ steps --

/** The fields a step cannot go on without, in the order they are on the screen. */
export type RequiredField = "phone" | "fullName" | "items" | "city" | "addressLine" | "shipping";

/** Every named field of a step in screen order, to tell whether Enter was pressed before or after a missing one. */
export const STEP_FIELDS: Record<StepIndex, readonly string[]> = {
  0: ["phone", "fullName", "email"],
  1: ["items"],
  2: ["province", "city", "addressLine", "paymentMethod", "coupon", "shipping"],
};

/** The step a field lives on. */
export function stepOfField(field: RequiredField): StepIndex {
  if (field === "phone" || field === "fullName") return 0;
  if (field === "items") return 1;
  return 2;
}

/** An amount typed for shipping: undefined for an empty field (the server calculates it), NaN for anything that is not an amount. */
export function shippingMinorOf(text: string, toMinor: (major: string) => number): number | undefined {
  if (text.trim() === "") return undefined;
  const minor = toMinor(text);
  return Number.isFinite(minor) && minor >= 0 ? minor : Number.NaN;
}

/** What a step still needs, by field. An empty list is a finished step. */
export function missingFields(step: StepIndex, form: OrderForm, shippingOk: boolean): RequiredField[] {
  const missing: RequiredField[] = [];
  if (step === 0) {
    if (checkEgyptianMobile(form.phone) !== "valid") missing.push("phone");
    if (form.fullName.trim() === "") missing.push("fullName");
  } else if (step === 1) {
    if (form.lines.length === 0) missing.push("items");
  } else {
    if (form.city.trim() === "") missing.push("city");
    if (form.addressLine.trim() === "") missing.push("addressLine");
    if (!shippingOk) missing.push("shipping");
  }
  return missing;
}

// ---------------------------------------------------------------- catalog --

/**
 * Lower-case, without Arabic diacritics or tatweel, and with the letters
 * people type interchangeably folded together (أ إ آ → ا, ة → ه, ى → ي) — the
 * same folding Spotlight uses (components/CommandPalette.tsx). Digits are read
 * as ASCII so a product code typed on an Arabic keyboard still matches.
 */
export function foldForSearch(text: string): string {
  return asciiDigits(text)
    .toLowerCase()
    .replace(/[ً-ٰٟـ]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .trim();
}

/** The variants of a product that can be sold now. */
export function activeVariants(product: Product | undefined): Variant[] {
  return (product?.variants ?? []).filter((variant) => variant.status === "active");
}

/** Name, the product's code (with or without its #) or a variant's SKU. `needle` is already folded. */
export function productMatches(product: Product, needle: string): boolean {
  if (needle === "") return true;
  if (foldForSearch(product.name).includes(needle)) return true;
  const code = needle.replace(/^#/, "");
  if (code !== "" && product.productCode && String(product.productCode).replace(/^#/, "").includes(code)) return true;
  return (product.variants ?? []).some((variant) => variant.sku !== null && foldForSearch(variant.sku).includes(needle));
}

/** Does this product keep a count of pieces? Digital products, services and "track quantity off" do not. */
export function tracksStock(product: Product): boolean {
  if (product.productType !== "physical") return false;
  return (product as Product & { trackInventory?: boolean }).trackInventory !== false;
}

/** Pieces on hand across the variants on sale — the figure the catalog shows — or null when nothing is counted. */
export function stockOf(product: Product): number | null {
  if (!tracksStock(product)) return null;
  const variants = activeVariants(product);
  if (variants.length === 0) return null;
  return variants.reduce((sum, variant) => sum + variant.stockOnHand, 0);
}

/** A variant with nothing left to sell (and no overselling): said on its chip, never a block — the server decides. */
export function variantIsOut(product: Product, variant: Variant): boolean {
  return tracksStock(product) && !variant.allowOverselling && variant.stockOnHand - variant.reservedStock <= 0;
}

/**
 * Is the variant worth naming beside its product? A product sold in one
 * plain form has a variant with no options: naming it would only show an id.
 */
export function variantIsNamed(product: Product, variant: Variant): boolean {
  return Object.keys(variant.optionValues ?? {}).length > 0 || activeVariants(product).length > 1;
}
