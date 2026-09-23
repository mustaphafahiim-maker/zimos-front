"use client";

import type { ReactNode } from "react";
import { GOVERNORATES } from "@/lib/egypt";
import type { OrderFormErrors, OrderFormField, OrderFormValues } from "@/lib/orderForm";
import { useStore } from "@/lib/StoreContext";
import { input, label as labelClass } from "../ui";

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

/**
 * The COD address/contact fields. Controlled; validation lives in
 * lib/orderForm.ts so the product quick form and checkout behave identically.
 *
 * `fields` lets the checkout page draw the contact fields and the address
 * fields as two sections of the same form; by default all of them render
 * in one grid, as the product quick-order form has them. `onBlur` is how a
 * caller validates a field as the shopper leaves it.
 */
export function OrderFormFields({
  idPrefix,
  values,
  errors,
  onChange,
  onBlur,
  showAltPhone = false,
  showEmail = false,
  fields = "all",
}: {
  idPrefix: string;
  values: OrderFormValues;
  errors: OrderFormErrors;
  onChange: (field: OrderFormField, value: string) => void;
  onBlur?: (field: OrderFormField) => void;
  showAltPhone?: boolean;
  showEmail?: boolean;
  fields?: "all" | "contact" | "address";
}) {
  const { t, locale } = useStore();
  const contact = fields !== "address";
  const address = fields !== "contact";

  const a11y = (field: OrderFormField, hasHint = false) => {
    const id = fieldId(idPrefix, field);
    const describedBy = errors[field] ? `${id}-error` : hasHint ? `${id}-hint` : undefined;
    return {
      id,
      name: field,
      "aria-invalid": errors[field] ? true : undefined,
      "aria-describedby": describedBy,
      onBlur: onBlur ? () => onBlur(field) : undefined,
    } as const;
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {contact && (
      <Field id={fieldId(idPrefix, "fullName")} label={t.form.fullName} required error={errors.fullName} className="sm:col-span-2">
        <input
          {...a11y("fullName")}
          type="text"
          autoComplete="name"
          required
          placeholder={t.form.fullNamePlaceholder}
          value={values.fullName}
          onChange={(e) => onChange("fullName", e.target.value)}
          className={input}
        />
      </Field>
      )}

      {contact && (
      <Field
        id={fieldId(idPrefix, "phone")}
        label={t.form.phone}
        required
        error={errors.phone}
        hint={t.form.phoneHint}
        className={showAltPhone ? "" : "sm:col-span-2"}
      >
        <input
          {...a11y("phone", true)}
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          dir="ltr"
          required
          maxLength={16}
          placeholder={t.form.phonePlaceholder}
          value={values.phone}
          onChange={(e) => onChange("phone", e.target.value)}
          className={`${input} text-start rtl:text-end`}
        />
      </Field>
      )}

      {contact && showAltPhone && (
        <Field id={fieldId(idPrefix, "altPhone")} label={t.form.altPhone} optionalLabel={t.common.optional} error={errors.altPhone}>
          <input
            {...a11y("altPhone")}
            type="tel"
            inputMode="tel"
            autoComplete="off"
            dir="ltr"
            maxLength={16}
            placeholder={t.form.phonePlaceholder}
            value={values.altPhone}
            onChange={(e) => onChange("altPhone", e.target.value)}
            className={`${input} text-start rtl:text-end`}
          />
        </Field>
      )}

      {contact && showEmail && (
        <Field
          id={fieldId(idPrefix, "email")}
          label={t.form.email}
          optionalLabel={t.common.optional}
          error={errors.email}
          className="sm:col-span-2"
        >
          <input
            {...a11y("email")}
            type="email"
            inputMode="email"
            autoComplete="email"
            dir="ltr"
            value={values.email}
            onChange={(e) => onChange("email", e.target.value)}
            className={`${input} text-start rtl:text-end`}
          />
        </Field>
      )}

      {address && (
      <Field id={fieldId(idPrefix, "governorate")} label={t.form.governorate} required error={errors.governorate}>
        <div className="relative">
          <select
            {...a11y("governorate")}
            required
            autoComplete="address-level1"
            value={values.governorate}
            onChange={(e) => onChange("governorate", e.target.value)}
            className={`${input} cursor-pointer appearance-none pe-10`}
          >
            <option value="">{t.form.chooseGovernorate}</option>
            {GOVERNORATES.map((g) => (
              <option key={g.code} value={g.code}>
                {g[locale]}
              </option>
            ))}
          </select>
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
        </div>
      </Field>
      )}

      {address && (
      <Field id={fieldId(idPrefix, "city")} label={t.form.city} required error={errors.city}>
        <input
          {...a11y("city")}
          type="text"
          autoComplete="address-level2"
          required
          value={values.city}
          onChange={(e) => onChange("city", e.target.value)}
          className={input}
        />
      </Field>
      )}

      {address && (
      <Field id={fieldId(idPrefix, "address")} label={t.form.address} required error={errors.address} className="sm:col-span-2">
        <input
          {...a11y("address")}
          type="text"
          autoComplete="street-address"
          required
          placeholder={t.form.addressPlaceholder}
          value={values.address}
          onChange={(e) => onChange("address", e.target.value)}
          className={input}
        />
      </Field>
      )}

      {address && (
      <Field id={fieldId(idPrefix, "notes")} label={t.form.notes} optionalLabel={t.common.optional} className="sm:col-span-2">
        <textarea
          {...a11y("notes")}
          rows={2}
          placeholder={t.form.notesPlaceholder}
          value={values.notes}
          onChange={(e) => onChange("notes", e.target.value)}
          className={`${input} min-h-20 resize-y`}
        />
      </Field>
      )}
    </div>
  );
}
