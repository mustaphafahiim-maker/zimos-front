import { useState, type FormEvent } from "react";
import { Alert, Button, Input, cn } from "@store-builder/ui";
import type { ShippingRate, ShippingRateType, ShippingZone } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { formatMoney, majorToMinor, minorToMajorInput } from "@/lib/format";
import { IconDelete, IconEdit, IconGlobe, IconPlus } from "@/components/icons";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/list";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField, Field } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { fmt, useT } from "@/i18n/LocaleContext";
import { LIST_CARD, MiniSwitch, RowIconButton } from "./RowControls";
import { STRINGS, type Strings } from "./strings";

const RATE_TYPE_LABEL: Record<ShippingRateType, keyof Strings> = {
  flat: "rateTypeFlat",
  weight_based: "rateTypeWeight",
  quantity_based: "rateTypeQuantity",
  order_value_based: "rateTypeOrderValue",
  free: "rateTypeFree",
};

/** Reads a JSONB config number that may arrive as a number or a BIGINT string. */
function numOrUndef(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

function rateSummary(r: ShippingRate, tr: Strings): string {
  const cfg = r.config ?? {};
  switch (r.rateType) {
    case "flat":
      return formatMoney(numOrUndef(cfg.amount));
    case "free":
      return tr.noCharge;
    default: {
      const tiers = Array.isArray(cfg.tiers) ? cfg.tiers : [];
      return fmt(tiers.length === 1 ? tr.tierCountOne : tr.tierCountMany, { count: tiers.length });
    }
  }
}

/** "2–5 days" / "3 days" / "from 2 days" / "up to 5 days" / "—". */
function rateDeliveryLabel(r: ShippingRate, tr: Strings): string {
  const min = r.estimatedDeliveryMinDays;
  const max = r.estimatedDeliveryMaxDays;
  const unit = (n: number) => fmt(n === 1 ? tr.dayOne : tr.dayMany, { n });
  if (min != null && max != null) return min === max ? unit(min) : fmt(tr.dayRange, { min, max });
  if (min != null) return fmt(tr.daysFrom, { days: unit(min) });
  if (max != null) return fmt(tr.daysUpTo, { days: unit(max) });
  return "—";
}

/**
 * Parse an optional whole-day field. "" → null (clear / leave unset), a valid
 * 0–3650 integer → that number, anything else → "invalid". Mirrors the backend
 * Joi rule `number().integer().min(0).max(3650).allow(null)`.
 */
function parseDays(input: string): number | null | "invalid" {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0 || n > 3650) return "invalid";
  return n;
}

/**
 * Shipping zones and the rates inside each: one card per zone, its rates as
 * rows under it (no table to scroll sideways on a phone). Turning a zone or a
 * rate on and off happens at once, with Undo; adding, editing and deleting
 * open in a sheet, exactly the forms the page always had.
 */
