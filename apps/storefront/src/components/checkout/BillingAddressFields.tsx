"use client";

import { useState, type ReactNode } from "react";
import {
  apiFieldProblems,
  checkoutBillingAddressModeOf,
  type CheckoutPayloadWithBilling,
} from "@store-builder/api-client";
import { FORM_COUNTRIES, formOptionsOf, provinceFor, type OrderFormFieldModes } from "@/lib/orderForm";
import { placesFor } from "@/lib/places";
import { useStore } from "@/lib/StoreContext";
import { countryName, useStoreCountry } from "@/lib/storeCountry";
import { arOrEn } from "@/lib/i18n";
import { input, label as labelClass } from "../ui";

/**
 * The billing address (dashboard → Checkout form → "Ask for a billing
 * address"). Billed to the shipping address unless the shopper unticks "same
 * as shipping"; then name (optional), country, region, city, area, address
 * and postal code are asked, and country, city and address must be filled.
 * Kept apart from the shipping fields (lib/orderForm) so each form adds it
 * with a hook and one element.
 */

export interface BillingValues {
  fullName: string;
  country: string;
  region: string;
  city: string;
  area: string;
  addressLine: string;
  postalCode: string;
}

export type BillingField = keyof BillingValues;
type BillingErrors = Partial<Record<BillingField, string>>;

const ORDER: BillingField[] = ["fullName", "country", "region", "city", "area", "postalCode", "addressLine"];

/** The request fields a checkout 422 names, mapped onto the billing block. */
const SERVER_FIELDS: Record<string, BillingField> = {
  "billingAddress.fullName": "fullName",
  "billingAddress.country": "country",
  "billingAddress.province": "region",
  "billingAddress.city": "city",
  "billingAddress.area": "area",
  "billingAddress.addressLine": "addressLine",
  "billingAddress.postalCode": "postalCode",
};

export function billingFieldId(idPrefix: string, field: BillingField) {
  return `${idPrefix}-billing-${field}`;
}

export interface BillingAddressState {
  /** The store asks for a billing address. */
  enabled: boolean;
  same: boolean;
  setSame: (same: boolean) => void;
  values: BillingValues;
  errors: BillingErrors;
  set: (field: BillingField, value: string) => void;
  /** Checks the block and shows what is wrong; the invalid fields in form order. */
  check: () => BillingField[];
  /** Shows the billing problems of a checkout 422; the fields it named, in form order. */
  showServerErrors: (err: unknown) => BillingField[];
  /** What the checkout request carries: nothing while billed to the shipping address. */
  payload: () => Pick<CheckoutPayloadWithBilling, "billingSameAsShipping" | "billingAddress">;
}

export function useBillingAddress(fields: OrderFormFieldModes): BillingAddressState {
  const { t } = useStore();
  const storeCountry = useStoreCountry();
  const enabled = checkoutBillingAddressModeOf(formOptionsOf(fields)) === "on";
  const [same, setSame] = useState(true);
  const [values, setValues] = useState<BillingValues>(() => ({
    fullName: "",
    country: storeCountry || "EG",
    region: "",
    city: "",
    area: "",
    addressLine: "",
    postalCode: "",
  }));
  const [errors, setErrors] = useState<BillingErrors>({});
  const asked = enabled && !same;

  const set = (field: BillingField, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value, ...(field === "country" ? { region: "" } : {}) }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const check = () => {
    if (!asked) {
      setErrors({});
      return [];
    }
    const found: BillingErrors = {};
    if (!values.country.trim()) found.country = t.form.errors.country;
    if (!values.city.trim()) found.city = t.form.errors.city;
    if (!values.addressLine.trim()) found.addressLine = t.form.errors.address;
    setErrors(found);
    return ORDER.filter((f) => found[f]);
  };

  const showServerErrors = (err: unknown) => {
    const found: BillingErrors = {};
    for (const problem of apiFieldProblems(err)) {
      const field = SERVER_FIELDS[problem.field];
      if (!field || found[field]) continue;
      found[field] =
        field === "city"
          ? t.form.errors.city
          : field === "addressLine"
            ? t.form.errors.address
            : field === "country"
              ? t.form.errors.country
              : t.form.errors.required;
    }
    const named = ORDER.filter((f) => found[f]);
    if (named.length > 0) {
      // A billing problem means the block has to be open to fix it.
      setSame(false);
      setErrors(found);
    }
    return named;
  };

  const payload = (): Pick<CheckoutPayloadWithBilling, "billingSameAsShipping" | "billingAddress"> => {
    if (!asked) return {};
    const v = Object.fromEntries(Object.entries(values).map(([k, x]) => [k, x.trim()])) as unknown as BillingValues;
    // A listed place goes as its names, like the shipping governorate; a country without a list sends what was typed.
    const province = placesFor(v.country).length > 0 ? provinceFor(v.region) : v.region || undefined;
    return {
      billingSameAsShipping: false,
      billingAddress: {
        ...(v.fullName ? { fullName: v.fullName } : {}),
        country: v.country,
        ...(province ? { province } : {}),
        city: v.city,
        ...(v.area ? { area: v.area } : {}),
        addressLine: v.addressLine,
        ...(v.postalCode ? { postalCode: v.postalCode } : {}),
      },
    };
  };

  return { enabled, same, setSame, values, errors, set, check, showServerErrors, payload };
}

