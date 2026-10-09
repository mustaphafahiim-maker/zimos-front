import {
  isCheckoutPhotoField,
  resolveCheckoutForm,
  type CheckoutFieldMode,
  type CheckoutForm,
  type CheckoutFormField,
  type CheckoutFormFieldKey,
  type CheckoutPayload,
  type CheckoutSettings,
  type CheckoutAddressWithPlace,
} from "@store-builder/api-client";
import { isEgyptianMobile, normalizePhone } from "./egypt";
import { isPhotoUploading } from "./checkoutPhoto";
import { findPlace, placesFor } from "./places";
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

/**
 * The store's own place pickers (lib/useStorePlaces) as validation reads them:
 * while `active`, the governorate field is the region picker and the city is
 * picked from the region's cities (typed when it has none).
 */
export interface PlacePicks {
  active: boolean;
  regionId: string;
  cityId: string;
  hasCities: boolean;
}

/**
 * What is wrong with one field of the purchase form, in the shopper's words;
 * undefined when it is fine. The one set of rules: the whole-form check the
 * order button runs (`validateOrderForm`) and the check a field runs as it is
 * typed in (`validateOrderField`) both read it, so they can never disagree.
 */
function fieldProblem(f: CheckoutFormField, values: OrderFormValues, t: Dictionary, places: PlacePicks | null): string | undefined {
  const field = FORM_FIELD_OF[f.key];
  const value = values[field].trim();
  const egypt = isEgyptForm(values);
  const validPhone = (raw: string) => (egypt ? isEgyptianMobile(raw) : INTL_PHONE.test(normalizePhone(raw)));

  switch (f.key) {
    case "full_name":
      return value.length < 2 ? t.form.errors.fullName : undefined;
    case "phone":
      return validPhone(value) ? undefined : egypt ? t.form.errors.phone : t.form.errors.phoneIntl;
    case "phone_alt":
      if (!value) return f.required ? t.form.errors.required : undefined;
      return validPhone(value) ? undefined : egypt ? t.form.errors.altPhone : t.form.errors.phoneIntl;
    case "email":
      if (!value) return f.required ? t.form.errors.emailRequired : undefined;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? undefined : t.form.errors.email;
    case "country":
      return f.required && !value ? t.form.errors.country : undefined;
    case "government":
      if (places) return f.required && !places.regionId ? t.form.errors.governorate : undefined;
      if (!value) return f.required ? t.form.errors.governorate : undefined;
      return placesFor(values.country).length > 0 && !placesFor(values.country).some((p) => p.code === value)
        ? t.form.errors.governorate
        : undefined;
    case "city":
      // Picked from the region's cities; a region without any keeps the typed city.
      if (places && (!places.regionId || places.hasCities)) {
        return f.required && places.regionId && !places.cityId ? t.form.errors.cityChoose : undefined;
      }
      return f.required && !value ? t.form.errors.city : undefined;
    case "address":
      return f.required && value.length < 5 ? t.form.errors.address : undefined;
    case "postal_code":
      return f.required && !value ? t.form.errors.postalCode : undefined;
    case "note":
      return undefined;
    default:
      // A photo field waits for its upload; its answer is the upload id (components/checkout/CheckoutPhotoField).
      if (isCheckoutPhotoField(f)) {
        if (isPhotoUploading(f.key)) return t.custom.waitUpload;
        return f.required && !value ? t.form.errors.photoRequired : undefined;
      }
      return f.required && !value ? t.form.errors.required : undefined;
  }
}

export function validateOrderForm(
  values: OrderFormValues,
  t: Dictionary,
  fields: OrderFormFieldModes,
  opts: { showAltPhone?: boolean; places?: PlacePicks | null } = {}
): OrderFormErrors {
  const places = opts.places?.active ? opts.places : null;
  const e: OrderFormErrors = {};
  for (const f of formOf(fields, opts)) {
    const problem = fieldProblem(f, values, t, places);
    if (problem) e[FORM_FIELD_OF[f.key]] = problem;
  }
  return e;
}

