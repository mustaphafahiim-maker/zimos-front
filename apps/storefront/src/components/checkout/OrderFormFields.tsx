"use client";

import { useEffect, useState, type ChangeEvent, type KeyboardEvent, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { PlusIcon } from "@phosphor-icons/react/dist/ssr/Plus";
import { isCheckoutPhotoField, type CheckoutFormField } from "@store-builder/api-client";
import { useShippingPlaces } from "@/lib/useShippingPlaces";
import {
  FORM_COUNTRIES,
  FORM_FIELD_OF,
  NOTES_MAX,
  POSTAL_CODE_MAX,
  egyptPhoneIssue,
  formOf,
  isEgyptForm,
  validateOrderField,
  type EgyptPhoneIssue,
  type OrderFormErrors,
  type OrderFormField,
  type OrderFormFieldModes,
  type OrderFormValues,
} from "@/lib/orderForm";
import { isEgyptianMobile, normalizePhone } from "@/lib/egypt";
import { useStore } from "@/lib/StoreContext";
import { countryName } from "@/lib/storeCountry";
import { CheckIcon } from "../Icons";
import { focusRing, input, label as labelClass } from "../ui";
import { CheckoutPhotoField } from "./CheckoutPhotoField";
import { StorePlaceFields } from "./StorePlaceFields";
import type { StorePlacesState } from "@/lib/useStorePlaces";
import { arOrEn, pickText } from "@/lib/i18n";
import { AddressSearch, addressSearchSlot } from "./AddressSearch";
import { CHECKOUT_TEXT } from "./checkoutText";
import { useDraft, type OrderFormDrafts } from "./formDrafts";

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
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-soft">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1.5 text-sm font-medium text-danger">
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

/** What a field hands the control it draws. */
interface Control {
  /** The text in the box: what is being typed, else the form's value. */
  value: string;
  a11y: { id: string; name: string; "aria-invalid": true | undefined; "aria-describedby": string | undefined };
  /** A change. `now` hands it to the form without waiting for a pause (a finished phone number). */
  set: (next: string, now?: boolean) => void;
  /** The control was left. */
  blur: () => void;
}

/**
 * One field: its label, its control, its hint and its error — and the gentle
 * validation. Nothing turns red before the shopper has typed in the field and
 * left it once; from then on it is checked as it changes, so an error goes
 * the moment it is fixed. An error the form itself reports (the order button,
 * the server) shows at once, and also starts the as-you-type check.
 *
 * With `drafts`, typing stays here: the keystroke redraws this field only and
 * reaches the form after a pause or on leaving (components/checkout/formDrafts).
 */
function FieldBox({
  field,
  id,
  label,
  required,
  optionalLabel,
  hint,
  className,
  value,
  error,
  drafts,
  onChange,
  check,
  render,
}: {
  field: OrderFormField;
  id: string;
  label: string;
  required?: boolean;
  optionalLabel?: string;
  hint?: string;
  className?: string;
  value: string;
  /** The form's own error for this field. */
  error?: string;
  /** Null for a control that is picked rather than typed in (a select): its change reaches the form at once. */
  drafts: OrderFormDrafts | null;
  onChange: (field: OrderFormField, value: string) => void;
  check: (field: OrderFormField, value: string) => string | undefined;
  render: (control: Control) => ReactNode;
}) {
  const draft = useDraft(drafts, field);
  const shown = draft ?? value;
  const [dirty, setDirty] = useState(false);
  const [armed, setArmed] = useState(false);
  if (error && !armed) setArmed(true);

  const live = armed ? check(field, shown) : undefined;
  // While the box runs ahead of the form, the form's error is about older text.
  const typing = draft !== undefined && draft !== value;
  const message = typing ? live : (live ?? error);

  const control: Control = {
    value: shown,
    a11y: {
      id,
      name: field,
      "aria-invalid": message ? true : undefined,
      "aria-describedby": message ? `${id}-error` : hint ? `${id}-hint` : undefined,
    },
    set(next, now) {
      if (!dirty) setDirty(true);
      if (drafts) {
        drafts.type(field, next);
        if (now) drafts.flush();
      } else {
        onChange(field, next);
      }
    },
    blur() {
      if (dirty && !armed) setArmed(true);
      drafts?.flush();
    },
  };

  return (
    <Field id={id} label={label} required={required} optionalLabel={optionalLabel} error={message} hint={hint} className={className}>
      {render(control)}
    </Field>
  );
}

/** The store's own pickers, with the typed city (a region without cities) kept in its box while it is typed. */
function PlacePickers({
  drafts,
  cityValue,
  onChange,
  ...rest
}: Omit<Parameters<typeof StorePlaceFields>[0], "cityText" | "onCityText" | "onCityBlur"> & {
  drafts: OrderFormDrafts | null;
  cityValue: string;
  onChange: (field: OrderFormField, value: string) => void;
}) {
  const draft = useDraft(drafts, "city");
  return (
    <StorePlaceFields
      {...rest}
      cityText={draft ?? cityValue}
      onCityText={(v) => (drafts ? drafts.type("city", v) : onChange("city", v))}
      onCityBlur={() => drafts?.flush()}
    />
  );
}

/** How long the governorate waits for the store's own places before the platform's list is offered anyway. */
const PLACES_PATIENCE_MS = 4000;

/**
 * True while the store's own place list is still being asked for: the
 * governorate and the city then keep their boxes, not yet usable, instead of
 * showing the platform's list and swapping it for the store's pickers under
 * the shopper's thumb. Never for long — a slow or lost request gives way to
 * the platform's list.
 */
function useHeldPlaces(loading: boolean): boolean {
  const [waited, setWaited] = useState(false);
  useEffect(() => {
    if (!loading) return;
    const timer = window.setTimeout(() => setWaited(true), PLACES_PATIENCE_MS);
    return () => window.clearTimeout(timer);
  }, [loading]);
  return loading && !waited;
}

/** Fields that share a row on wide screens; everything else takes the full row. */
const HALF_WIDTH = new Set(["government", "city"]);

type Group = "contact" | "address" | "other";
const CONTACT_KEYS: ReadonlySet<string> = new Set(["full_name", "phone", "phone_alt", "email"]);
const ADDRESS_KEYS: ReadonlySet<string> = new Set(["country", "government", "city", "address", "postal_code", "sa_national_address"]);
const groupOf = (key: string): Group => (CONTACT_KEYS.has(key) ? "contact" : ADDRESS_KEYS.has(key) ? "address" : "other");

/**
 * Where a heading can go over the contact fields and over the address fields:
 * before the first of each — but only when the merchant's order keeps each
 * group together. Fields are never moved to make a group; an order that mixes
 * them gets no headings. -1 for a group the form does not have.
 */
function groupStarts(list: readonly CheckoutFormField[]): { contact: number; address: number } | null {
  const runs: Group[] = [];
  for (const f of list) {
    const group = groupOf(f.key);
    if (runs[runs.length - 1] !== group) runs.push(group);
  }
  const together = (group: Group) => runs.filter((g) => g === group).length <= 1;
  if (!together("contact") || !together("address")) return null;
  return {
    contact: list.findIndex((f) => groupOf(f.key) === "contact"),
    address: list.findIndex((f) => groupOf(f.key) === "address"),
  };
}

/** Whether <OrderFormFields groupTitles> will draw its headings for this form (the page then drops its own title). */
export function hasFieldGroups(fields: OrderFormFieldModes, opts: { showAltPhone?: boolean } = {}): boolean {
  return groupStarts(formOf(fields, opts)) !== null;
}

/**
 * The COD address/contact fields. Controlled; validation lives in
 * lib/orderForm.ts so the product quick form and checkout behave identically.
 * Which fields appear, in what order, under which label and whether they must
 * be filled comes from the store's purchase form (`fields`, see `formOf`).
 * With the store's own place list (`storePlaces`, lib/useStorePlaces) the
 * governorate and city become its region → city → area pickers.
 *
 * The keyboard's Enter key goes on to the next field and, from the last one,
 * puts the keyboard away: it never sends the order from a field.
 */
export function OrderFormFields({
  idPrefix,
  values,
  errors,
  onChange,
  fields,
  showAltPhone = false,
  storePlaces = null,
  drafts = null,
  groupTitles = null,
  foldNote = false,
}: {
  idPrefix: string;
  values: OrderFormValues;
  errors: OrderFormErrors;
  onChange: (field: OrderFormField, value: string) => void;
  fields: OrderFormFieldModes;
  showAltPhone?: boolean;
  /** The store's own places (region → city → area); absent or inactive = the platform's governorates and a typed city. */
  storePlaces?: StorePlacesState | null;
  /** Optional: typing stays in its field and reaches `onChange`'s owner after a pause (components/checkout/formDrafts). */
  drafts?: OrderFormDrafts | null;
  /** Optional: headings over the contact fields and over the address fields, where the merchant's order keeps each together. */
  groupTitles?: { contact: string; address: string } | null;
  /** Optional: the note (never a required field) waits behind a one-line button until the shopper wants it. */
  foldNote?: boolean;
}) {
  const { t, locale, intlLocale } = useStore();
  const text = pickText(CHECKOUT_TEXT, locale);
  const egypt = isEgyptForm(values);
  // The platform's places for the form's country, less the ones the store does not deliver to.
  const places = useShippingPlaces(values.country || "EG");
  const list = formOf(fields, { showAltPhone });
  const shownKeys = new Set(list.map((f) => f.key));
  const ownPlaces = storePlaces?.active ? storePlaces : null;
  const heldPlaces = useHeldPlaces(Boolean(storePlaces?.loading));
  const [noteOpen, setNoteOpen] = useState(false);
  const noteFolded = foldNote && !noteOpen && !values.notes && !errors.notes;

  const number = (n: number) => new Intl.NumberFormat(intlLocale).format(n);
  const phoneWords = (issue: EgyptPhoneIssue): string =>
    issue.kind === "short"
      ? text.phoneShort(number(issue.digits), number(11))
      : issue.kind === "long"
        ? text.phoneLong
        : issue.kind === "operator"
          ? text.phoneOperator
          : issue.kind === "letters"
            ? text.phoneLetters
            : text.phonePrefix;

  /** One field's problem with `value` in it — the form's own rules; an Egyptian number also says exactly what to fix. */
  const check = (field: OrderFormField, value: string): string | undefined => {
    const problem = validateOrderField(field, value === values[field] ? values : { ...values, [field]: value }, t, fields, {
      showAltPhone,
      places: storePlaces,
    });
    if (!problem) return undefined;
    if (egypt && (field === "phone" || field === "altPhone")) {
      const issue = egyptPhoneIssue(value);
      if (issue) return phoneWords(issue);
    }
    return problem;
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

  // The last field a keyboard can go on from: its Enter key reads "done", the others "next".
  let lastTyped = -1;
  list.forEach((f, i) => {
    if (isCheckoutPhotoField(f) || f.key === "note") return;
    lastTyped = i;
  });

  function renderField(f: CheckoutFormField, index: number) {
    const field = FORM_FIELD_OF[f.key];
    const id = fieldId(idPrefix, field);
    const label = f.label[arOrEn(locale)] || f.label.ar || f.label.en || builtInLabel[f.key] || f.key;
    const help = f.helpText[arOrEn(locale)] || f.helpText.ar || f.helpText.en || "";
    const value = values[field];
    const enterKeyHint = index < lastTyped ? ("next" as const) : ("done" as const);
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
      className: half ? "" : "sm:col-span-2",
    };
    const box = { ...common, field, value, error: errors[field], onChange, check, hint: help || undefined };

    /** The governorate's or the city's box while the store's own places are on their way. */
    const held = (placeholder: string) => (
      <Field key={f.key} {...common}>
        <div className="relative">
          <select
            id={id}
            disabled
            aria-busy="true"
            defaultValue=""
            className={`${input} animate-pulse cursor-wait appearance-none pe-10 motion-reduce:animate-none`}
          >
            <option value="">{placeholder}</option>
          </select>
          <Chevron />
        </div>
      </Field>
    );

    switch (f.key) {
      case "full_name":
        return (
          <FieldBox
            key={f.key}
            {...box}
            drafts={drafts}
            render={(c) => (
              <input
                {...c.a11y}
                type="text"
                autoComplete="name"
                autoCapitalize="words"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint={enterKeyHint}
                required={f.required}
                placeholder={t.form.fullNamePlaceholder}
                value={c.value}
                onChange={(e) => c.set(e.target.value)}
                onBlur={c.blur}
                className={input}
              />
            )}
          />
        );
      case "phone":
      case "phone_alt": {
        const hint = help || (f.key === "phone" && egypt ? t.form.phoneHint : "");
        return (
          <FieldBox
            key={f.key}
            {...box}
            hint={hint || undefined}
            drafts={drafts}
            render={(c) => {
              const valid = egypt && isEgyptianMobile(c.value);
              const onType = (e: ChangeEvent<HTMLInputElement>) => {
                const el = e.target;
                // Arabic and Persian digits, spaces, dashes and a +20 become the 11 digits the courier dials.
                const next = normalizePhone(el.value);
                if (next !== el.value && next.length === el.value.length) {
                  // Same length (digits swapped for digits): the caret stays where the shopper is editing.
                  const at = el.selectionStart;
                  if (at !== null) {
                    requestAnimationFrame(() => {
                      if (document.activeElement !== el) return;
                      try {
                        el.setSelectionRange(at, at);
                      } catch {
                        /* a browser that does not place the caret in this input */
                      }
                    });
                  }
                }
                // A finished number is handed over at once: the deposit check and the saved-order capture need not wait.
                c.set(next, egypt && isEgyptianMobile(next));
              };
              return (
                <div className="relative">
                  <input
                    {...c.a11y}
                    type="tel"
                    inputMode="tel"
                    autoComplete={f.key === "phone" ? "tel-national" : "off"}
                    enterKeyHint={enterKeyHint}
                    dir="ltr"
                    required={f.required}
                    maxLength={16}
                    placeholder={egypt ? t.form.phonePlaceholder : undefined}
                    value={c.value}
                    onChange={onType}
                    onBlur={c.blur}
                    className={`${input} text-start rtl:text-end`}
                  />
                  {valid && <CheckIcon size={18} weight="bold" className="pointer-events-none absolute end-3 top-1/2 -translate-y-1/2 text-success" />}
                  <span role="status" className="sr-only">
                    {valid ? text.phoneOk : ""}
                  </span>
                </div>
              );
            }}
          />
        );
      }
      case "email":
        return (
          <FieldBox
            key={f.key}
            {...box}
            drafts={drafts}
            render={(c) => (
              <input
                {...c.a11y}
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint={enterKeyHint}
                required={f.required}
                dir="ltr"
                value={c.value}
                onChange={(e) => c.set(e.target.value)}
                onBlur={c.blur}
                className={`${input} text-start rtl:text-end`}
              />
            )}
          />
        );
      case "country":
        return (
          <FieldBox
            key={f.key}
            {...box}
            drafts={null}
            render={(c) => (
              <div className="relative">
                <select
                  {...c.a11y}
                  required={f.required}
                  autoComplete="country"
                  value={c.value || "EG"}
                  onChange={(e) => c.set(e.target.value)}
                  onBlur={c.blur}
                  className={`${input} cursor-pointer appearance-none pe-10`}
                >
                  {/* A store country the list does not carry (lib/storeCountry) is offered too. */}
                  {c.value && !FORM_COUNTRIES.some((country) => country.code === c.value) && <option value={c.value}>{countryName(c.value, locale)}</option>}
                  {FORM_COUNTRIES.map((country) => (
                    <option key={country.code} value={country.code}>
                      {country[arOrEn(locale)]}
                    </option>
                  ))}
                </select>
                <Chevron />
              </div>
            )}
          />
        );
      case "government":
        if (heldPlaces) return held(t.form.chooseGovernorate);
        if (ownPlaces) {
          // The pickers stand in for the governorate and the city (rendered here, skipped at "city").
          const cityField = list.find((x) => x.key === "city");
          const cityHelp = cityField ? cityField.helpText[arOrEn(locale)] || cityField.helpText.ar || cityField.helpText.en : "";
          return (
            <PlacePickers
              key={f.key}
              idPrefix={idPrefix}
              places={ownPlaces}
              region={{
                label: f.label[arOrEn(locale)] || f.label.ar || f.label.en || (egypt ? t.form.governorate : t.places.region),
                required: f.required,
                hint: help || undefined,
                // With a region picked, a governorate error can only be the server refusing the picked place.
                error: ownPlaces.regionId ? undefined : errors.governorate,
              }}
              refusal={ownPlaces.regionId ? errors.governorate : undefined}
              city={
                cityField
                  ? {
                      label:
                        cityField.label[arOrEn(locale)] ||
                        cityField.label.ar ||
                        cityField.label.en ||
                        (ownPlaces.regionId && !ownPlaces.hasCities ? t.form.city : t.places.city),
                      required: cityField.required,
                      hint: cityHelp || undefined,
                      error: errors.city,
                    }
                  : null
              }
              drafts={drafts}
              cityValue={values.city}
              onChange={onChange}
            />
          );
        }
        return (
          <FieldBox
            key={f.key}
            {...box}
            drafts={places.length > 0 ? null : drafts}
            render={(c) =>
              places.length > 0 ? (
                <div className="relative">
                  <select
                    {...c.a11y}
                    required={f.required}
                    autoComplete="address-level1"
                    value={c.value}
                    onChange={(e) => c.set(e.target.value)}
                    onBlur={c.blur}
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
                  {...c.a11y}
                  type="text"
                  autoComplete="address-level1"
                  enterKeyHint={enterKeyHint}
                  required={f.required}
                  maxLength={100}
                  value={c.value}
                  onChange={(e) => c.set(e.target.value)}
                  onBlur={c.blur}
                  className={input}
                />
              )
            }
          />
        );
      case "city":
        if (heldPlaces && shownKeys.has("government")) return held("");
        if (ownPlaces) return null;
        return (
          <FieldBox
            key={f.key}
            {...box}
            drafts={drafts}
            render={(c) => (
              <input
                {...c.a11y}
                type="text"
                autoComplete="address-level2"
                enterKeyHint={enterKeyHint}
                required={f.required}
                maxLength={100}
                value={c.value}
                onChange={(e) => c.set(e.target.value)}
                onBlur={c.blur}
                className={input}
              />
            )}
          />
        );
      case "address":
        return (
          <FieldBox
            key={f.key}
            {...box}
            drafts={drafts}
            render={(c) => (
              <input
                {...c.a11y}
                type="text"
                autoComplete="street-address"
                enterKeyHint={enterKeyHint}
                required={f.required}
                maxLength={500}
                placeholder={t.form.addressPlaceholder}
                value={c.value}
                onChange={(e) => c.set(e.target.value)}
                onBlur={c.blur}
                className={input}
              />
            )}
          />
        );
      case "postal_code":
        return (
          <FieldBox
            key={f.key}
            {...box}
            drafts={drafts}
            render={(c) => (
              <input
                {...c.a11y}
                type="text"
                inputMode="numeric"
                autoComplete="postal-code"
                enterKeyHint={enterKeyHint}
                required={f.required}
                dir="ltr"
                maxLength={POSTAL_CODE_MAX}
                value={c.value}
                onChange={(e) => c.set(e.target.value)}
                onBlur={c.blur}
                className={`${input} text-start rtl:text-end sm:max-w-56`}
              />
            )}
          />
        );
      case "sa_national_address":
        return (
          <FieldBox
            key={f.key}
            {...box}
            drafts={drafts}
            render={(c) => (
              <input
                {...c.a11y}
                type="text"
                autoComplete="off"
                autoCapitalize="characters"
                enterKeyHint={enterKeyHint}
                required={f.required}
                dir="ltr"
                maxLength={40}
                placeholder={t.form.nationalAddressPlaceholder}
                value={c.value}
                onChange={(e) => c.set(e.target.value.toUpperCase())}
                onBlur={c.blur}
                className={`${input} text-start rtl:text-end sm:max-w-56`}
              />
            )}
          />
        );
      case "note":
        if (noteFolded) {
          return (
            <div key={f.key} className="sm:col-span-2">
              <button
                type="button"
                aria-expanded={false}
                onClick={() => {
                  // Committed first, so the box exists to take the focus.
                  flushSync(() => setNoteOpen(true));
                  document.getElementById(id)?.focus();
                }}
                className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl text-sm font-medium text-primary hover:underline ${focusRing}`}
              >
                <PlusIcon size={18} weight="bold" aria-hidden="true" />
                {label}
                <span className="text-xs font-normal text-ink-soft">({t.common.optional})</span>
              </button>
            </div>
          );
        }
        return (
          <FieldBox
            key={f.key}
            {...box}
            drafts={drafts}
            render={(c) => (
              <textarea
                {...c.a11y}
                rows={2}
                maxLength={NOTES_MAX}
                placeholder={t.form.notesPlaceholder}
                value={c.value}
                onChange={(e) => c.set(e.target.value)}
                onBlur={c.blur}
                className={`${input} min-h-20 resize-y`}
              />
            )}
          />
        );
      default:
        // The merchant's own fields: free text, one of their options, or a photo.
        if (isCheckoutPhotoField(f)) {
          return (
            <Field key={f.key} {...common} error={errors[field]} hint={help || undefined}>
              <CheckoutPhotoField
                id={id}
                fieldKey={f.key}
                label={label}
                value={value}
                onChange={(v) => onChange(field, v)}
                required={f.required}
                invalid={Boolean(errors[field])}
                describedBy={errors[field] ? `${id}-error` : help ? `${id}-hint` : undefined}
              />
            </Field>
          );
        }
        if (f.type === "choice") {
          return (
            <FieldBox
              key={f.key}
              {...box}
              drafts={null}
              render={(c) => (
                <div className="relative">
                  <select
                    {...c.a11y}
                    required={f.required}
                    value={c.value}
                    onChange={(e) => c.set(e.target.value)}
                    onBlur={c.blur}
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
              )}
            />
          );
        }
        return (
          <FieldBox
            key={f.key}
            {...box}
            drafts={drafts}
            render={(c) => (
              <input
                {...c.a11y}
                type="text"
                autoComplete="off"
                enterKeyHint={enterKeyHint}
                required={f.required}
                maxLength={500}
                value={c.value}
                onChange={(e) => c.set(e.target.value)}
                onBlur={c.blur}
                className={input}
              />
            )}
          />
        );
    }
  }

  /** Enter in a one-line field: on to the next control, or the keyboard away from the last. Never the order. */
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key !== "Enter" || e.defaultPrevented || e.nativeEvent.isComposing) return;
    const el = e.target;
    if (!(el instanceof HTMLInputElement) || el.type === "file" || el.type === "checkbox" || el.type === "radio") return;
    e.preventDefault();
    const controls = Array.from(
      e.currentTarget.querySelectorAll<HTMLElement>("input:not([type='hidden']):not([type='file']), select, textarea")
    ).filter((control) => !control.hasAttribute("disabled") && control.offsetParent !== null);
    const next = controls[controls.indexOf(el) + 1];
    if (next) next.focus();
    else el.blur();
  }

  // "Search your address" (handoff 184) goes before the form's first address field.
  const searchAt = addressSearchSlot(list);
  const search = <AddressSearch key="address-search" idPrefix={idPrefix} country={values.country} onChange={onChange} storePlaces={ownPlaces} />;
  const starts = groupTitles ? groupStarts(list) : null;
  const heading = "text-base font-semibold text-ink sm:col-span-2";

  return (
    <div className="grid gap-4 sm:grid-cols-2" onKeyDown={onKeyDown}>
      {list.flatMap((f, i) => {
        const row: ReactNode[] = [];
        if (starts && groupTitles && i === starts.contact) {
          row.push(
            <h3 key="group-contact" className={`${heading} ${i > 0 ? "mt-2 border-t border-line pt-5" : ""}`}>
              {groupTitles.contact}
            </h3>
          );
        }
        if (starts && groupTitles && i === starts.address) {
          row.push(
            <h3 key="group-address" className={`${heading} ${i > 0 ? "mt-2 border-t border-line pt-5" : ""}`}>
              {groupTitles.address}
            </h3>
          );
        }
        if (i === searchAt) row.push(search);
        row.push(renderField(f, i));
        return row;
      })}
    </div>
  );
}
