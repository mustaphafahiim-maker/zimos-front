import { useEffect, useId, useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import { stockLocationCreate, stockLocationUpdate, type StockLocation } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { getFieldErrors } from "@/lib/errors";
import { numberField, parseWholeNumber } from "@/lib/wholeNumber";
import { useT } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { Field, TextField } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { INVENTORY_STRINGS } from "./inventoryStrings";

type Errors = Partial<Record<"name" | "address" | "priority", string>>;

/**
 * Add or edit a stock location (POST / PATCH /stock-locations): its name, an
 * optional address and its shipping priority. A second location on a plan
 * without multiple warehouses is refused with the plan's own sentence.
 */
export function LocationDialog({
  open,
  location,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** The location being edited; null to add one. */
  location: StockLocation | null;
  onClose: () => void;
  onSaved: (saved: StockLocation, created: boolean) => void;
}) {
  const t = useT(INVENTORY_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [priority, setPriority] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Each opening starts from the location as it is saved.
  useEffect(() => {
    if (!open) return;
    setName(location?.name ?? "");
    setAddress(location?.address ?? "");
    setPriority(numberField(location?.priority ?? 0));
    setErrors({});
    setFailure(null);
  }, [open, location]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const order = parseWholeNumber(priority, 0, 1000);
    const found: Errors = {};
    if (!name.trim()) found.name = t.nameError;
    if (order !== null && Number.isNaN(order)) found.priority = t.priorityError;
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = (["name", "priority"] as const).find((k) => found[k]);
      document.querySelector<HTMLElement>(`#${CSS.escape(formId)} [data-field="${first}"] input`)?.focus();
      return;
    }
    setSaving(true);
    setFailure(null);
    const body = { name: name.trim(), address: address.trim() || null, priority: order ?? 0 };
    try {
      const saved = location
        ? await stockLocationUpdate(apiClient, workspaceId, location.id, body)
        : await stockLocationCreate(apiClient, workspaceId, body);
      onSaved(saved, !location);
    } catch (err) {
      const fields = getFieldErrors(err);
      const known: Errors = { name: fields.name, address: fields.address, priority: fields.priority };
      if (known.name || known.address || known.priority) setErrors(known);
      // The plan's refusal is a 403 with its own code: it is not a missing permission.
      else setFailure(errorMessage(err, { FEATURE_NOT_IN_PLAN: t.planRefused, TOO_MANY_LOCATIONS: t.tooMany }));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={location ? t.editTitle : t.addTitle}
      description={t.dialogDescription}
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
            label={t.name}
            required
            dir="auto"
            autoComplete="off"
            maxLength={120}
            placeholder={t.namePlaceholder}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            error={errors.name}
          />
        </div>
        <Field label={t.address} error={errors.address}>
          {(props) => <Textarea {...props} rows={2} dir="auto" maxLength={300} value={address} onChange={(e) => setAddress(e.target.value)} />}
        </Field>
        <div data-field="priority">
          <TextField
            label={t.priority}
            hint={t.priorityHint}
            inputMode="numeric"
            dir="ltr"
            autoComplete="off"
            maxLength={4}
            value={priority}
            onChange={(e) => {
              setPriority(e.target.value);
              if (errors.priority) setErrors((prev) => ({ ...prev, priority: undefined }));
            }}
            error={errors.priority}
          />
        </div>
        {failure && <Alert variant="danger">{failure}</Alert>}
      </form>
    </Modal>
  );
}
