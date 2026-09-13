import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { Alert, Button, Input } from "@store-builder/ui";
import type { Customer, CustomerAddress } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField, Field } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    customer: "Customer",
    customers: "Customers",
    summary: "{orders} orders · reliability {score}",
    contactDetails: "Contact details",
    fullName: "Full name",
    email: "Email",
    phone: "Phone",
    phoneHint: "Set from the storefront / checkout — read-only here.",
    alternatePhone: "Alternate phone",
    marketingConsent: "Has consented to marketing",
    customerUpdated: "Customer updated.",
    blacklist: "Blacklist",
    isBlacklisted: "This customer is blacklisted.",
    isBlacklistedReason: "This customer is blacklisted — {reason}.",
    removeFromBlacklist: "Remove from blacklist",
    blacklistExplainer: "Blacklisting stops this customer from checking out.",
    blacklistCustomer: "Blacklist customer",
    blacklistConfirmTitle: "Blacklist this customer?",
    blacklistConfirmDescription: "They won't be able to check out until you remove them from the blacklist.",
    blacklistConfirm: "Blacklist",
    reason: "Reason",
    reasonPlaceholder: "Repeated failed deliveries",
    reasonRequired: "Enter a reason for blacklisting this customer.",
    blacklistedToast: "Customer blacklisted.",
    removedToast: "Customer removed from the blacklist.",
    removeConfirmTitle: "Remove from blacklist?",
    removeConfirmDescription: "The customer will be able to place orders again.",
    remove: "Remove",
    addresses: "Addresses",
    addAddress: "Add address",
    editAddress: "Edit address",
    saveAddress: "Save address",
    noAddresses: "No addresses on file.",
    listSeparator: ", ",
    default: "Default",
    country: "Country",
    countryHint: "Two-letter code.",
    province: "Province",
    city: "City",
    postalCode: "Postal code",
    addressLine: "Address line",
    notes: "Notes",
    defaultAddress: "Default address",
    addressSaved: "Address saved.",
    addressAdded: "Address added.",
  },
  ar: {
    customer: "العميل",
    customers: "العملاء",
    summary: "{orders} طلب · الموثوقية {score}",
    contactDetails: "بيانات التواصل",
    fullName: "الاسم بالكامل",
    email: "البريد الإلكتروني",
    phone: "الهاتف",
    phoneHint: "يُحدَّد من المتجر / صفحة الدفع — للقراءة فقط هنا.",
    alternatePhone: "هاتف بديل",
    marketingConsent: "وافق على استلام الرسائل التسويقية",
    customerUpdated: "تم تحديث بيانات العميل.",
    blacklist: "قائمة الحظر",
    isBlacklisted: "هذا العميل محظور.",
    isBlacklistedReason: "هذا العميل محظور — {reason}.",
    removeFromBlacklist: "إزالة من قائمة الحظر",
    blacklistExplainer: "حظر العميل يمنعه من إتمام الطلب.",
    blacklistCustomer: "حظر العميل",
    blacklistConfirmTitle: "حظر هذا العميل؟",
    blacklistConfirmDescription: "لن يتمكن من إتمام أي طلب حتى تزيله من قائمة الحظر.",
    blacklistConfirm: "حظر",
    reason: "السبب",
    reasonPlaceholder: "رفض الاستلام أكثر من مرة",
    reasonRequired: "اكتب سبب حظر هذا العميل.",
    blacklistedToast: "تم حظر العميل.",
    removedToast: "تمت إزالة العميل من قائمة الحظر.",
    removeConfirmTitle: "إزالة من قائمة الحظر؟",
    removeConfirmDescription: "سيتمكن العميل من تقديم الطلبات مرة أخرى.",
    remove: "إزالة",
    addresses: "العناوين",
    addAddress: "إضافة عنوان",
    editAddress: "تعديل العنوان",
    saveAddress: "حفظ العنوان",
    noAddresses: "لا توجد عناوين مسجّلة.",
    listSeparator: "، ",
    default: "افتراضي",
    country: "الدولة",
    countryHint: "رمز من حرفين (مثل EG).",
    province: "المحافظة",
    city: "المدينة",
    postalCode: "الرمز البريدي",
    addressLine: "العنوان بالتفصيل",
    notes: "ملاحظات",
    defaultAddress: "العنوان الافتراضي",
    addressSaved: "تم حفظ العنوان.",
    addressAdded: "تمت إضافة العنوان.",
  },
} satisfies Messages;

