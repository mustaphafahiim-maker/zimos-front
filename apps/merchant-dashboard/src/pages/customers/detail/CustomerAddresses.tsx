import { useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import type { Customer, CustomerAddress } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { placeName } from "@/lib/format";
import { IconPlus } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { Field, TextField } from "@/components/Field";
import { StatusBadge } from "@/components/StatusBadge";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { getLocale, useCommon, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    addAddress: "Add address",
    noAddresses: "No addresses on file.",
    defaultBadge: "Default",
    editAddress: "Edit address",
    addressSaved: "Address saved.",
    addressAdded: "Address added.",
    country: "Country",
    countryHint: "Two-letter code.",
    province: "Governorate",
    city: "City",
    postalCode: "Postal code",
    addressLine: "Address line",
    notes: "Notes",
    defaultAddress: "Default address",
    saveAddress: "Save address",
  },
  ar: {
    addAddress: "ضيف عنوان",
    noAddresses: "مفيش عناوين متسجّلة.",
    defaultBadge: "الأساسي",
    editAddress: "عدّل العنوان",
    addressSaved: "العنوان اتحفظ.",
    addressAdded: "العنوان اتضاف.",
    country: "الدولة",
    countryHint: "رمز من حرفين.",
    province: "المحافظة",
    city: "المدينة",
    postalCode: "الرمز البريدي",
    addressLine: "العنوان",
    notes: "ملاحظات",
    defaultAddress: "العنوان الأساسي",
    saveAddress: "احفظ العنوان",
  },
} satisfies Messages;

/** An address on one line: the street, the city, the governorate — Egypt's own code adds nothing. */
export function addressLineOf(address: CustomerAddress): string {
  return [address.addressLine, placeName(address.city), placeName(address.province), address.postalCode, address.country === "EG" ? null : address.country]
    .filter(Boolean)
    .join(getLocale() === "ar" ? "، " : ", ");
}

/**
 * «العناوين»: where this customer's parcels go. Each address with its note and
 * the «الأساسي» mark, «تعديل» beside it, and «ضيف عنوان» — both open the same
 * form in a sheet (country, governorate, city, postal code, the street, a
 * note, default). What is sent is what the page always sent.
 */
export function CustomerAddresses({ customer, onChanged }: { customer: Customer; onChanged: () => void }) {
  const t = useT(STRINGS);
  const common = useCommon();
  const [target, setTarget] = useState<CustomerAddress | "new" | null>(null);
  const addresses = customer.addresses ?? [];

  return (
    <div className="min-w-0">
      {addresses.length === 0 ? (
        <p className="text-sm leading-6 text-ink-soft">{t.noAddresses}</p>
      ) : (
        <ul className="divide-y divide-line">
          {addresses.map((a) => (
            <li key={a.id} className="flex items-start justify-between gap-3 py-2.5 first:pt-0">
              <div className="min-w-0 text-sm leading-6">
                <p dir="auto" className="break-words text-ink">
                  {addressLineOf(a)}
                </p>
                {a.notes && (
                  <p dir="auto" className="break-words text-xs leading-5 text-ink-soft">
                    {a.notes}
                  </p>
                )}
                {a.isDefault && <StatusBadge value="default" tone="info" text={t.defaultBadge} className="mt-1" />}
              </div>
              <Button type="button" size="sm" variant="ghost" className="-my-1 min-h-11 shrink-0 rounded-full px-3 pointer-fine:min-h-9" onClick={() => setTarget(a)}>
                {common.edit}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3">
        <Button type="button" variant="outline" className="min-h-11 rounded-full px-5 pointer-fine:min-h-9" onClick={() => setTarget("new")}>
          <IconPlus className="size-4" weight="bold" aria-hidden />
          {t.addAddress}
        </Button>
      </div>

      <Modal open={target !== null} onClose={() => setTarget(null)} title={target === "new" ? t.addAddress : t.editAddress}>
        {target !== null && (
          <AddressForm
            key={target === "new" ? "new" : target.id}
            customerId={customer.id}
            address={target === "new" ? undefined : target}
            onCancel={() => setTarget(null)}
            onDone={() => {
              setTarget(null);
              onChanged();
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function AddressForm({
  customerId,
  address,
  onDone,
  onCancel,
}: {
  customerId: string;
  address?: CustomerAddress;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT(STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [country, setCountry] = useState(address?.country ?? "EG");
  const [province, setProvince] = useState(address?.province ?? "");
  const [city, setCity] = useState(address?.city ?? "");
  const [addressLine, setAddressLine] = useState(address?.addressLine ?? "");
  const [postalCode, setPostalCode] = useState(address?.postalCode ?? "");
  const [notes, setNotes] = useState(address?.notes ?? "");
  const [isDefault, setIsDefault] = useState(address?.isDefault ?? false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      if (address) {
        await apiClient.updateCustomerAddress(workspaceId, customerId, address.id, {
          country: country.trim().toUpperCase(),
          province: province.trim() || null,
          city: city.trim(),
          addressLine: addressLine.trim(),
          postalCode: postalCode.trim() || null,
          notes: notes.trim() || null,
          isDefault,
        });
        toast.success(t.addressSaved);
      } else {
        await apiClient.addCustomerAddress(workspaceId, customerId, {
          country: country.trim().toUpperCase(),
          province: province.trim() || undefined,
          city: city.trim(),
          addressLine: addressLine.trim(),
          postalCode: postalCode.trim() || undefined,
          notes: notes.trim() || undefined,
          isDefault,
        });
        toast.success(t.addressAdded);
      }
      onDone();
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {formError && <Alert variant="danger">{formError}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t.country}
          required
          dir="ltr"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          error={fieldErrors.country}
          hint={t.countryHint}
        />
        <TextField label={t.province} dir="auto" value={province} onChange={(e) => setProvince(e.target.value)} error={fieldErrors.province} />
        <TextField label={t.city} required dir="auto" value={city} onChange={(e) => setCity(e.target.value)} error={fieldErrors.city} />
        <TextField label={t.postalCode} dir="ltr" value={postalCode} onChange={(e) => setPostalCode(e.target.value)} error={fieldErrors.postalCode} />
      </div>
      <TextField
        label={t.addressLine}
        required
        dir="auto"
        value={addressLine}
        onChange={(e) => setAddressLine(e.target.value)}
        error={fieldErrors.addressLine}
      />
      <Field label={t.notes} error={fieldErrors.notes}>
        {({ id }) => <Textarea id={id} dir="auto" value={notes} onChange={(e) => setNotes(e.target.value)} />}
      </Field>
      <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-ink">
        <input type="checkbox" className="size-4 shrink-0 cursor-pointer accent-primary" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
        {t.defaultAddress}
      </label>
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" className="min-h-11 rounded-full px-5" onClick={onCancel} disabled={saving}>
          {common.cancel}
        </Button>
        <Button type="submit" className="min-h-11 rounded-full px-5" disabled={saving || !country.trim() || !city.trim() || !addressLine.trim()}>
          {saving ? common.saving : address ? t.saveAddress : t.addAddress}
        </Button>
      </div>
    </form>
  );
}
