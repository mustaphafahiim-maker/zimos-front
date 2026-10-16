import {
  resolveCheckoutForm,
  type CheckoutFieldMode,
  type CheckoutForm,
  type CheckoutFormField,
  type CheckoutFormFieldKey,
  type CheckoutPayload,
  type CheckoutSettings,
} from "@store-builder/api-client";
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
  postalCode: string;
  notes: string;
  /** ISO code; empty means Egypt (the country field is off by default). */
  country: string;
  nationalAddress: string;
  custom1: string;
  custom2: string;
  custom3: string;
  custom4: string;
  custom5: string;
  /** "pickup" when the shopper collects the order from the store; "" = delivery. */
  deliveryMethod: string;
  /** The store's delivery area (when it prices by zones); "" = none chosen. */
  deliveryZoneId: string;
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
  postalCode: "",
  notes: "",
  country: "",
  nationalAddress: "",
  custom1: "",
  custom2: "",
  custom3: "",
  custom4: "",
  custom5: "",
  deliveryMethod: "",
  deliveryZoneId: "",
};

/** Field order for "focus the first invalid field". */
export const FIELD_ORDER: OrderFormField[] = [
  "fullName",
  "phone",
  "altPhone",
  "email",
  "country",
  "governorate",
  "city",
  "address",
  "postalCode",
  "nationalAddress",
  "custom1",
  "custom2",
  "custom3",
  "custom4",
  "custom5",
  "notes",
];

/** Backend limits (checkoutValidation.js) — kept as input maxLengths. */
export const POSTAL_CODE_MAX = 20;
export const NOTES_MAX = 500;

/**
 * How one form renders the merchant-configurable fields. The checkout page
 * uses the store's settings as they are; the product quick form keeps itself
 * short — see `quickFormFields`. `form` is the purchase form builder's field
 * list (settings → purchase form); without it the list is derived from the
 * three modes.
 */
export type OrderFormFieldModes = CheckoutSettings & { form?: CheckoutForm };

/** The builder's field key for each form value. */
export const FORM_FIELD_OF: Record<CheckoutFormFieldKey, OrderFormField> = {
  full_name: "fullName",
  phone: "phone",
  phone_alt: "altPhone",
  email: "email",
  country: "country",
  government: "governorate",
  city: "city",
  address: "address",
  postal_code: "postalCode",
  sa_national_address: "nationalAddress",
  note: "notes",
  custom_1: "custom1",
  custom_2: "custom2",
  custom_3: "custom3",
  custom_4: "custom4",
  custom_5: "custom5",
};

/** Countries the country field offers (the store's couriers decide which it really serves). */
export const FORM_COUNTRIES: Array<{ code: string; ar: string; en: string }> = [
  { code: "EG", ar: "مصر", en: "Egypt" },
  { code: "SA", ar: "السعودية", en: "Saudi Arabia" },
  { code: "AE", ar: "الإمارات", en: "United Arab Emirates" },
  { code: "KW", ar: "الكويت", en: "Kuwait" },
  { code: "QA", ar: "قطر", en: "Qatar" },
  { code: "BH", ar: "البحرين", en: "Bahrain" },
  { code: "OM", ar: "عُمان", en: "Oman" },
  { code: "JO", ar: "الأردن", en: "Jordan" },
  { code: "IQ", ar: "العراق", en: "Iraq" },
  { code: "LY", ar: "ليبيا", en: "Libya" },
  { code: "MA", ar: "المغرب", en: "Morocco" },
  { code: "DZ", ar: "الجزائر", en: "Algeria" },
  { code: "TN", ar: "تونس", en: "Tunisia" },
];

const INTL_PHONE = /^\+?\d{8,15}$/;

/** Whether the form is being filled for Egypt (governorate list, Egyptian mobile rules). */
export function isEgyptForm(values: OrderFormValues): boolean {
  return (values.country || "EG") === "EG";
}

/**
 * The purchase form as this page renders it: the merchant's enabled fields in
 * their order, with email, postal code and notes following the three modes on
 * `fields` — those are what the quick form shortens and what `reveal()` flips
 * when the server names a hidden field.
 */