function Chevron() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-ink-soft"
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** The "same as shipping" box and, once unticked, the billing address fields. */
export function BillingAddressFields({ idPrefix, state }: { idPrefix: string; state: BillingAddressState }) {
  const { t, locale } = useStore();
  if (!state.enabled) return null;
  const { values, errors } = state;
  const places = placesFor(values.country);
  const egypt = (values.country || "EG") === "EG";

  const field = (
    name: BillingField,
    labelText: string,
    control: (a11y: { id: string; "aria-invalid"?: true; "aria-describedby"?: string }) => ReactNode,
    opts: { required?: boolean; half?: boolean } = {}
  ) => {
    const id = billingFieldId(idPrefix, name);
    return (
      <div className={opts.half ? "" : "sm:col-span-2"}>
        <label htmlFor={id} className={labelClass}>
          {labelText}
          {opts.required ? (
            <span className="text-danger" aria-hidden>
              {" "}*
            </span>
          ) : (
            <span className="ms-1 text-xs font-normal text-ink-soft">({t.common.optional})</span>
          )}
        </label>
        {control({ id, ...(errors[name] ? { "aria-invalid": true, "aria-describedby": `${id}-error` } : {}) })}
        {errors[name] && (
          <p id={`${id}-error`} className="mt-1 text-xs font-medium text-danger">
            {errors[name]}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="mt-5 border-t border-line pt-4">
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink">
        <input
          type="checkbox"
          checked={state.same}
          onChange={(e) => state.setSame(e.target.checked)}
          className="size-5 shrink-0 cursor-pointer accent-primary"
          aria-controls={`${idPrefix}-billing`}
          aria-expanded={!state.same}
        />
        {t.checkoutExtras.billingSame}
      </label>

      {!state.same && (
        <fieldset id={`${idPrefix}-billing`} className="mt-3">
          <legend className="mb-3 text-base font-semibold text-ink">{t.checkoutExtras.billingTitle}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {field("fullName", t.checkoutExtras.billingName, (a11y) => (
              <input
                {...a11y}
                type="text"
                autoComplete="billing name"
                maxLength={200}
                value={values.fullName}
                onChange={(e) => state.set("fullName", e.target.value)}
                className={input}
              />
            ))}
            {field(
              "country",
              t.form.country,
              (a11y) => (
                <div className="relative">
                  <select
                    {...a11y}
                    required
                    autoComplete="billing country"
                    value={values.country}
                    onChange={(e) => state.set("country", e.target.value)}
                    className={`${input} cursor-pointer appearance-none pe-10`}
                  >
                    {values.country && !FORM_COUNTRIES.some((c) => c.code === values.country) && (
                      <option value={values.country}>{countryName(values.country, locale)}</option>
                    )}
                    {FORM_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c[arOrEn(locale)]}
                      </option>
                    ))}
                  </select>
                  <Chevron />
                </div>
              ),
              { required: true }
            )}
            {field(
              "region",
              egypt ? t.form.governorate : t.checkoutExtras.region,
              (a11y) =>
                places.length > 0 ? (
                  <div className="relative">
                    <select
                      {...a11y}
                      autoComplete="billing address-level1"
                      value={values.region}
                      onChange={(e) => state.set("region", e.target.value)}
                      className={`${input} cursor-pointer appearance-none pe-10`}
                    >
                      <option value="">{t.form.choose}</option>
                      {places.map((p) => (
                        <option key={p.code} value={p.code}>
                          {p[arOrEn(locale)]}
                        </option>
                      ))}
                    </select>
                    <Chevron />
                  </div>
                ) : (
                  <input
                    {...a11y}
                    type="text"
                    autoComplete="billing address-level1"
                    maxLength={100}
                    value={values.region}
                    onChange={(e) => state.set("region", e.target.value)}
                    className={input}
                  />
                ),
              { half: true }
            )}
            {field(
              "city",
              t.checkoutExtras.city,
              (a11y) => (
                <input
                  {...a11y}
                  type="text"
                  required
                  autoComplete="billing address-level2"
                  maxLength={100}
                  value={values.city}
                  onChange={(e) => state.set("city", e.target.value)}
                  className={input}
                />
              ),
              { required: true, half: true }
            )}
            {field(
              "area",
              t.checkoutExtras.area,
              (a11y) => (
                <input
                  {...a11y}
                  type="text"
                  autoComplete="billing address-level3"
                  maxLength={100}
                  value={values.area}
                  onChange={(e) => state.set("area", e.target.value)}
                  className={input}
                />
              ),
              { half: true }
            )}
            {field(
              "postalCode",
              t.form.postalCode,
              (a11y) => (
                <input
                  {...a11y}
                  type="text"
                  inputMode="numeric"
                  autoComplete="billing postal-code"
                  dir="ltr"
                  maxLength={20}
                  value={values.postalCode}
                  onChange={(e) => state.set("postalCode", e.target.value)}
                  className={`${input} text-start rtl:text-end`}
                />
              ),
              { half: true }
            )}
            {field(
              "addressLine",
              t.form.address,
              (a11y) => (
                <input
                  {...a11y}
                  type="text"
                  required
                  autoComplete="billing street-address"
                  maxLength={500}
                  placeholder={t.form.addressPlaceholder}
                  value={values.addressLine}
                  onChange={(e) => state.set("addressLine", e.target.value)}
                  className={input}
                />
              ),
              { required: true }
            )}
          </div>
        </fieldset>
      )}
    </div>
  );
}
