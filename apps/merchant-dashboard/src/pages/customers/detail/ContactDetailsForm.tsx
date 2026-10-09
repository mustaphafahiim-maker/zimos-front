import { useState, type FormEvent } from "react";
import { Alert, Button, Input } from "@store-builder/ui";
import type { Customer } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { Field, TextField } from "@/components/Field";
import { useToast } from "@/components/Toast";
import { useCommon, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    fullName: "Full name",
    email: "Email",
    phone: "Phone",
    phoneHint: "Set from the storefront / checkout — read-only here.",
    alternatePhone: "Alternate phone",
    marketingConsent: "Has consented to marketing",
    customerUpdated: "Customer updated.",
    discard: "Discard",
  },
  ar: {
    fullName: "الاسم بالكامل",
    email: "الإيميل",
    phone: "رقم الموبايل",
    phoneHint: "بييجي من المتجر وقت الأوردر، ومش بيتعدّل من هنا.",
    alternatePhone: "رقم تاني",
    marketingConsent: "موافق يوصله رسايل تسويقية",
    customerUpdated: "بيانات العميل اتحدّثت.",
    discard: "تجاهل",
  },
} satisfies Messages;

/**
 * «بيانات التواصل»: the customer's name, email, second number and whether
 * they accept marketing messages. The phone they ordered with is shown and
 * cannot be changed here. Saving sends the four fields as before
 * (PATCH /customers/:id); the button is there once something changed, and the
 * page is told so a reload asks first.
 */
export function ContactDetailsForm({ customer, onSaved }: { customer: Customer; onSaved: () => void }) {
  const t = useT(STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [fullName, setFullName] = useState(customer.fullName ?? "");
  const [email, setEmail] = useState(customer.email ?? "");
  const [alternatePhone, setAlternatePhone] = useState(customer.alternatePhone ?? "");
  const [marketingConsent, setMarketingConsent] = useState(customer.marketingConsent);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const dirty =
    fullName.trim() !== (customer.fullName ?? "").trim() ||
    email.trim() !== (customer.email ?? "").trim() ||
    alternatePhone.trim() !== (customer.alternatePhone ?? "").trim() ||
    marketingConsent !== customer.marketingConsent;
  useReportDirty(dirty);

  function discard() {
    setFullName(customer.fullName ?? "");
    setEmail(customer.email ?? "");
    setAlternatePhone(customer.alternatePhone ?? "");
    setMarketingConsent(customer.marketingConsent);
    setFormError(null);
    setFieldErrors({});
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || !dirty) return;
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
    <form onSubmit={submit} className="@container space-y-4">
      {formError && <Alert variant="danger">{formError}</Alert>}
      <div className="grid gap-4 @md:grid-cols-2">
        <TextField label={t.fullName} dir="auto" value={fullName} disabled={saving} onChange={(e) => setFullName(e.target.value)} error={fieldErrors.fullName} />
        <TextField label={t.email} type="email" dir="ltr" value={email} disabled={saving} onChange={(e) => setEmail(e.target.value)} error={fieldErrors.email} />
        <Field label={t.phone} hint={t.phoneHint}>
          {({ id }) => <Input id={id} dir="ltr" value={customer.phoneRaw || customer.phoneNormalized} disabled />}
        </Field>
        <TextField
          label={t.alternatePhone}
          type="tel"
          dir="ltr"
          value={alternatePhone}
          disabled={saving}
          onChange={(e) => setAlternatePhone(e.target.value)}
          error={fieldErrors.alternatePhone}
        />
      </div>
      <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-sm text-ink">
        <input
          type="checkbox"
          className="size-4 shrink-0 cursor-pointer accent-primary"
          checked={marketingConsent}
          disabled={saving}
          onChange={(e) => setMarketingConsent(e.target.checked)}
        />
        {t.marketingConsent}
      </label>
      {/* There once something changed — the same way the pay-later and company forms of this page show theirs. */}
      {(dirty || saving) && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="outline" className="min-h-11 rounded-full px-5" disabled={saving} onClick={discard}>
            {t.discard}
          </Button>
          <Button type="submit" className="min-h-11 rounded-full px-5" disabled={saving}>
            {saving ? common.saving : common.save}
          </Button>
        </div>
      )}
    </form>
  );
}