export function formOf(fields: OrderFormFieldModes, opts: { showAltPhone?: boolean } = {}): CheckoutFormField[] {
  const form = fields.form ?? resolveCheckoutForm(fields);
  const byMode = (mode: CheckoutFieldMode, f: CheckoutFormField): CheckoutFormField => ({
    ...f,
    enabled: mode !== "hidden",
    required: mode === "required",
  });
  return form.fields
    .map((f) => {
      if (f.key === "email") return byMode(fields.email, f);
      if (f.key === "postal_code") return byMode(fields.postal_code, f);
      if (f.key === "note") return byMode(fields.notes === "hidden" ? "hidden" : "optional", f);
      // The second number is only asked where there is room, unless the store demands it.
      if (f.key === "phone_alt") return { ...f, enabled: f.enabled && (f.required || opts.showAltPhone === true) };
      return f;
    })
    .filter((f) => f.enabled);
}

/** The form's options (layout, trust badges, discount codes…) for a set of field modes. */
export function formOptionsOf(fields: OrderFormFieldModes | null | undefined): CheckoutForm {
  return fields?.form ?? resolveCheckoutForm(fields ?? null);
}

/**
 * The quick form only asks for email/postal code when the store demands them
 * (the server would refuse the order otherwise). Notes follow the setting.
 */
export function quickFormFields(settings: OrderFormFieldModes): OrderFormFieldModes {
  const onlyIfRequired = (mode: CheckoutFieldMode): CheckoutFieldMode => (mode === "required" ? "required" : "hidden");
  return {
    ...settings,
    email: onlyIfRequired(settings.email),
    postal_code: onlyIfRequired(settings.postal_code),
    notes: settings.notes,
  };
}

/** The address fields a pickup order leaves out. */
export const PICKUP_SKIPS = new Set<string>(["country", "government", "city", "address", "postal_code", "sa_national_address"]);

export const isPickupForm = (values: OrderFormValues) => values.deliveryMethod === "pickup";

export function validateOrderForm(
  values: OrderFormValues,
  t: Dictionary,
  fields: OrderFormFieldModes,
  opts: { showAltPhone?: boolean; requireZone?: boolean } = {}
): OrderFormErrors {
  const e: OrderFormErrors = {};
  // A store that prices by delivery zones needs the shopper's area (not for pickup).
  if (opts.requireZone && !isPickupForm(values) && !values.deliveryZoneId) e.deliveryZoneId = t.form.errors.zone;
  const egypt = isEgyptForm(values);
  const validPhone = (raw: string) => (egypt ? isEgyptianMobile(raw) : INTL_PHONE.test(normalizePhone(raw)));

  for (const f of formOf(fields, opts)) {
    // A pickup order has no address: its fields are not asked for.
    if (isPickupForm(values) && PICKUP_SKIPS.has(f.key)) continue;
    const field = FORM_FIELD_OF[f.key];
    const value = values[field].trim();
    switch (f.key) {
      case "full_name":
        if (value.length < 2) e.fullName = t.form.errors.fullName;
        break;
      case "phone":
        if (!validPhone(value)) e.phone = egypt ? t.form.errors.phone : t.form.errors.phoneIntl;
        break;
      case "phone_alt":
        if (!value) {
          if (f.required) e.altPhone = t.form.errors.required;
        } else if (!validPhone(value)) {
          e.altPhone = egypt ? t.form.errors.altPhone : t.form.errors.phoneIntl;
        }
        break;
      case "email":
        if (!value) {
          if (f.required) e.email = t.form.errors.emailRequired;
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          e.email = t.form.errors.email;
        }
        break;
      case "country":
        if (f.required && !value) e.country = t.form.errors.country;
        break;
      case "government":
        if (!value) {
          if (f.required) e.governorate = t.form.errors.governorate;
        } else if (egypt && !findGovernorate(value)) {
          e.governorate = t.form.errors.governorate;
        }
        break;
      case "city":
        if (f.required && !value) e.city = t.form.errors.city;
        break;
      case "address":
        if (f.required && value.length < 5) e.address = t.form.errors.address;
        break;
      case "postal_code":
        if (f.required && !value) e.postalCode = t.form.errors.postalCode;
        break;
      case "note":
        break;
      default:
        if (f.required && !value) e[field] = t.form.errors.required;
    }
  }
  return e;
}

