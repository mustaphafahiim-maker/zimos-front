import type { CheckoutPayload } from "@store-builder/api-client";
import { findGovernorate, isEgyptianMobile, normalizePhone, type Governorate } from "./egypt";
import type { Dictionary } from "./i18n";

/** The COD order form shared by the product quick-order form and checkout. */
export interface OrderFormValues {
  fullName: string;
  phone: string;
  altPhone: string;
  email: string;
  governorate: string;
  city: string;
  address: string;
  notes: string;
}

export type OrderFormField = keyof OrderFormValues;
export type OrderFormErrors = Partial<Record<OrderFormField, string>>;

export const EMPTY_ORDER_FORM: OrderFormValues = {
  fullName: "",
  phone: "",
  altPhone: "",
  email: "",
  governorate: "",
  city: "",
  address: "",
  notes: "",
};

/** Field order for "focus the first invalid field". */
export const FIELD_ORDER: OrderFormField[] = [
  "fullName",
  "phone",
  "altPhone",
  "email",
  "governorate",
  "city",
  "address",
  "notes",
];

/** The checkout page's sections — who the order is for, then where it goes. */
export const CONTACT_FIELDS: OrderFormField[] = ["fullName", "phone", "altPhone", "email"];
export const ADDRESS_FIELDS: OrderFormField[] = ["governorate", "city", "address", "notes"];

/** One field's error, or undefined when it is fine — for validation on blur. */
export function validateField(field: OrderFormField, values: OrderFormValues, t: Dictionary): string | undefined {
  switch (field) {
    case "fullName":
      return values.fullName.trim().length < 2 ? t.form.errors.fullName : undefined;
    case "phone":
      return isEgyptianMobile(values.phone) ? undefined : t.form.errors.phone;
    case "altPhone":
      return values.altPhone.trim() && !isEgyptianMobile(values.altPhone) ? t.form.errors.altPhone : undefined;
    case "email":
      return values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())
        ? t.form.errors.email
        : undefined;
    case "governorate":
      return findGovernorate(values.governorate) ? undefined : t.form.errors.governorate;
    case "city":
      return values.city.trim() ? undefined : t.form.errors.city;
    case "address":
      return values.address.trim().length < 5 ? t.form.errors.address : undefined;
    case "notes":
      return undefined;
  }
}

export function validateOrderForm(values: OrderFormValues, t: Dictionary): OrderFormErrors {
  const e: OrderFormErrors = {};
  for (const field of FIELD_ORDER) {
    const error = validateField(field, values, t);
    if (error) e[field] = error;
  }
  return e;
}

/**
 * The province string an order carries: the Arabic name — what Egyptian
 * couriers and confirmation agents read — with the English name alongside so
 * either reads naturally in the merchant dashboard. The shipping quote sends
 * the same string, so it matches the zones the merchant set up exactly as
 * checkout will.
 */
export function shippingRegionOf(gov: Governorate): string {
  return `${gov.ar} (${gov.en})`;
}

/** Builds the checkout payload — cash on delivery unless an online method was chosen. */
export function toCheckoutPayload(
  values: OrderFormValues,
  options: {
    discountCode?: string;
    systemNotes?: string[];
    item?: CheckoutPayload["item"];
    paymentMethod?: CheckoutPayload["paymentMethod"];
  } = {}
): CheckoutPayload {
  const gov = findGovernorate(values.governorate);
  const altPhone = values.altPhone.trim() ? normalizePhone(values.altPhone) : "";
  const systemNotes = (options.systemNotes ?? []).filter(Boolean);

  return {
    contact: {
      fullName: values.fullName.trim(),
      phone: normalizePhone(values.phone),
      ...(altPhone ? { alternatePhone: altPhone } : {}),
      ...(values.email.trim() ? { email: values.email.trim() } : {}),
    },
    shippingAddress: {
      country: "EG",
      ...(gov ? { province: shippingRegionOf(gov) } : {}),
      city: values.city.trim(),
      addressLine: values.address.trim(),
      ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
    },
    paymentMethod: options.paymentMethod ?? "cod",
    ...(options.discountCode?.trim() ? { discountCode: options.discountCode.trim() } : {}),
    ...(systemNotes.length ? { notes: systemNotes.join(" | ") } : {}),
    ...(options.item ? { item: options.item } : {}),
  };
}
