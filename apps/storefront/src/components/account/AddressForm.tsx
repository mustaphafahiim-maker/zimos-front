"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { ShopperAddress, ShopperAddressInput } from "@store-builder/api-client";
import { btnGhost, btnPrimary, card, input, label as labelClass } from "@/components/ui";
import { isEgyptianMobile, normalizePhone } from "@/lib/egypt";
import { arOrEn } from "@/lib/i18n";
import type { OrderFormField } from "@/lib/orderForm";
import { addressInput, governorateCodeOf, governoratesOf } from "@/lib/shopperAddress";
import { useStore } from "@/lib/StoreContext";
import { useStoreCountry } from "@/lib/storeCountry";

type Errors = Partial<Record<"governorate" | "city" | "address" | "phone", string>>;

/**
 * Add or edit one saved address: the governorate from the checkout's own
 * list in Egypt (a typed region elsewhere) and a typed city, so an address
 * saved here reads the same at checkout. The country is the store's.
 */
export function AddressForm({
  address,
  canBeDefault,
  onSave,
  onCancel,
  title,
  addressOnly = false,
  children,
  submitLabel,
  busyLabel,
  withoutPostalCode = false,
}: {
  /** The address being edited; absent for a new one. */
  address?: ShopperAddress | null;
  /** False when this is the shopper's first address: it is the default anyway. */
  canBeDefault: boolean;
  onSave: (input: ShopperAddressInput) => Promise<string | null>;
  onCancel: () => void;
  /** Said instead of "Edit address" / "New address". */
  title?: string;
  /** Leaves out the label, recipient and phone. */
  addressOnly?: boolean;
  /** More fields, drawn after the postal code. */
  children?: ReactNode;
  /** Said on the save button instead of "Save address", and while it runs. */
  submitLabel?: string;
  busyLabel?: string;
  /** Leaves the postal code out even when the store's form shows it. */
  withoutPostalCode?: boolean;
}) {
  const { t, store, locale } = useStore();
  const a = t.account;
  const storeCountry = useStoreCountry();
  const country = (address?.country || storeCountry).toUpperCase();
  const egypt = country === "EG";
  const governorates = governoratesOf(country);
  const prefix = address ? `address-${address.id}` : "address-new";

  const [values, setValues] = useState(() => ({
    label: address?.label ?? "",
    fullName: address?.fullName ?? "",
    phone: address?.phone ?? "",
    governorate: governorateCodeOf(address?.province, country),
    city: address?.city ?? "",
    address: address?.addressLine ?? "",
    postalCode: address?.postalCode ?? "",
    isDefault: Boolean(address?.isDefault),
  }));
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const firstRef = useRef<HTMLInputElement>(null);

  function onFieldChange(field: OrderFormField, value: string) {
    if (field !== "governorate" && field !== "city") return;
    setValues((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  useEffect(() => {
    firstRef.current?.focus();
  }, []);

  const showPostal = !withoutPostalCode && store?.checkout?.postal_code !== "hidden";

  function validate(): Errors {
    const e: Errors = {};
    if (governorates.length > 0 && !values.governorate) e.governorate = t.form.errors.governorate;
    if (!values.city.trim()) e.city = t.form.errors.city;
    if (values.address.trim().length < 5) e.address = t.form.errors.address;
    if (values.phone.trim()) {
      const ok = egypt ? isEgyptianMobile(values.phone) : /^\+?\d{8,15}$/.test(normalizePhone(values.phone));
      if (!ok) e.phone = egypt ? t.form.errors.phone : t.form.errors.phoneIntl;
    }
    return e;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const found = validate();
    setErrors(found);
    const first = (["phone", "governorate", "city", "address"] as const).find((k) => found[k]);
    if (first) {
      document.getElementById(`${prefix}-${first}`)?.focus();
      return;
    }
    setBusy(true);
    setFailure(null);
    const problem = await onSave(
      addressInput({
        country,
        governorate: values.governorate,
        city: values.city,
        addressLine: values.address,
        postalCode: showPostal ? values.postalCode : "",
        label: values.label,
        fullName: values.fullName,
        phone: values.phone ? normalizePhone(values.phone) : "",
        ...(canBeDefault ? { isDefault: values.isDefault } : {}),
      })
    );
    setBusy(false);
    if (problem) setFailure(problem);
  }

  const field = (id: string, error?: string) => ({
    id: `${prefix}-${id}`,
    "aria-invalid": error ? true : undefined,
    "aria-describedby": error ? `${prefix}-${id}-error` : undefined,
  });
  const errorLine = (id: string, error?: string) =>
    error ? (
      <p id={`${prefix}-${id}-error`} className="mt-1 text-xs font-medium text-danger">
        {error}
      </p>
    ) : null;
  const optional = <span className="ms-1 text-xs font-normal text-ink-soft">({t.common.optional})</span>;
  const required = (
    <span className="text-danger" aria-hidden>
      {" "}*
    </span>
  );

  return (
    <form onSubmit={submit} noValidate className={`${card} p-5 sm:p-6`} aria-labelledby={`${prefix}-title`}>
      <h2 id={`${prefix}-title`} className="text-lg font-semibold text-ink">
        {title ?? (address ? a.editAddress : a.newAddress)}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {!addressOnly && (
          <>
        <div className="sm:col-span-2">
          <label htmlFor={`${prefix}-label`} className={labelClass}>
            {a.label}
            {optional}
          </label>
          <input
            ref={firstRef}
            id={`${prefix}-label`}
            type="text"
            maxLength={60}
            placeholder={a.labelPlaceholder}
            value={values.label}
            onChange={(e) => setValues((p) => ({ ...p, label: e.target.value }))}
            className={input}
          />
        </div>
        <div>
          <label htmlFor={`${prefix}-fullName`} className={labelClass}>
            {a.recipient}
            {optional}
          </label>
          <input
            id={`${prefix}-fullName`}
            type="text"
            autoComplete="name"
            maxLength={200}
            value={values.fullName}
            onChange={(e) => setValues((p) => ({ ...p, fullName: e.target.value }))}
            className={input}
          />
        </div>
        <div>
          <label htmlFor={`${prefix}-phone`} className={labelClass}>
            {a.recipientPhone}
            {optional}
          </label>
          <input
            {...field("phone", errors.phone)}
            type="tel"
            inputMode="tel"
            autoComplete={egypt ? "tel-national" : "tel"}
            dir="ltr"
            placeholder={egypt ? t.form.phonePlaceholder : undefined}
            maxLength={32}
            value={values.phone}
            onChange={(e) => {
              setValues((p) => ({ ...p, phone: e.target.value }));
              setErrors((p) => ({ ...p, phone: undefined }));
            }}
            className={`${input} text-start rtl:text-end`}
          />
          {errorLine("phone", errors.phone)}
        </div>
          </>
        )}

        <>
            <div>
              <label htmlFor={`${prefix}-governorate`} className={labelClass}>
                {t.form.governorate}
                {required}
              </label>
              {governorates.length > 0 ? (
                <select
                  {...field("governorate", errors.governorate)}
                  autoComplete="address-level1"
                  value={values.governorate}
                  onChange={(e) => onFieldChange("governorate", e.target.value)}
                  className={`${input} cursor-pointer`}
                >
                  <option value="">{t.form.chooseGovernorate}</option>
                  {governorates.map((g) => (
                    <option key={g.code} value={g.code}>
                      {g[arOrEn(locale)]}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  {...field("governorate", errors.governorate)}
                  type="text"
                  autoComplete="address-level1"
                  maxLength={120}
                  value={values.governorate}
                  onChange={(e) => onFieldChange("governorate", e.target.value)}
                  className={input}
                />
              )}
              {errorLine("governorate", errors.governorate)}
            </div>
            <div>
              <label htmlFor={`${prefix}-city`} className={labelClass}>
                {t.form.city}
                {required}
              </label>
              <input
                {...field("city", errors.city)}
                type="text"
                autoComplete="address-level2"
                maxLength={120}
                value={values.city}
                onChange={(e) => onFieldChange("city", e.target.value)}
                className={input}
              />
              {errorLine("city", errors.city)}
            </div>
        </>

        <div className="sm:col-span-2">
          <label htmlFor={`${prefix}-address`} className={labelClass}>
            {t.form.address}
            {required}
          </label>
          <input
            {...field("address", errors.address)}
            type="text"
            autoComplete="street-address"
            maxLength={500}
            placeholder={t.form.addressPlaceholder}
            value={values.address}
            onChange={(e) => {
              setValues((p) => ({ ...p, address: e.target.value }));
              setErrors((p) => ({ ...p, address: undefined }));
            }}
            className={input}
          />
          {errorLine("address", errors.address)}
        </div>

        {showPostal && (
          <div>
            <label htmlFor={`${prefix}-postalCode`} className={labelClass}>
              {t.form.postalCode}
              {optional}
            </label>
            <input
              id={`${prefix}-postalCode`}
              type="text"
              inputMode="numeric"
              autoComplete="postal-code"
              dir="ltr"
              maxLength={20}
              value={values.postalCode}
              onChange={(e) => setValues((p) => ({ ...p, postalCode: e.target.value }))}
              className={`${input} text-start rtl:text-end`}
            />
          </div>
        )}

        {children}

        {canBeDefault && (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink sm:col-span-2">
            <input
              type="checkbox"
              checked={values.isDefault}
              onChange={(e) => setValues((p) => ({ ...p, isDefault: e.target.checked }))}
              className="h-5 w-5 shrink-0 cursor-pointer accent-[var(--color-primary)]"
            />
            {a.makeDefault}
          </label>
        )}
      </div>

      <div aria-live="polite" className="mt-4 empty:hidden">
        {failure && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{failure}</p>}
      </div>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <button type="button" onClick={onCancel} className={btnGhost}>
          {a.cancel}
        </button>
        <button type="submit" disabled={busy} className={btnPrimary}>
          {busy ? (busyLabel ?? a.saving) : (submitLabel ?? a.saveAddress)}
        </button>
      </div>
    </form>
  );
}