/**
 * The governorate as the order stores it in shippingAddress.province: its
 * Arabic name with the English one alongside. The shipping quote sends the
 * same string, so a zone's regions match the quote and the order alike.
 */
export function provinceFor(code: string): string | undefined {
  const gov = findGovernorate(code);
  return gov ? `${gov.ar} (${gov.en})` : undefined;
}

/**
 * Builds the COD checkout payload. The governorate is sent by its Arabic name —
 * what Egyptian couriers and confirmation agents read — with the English name
 * alongside so either reads naturally in the merchant dashboard. A field the
 * form doesn't show is never sent. The shopper's note travels as
 * `shippingAddress.notes` (for the courier); the top-level `notes` is ours.
 * The fields with no column of their own (national address, the merchant's
 * custom fields) travel as `formFields`.
 */
export function toCheckoutPayload(
  values: OrderFormValues,
  fields: OrderFormFieldModes,
  options: {
    discountCode?: string;
    systemNotes?: string[];
    item?: CheckoutPayload["item"];
    showAltPhone?: boolean;
  } = {}
): CheckoutPayload {
  const shown = new Set(formOf(fields, { showAltPhone: options.showAltPhone }).map((f) => f.key));
  const read = (key: CheckoutFormFieldKey) => (shown.has(key) ? values[FORM_FIELD_OF[key]].trim() : "");
  // A hidden country field leaves the store's own country in the values (lib/storeCountry).
  const country = values.country || "EG";
  const province = country === "EG" ? provinceFor(read("government")) : read("government") || undefined;
  const altPhone = read("phone_alt") ? normalizePhone(read("phone_alt")) : "";
  const email = read("email");
  const postalCode = read("postal_code");
  const notes = read("note");
  const systemNotes = (options.systemNotes ?? []).filter(Boolean);
  const allowCodes = formOptionsOf(fields).allow_discount_codes;

  const formFields: Record<string, string> = {};
  for (const key of shown) {
    if (key === "sa_national_address" || key.startsWith("custom_")) {
      const value = read(key);
      if (value) formFields[key] = value;
    }
  }

  // Pickup: no address goes out; the shopper's note joins the order's notes instead.
  if (isPickupForm(values)) {
    const pickupNotes = [notes, ...systemNotes].filter(Boolean);
    const pickupPayload: CheckoutPayload = {
      contact: {
        fullName: values.fullName.trim(),
        phone: normalizePhone(values.phone),
        ...(altPhone ? { alternatePhone: altPhone } : {}),
        ...(email ? { email } : {}),
      },
      deliveryMethod: "pickup",
      paymentMethod: "cod",
      ...(allowCodes && options.discountCode?.trim() ? { discountCode: options.discountCode.trim() } : {}),
      ...(pickupNotes.length ? { notes: pickupNotes.join(" | ") } : {}),
      ...(options.item ? { item: options.item } : {}),
    };
    return Object.keys(formFields).length > 0 ? ({ ...pickupPayload, formFields } as CheckoutPayload) : pickupPayload;
  }

  const payload: CheckoutPayload = {
    contact: {
      fullName: values.fullName.trim(),
      phone: normalizePhone(values.phone),
      ...(altPhone ? { alternatePhone: altPhone } : {}),
      ...(email ? { email } : {}),
    },
    shippingAddress: {
      country,
      ...(province ? { province } : {}),
      city: read("city"),
      addressLine: read("address"),
      ...(postalCode ? { postalCode } : {}),
      ...(notes ? { notes } : {}),
    },
    ...(values.deliveryZoneId ? { deliveryZoneId: values.deliveryZoneId } : {}),
    paymentMethod: "cod",
    ...(allowCodes && options.discountCode?.trim() ? { discountCode: options.discountCode.trim() } : {}),
    ...(systemNotes.length ? { notes: systemNotes.join(" | ") } : {}),
    ...(options.item ? { item: options.item } : {}),
  };
  return Object.keys(formFields).length > 0 ? ({ ...payload, formFields } as CheckoutPayload) : payload;
}
