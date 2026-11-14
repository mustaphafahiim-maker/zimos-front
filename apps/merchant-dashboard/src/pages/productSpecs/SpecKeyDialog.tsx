import { useEffect, useId, useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import { SPEC_LIMITS, specKeyCreate, specKeyUpdate, type SpecKey, type SpecKeyInput } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { TextField } from "@/components/Field";
import { SPEC_STRINGS } from "./specStrings";

/**
 * Add or edit one specification (POST / PUT /product-specs/keys): its name in
 * Arabic and English — one is enough — an optional unit, and whether shoppers
 * can filter the store by it. A new one is placed last (`nextPosition`); the
 * order is changed with the arrows in the list.
 */
export function SpecKeyDialog({
  open,
  specKey,
  nextPosition,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** The specification being edited; null for a new one. */
  specKey: SpecKey | null;
  /** Where a new specification goes: after the last one. */
  nextPosition: number;
  onClose: () => void;
  onSaved: (saved: SpecKey, created: boolean) => void;
}) {
  const t = useT(SPEC_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const hintId = useId();
  const [ar, setAr] = useState("");
  const [en, setEn] = useState("");
  const [unit, setUnit] = useState("");
  const [filterable, setFilterable] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAr(specKey?.name.ar ?? "");
    setEn(specKey?.name.en ?? "");
    setUnit(specKey?.unit ?? "");
    setFilterable(specKey?.filterable ?? false);
    setNameError(null);
    setFailure(null);
  }, [open, specKey]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const name = { ...(ar.trim() ? { ar: ar.trim() } : {}), ...(en.trim() ? { en: en.trim() } : {}) };
    if (!name.ar && !name.en) {
      setNameError(t.nameRequired);
      return;
    }
    const body: SpecKeyInput = { name, unit: unit.trim() || null, filterable, position: specKey?.position ?? nextPosition };
    setSaving(true);
    setFailure(null);
    try {
      const saved = specKey ? await specKeyUpdate(apiClient, workspaceId, specKey.id, body) : await specKeyCreate(apiClient, workspaceId, body);
      onSaved(saved, !specKey);
    } catch (err) {
      setFailure(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={specKey ? t.editTitle : t.addTitle}
      footer={
        <>
          <Button type="button" variant="outline" className="min-h-11 rounded-full px-5" disabled={saving} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="min-h-11 rounded-full px-5" disabled={saving}>
            {saving ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t.nameAr}
            dir="rtl"
            lang="ar"
            autoComplete="off"
            maxLength={SPEC_LIMITS.name}
            value={ar}
            disabled={saving}
            error={nameError ?? undefined}
            aria-describedby={hintId}
            onChange={(e) => {
              setAr(e.target.value);
              setNameError(null);
            }}
          />
          <TextField
            label={t.nameEn}
            dir="ltr"
            lang="en"
            autoComplete="off"
            maxLength={SPEC_LIMITS.name}
            value={en}
            disabled={saving}
            aria-describedby={hintId}
            onChange={(e) => {
              setEn(e.target.value);
              setNameError(null);
            }}
          />
        </div>
        <p id={hintId} className="-mt-2 text-xs text-ink-soft">
          {t.nameHint}
        </p>
        <TextField
          label={t.unit}
          hint={t.unitHint}
          dir="auto"
          autoComplete="off"
          maxLength={SPEC_LIMITS.unit}
          placeholder={t.unitPlaceholder}
          value={unit}
          disabled={saving}
          onChange={(e) => setUnit(e.target.value)}
          className="max-w-[12rem] [&_input]:h-11"
        />
        <div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink">
            <input
              type="checkbox"
              className="size-5 shrink-0 cursor-pointer accent-primary"
              checked={filterable}
              disabled={saving}
              onChange={(e) => setFilterable(e.target.checked)}
            />
            {t.filterable}
          </label>
          <p className="text-xs text-ink-soft">{t.filterableHint}</p>
        </div>
        {failure && <Alert variant="danger">{failure}</Alert>}
      </form>
    </Modal>
  );
}
