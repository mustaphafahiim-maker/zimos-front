import { useEffect, useId, useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import { contactsCreate } from "@store-builder/api-client";
import { TextField } from "@/components/Field";
import { IconUserAdd } from "@/components/icons";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { useCommon, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { CONTACT_STRINGS, contactErrorCode, parseTagInput } from "../contactStrings";
import { FormSheet } from "./FormSheet";

const STRINGS = {
  en: {
    add: "Add contact",
    addTitle: "Add a contact",
    addDescription: "A lead you met outside the store. They become a customer with their first order.",
    name: "Name",
    phone: "Phone",
    phoneHint: "The number you call them on. It is how the store knows them.",
    email: "Email",
    tags: "Tags",
    tagsHint: "Separate tags with commas.",
    consent: "They agreed to receive marketing messages",
    added: "Contact added.",
    openExisting: "Open that contact",
  },
  ar: {
    add: "إضافة جهة اتصال",
    addTitle: "إضافة جهة اتصال",
    addDescription: "عميل محتمل عرفته من برّه المتجر. هيبقى عميل مع أول أوردر.",
    name: "الاسم",
    phone: "الموبايل",
    phoneHint: "الرقم اللي بتكلّمه عليه. المتجر بيعرفه بيه.",
    email: "البريد الإلكتروني",
    tags: "الوسوم",
    tagsHint: "افصل بين الوسوم بفاصلة.",
    consent: "وافق إنه يستقبل رسايل تسويقية",
    added: "جهة الاتصال اتضافت.",
    openExisting: "افتح جهة الاتصال",
  },
} satisfies Messages;

const EMPTY = { fullName: "", phone: "", email: "", tags: "", consent: false };

/**
 * «إضافة جهة اتصال» — a lead met outside the store, added by hand (POST
 * /contacts): name, phone (the one field that must be there), email, tags and
 * whether they agreed to marketing. It opens as a sheet over the list and
 * never leaves it; a number the store already knows is answered with a link to
 * that contact instead of a second record.
 */
export function AddContactSheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const t = useT(STRINGS);
  const c = useT(CONTACT_STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; customerId?: string } | null>(null);

  useEffect(() => {
    if (open) {
      setForm(EMPTY);
      setError(null);
    }
  }, [open]);

  const dirty = form.fullName !== "" || form.phone !== "" || form.email !== "" || form.tags !== "" || form.consent;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await contactsCreate(apiClient, workspaceId, {
        phone: form.phone.trim(),
        fullName: form.fullName.trim() || undefined,
        email: form.email.trim() || undefined,
        marketingConsent: form.consent,
        tags: parseTagInput(form.tags),
      });
      toast.success(t.added);
      onAdded();
    } catch (err) {
      const code = contactErrorCode(err);
      if (code === "PHONE_TAKEN") {
        const details = (err as { details?: { customerId?: string } }).details;
        setError({ message: c.phoneTaken, customerId: details?.customerId });
      } else if (code === "INVALID_PHONE") setError({ message: c.invalidPhone });
      else setError({ message: errorMessage(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <FormSheet
      open={open}
      onClose={onClose}
      title={t.addTitle}
      description={t.addDescription}
      dirty={dirty}
      busy={busy}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={busy} onClick={onClose}>
            {common.cancel}
          </Button>
          <Button type="submit" form={formId} className="rounded-full px-5" disabled={busy || !form.phone.trim()}>
            <IconUserAdd className="size-4" weight="bold" aria-hidden />
            {busy ? common.saving : t.add}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4">
        {error && (
          <Alert variant="danger">
            {error.message}{" "}
            {error.customerId && (
              <ViewLink to={`/customers/${error.customerId}`} className="font-medium underline underline-offset-4">
                {t.openExisting}
              </ViewLink>
            )}
          </Alert>
        )}
        {/* The phone first: it is the one thing a contact cannot do without. */}
        <TextField
          label={t.phone}
          hint={t.phoneHint}
          required
          type="tel"
          dir="ltr"
          inputMode="tel"
          autoComplete="off"
          value={form.phone}
          onChange={(e) => setForm({ ...form, phone: e.target.value })}
          maxLength={32}
        />
        <TextField label={t.name} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} maxLength={200} />
        <TextField label={t.email} type="email" dir="ltr" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} maxLength={255} />
        <TextField label={t.tags} hint={t.tagsHint} value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} />
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
          <input
            type="checkbox"
            className="size-5 shrink-0 cursor-pointer accent-primary"
            checked={form.consent}
            onChange={(e) => setForm({ ...form, consent: e.target.checked })}
          />
          {t.consent}
        </label>
      </form>
    </FormSheet>
  );
}