export function CustomerDetailPage() {
  const t = useT(STRINGS);
  const { customerId } = useParams<{ customerId: string }>();
  const workspaceId = useWorkspaceId();
  const detail = useAsync(
    () => apiClient.getCustomer(workspaceId, customerId as string),
    [workspaceId, customerId]
  );
  const customer = detail.data;
  const reload = () => detail.refresh({ silent: true });

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={
          customer
            ? customer.fullName || customer.phoneRaw || customer.phoneNormalized
            : t.customer
        }
        back={{ to: "/customers", label: t.customers }}
        description={
          customer
            ? fmt(t.summary, { orders: customer.totalOrders, score: customer.reliabilityScore })
            : undefined
        }
      />

      <DataState loading={detail.loading} error={detail.error} onRetry={() => detail.refresh()}>
        {customer && (
          <div className="space-y-6">
            <ContactForm customer={customer} onSaved={reload} />
            <BlacklistSection customer={customer} onChanged={reload} />
            <AddressesSection customer={customer} onChanged={reload} />
          </div>
        )}
      </DataState>
    </div>
  );
}

function ContactForm({ customer, onSaved }: { customer: Customer; onSaved: () => void }) {
  const t = useT(STRINGS);
  const c = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [fullName, setFullName] = useState(customer.fullName ?? "");
  const [email, setEmail] = useState(customer.email ?? "");
  const [alternatePhone, setAlternatePhone] = useState(customer.alternatePhone ?? "");
  const [marketingConsent, setMarketingConsent] = useState(customer.marketingConsent);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      await apiClient.updateCustomer(workspaceId, customer.id, {
        fullName: fullName.trim() || null,
        email: email.trim() || null,
        alternatePhone: alternatePhone.trim() || null,
        marketingConsent,
      });
      toast.success(t.customerUpdated);
      onSaved();
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-paper-raised p-5">
      <h2 className="font-display text-lg font-semibold text-ink">{t.contactDetails}</h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        {formError && <Alert variant="danger">{formError}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t.fullName}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={fieldErrors.fullName}
            dir="auto"
          />
          <TextField
            label={t.email}
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
          />
          <Field label={t.phone} hint={t.phoneHint}>
            {({ id }) => (
              <Input id={id} dir="ltr" value={customer.phoneRaw || customer.phoneNormalized} disabled />
            )}
          </Field>
          <TextField
            label={t.alternatePhone}
            type="tel"
            dir="ltr"
            value={alternatePhone}
            onChange={(e) => setAlternatePhone(e.target.value)}
            error={fieldErrors.alternatePhone}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            className="accent-primary"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
          />
          {t.marketingConsent}
        </label>
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? c.saving : c.save}
          </Button>
        </div>
      </form>
    </section>
  );
}

