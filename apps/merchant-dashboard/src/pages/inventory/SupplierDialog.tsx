import { useEffect, useId, useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import { supplierCreate, supplierUpdate, type Supplier } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { getFieldErrors } from "@/lib/errors";
import { useT } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { Field, TextField } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { PURCHASING_STRINGS } from "./purchasingStrings";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Draft {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

const draftOf = (supplier: Supplier | null): Draft => ({
  name: supplier?.name ?? "",
  contactName: supplier?.contactName ?? "",
  phone: supplier?.phone ?? "",
  email: supplier?.email ?? "",
  address: supplier?.address ?? "",
  notes: supplier?.notes ?? "",
});

type Errors = Partial<Record<keyof Draft, string>>;

/** Add or edit a supplier (POST / PATCH /purchasing/suppliers): a name, and how to reach them. */
export function SupplierDialog({
  open,
  supplier,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** The supplier being edited; null to add one. */
  supplier: Supplier | null;
  onClose: () => void;
  onSaved: (saved: Supplier, created: boolean) => void;
}) {
  const t = useT(PURCHASING_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const [draft, setDraft] = useState<Draft>(() => draftOf(supplier));
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Each opening starts from the supplier as it is saved.
  useEffect(() => {
    if (!open) return;
    setDraft(draftOf(supplier));
    setErrors({});
    setFailure(null);
  }, [open, supplier]);

  const set = <K extends keyof Draft>(key: K, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const email = draft.email.trim();
    const found: Errors = {};
    if (!draft.name.trim()) found.name = t.supplierNameError;
    if (email && !EMAIL_RE.test(email)) found.email = t.emailError;
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = (["name", "email"] as const).find((k) => found[k]);
      document.querySelector<HTMLElement>(`#${CSS.escape(formId)} [data-field="${first}"] input`)?.focus();
      return;
    }
    setSaving(true);
    setFailure(null);
    const body = {
      name: draft.name.trim(),
      contactName: draft.contactName.trim() || null,
      phone: draft.phone.trim() || null,
      email: email || null,
      address: draft.address.trim() || null,
      notes: draft.notes.trim() || null,
    };
    try {
      const saved = supplier ? await supplierUpdate(apiClient, workspaceId, supplier.id, body) : await supplierCreate(apiClient, workspaceId, body);
      onSaved(saved, !supplier);
    } catch (err) {
      const fields = getFieldErrors(err);
      // The API checks the email more strictly than the form does (a made-up ending is refused): same sentence.
      const known: Errors = { name: fields.name, email: fields.email ? t.emailError : undefined, phone: fields.phone };
      if (known.name || known.email || known.phone) setErrors(known);
      else setFailure(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={supplier ? t.supplierEditTitle : t.supplierAddTitle}
      description={t.supplierDialogDescription}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={saving} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="rounded-full px-5" disabled={saving}>
            {saving ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <div data-field="name">
          <TextField
            label={t.supplierName}
            required
            dir="auto"
            autoComplete="off"
            maxLength={160}
            value={draft.name}
            onChange={(e) => set("name", e.target.value)}
            error={errors.name}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t.contactName}
            dir="auto"
            autoComplete="off"
            maxLength={120}
            value={draft.contactName}
            onChange={(e) => set("contactName", e.target.value)}
          />
          <TextField
            label={t.phone}
            type="tel"
            dir="ltr"
            autoComplete="off"
            maxLength={40}
            value={draft.phone}
            onChange={(e) => set("phone", e.target.value)}
            error={errors.phone}
          />
        </div>
        <div data-field="email">
          <TextField
            label={t.email}
            type="email"
            dir="ltr"
            autoComplete="off"
            maxLength={255}
            value={draft.email}
            onChange={(e) => set("email", e.target.value)}
            error={errors.email}
          />
        </div>
        <Field label={t.supplierAddress}>
          {(props) => (
            <Textarea {...props} rows={2} dir="auto" maxLength={300} value={draft.address} onChange={(e) => set("address", e.target.value)} />
          )}
        </Field>
        <Field label={t.supplierNotes} hint={t.supplierNotesHint}>
          {(props) => (
            <Textarea {...props} rows={3} dir="auto" maxLength={5000} value={draft.notes} onChange={(e) => set("notes", e.target.value)} />
          )}
        </Field>
        {failure && <Alert variant="danger">{failure}</Alert>}
      </form>
    </Modal>
  );
}
