import { useEffect, useId, useState, type FormEvent } from "react";
import { Alert, Button, Input, cn } from "@store-builder/ui";
import { STOCK_FORECAST_LIMITS, stockForecastSaveSettings, type StockForecastSettings } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { parseWholeNumber } from "@/lib/wholeNumber";
import { fmt, useT } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { FORECAST_SETTING_KEY, FORECAST_STRINGS } from "./forecastStrings";

const FIELDS = ["windowDays", "leadTimeDays", "coverDays", "safetyDays"] as const;
type FieldKey = (typeof FIELDS)[number];
type Draft = Record<FieldKey, string>;

const draftOf = (settings: StockForecastSettings): Draft => ({
  windowDays: String(settings.windowDays),
  leadTimeDays: String(settings.leadTimeDays),
  coverDays: String(settings.coverDays),
  safetyDays: String(settings.safetyDays),
});

/**
 * The forecast's four numbers (PUT /stock-forecast/settings): the days of
 * sales it averages, the supplier's lead time, the days an order should cover
 * and the safety margin. Each is a sentence with its number field where the
 * handoff's wording has the gap.
 */
export function ForecastSettingsDialog({
  open,
  settings,
  onClose,
  onSaved,
}: {
  open: boolean;
  settings: StockForecastSettings;
  onClose: () => void;
  onSaved: (saved: StockForecastSettings) => void;
}) {
  const t = useT(FORECAST_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const [draft, setDraft] = useState<Draft>(() => draftOf(settings));
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Each opening starts from what is saved.
  useEffect(() => {
    if (!open) return;
    setDraft(draftOf(settings));
    setErrors({});
    setFailure(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const found: Partial<Record<FieldKey, string>> = {};
    const values = {} as StockForecastSettings;
    for (const key of FIELDS) {
      const { min, max } = STOCK_FORECAST_LIMITS[key];
      const value = parseWholeNumber(draft[key], min, max);
      if (value === null || Number.isNaN(value)) found[key] = fmt(t.rangeError, { min, max });
      else values[key] = value;
    }
    setErrors(found);
    const first = FIELDS.find((key) => found[key]);
    if (first) {
      document.getElementById(`${formId}-${first}`)?.focus();
      return;
    }
    setSaving(true);
    setFailure(null);
    try {
      onSaved(await stockForecastSaveSettings(apiClient, workspaceId, values));
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
      title={t.settingsTitle}
      description={t.settingsDescription}
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
        {FIELDS.map((key) => {
          const { min, max } = STOCK_FORECAST_LIMITS[key];
          // The sentence around its number: "Sales over the last [30] days". Without a gap, the field ends it.
          const [before, after = ""] = t[FORECAST_SETTING_KEY[key]].split("{n}");
          const id = `${formId}-${key}`;
          const hintId = `${id}-hint`;
          const error = errors[key];
          return (
            <div key={key}>
              <label htmlFor={id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-ink">
                <span>{before.trim()}</span>
                <Input
                  id={id}
                  inputMode="numeric"
                  dir="ltr"
                  autoComplete="off"
                  maxLength={3}
                  value={draft[key]}
                  disabled={saving}
                  aria-invalid={error ? true : undefined}
                  aria-describedby={hintId}
                  onChange={(e) => {
                    setDraft((d) => ({ ...d, [key]: e.target.value }));
                    if (error) setErrors((prev) => ({ ...prev, [key]: undefined }));
                  }}
                  className={cn("h-11 w-20 text-center tabular-nums", error && "border-danger focus-visible:ring-danger/30")}
                />
                {after.trim() && <span>{after.trim()}</span>}
              </label>
              <p id={hintId} className={error ? "mt-1 text-xs font-medium text-danger" : "mt-1 text-xs text-ink-soft"}>
                {error ?? fmt(t.rangeHint, { min, max })}
              </p>
            </div>
          );
        })}
        {failure && <Alert variant="danger">{failure}</Alert>}
      </form>
    </Modal>
  );
}
