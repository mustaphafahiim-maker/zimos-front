"use client";

import type { ReactNode } from "react";
import type { CheckoutFormField } from "@store-builder/api-client";
import { useShippingPlaces } from "@/lib/useShippingPlaces";
import {
  FORM_COUNTRIES,
  FORM_FIELD_OF,
  NOTES_MAX,
  POSTAL_CODE_MAX,
  formOf,
  isEgyptForm,
  type OrderFormErrors,
  type OrderFormField,
  type OrderFormFieldModes,
  type OrderFormValues,
} from "@/lib/orderForm";
import { useStore } from "@/lib/StoreContext";
import { countryName } from "@/lib/storeCountry";
import { input, label as labelClass } from "../ui";
import { arOrEn } from "@/lib/i18n";

export function fieldId(prefix: string, field: OrderFormField) {
  return `${prefix}-${field}`;
}

function Field({
  id,
  label,
  required,
  optionalLabel,
  error,
  hint,
  className = "",
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  optionalLabel?: string;
  error?: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className={labelClass}>
        {label}
        {required ? (
          <span className="text-danger" aria-hidden>
            {" "}*
          </span>
        ) : optionalLabel ? (
          <span className="ms-1 text-xs font-normal text-ink-soft">({optionalLabel})</span>
        ) : null}
      </label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-ink-soft">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  );
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

/** Fields that share a row on wide screens; everything else takes the full row. */
const HALF_WIDTH = new Set(["government", "city"]);

/**
 * The COD address/contact fields. Controlled; validation lives in
 * lib/orderForm.ts so the product quick form and checkout behave identically.
 * Which fields appear, in what order, under which label and whether they must
 * be filled comes from the store's purchase form (`fields`, see `formOf`).
 */
export function OrderFormFields({
  idPrefix,
  values,
  errors,
  onChange,
  fields,
  showAltPhone = false,
}: {
  idPrefix: string;
  values: OrderFormValues;
  errors: OrderFormErrors;
  onChange: (field: OrderFormField, value: string) => void;
  fields: OrderFormFieldModes;
  showAltPhone?: boolean;
}) {
  const { t, locale } = useStore();
  const egypt = isEgyptForm(values);
  // The platform's places for the form's country, less the ones the store does not deliver to.
  const places = useShippingPlaces(values.country || "EG");
  const list = formOf(fields, { showAltPhone });
  const shownKeys = new Set(list.map((f) => f.key));

  const a11y = (field: OrderFormField, hasHint = false) => {
    const id = fieldId(idPrefix, field);
    const describedBy = errors[field] ? `${id}-error` : hasHint ? `${id}-hint` : undefined;
    return {
      id,
      name: field,
      "aria-invalid": errors[field] ? true : undefined,
      "aria-describedby": describedBy,
    } as const;
  };

  const builtInLabel: Record<string, string> = {
    full_name: t.form.fullName,
    phone: t.form.phone,
    phone_alt: t.form.altPhone,
    email: t.form.email,
    country: t.form.country,
    government: t.form.governorate,
    city: t.form.city,
    address: t.form.address,
    postal_code: t.form.postalCode,
    sa_national_address: t.form.nationalAddress,
    note: t.form.notes,
  };

  function renderField(f: CheckoutFormField) {
    const field = FORM_FIELD_OF[f.key];
    const id = fieldId(idPrefix, field);
    const label = f.label[arOrEn(locale)] || f.label.ar || f.label.en || builtInLabel[f.key] || f.key;
    const help = f.helpText[arOrEn(locale)] || f.helpText.ar || f.helpText.en || "";
    const value = values[field];
    const set = (v: string) => onChange(field, v);
    // Half-width only when its row partner is on the form too.
    const half =
      (HALF_WIDTH.has(f.key) && shownKeys.has("government") && shownKeys.has("city")) ||
      (f.key === "phone" && shownKeys.has("phone_alt")) ||
      f.key === "phone_alt";
    const common = {
      id,
      label,
      required: f.required,
      optionalLabel: t.common.optional,
      error: errors[field],
      className: half ? "" : "sm:col-span-2",
    };

    switch (f.key) {
      case "full_name":
        return (
          <Field key={f.key} {...common} hint={help || undefined}>
            <input
              {...a11y(field, !!help)}
              type="text"
              autoComplete="name"
              required
              placeholder={t.form.fullNamePlaceholder}
              value={value}
              onChange={(e) => set(e.target.value)}
              className={input}
            />
          </Field>
        );
      case "phone":
      case "phone_alt": {
        const hint = help || (f.key === "phone" && egypt ? t.form.phoneHint : "");
        return (
          <Field key={f.key} {...common} hint={hint || undefined}>
            <input
              {...a11y(field, !!hint)}
              type="tel"
              inputMode="tel"
              autoComplete={f.key === "phone" ? "tel-national" : "off"}
              dir="ltr"
              required={f.required}
              maxLength={16}
              placeholder={egypt ? t.form.phonePlaceholder : undefined}
              value={value}
              onChange={(e) => set(e.target.value)}
              className={`${input} text-start rtl:text-end`}
            />
          </Field>
        );
      }
      case "email":
        return (
          <Field key={f.key} {...common} hint={help || undefined}>
            <input
              {...a11y(field, !!help)}
              type="email"
              inputMode="email"
              autoComplete="email"
              required={f.required}
              dir="ltr"
              value={value}
              onChange={(e) => set(e.target.value)}
              className={`${input} text-start rtl:text-end`}
            />
          </Field>
        );
      case "country":
        return (
          <Field key={f.key} {...common} hint={help || undefined}>
            <div className="relative">
              <select
                {...a11y(field, !!help)}
                required={f.required}
                autoComplete="country"
                value={value || "EG"}
                onChange={(e) => set(e.target.value)}
                className={`${input} cursor-pointer appearance-none pe-10`}
              >
                {/* A store country the list does not carry (lib/storeCountry) is offered too. */}
                {value && !FORM_COUNTRIES.some((c) => c.code === value) && <option value={value}>{countryName(value, locale)}</option>}
                {FORM_COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c[arOrEn(locale)]}
                  </option>
                ))}
              </select>
              <Chevron />
            </div>
          </Field>
        );
      case "government":
        return (
          <Field key={f.key} {...common} hint={help || undefined}>
            {places.length > 0 ? (
              <div className="relative">
                <select
                  {...a11y(field, !!help)}
                  required={f.required}
                  autoComplete="address-level1"
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className={`${input} cursor-pointer appearance-none pe-10`}
                >
                  <option value="">{t.form.chooseGovernorate}</option>
                  {places.map((g) => (
                    <option key={g.code} value={g.code}>
                      {g[arOrEn(locale)]}
                    </option>
                  ))}
                </select>
                <Chevron />
              </div>
            ) : (
              <input
                {...a11y(field, !!help)}
                type="text"
                autoComplete="address-level1"
                required={f.required}
                maxLength={100}
                value={value}
                onChange={(e) => set(e.target.value)}
                className={input}
              />
            )}
          </Field>
        );
      case "city":
        return (
          <Field key={f.key} {...common} hint={help || undefined}>
            <input
              {...a11y(field, !!help)}
              type="text"
              autoComplete="address-level2"
              required={f.required}
              maxLength={100}
              value={value}
              onChange={(e) => set(e.target.value)}
              className={input}
            />
          </Field>
        );
      case "address":
        return (
          <Field key={f.key} {...common} hint={help || undefined}>
            <input
              {...a11y(field, !!help)}
              type="text"
              autoComplete="street-address"
              required={f.required}
              maxLength={500}
              placeholder={t.form.addressPlaceholder}
              value={value}
              onChange={(e) => set(e.target.value)}
              className={input}
            />
          </Field>
        );
      case "postal_code":
        return (
          <Field key={f.key} {...common} hint={help || undefined}>
            <input
              {...a11y(field, !!help)}
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              required={f.required}
              dir="ltr"
              maxLength={POSTAL_CODE_MAX}
              value={value}
              onChange={(e) => set(e.target.value)}
              className={`${input} text-start rtl:text-end sm:max-w-56`}
            />
          </Field>
        );
      case "sa_national_address":
        return (
          <Field key={f.key} {...common} hint={help || undefined}>
            <input
              {...a11y(field, !!help)}
              type="text"
              autoComplete="off"
              required={f.required}
              dir="ltr"
              maxLength={40}
              placeholder={t.form.nationalAddressPlaceholder}
              value={value}
              onChange={(e) => set(e.target.value.toUpperCase())}
              className={`${input} text-start rtl:text-end sm:max-w-56`}
            />
          </Field>
        );
      case "note":
        return (
          <Field key={f.key} {...common} hint={help || undefined}>
            <textarea
              {...a11y(field, !!help)}
              rows={2}
              maxLength={NOTES_MAX}
              placeholder={t.form.notesPlaceholder}
              value={value}
              onChange={(e) => set(e.target.value)}
              className={`${input} min-h-20 resize-y`}
            />
          </Field>
        );
      default:
        // The merchant's own fields: free text, or one of their options.
        return (
          <Field key={f.key} {...common} hint={help || undefined}>
            {f.type === "choice" ? (
              <div className="relative">
                <select
                  {...a11y(field, !!help)}
                  required={f.required}
                  value={value}
                  onChange={(e) => set(e.target.value)}
                  className={`${input} cursor-pointer appearance-none pe-10`}
                >
                  <option value="">{t.form.choose}</option>
                  {(f.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <Chevron />
              </div>
            ) : (
              <input
                {...a11y(field, !!help)}
                type="text"
                autoComplete="off"
                required={f.required}
                maxLength={500}
                value={value}
                onChange={(e) => set(e.target.value)}
                className={input}
              />
            )}
          </Field>
        );
    }
  }

  return <div className="grid gap-4 sm:grid-cols-2">{list.map(renderField)}</div>;
}
