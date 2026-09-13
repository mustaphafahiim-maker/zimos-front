import type { CheckoutPayload } from "@store-builder/api-client";
import { findGovernorate, isEgyptianMobile, normalizePhone } from "./egypt";
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

export function validateOrderForm(values: OrderFormValues, t: Dictionary): OrderFormErrors {
  const e: OrderFormErrors = {};
  if (values.fullName.trim().length < 2) e.fullName = t.form.errors.fullName;
  if (!isEgyptianMobile(values.phone)) e.phone = t.form.errors.phone;
  if (values.altPhone.trim() && !isEgyptianMobile(values.altPhone)) e.altPhone = t.form.errors.altPhone;
  if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) e.email = t.form.errors.email;
  if (!findGovernorate(values.governorate)) e.governorate = t.form.errors.governorate;
  if (!values.city.trim()) e.city = t.form.errors.city;
  if (values.address.trim().length < 5) e.address = t.form.errors.address;
  return e;
}

/**
 * Builds the COD checkout payload. The governorate is sent by its Arabic name —
 * what Egyptian couriers and confirmation agents read — with the English name
 * alongside so either reads naturally in the merchant dashboard.
 */
export function toCheckoutPayload(
  values: OrderFormValues,
  options: { discountCode?: string; systemNotes?: string[]; item?: CheckoutPayload["item"] } = {}
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
      ...(gov ? { province: `${gov.ar} (${gov.en})` } : {}),
      city: values.city.trim(),
      addressLine: values.address.trim(),
      ...(values.notes.trim() ? { notes: values.notes.trim() } : {}),
    },
    paymentMethod: "cod",
    ...(options.discountCode?.trim() ? { discountCode: options.discountCode.trim() } : {}),
    ...(systemNotes.length ? { notes: systemNotes.join(" | ") } : {}),
    ...(options.item ? { item: options.item } : {}),
  };
}
