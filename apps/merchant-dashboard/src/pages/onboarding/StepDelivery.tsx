import { useEffect, useRef, useState, type FormEvent } from "react";
import { HandCoins } from "lucide-react";
import { Alert, cn } from "@store-builder/ui";
import { apiClient } from "@/lib/apiClient";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { MoneyInput } from "@/components/MoneyInput";
import { formatNumber, majorToMinor, minorToMajorInput } from "@/lib/format";
import { GOVERNORATES, regionLabel } from "./data";
import type { StepProps } from "./state";
import { STRINGS } from "./strings";

export function StepDelivery({ state, next, update, setSaving, saving, formId }: StepProps) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const { workspaces } = useWorkspace();
  const workspaceId = state.workspaceId!;
  const currency =
    state.basics?.currency ?? workspaces.find((w) => w.id === workspaceId)?.defaultCurrency ?? "EGP";

  const [selected, setSelected] = useState<string[]>(state.delivery?.regionCodes ?? []);
  const [fee, setFee] = useState(state.delivery ? minorToMajorInput(state.delivery.feeMinor) : "");
  const [cod, setCod] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const allRef = useRef<HTMLInputElement>(null);

  const total = GOVERNORATES.length;
  const allSelected = selected.length === total;
  useEffect(() => {
    if (allRef.current) allRef.current.indeterminate = selected.length > 0 && !allSelected;
  }, [selected, allSelected]);

  const toggle = (code: string) =>
    setSelected((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setErrors({});
    setFormError(null);

    const feeMinor = majorToMinor(fee);
    const errs: Record<string, string> = {};
    if (selected.length === 0) errs.regions = t.pickGovernorate;
    if (!Number.isFinite(feeMinor) || feeMinor < 0) errs.fee = t.feeInvalid;
    if (Object.keys(errs).length) {
      setErrors(errs);
      return;
    }

    // Every governorate selected → a country-wide zone (empty regions matches
    // any province, including spellings outside our list).
    const regions = allSelected ? [] : GOVERNORATES.filter((g) => selected.includes(g.code)).map((g) => regionLabel(g.code));
    const zonePayload = { name: t.zoneName, countries: ["EG"], regions, isActive: true };
    const ratePayload = { name: t.rateName, rateType: "flat" as const, config: { amount: feeMinor }, isActive: true };

    setSaving(true);
    let stage: "zone" | "rate" = "zone";
    try {
      let zoneId = state.delivery?.zoneId;
      if (zoneId) {
        await apiClient.updateShippingZone(workspaceId, zoneId, zonePayload);
      } else {
        zoneId = (await apiClient.createShippingZone(workspaceId, zonePayload)).id;
        update({ delivery: { zoneId, regionCodes: selected, feeMinor } });
      }
      stage = "rate";
      let rateId = state.delivery?.rateId;
      if (rateId) {
        await apiClient.updateShippingRate(workspaceId, rateId, ratePayload);
      } else {
        rateId = (await apiClient.createShippingRate(workspaceId, zoneId, ratePayload)).id;
      }
      next({ delivery: { zoneId, rateId, regionCodes: selected, feeMinor } });
    } catch (err) {
      const fe = getFieldErrors(err);
      if (stage === "zone" && (fe.regions || fe.countries)) setErrors({ regions: fe.regions ?? fe.countries });
      else if (stage === "rate" && (fe.config || fe.amount)) setErrors({ fee: fe.config ?? fe.amount });
      else setFormError(getErrorMessage(err, t.deliveryError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form id={formId} onSubmit={handleSubmit} noValidate className="space-y-6">
      {formError && <Alert variant="danger">{formError}</Alert>}

      <fieldset aria-describedby={errors.regions ? "onb-regions-error" : undefined}>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <legend className="text-sm font-medium text-ink">
            {t.governorates}
            <span className="text-danger" aria-hidden>
              {" "}
              *
            </span>
          </legend>
          <span className="tabular text-xs text-ink-muted" aria-live="polite">
            {fmt(t.selectedCount, { n: formatNumber(selected.length), total: formatNumber(total) })}
          </span>
        </div>
        <label className="mb-2 inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-ink">
          <input
            ref={allRef}
            type="checkbox"
            className="size-4 accent-[var(--color-primary,#1D4ED8)]"
            checked={allSelected}
            onChange={() => setSelected(allSelected ? [] : GOVERNORATES.map((g) => g.code))}
          />
          {t.selectAll}
        </label>
        <div
          className={cn(
            "grid grid-cols-1 gap-1.5 rounded-2xl border bg-paper-raised p-2 min-[400px]:grid-cols-2 md:grid-cols-3",
            errors.regions ? "border-danger" : "border-line"
          )}
        >
          {GOVERNORATES.map((g) => {
            const checked = selected.includes(g.code);
            return (
              <label
                key={g.code}
                className={cn(
                  "flex min-h-10 cursor-pointer items-center gap-2 rounded-[10px] px-2.5 py-1.5 text-sm transition-colors",
                  checked ? "bg-primary-soft text-ink" : "text-ink-soft hover:bg-paper"
                )}
              >
                <input
                  type="checkbox"
                  className="size-4 shrink-0 accent-[var(--color-primary,#1D4ED8)]"
                  checked={checked}
                  onChange={() => toggle(g.code)}
                />
                <span lang={locale}>{g[locale]}</span>
              </label>
            );
          })}
        </div>
        {errors.regions && (
          <p id="onb-regions-error" className="mt-1.5 text-xs font-medium text-danger">
            {errors.regions}
          </p>
        )}
      </fieldset>

      <MoneyInput
        label={t.fee}
        required
        currency={currency}
        value={fee}
        onChange={setFee}
        error={errors.fee}
        hint={t.feeHint}
        className="max-w-xs"
      />

      <div className="flex items-start gap-3 rounded-2xl border border-line bg-paper-raised p-4">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary-soft text-primary">
          <HandCoins className="size-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <span id="onb-cod-label" className="text-sm font-semibold text-ink">
              {t.cod}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={cod}
              aria-labelledby="onb-cod-label"
              aria-describedby="onb-cod-note"
              onClick={() => setCod((v) => !v)}
              className={cn(
                "relative h-6 w-11 shrink-0 cursor-pointer rounded-full transition-colors",
                cod ? "bg-primary" : "bg-line-strong"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-5 rounded-full bg-white shadow transition-[inset-inline-start]",
                  cod ? "start-[22px]" : "start-0.5"
                )}
              />
            </button>
          </div>
          <p id="onb-cod-note" className="mt-1 text-xs text-ink-muted">
            {t.codNote}
          </p>
        </div>
      </div>
    </form>
  );
}