/**
 * The same check for one field — what a field shows once the shopper has left
 * it, and from then on as they type. Undefined when the field is fine, and
 * for a field this form does not show.
 */
export function validateOrderField(
  field: OrderFormField,
  values: OrderFormValues,
  t: Dictionary,
  fields: OrderFormFieldModes,
  opts: { showAltPhone?: boolean; places?: PlacePicks | null } = {}
): string | undefined {
  const f = formOf(fields, opts).find((candidate) => FORM_FIELD_OF[candidate.key] === field);
  return f ? fieldProblem(f, values, t, opts.places?.active ? opts.places : null) : undefined;
}

/**
 * Why a number is not an Egyptian mobile, for the words under the field. It
 * decides nothing: whether a number is one is `isEgyptianMobile` (lib/egypt),
 * and this only names what to fix in one that is not. Null for a valid number
 * and for an empty field (the form's own "required" line covers that).
 *
 *   prefix   — does not start with 01
 *   operator — starts with 01, but not 010 / 011 / 012 / 015
 *   short    — fewer than 11 digits so far (`digits` says how many)
 *   long     — more than 11 digits
 *   letters  — something that is not a digit (a foreign "+", a letter)
 */
export type EgyptPhoneIssue =
  | { kind: "prefix" | "operator" | "long" | "letters" }
  | { kind: "short"; digits: number };

export function egyptPhoneIssue(raw: string): EgyptPhoneIssue | null {
  if (isEgyptianMobile(raw)) return null;
  const number = normalizePhone(raw);
  if (!number) return null;
  if (/\D/.test(number)) return { kind: "letters" };
  if (!"01".startsWith(number.slice(0, 2))) return { kind: "prefix" };
  if (number.length >= 3 && !"0125".includes(number[2])) return { kind: "operator" };
  if (number.length < 11) return { kind: "short", digits: number.length };
  return { kind: "long" };
}

/**
 * The governorate (or region, lib/places) as the order stores it in
 * shippingAddress.province: its Arabic name with the English one alongside.
 * The shipping quote sends the same string, so a zone's regions match the
 * quote and the order alike.
 */
export function provinceFor(code: string): string | undefined {
  const place = findPlace(code);
  return place ? `${place.ar} (${place.en})` : undefined;
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
    /** The place picked from the store's own list (lib/useStorePlaces): its names and id. */
    place?: { province: string; city?: string; area?: string; placeId: string } | null;
  } = {}
): CheckoutPayload {
  const shown = new Set(formOf(fields, { showAltPhone: options.showAltPhone }).map((f) => f.key));
  const read = (key: CheckoutFormFieldKey) => (shown.has(key) ? values[FORM_FIELD_OF[key]].trim() : "");
  // A hidden country field leaves the store's own country in the values (lib/storeCountry).
  const country = values.country || "EG";
  // A listed place goes as its names; a country without a list sends what was typed.
  const place = options.place ?? null;
  const province = place
    ? place.province
    : placesFor(country).length > 0
      ? provinceFor(read("government"))
      : read("government") || undefined;
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

  const shippingAddress: CheckoutAddressWithPlace = {
    country,
    ...(province ? { province } : {}),
    city: place?.city ?? read("city"),
    ...(place?.area ? { area: place.area } : {}),
    ...(place ? { placeId: place.placeId } : {}),
    addressLine: read("address"),
    ...(postalCode ? { postalCode } : {}),
    ...(notes ? { notes } : {}),
  };

  const payload: CheckoutPayload = {
    contact: {
      fullName: values.fullName.trim(),
      phone: normalizePhone(values.phone),
      ...(altPhone ? { alternatePhone: altPhone } : {}),
      ...(email ? { email } : {}),
    },
    shippingAddress,
    paymentMethod: "cod",
    ...(allowCodes && options.discountCode?.trim() ? { discountCode: options.discountCode.trim() } : {}),
    ...(systemNotes.length ? { notes: systemNotes.join(" | ") } : {}),
    ...(options.item ? { item: options.item } : {}),
  };
  return Object.keys(formFields).length > 0 ? ({ ...payload, formFields } as CheckoutPayload) : payload;
}