export function ZonesSection() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const tr = useT(STRINGS);
  const zones = useAsync(() => apiClient.listShippingZones(workspaceId), [workspaceId]);

  const [zoneForm, setZoneForm] = useState<ShippingZone | "new" | null>(null);
  const [deletingZone, setDeletingZone] = useState<ShippingZone | null>(null);
  const [rateForm, setRateForm] = useState<{ zoneId: string; rate?: ShippingRate } | null>(null);
  const [deletingRate, setDeletingRate] = useState<ShippingRate | null>(null);

  const reloadZones = () => zones.refresh({ silent: true });
  const zoneList = zones.data ?? [];

  async function setZoneActive(zone: ShippingZone, isActive: boolean, undoable: boolean) {
    try {
      await apiClient.updateShippingZone(workspaceId, zone.id, { isActive });
      const message = fmt(isActive ? tr.activated : tr.deactivated, { name: zone.name });
      if (undoable) {
        toast.undo(message, async () => {
          await apiClient.updateShippingZone(workspaceId, zone.id, { isActive: !isActive });
          await reloadZones();
        });
      } else {
        toast.success(message);
      }
      void reloadZones();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function setRateActive(rate: ShippingRate, isActive: boolean) {
    try {
      await apiClient.updateShippingRate(workspaceId, rate.id, { isActive });
      toast.undo(fmt(isActive ? tr.activated : tr.deactivated, { name: rate.name }), async () => {
        await apiClient.updateShippingRate(workspaceId, rate.id, { isActive: !isActive });
        await reloadZones();
      });
      void reloadZones();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function confirmDeleteZone() {
    if (!deletingZone) return;
    await apiClient.deleteShippingZone(workspaceId, deletingZone.id);
    toast.success(fmt(tr.deleted, { name: deletingZone.name }));
    setDeletingZone(null);
    void reloadZones();
  }

  async function confirmDeleteRate() {
    if (!deletingRate) return;
    await apiClient.deleteShippingRate(workspaceId, deletingRate.id);
    toast.success(tr.rateDeleted);
    setDeletingRate(null);
    void reloadZones();
  }

  return (
    <div className="flex min-w-0 flex-col gap-[var(--bento-gap)]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <p className="min-w-0 flex-[1_1_14rem] text-sm leading-6 text-ink-soft">{tr.zonesIntro}</p>
        {zoneList.length > 0 && (
          <Button className="min-h-11 rounded-full px-4" onClick={() => setZoneForm("new")}>
            <IconPlus weight="bold" aria-hidden />
            {tr.addZone}
          </Button>
        )}
      </div>

      <DataState
        loading={zones.loading}
        error={zones.error}
        onRetry={() => zones.refresh()}
        skeleton={<ListSkeleton rows={4} variant="card" />}
      >
        {zoneList.length === 0 ? (
          <EmptyState
            icon={<IconGlobe aria-hidden />}
            title={tr.zonesEmptyTitle}
            description={tr.zonesEmpty}
            action={
              <Button className="min-h-11 rounded-full px-5" onClick={() => setZoneForm("new")}>
                <IconPlus weight="bold" aria-hidden />
                {tr.addZone}
              </Button>
            }
          />
        ) : (
          <div className="flex flex-col gap-[var(--bento-gap)]">
            {zoneList.map((zone) => (
              <ZoneCard
                key={zone.id}
                zone={zone}
                onEditZone={() => setZoneForm(zone)}
                onDeleteZone={() => setDeletingZone(zone)}
                onToggleZone={(next) => void setZoneActive(zone, next, true)}
                onAddRate={() => setRateForm({ zoneId: zone.id })}
                onEditRate={(rate) => setRateForm({ zoneId: zone.id, rate })}
                onDeleteRate={(rate) => setDeletingRate(rate)}
                onToggleRate={(rate, next) => void setRateActive(rate, next)}
              />
            ))}
          </div>
        )}
      </DataState>

      <Modal open={zoneForm !== null} onClose={() => setZoneForm(null)} title={zoneForm === "new" ? tr.addZone : tr.editZone}>
        {zoneForm !== null && (
          <ZoneForm
            key={zoneForm === "new" ? "new" : zoneForm.id}
            zone={zoneForm === "new" ? undefined : zoneForm}
            onCancel={() => setZoneForm(null)}
            onDone={() => {
              setZoneForm(null);
              void reloadZones();
            }}
          />
        )}
      </Modal>

      <Modal open={rateForm !== null} onClose={() => setRateForm(null)} title={rateForm?.rate ? tr.editRate : tr.addRate}>
        {rateForm !== null && (
          <RateForm
            key={rateForm.rate ? rateForm.rate.id : `new-${rateForm.zoneId}`}
            zoneId={rateForm.zoneId}
            rate={rateForm.rate}
            onCancel={() => setRateForm(null)}
            onDone={() => {
              setRateForm(null);
              void reloadZones();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deletingZone !== null}
        title={fmt(tr.deleteTitle, { name: deletingZone?.name ?? "" })}
        description={tr.deleteZoneBody}
        confirmLabel={tr.deleteZoneConfirm}
        cancelLabel={tr.cancel}
        busyLabel={tr.working}
        destructive
        onCancel={() => setDeletingZone(null)}
        onConfirm={confirmDeleteZone}
      />

      <ConfirmDialog
        open={deletingRate !== null}
        title={fmt(tr.deleteTitle, { name: deletingRate?.name ?? "" })}
        description={tr.deleteRateBody}
        confirmLabel={tr.deleteRateConfirm}
        cancelLabel={tr.cancel}
        busyLabel={tr.working}
        destructive
        onCancel={() => setDeletingRate(null)}
        onConfirm={confirmDeleteRate}
      />
    </div>
  );
}

function ZoneCard({
  zone,
  onEditZone,
  onDeleteZone,
  onToggleZone,
  onAddRate,
  onEditRate,
  onDeleteRate,
  onToggleRate,
}: {
  zone: ShippingZone;
  onEditZone: () => void;
  onDeleteZone: () => void;
  onToggleZone: (next: boolean) => void;
  onAddRate: () => void;
  onEditRate: (rate: ShippingRate) => void;
  onDeleteRate: (rate: ShippingRate) => void;
  onToggleRate: (rate: ShippingRate, next: boolean) => void;
}) {
  const tr = useT(STRINGS);
  const rates = zone.rates ?? [];
  return (
    <section data-slot="card" className={LIST_CARD}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 py-2 ps-4 pe-2">
        <div className={cn("min-w-0 flex-[1_1_10rem] py-1", !zone.isActive && "opacity-60")}>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="min-w-0 truncate text-[15px] leading-6 font-semibold text-ink">{zone.name}</h3>
            <StatusBadge value={zone.isActive ? "active" : "inactive"} text={zone.isActive ? tr.zoneActive : tr.zoneInactive} />
          </div>
          <p className="text-[13px] leading-5 text-ink-soft">
            <bdi dir="ltr">{zone.countries.length ? zone.countries.join(", ") : tr.noCountries}</bdi>
            {" · "}
            {fmt(tr.zoneRates, { n: rates.length })}
          </p>
        </div>
        <div className="ms-auto flex shrink-0 items-center">
          <MiniSwitch checked={zone.isActive} onChange={onToggleZone} label={fmt(tr.zoneOn, { name: zone.name })} />
          <RowIconButton label={fmt(tr.editNamed, { name: zone.name })} onClick={onEditZone}>
            <IconEdit aria-hidden />
          </RowIconButton>
          <RowIconButton label={fmt(tr.deleteNamed, { name: zone.name })} onClick={onDeleteZone} danger>
            <IconDelete aria-hidden />
          </RowIconButton>
        </div>
      </div>

      {rates.length === 0 ? (
        <p className="border-t border-line px-4 py-4 text-sm text-ink-soft">{tr.ratesEmpty}</p>
      ) : (
        <ul role="list">
          {rates.map((rate) => {
            // Type, what it costs, how long it takes, who carries it — only the parts that say something.
            const facts = [
              tr[RATE_TYPE_LABEL[rate.rateType]],
              rateSummary(rate, tr),
              rateDeliveryLabel(rate, tr),
              rate.carrierCode || "—",
            ].filter((part) => part !== "—");
            return (
              <li key={rate.id} className="flex min-h-13 flex-wrap items-center gap-x-2 border-t border-line py-1.5 ps-4 pe-2">
                <div className={cn("min-w-0 flex-[1_1_10rem]", !rate.isActive && "opacity-60")}>
                  <p className="flex flex-wrap items-center gap-2 text-sm leading-5 font-medium text-ink">
                    <span className="min-w-0 truncate">{rate.name}</span>
                    {!rate.isActive && <StatusBadge value="inactive" text={tr.rateInactive} />}
                  </p>
                  <p className="truncate text-[13px] leading-5 text-ink-soft">{facts.join(" · ")}</p>
                </div>
                <div className="ms-auto flex shrink-0 items-center">
                  <MiniSwitch checked={rate.isActive} onChange={(next) => onToggleRate(rate, next)} label={fmt(tr.rateOn, { name: rate.name })} />
                  <RowIconButton label={fmt(tr.editNamed, { name: rate.name })} onClick={() => onEditRate(rate)}>
                    <IconEdit aria-hidden />
                  </RowIconButton>
                  <RowIconButton label={fmt(tr.deleteNamed, { name: rate.name })} onClick={() => onDeleteRate(rate)} danger>
                    <IconDelete aria-hidden />
                  </RowIconButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="border-t border-line p-2">
        <Button variant="ghost" className="min-h-11 rounded-full px-3 text-primary" onClick={onAddRate}>
          <IconPlus weight="bold" aria-hidden />
          {tr.addRate}
        </Button>
      </div>
    </section>
  );
}

function ZoneForm({
  zone,
  onDone,
  onCancel,
}: {
  zone?: ShippingZone;
  onDone: () => void;
  onCancel: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const tr = useT(STRINGS);
  const [name, setName] = useState(zone?.name ?? "");
  const [countries, setCountries] = useState((zone?.countries ?? []).join(", "));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    const countryList = countries
      .split(",")
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);

    setSaving(true);
    try {
      const payload = { name: name.trim(), countries: countryList };
      if (zone) {
        await apiClient.updateShippingZone(workspaceId, zone.id, payload);
        toast.success(tr.zoneSaved);
      } else {
        await apiClient.createShippingZone(workspaceId, payload);
        toast.success(fmt(tr.added, { name: payload.name }));
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
      <TextField
        label={tr.name}
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.name}
        placeholder={tr.zoneNamePlaceholder}
      />
      <TextField
        label={tr.countries}
        value={countries}
        onChange={(e) => setCountries(e.target.value)}
        error={fieldErrors.countries}
        hint={tr.countriesHint}
        placeholder="EG, SA"
      />
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {tr.cancel}
        </Button>
        <Button type="submit" disabled={saving || name.trim() === ""}>
          {saving ? tr.saving : zone ? tr.saveZone : tr.addZone}
        </Button>
      </div>
    </form>
  );
}

interface TierDraft {
  threshold: string;
  amount: string;
}

function RateForm({
  zoneId,
  rate,
  onDone,
  onCancel,
}: {
  zoneId: string;
  rate?: ShippingRate;
  onDone: () => void;
  onCancel: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const tr = useT(STRINGS);
  const cfg = (rate?.config ?? {}) as Record<string, unknown>;

  const [name, setName] = useState(rate?.name ?? "");
  const [rateType, setRateType] = useState<ShippingRateType>(rate?.rateType ?? "flat");
  const [carrierCode, setCarrierCode] = useState(rate?.carrierCode ?? "");
  const [flatAmount, setFlatAmount] = useState(
    rate?.rateType === "flat" ? minorToMajorInput(numOrUndef(cfg.amount)) : ""
  );
  const [overflowAmount, setOverflowAmount] = useState(minorToMajorInput(numOrUndef(cfg.overflowAmount)));
  const [tiers, setTiers] = useState<TierDraft[]>(() => {
    const raw = Array.isArray(cfg.tiers) ? (cfg.tiers as Array<Record<string, unknown>>) : [];
    if (raw.length === 0) return [{ threshold: "", amount: "" }];
    return raw.map((t) => ({
      threshold:
        rate?.rateType === "order_value_based"
          ? minorToMajorInput(numOrUndef(t.minSubtotal))
          : String(numOrUndef(rate?.rateType === "weight_based" ? t.upToGrams : t.upToQuantity) ?? ""),
      amount: minorToMajorInput(numOrUndef(t.amount)),
    }));
  });
  const [estMinDays, setEstMinDays] = useState(
    rate?.estimatedDeliveryMinDays != null ? String(rate.estimatedDeliveryMinDays) : ""
  );
  const [estMaxDays, setEstMaxDays] = useState(
    rate?.estimatedDeliveryMaxDays != null ? String(rate.estimatedDeliveryMaxDays) : ""
  );

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const showTiers =
    rateType === "weight_based" || rateType === "quantity_based" || rateType === "order_value_based";
  const showOverflow = rateType === "weight_based" || rateType === "quantity_based";
  const thresholdIsMoney = rateType === "order_value_based";
  const thresholdLabel =
    rateType === "weight_based"
      ? tr.upToGrams
      : rateType === "quantity_based"
        ? tr.upToQuantity
        : tr.minSubtotal;

  function setTier(index: number, patch: Partial<TierDraft>) {
    setTiers((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
  }

  function buildConfig():
    | { config: Record<string, unknown> }
    | { errors: Record<string, string> } {
    if (rateType === "free") return { config: {} };

    if (rateType === "flat") {
      const amount = majorToMinor(flatAmount);
      if (!Number.isFinite(amount) || amount < 0) {
        return { errors: { amount: tr.errAmount } };
      }
      return { config: { amount } };
    }

    const cleaned = tiers.filter((t) => t.threshold.trim() !== "" || t.amount.trim() !== "");
    if (cleaned.length === 0) return { errors: { tiers: tr.errNoTiers } };

    const built: Array<Record<string, number>> = [];
    for (const t of cleaned) {
      const amount = majorToMinor(t.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        return { errors: { tiers: tr.errTierAmount } };
      }
      if (rateType === "order_value_based") {
        const minSubtotal = majorToMinor(t.threshold);
        if (!Number.isFinite(minSubtotal) || minSubtotal < 0) {
          return { errors: { tiers: tr.errTierSubtotal } };
        }
        built.push({ minSubtotal, amount });
      } else {
        const threshold = Math.floor(Number(t.threshold));
        if (!Number.isFinite(threshold) || threshold < 0) {
          return {
            errors: {
              tiers:
                rateType === "weight_based"
                  ? tr.errTierWeight
                  : tr.errTierQuantity,
            },
          };
        }
        built.push(
          rateType === "weight_based"
            ? { upToGrams: threshold, amount }
            : { upToQuantity: threshold, amount }
        );
      }
    }

    if (rateType === "order_value_based") return { config: { tiers: built } };

    const overflow = overflowAmount.trim() === "" ? 0 : majorToMinor(overflowAmount);
    if (!Number.isFinite(overflow) || overflow < 0) {
      return { errors: { overflowAmount: tr.errAmount } };
    }
    return { config: { tiers: built, overflowAmount: overflow } };
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const result = buildConfig();
    if ("errors" in result) {
      setFieldErrors(result.errors);
      return;
    }

    const minDays = parseDays(estMinDays);
    const maxDays = parseDays(estMaxDays);
    const dayErrors: Record<string, string> = {};
    if (minDays === "invalid") dayErrors.estimatedDeliveryMinDays = tr.errDays;
    if (maxDays === "invalid") dayErrors.estimatedDeliveryMaxDays = tr.errDays;
    if (typeof minDays === "number" && typeof maxDays === "number" && minDays > maxDays) {
      dayErrors.estimatedDeliveryMaxDays = tr.errDaysOrder;
    }
    if (Object.keys(dayErrors).length > 0) {
      setFieldErrors(dayErrors);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        rateType,
        config: result.config,
        carrierCode: carrierCode.trim() || null,
        estimatedDeliveryMinDays: minDays === "invalid" ? null : minDays,
        estimatedDeliveryMaxDays: maxDays === "invalid" ? null : maxDays,
      };
      if (rate) {
        await apiClient.updateShippingRate(workspaceId, rate.id, payload);
        toast.success(tr.rateSaved);
      } else {
        await apiClient.createShippingRate(workspaceId, zoneId, payload);
        toast.success(fmt(tr.added, { name: payload.name }));
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

      <TextField
        label={tr.name}
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.name}
        placeholder={tr.rateNamePlaceholder}
      />

      <Field label={tr.rateType} error={fieldErrors.rateType}>
        {({ id }) => (
          <Select
            id={id}
            value={rateType}
            onChange={(e) => setRateType(e.target.value as ShippingRateType)}
          >
            {(Object.keys(RATE_TYPE_LABEL) as ShippingRateType[]).map((t) => (
              <option key={t} value={t}>
                {tr[RATE_TYPE_LABEL[t]]}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {rateType === "flat" && (
        <MoneyInput
          label={tr.amount}
          required
          value={flatAmount}
          onChange={setFlatAmount}
          error={fieldErrors.amount}
        />
      )}

      {rateType === "free" && (
        <p className="text-sm text-ink-soft">{tr.freeRateNote}</p>
      )}

      {showTiers && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink-soft">{tr.tiers}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setTiers((prev) => [...prev, { threshold: "", amount: "" }])}
            >
              {tr.addTier}
            </Button>
          </div>
          {fieldErrors.tiers && (
            <p className="text-xs font-medium text-danger">{fieldErrors.tiers}</p>
          )}
          {tiers.map((tier, i) => (
            <div key={i} className="rounded-[0.5rem] border border-line p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {thresholdIsMoney ? (
                  <MoneyInput
                    label={thresholdLabel}
                    value={tier.threshold}
                    onChange={(v) => setTier(i, { threshold: v })}
                  />
                ) : (
                  <Field label={thresholdLabel}>
                    {({ id, ...aria }) => (
                      <Input
                        id={id}
                        {...aria}
                        type="number"
                        min={0}
                        value={tier.threshold}
                        onChange={(e) => setTier(i, { threshold: e.target.value })}
                      />
                    )}
                  </Field>
                )}
                <MoneyInput
                  label={tr.amount}
                  value={tier.amount}
                  onChange={(v) => setTier(i, { amount: v })}
                />
              </div>
              {tiers.length > 1 && (
                <div className="mt-2 text-end">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="text-danger hover:bg-danger-soft"
                    onClick={() => setTiers((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    {tr.removeTier}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showOverflow && (
        <MoneyInput
          label={tr.overflowAmount}
          value={overflowAmount}
          onChange={setOverflowAmount}
          error={fieldErrors.overflowAmount}
          hint={tr.overflowHint}
        />
      )}

      <TextField
        label={tr.carrierCode}
        value={carrierCode}
        onChange={(e) => setCarrierCode(e.target.value)}
        error={fieldErrors.carrierCode}
        hint={tr.optional}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={tr.estMinDays}
          error={fieldErrors.estimatedDeliveryMinDays}
          hint={tr.estMinDaysHint}
        >
          {({ id, ...aria }) => (
            <Input
              id={id}
              {...aria}
              type="number"
              min={0}
              max={3650}
              value={estMinDays}
              onChange={(e) => setEstMinDays(e.target.value)}
            />
          )}
        </Field>
        <Field
          label={tr.estMaxDays}
          error={fieldErrors.estimatedDeliveryMaxDays}
          hint={tr.optional}
        >
          {({ id, ...aria }) => (
            <Input
              id={id}
              {...aria}
              type="number"
              min={0}
              max={3650}
              value={estMaxDays}
              onChange={(e) => setEstMaxDays(e.target.value)}
            />
          )}
        </Field>
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {tr.cancel}
        </Button>
        <Button type="submit" disabled={saving || name.trim() === ""}>
          {saving ? tr.saving : rate ? tr.saveRate : tr.addRate}
        </Button>
      </div>
    </form>
  );
}