function BlacklistSection({
  customer,
  onChanged,
}: {
  customer: Customer;
  onChanged: () => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [blacklisting, setBlacklisting] = useState(false);
  const [unblacklisting, setUnblacklisting] = useState(false);
  const [reason, setReason] = useState("");

  async function confirmBlacklist() {
    if (reason.trim() === "") throw new Error(t.reasonRequired);
    await apiClient.setCustomerBlacklist(workspaceId, customer.id, {
      isBlacklisted: true,
      reason: reason.trim(),
    });
    toast.success(t.blacklistedToast);
    setBlacklisting(false);
    setReason("");
    onChanged();
  }

  async function confirmRemove() {
    await apiClient.setCustomerBlacklist(workspaceId, customer.id, { isBlacklisted: false });
    toast.success(t.removedToast);
    setUnblacklisting(false);
    onChanged();
  }

  return (
    <section className="rounded-2xl border border-line bg-paper-raised p-5">
      <h2 className="font-display text-lg font-semibold text-ink">{t.blacklist}</h2>
      {customer.isBlacklisted ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-ink-soft">
            {customer.blacklistReason
              ? fmt(t.isBlacklistedReason, { reason: customer.blacklistReason })
              : t.isBlacklisted}
          </p>
          <Button variant="outline" size="sm" onClick={() => setUnblacklisting(true)}>
            {t.removeFromBlacklist}
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-ink-soft">{t.blacklistExplainer}</p>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              setReason("");
              setBlacklisting(true);
            }}
          >
            {t.blacklistCustomer}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={blacklisting}
        title={t.blacklistConfirmTitle}
        description={t.blacklistConfirmDescription}
        confirmLabel={t.blacklistConfirm}
        destructive
        onCancel={() => setBlacklisting(false)}
        onConfirm={confirmBlacklist}
      >
        <Field label={t.reason} required>
          {({ id }) => (
            <Textarea
              id={id}
              dir="auto"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t.reasonPlaceholder}
            />
          )}
        </Field>
      </ConfirmDialog>

      <ConfirmDialog
        open={unblacklisting}
        title={t.removeConfirmTitle}
        description={t.removeConfirmDescription}
        confirmLabel={t.remove}
        onCancel={() => setUnblacklisting(false)}
        onConfirm={confirmRemove}
      />
    </section>
  );
}

function AddressesSection({
  customer,
  onChanged,
}: {
  customer: Customer;
  onChanged: () => void;
}) {
  const t = useT(STRINGS);
  const c = useCommon();
  const [target, setTarget] = useState<CustomerAddress | "new" | null>(null);
  const addresses = customer.addresses ?? [];

  return (
    <section className="rounded-2xl border border-line bg-paper-raised p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-semibold text-ink">{t.addresses}</h2>
        <Button size="sm" onClick={() => setTarget("new")}>
          {t.addAddress}
        </Button>
      </div>

      {addresses.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">{t.noAddresses}</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {addresses.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-line p-3"
            >
              <div className="min-w-0 text-sm">
                <p className="text-ink" dir="auto">
                  {[a.addressLine, a.city, a.province, a.postalCode, a.country]
                    .filter(Boolean)
                    .join(t.listSeparator)}
                </p>
                {a.notes && <p className="text-xs text-ink-soft" dir="auto">{a.notes}</p>}
                {a.isDefault && <p className="text-xs text-primary">{t.default}</p>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => setTarget(a)}>
                {c.edit}
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        title={target === "new" ? t.addAddress : t.editAddress}
      >
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
    </section>
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
  const c = useCommon();
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
        <TextField
          label={t.province}
          dir="auto"
          value={province}
          onChange={(e) => setProvince(e.target.value)}
          error={fieldErrors.province}
        />
        <TextField
          label={t.city}
          required
          dir="auto"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          error={fieldErrors.city}
        />
        <TextField
          label={t.postalCode}
          dir="ltr"
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
          error={fieldErrors.postalCode}
        />
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
        {({ id }) => (
          <Textarea id={id} dir="auto" value={notes} onChange={(e) => setNotes(e.target.value)} />
        )}
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          className="accent-primary"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
        />
        {t.defaultAddress}
      </label>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {c.cancel}
        </Button>
        <Button
          type="submit"
          disabled={saving || !country.trim() || !city.trim() || !addressLine.trim()}
        >
          {saving ? c.saving : address ? t.saveAddress : t.addAddress}
        </Button>
      </div>
    </form>
  );
}
