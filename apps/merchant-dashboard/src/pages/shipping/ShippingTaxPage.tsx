import { useState, type FormEvent, type ReactNode } from "react";
import { MapPinned, Percent } from "lucide-react";
import { Alert, Button, Input, Tabs, TabsContent, TabsList, TabsTrigger, cn } from "@store-builder/ui";
import type {
  ShippingRate,
  ShippingRateType,
  ShippingZone,
  TaxRate,
  Workspace,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import {
  basisPointsToPercentInput,
  formatMoney,
  formatPercent,
  majorToMinor,
  minorToMajorInput,
  percentToBasisPoints,
} from "@/lib/format";
import { fmt, useCommon, useLocale, useT } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField, Field } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { Select } from "@/components/Select";
import { EmptyState } from "@/components/EmptyState";
import { useToast } from "@/components/Toast";
import { CarriersSection } from "./CarriersSection";
import { RATE_TYPE_LABEL, SHIPPING_TAX_STRINGS, type ShippingTaxStrings } from "./ShippingTaxPage.strings";

/** Unicode isolates so LTR runs like "2–5" keep their order inside Arabic text. */
const LRI = "\u2066";
const PDI = "\u2069";

/** Reads a JSONB config number that may arrive as a number or a BIGINT string. */
function numOrUndef(v: unknown): number | undefined {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

function rateSummary(r: ShippingRate, t: ShippingTaxStrings): ReactNode {
  const cfg = r.config ?? {};
  switch (r.rateType) {
    case "flat":
      return <bdi>{formatMoney(numOrUndef(cfg.amount))}</bdi>;
    case "free":
      return t.noCharge;
    default: {
      const tiers = Array.isArray(cfg.tiers) ? cfg.tiers : [];
      return tiers.length === 1 ? t.tierOne : fmt(t.tierMany, { n: tiers.length });
    }
  }
}

/** "2–5 days" / "3 days" / "from 2 days" / "up to 5 days" / "—". */
function rateDeliveryLabel(r: ShippingRate, t: ShippingTaxStrings): string {
  const min = r.estimatedDeliveryMinDays;
  const max = r.estimatedDeliveryMaxDays;
  const unit = (n: number) => (n === 1 ? t.dayOne : fmt(t.dayMany, { n }));
  if (min != null && max != null) {
    return min === max ? unit(min) : fmt(t.daysRange, { range: `${LRI}${min}–${max}${PDI}` });
  }
  if (min != null) return fmt(t.fromDays, { days: unit(min) });
  if (max != null) return fmt(t.upToDays, { days: unit(max) });
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

export function ShippingTaxPage() {
  // Key the body on the workspace so all workspace-seeded state (the settings
  // block, the lifted tax toggle) re-initialises on a store switch, mirroring
  // how SettingsPage keys its sections. Avoids a re-sync effect.
  const workspaceId = useWorkspaceId();
  return <ShippingTaxBody key={workspaceId} />;
}

function ShippingTaxBody() {
  const t = useT(SHIPPING_TAX_STRINGS);
  const c = useCommon();
  const workspaceId = useWorkspaceId();
  const { currentWorkspace, refresh: refreshWorkspace } = useWorkspace();
  const toast = useToast();
  const zones = useAsync(() => apiClient.listShippingZones(workspaceId), [workspaceId]);
  const taxRates = useAsync(() => apiClient.listTaxRates(workspaceId), [workspaceId]);

  const [zoneForm, setZoneForm] = useState<ShippingZone | "new" | null>(null);
  const [deletingZone, setDeletingZone] = useState<ShippingZone | null>(null);
  const [rateForm, setRateForm] = useState<{ zoneId: string; rate?: ShippingRate } | null>(null);
  const [deletingRate, setDeletingRate] = useState<ShippingRate | null>(null);
  const [taxForm, setTaxForm] = useState<TaxRate | "new" | null>(null);
  const [deletingTax, setDeletingTax] = useState<TaxRate | null>(null);

  // Lifted so the toggle in the settings block drives the tax section's
  // de-emphasis live, before a save lands. Seeded from the workspace; a save
  // persists exactly this value, so it stays consistent without re-syncing.
  const [taxEnabled, setTaxEnabled] = useState(Boolean(currentWorkspace?.settings?.tax_enabled));

  const reloadZones = () => zones.refresh({ silent: true });
  const reloadTax = () => taxRates.refresh({ silent: true });
  const zoneList = zones.data ?? [];
  const taxList = taxRates.data ?? [];

  async function toggleZoneActive(zone: ShippingZone) {
    try {
      await apiClient.updateShippingZone(workspaceId, zone.id, { isActive: !zone.isActive });
      toast.success(fmt(zone.isActive ? t.toastDeactivated : t.toastActivated, { name: zone.name }));
      reloadZones();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function toggleRateActive(rate: ShippingRate) {
    try {
      await apiClient.updateShippingRate(workspaceId, rate.id, { isActive: !rate.isActive });
      toast.success(fmt(rate.isActive ? t.toastDeactivated : t.toastActivated, { name: rate.name }));
      reloadZones();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function confirmDeleteZone() {
    if (!deletingZone) return;
    await apiClient.deleteShippingZone(workspaceId, deletingZone.id);
    toast.success(fmt(t.toastDeleted, { name: deletingZone.name }));
    setDeletingZone(null);
    reloadZones();
  }

  async function confirmDeleteRate() {
    if (!deletingRate) return;
    await apiClient.deleteShippingRate(workspaceId, deletingRate.id);
    toast.success(t.toastRateDeleted);
    setDeletingRate(null);
    reloadZones();
  }

  async function confirmDeleteTax() {
    if (!deletingTax) return;
    await apiClient.deleteTaxRate(workspaceId, deletingTax.id);
    toast.success(fmt(t.toastDeleted, { name: deletingTax.name }));
    setDeletingTax(null);
    reloadTax();
  }

  return (
    <div className="max-w-5xl space-y-8">
      <PageHeader title={t.pageTitle} description={t.pageDescription} />

      <Tabs defaultValue="carriers">
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList>
            <TabsTrigger value="carriers">{t.tabCarriers}</TabsTrigger>
            <TabsTrigger value="zones">{t.tabZones}</TabsTrigger>
            <TabsTrigger value="tax">{t.tabTax}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="carriers" className="pt-4">
          <CarriersSection />
        </TabsContent>

        <TabsContent value="zones" className="space-y-12 pt-4">
          <StoreShippingTaxSettings
            workspace={currentWorkspace}
            taxEnabled={taxEnabled}
            onTaxEnabledChange={setTaxEnabled}
            onSaved={refreshWorkspace}
          />

          <section>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-ink">{t.zonesTitle}</h2>
              <Button onClick={() => setZoneForm("new")}>{t.addZone}</Button>
            </div>

            <DataState loading={zones.loading} error={zones.error} onRetry={() => zones.refresh()}>
              {zoneList.length === 0 ? (
                <EmptyState
                  icon={<MapPinned />}
                  title={t.zonesEmptyTitle}
                  description={t.zonesEmptyDesc}
                  action={<Button onClick={() => setZoneForm("new")}>{t.addZone}</Button>}
                />
              ) : (
                <div className="space-y-4">
                  {zoneList.map((zone) => (
                    <ZoneCard
                      key={zone.id}
                      zone={zone}
                      onEditZone={() => setZoneForm(zone)}
                      onDeleteZone={() => setDeletingZone(zone)}
                      onToggleZone={() => toggleZoneActive(zone)}
                      onAddRate={() => setRateForm({ zoneId: zone.id })}
                      onEditRate={(rate) => setRateForm({ zoneId: zone.id, rate })}
                      onDeleteRate={(rate) => setDeletingRate(rate)}
                      onToggleRate={(rate) => toggleRateActive(rate)}
                    />
                  ))}
                </div>
              )}
            </DataState>
          </section>
        </TabsContent>

        <TabsContent value="tax" className="pt-4">
          <section className={cn("transition-opacity", !taxEnabled && "opacity-60")}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">{t.taxTitle}</h2>
                {!taxEnabled && <p className="mt-1 text-xs text-ink-soft">{t.taxOffNote}</p>}
              </div>
              <Button onClick={() => setTaxForm("new")}>{t.addTaxRate}</Button>
            </div>

            <DataState loading={taxRates.loading} error={taxRates.error} onRetry={() => taxRates.refresh()}>
              {taxList.length === 0 ? (
                <EmptyState
                  icon={<Percent />}
                  title={t.taxEmptyTitle}
                  description={t.taxEmptyDesc}
                  action={<Button onClick={() => setTaxForm("new")}>{t.addTaxRate}</Button>}
                />
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-line bg-paper-raised">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead>
                      <tr className="border-b border-line bg-paper text-start text-xs uppercase tracking-wide text-ink-soft">
                        <th className="px-4 py-3 text-start font-medium">{t.colName}</th>
                        <th className="px-4 py-3 text-start font-medium">{t.colCountry}</th>
                        <th className="px-4 py-3 text-start font-medium">{t.colRate}</th>
                        <th className="px-4 py-3 text-start font-medium">{t.colAppliesToShipping}</th>
                        <th className="px-4 py-3 text-start font-medium">{t.colPricesIncludeTax}</th>
                        <th className="px-4 py-3 font-medium">
                          <span className="sr-only">{c.actions}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {taxList.map((tax) => (
                        <tr key={tax.id} className="border-b border-line last:border-0 hover:bg-paper">
                          <td className="px-4 py-3 font-medium text-ink">{tax.name}</td>
                          <td className="px-4 py-3 text-ink-soft">
                            <bdi>{tax.country || "—"}</bdi>
                          </td>
                          <td className="px-4 py-3 text-ink-soft">
                            <span dir="ltr">{formatPercent(tax.rateBasisPoints)}</span>
                          </td>
                          <td className="px-4 py-3 text-ink-soft">
                            <YesNo value={tax.appliesToShipping} />
                          </td>
                          <td className="px-4 py-3 text-ink-soft">
                            <YesNo value={tax.pricesIncludeTax} />
                          </td>
                          <td className="whitespace-nowrap px-4 py-3 text-end">
                            <Button size="sm" variant="ghost" onClick={() => setTaxForm(tax)}>
                              {c.edit}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-danger hover:bg-danger-soft"
                              onClick={() => setDeletingTax(tax)}
                            >
                              {c.delete}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </DataState>
          </section>
        </TabsContent>
      </Tabs>

      <Modal
        open={zoneForm !== null}
        onClose={() => setZoneForm(null)}
        title={zoneForm === "new" ? t.addZone : t.editZone}
      >
        {zoneForm !== null && (
          <ZoneForm
            key={zoneForm === "new" ? "new" : zoneForm.id}
            zone={zoneForm === "new" ? undefined : zoneForm}
            onCancel={() => setZoneForm(null)}
            onDone={() => {
              setZoneForm(null);
              reloadZones();
            }}
          />
        )}
      </Modal>

      <Modal open={rateForm !== null} onClose={() => setRateForm(null)} title={rateForm?.rate ? t.editRate : t.addRate}>
        {rateForm !== null && (
          <RateForm
            key={rateForm.rate ? rateForm.rate.id : `new-${rateForm.zoneId}`}
            zoneId={rateForm.zoneId}
            rate={rateForm.rate}
            onCancel={() => setRateForm(null)}
            onDone={() => {
              setRateForm(null);
              reloadZones();
            }}
          />
        )}
      </Modal>

      <Modal
        open={taxForm !== null}
        onClose={() => setTaxForm(null)}
        title={taxForm === "new" ? t.addTaxRate : t.editTaxRate}
      >
        {taxForm !== null && (
          <TaxRateForm
            key={taxForm === "new" ? "new" : taxForm.id}
            taxRate={taxForm === "new" ? undefined : taxForm}
            onCancel={() => setTaxForm(null)}
            onDone={() => {
              setTaxForm(null);
              reloadTax();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deletingZone !== null}
        title={fmt(t.confirmDeleteTitle, { name: deletingZone?.name ?? "" })}
        description={t.confirmZoneDesc}
        confirmLabel={t.confirmZoneLabel}
        destructive
        onCancel={() => setDeletingZone(null)}
        onConfirm={confirmDeleteZone}
      />

      <ConfirmDialog
        open={deletingRate !== null}
        title={fmt(t.confirmDeleteTitle, { name: deletingRate?.name ?? "" })}
        description={t.confirmRateDesc}
        confirmLabel={t.confirmRateLabel}
        destructive
        onCancel={() => setDeletingRate(null)}
        onConfirm={confirmDeleteRate}
      />

      <ConfirmDialog
        open={deletingTax !== null}
        title={fmt(t.confirmDeleteTitle, { name: deletingTax?.name ?? "" })}
        description={t.confirmTaxDesc}
        confirmLabel={t.confirmTaxLabel}
        destructive
        onCancel={() => setDeletingTax(null)}
        onConfirm={confirmDeleteTax}
      />
    </div>
  );
}

function YesNo({ value }: { value: boolean }) {
  const c = useCommon();
  return value ? (
    <span className="text-success" aria-label={c.yes} title={c.yes}>
      ✓
    </span>
  ) : (
    <span aria-label={c.no} title={c.no}>
      —
    </span>
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
  onToggleZone: () => void;
  onAddRate: () => void;
  onEditRate: (rate: ShippingRate) => void;
  onDeleteRate: (rate: ShippingRate) => void;
  onToggleRate: (rate: ShippingRate) => void;
}) {
  const t = useT(SHIPPING_TAX_STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  const rateTypeLabel = RATE_TYPE_LABEL[locale];
  const rates = zone.rates ?? [];
  return (
    <div className={cn("rounded-2xl border border-line bg-paper-raised p-4", !zone.isActive && "opacity-60")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-ink">{zone.name}</p>
            <StatusBadge value={zone.isActive ? "active" : "inactive"} />
          </div>
          <p className="text-xs text-ink-soft">
            {zone.countries.length ? <bdi>{zone.countries.join(", ")}</bdi> : t.noCountries}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onToggleZone}>
            {zone.isActive ? t.deactivate : t.activate}
          </Button>
          <Button size="sm" variant="ghost" onClick={onEditZone}>
            {c.edit}
          </Button>
          <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" onClick={onDeleteZone}>
            {c.delete}
          </Button>
        </div>
      </div>

      <div className="mt-3">
        {rates.length === 0 ? (
          <p className="text-sm text-ink-soft">{t.noRatesInZone}</p>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-line bg-paper-raised">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-line bg-paper text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-3 py-2 text-start font-medium">{t.colRate}</th>
                  <th className="px-3 py-2 text-start font-medium">{t.colType}</th>
                  <th className="px-3 py-2 text-start font-medium">{t.colDetail}</th>
                  <th className="px-3 py-2 text-start font-medium">{t.colDelivery}</th>
                  <th className="px-3 py-2 text-start font-medium">{t.colCarrier}</th>
                  <th className="px-3 py-2 text-start font-medium">{c.status}</th>
                  <th className="px-3 py-2 font-medium">
                    <span className="sr-only">{c.actions}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rates.map((rate) => (
                  <tr key={rate.id} className={cn("border-b border-line last:border-0", !rate.isActive && "opacity-60")}>
                    <td className="px-3 py-2 text-ink">{rate.name}</td>
                    <td className="px-3 py-2 text-ink-soft">{rateTypeLabel[rate.rateType]}</td>
                    <td className="px-3 py-2 text-ink-soft">{rateSummary(rate, t)}</td>
                    <td className="px-3 py-2 text-ink-soft">{rateDeliveryLabel(rate, t)}</td>
                    <td className="px-3 py-2 text-ink-soft">
                      <bdi>{rate.carrierCode || "—"}</bdi>
                    </td>
                    <td className="px-3 py-2">
                      <StatusBadge value={rate.isActive ? "active" : "inactive"} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-end">
                      <Button size="sm" variant="ghost" onClick={() => onToggleRate(rate)}>
                        {rate.isActive ? t.deactivate : t.activate}
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => onEditRate(rate)}>
                        {c.edit}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-danger hover:bg-danger-soft"
                        onClick={() => onDeleteRate(rate)}
                      >
                        {c.delete}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="mt-2">
          <Button size="sm" variant="outline" onClick={onAddRate}>
            {t.addRate}
          </Button>
        </div>
      </div>
    </div>
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
  const t = useT(SHIPPING_TAX_STRINGS);
  const c = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
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
      .map((code) => code.trim().toUpperCase())
      .filter(Boolean);

    setSaving(true);
    try {
      const payload = { name: name.trim(), countries: countryList };
      if (zone) {
        await apiClient.updateShippingZone(workspaceId, zone.id, payload);
        toast.success(t.toastZoneSaved);
      } else {
        await apiClient.createShippingZone(workspaceId, payload);
        toast.success(fmt(t.toastAdded, { name: payload.name }));
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
        label={t.nameLabel}
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.name}
        placeholder={t.zoneNamePlaceholder}
      />
      <TextField
        label={t.countriesLabel}
        value={countries}
        onChange={(e) => setCountries(e.target.value)}
        error={fieldErrors.countries}
        hint={t.countriesHint}
        placeholder="EG, SA"
        dir="ltr"
      />
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {c.cancel}
        </Button>
        <Button type="submit" disabled={saving || name.trim() === ""}>
          {saving ? c.saving : zone ? t.saveZone : t.addZone}
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
  const t = useT(SHIPPING_TAX_STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  const rateTypeLabel = RATE_TYPE_LABEL[locale];
  const workspaceId = useWorkspaceId();
  const toast = useToast();
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
    return raw.map((tier) => ({
      threshold:
        rate?.rateType === "order_value_based"
          ? minorToMajorInput(numOrUndef(tier.minSubtotal))
          : String(numOrUndef(rate?.rateType === "weight_based" ? tier.upToGrams : tier.upToQuantity) ?? ""),
      amount: minorToMajorInput(numOrUndef(tier.amount)),
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
    rateType === "weight_based" ? t.upToGrams : rateType === "quantity_based" ? t.upToQuantity : t.minSubtotal;

  function setTier(index: number, patch: Partial<TierDraft>) {
    setTiers((prev) => prev.map((tier, i) => (i === index ? { ...tier, ...patch } : tier)));
  }

  function buildConfig():
    | { config: Record<string, unknown> }
    | { errors: Record<string, string> } {
    if (rateType === "free") return { config: {} };

    if (rateType === "flat") {
      const amount = majorToMinor(flatAmount);
      if (!Number.isFinite(amount) || amount < 0) {
        return { errors: { amount: t.errAmount } };
      }
      return { config: { amount } };
    }

    const cleaned = tiers.filter((tier) => tier.threshold.trim() !== "" || tier.amount.trim() !== "");
    if (cleaned.length === 0) return { errors: { tiers: t.errAtLeastOneTier } };

    const built: Array<Record<string, number>> = [];
    for (const tier of cleaned) {
      const amount = majorToMinor(tier.amount);
      if (!Number.isFinite(amount) || amount < 0) {
        return { errors: { tiers: t.errTierAmount } };
      }
      if (rateType === "order_value_based") {
        const minSubtotal = majorToMinor(tier.threshold);
        if (!Number.isFinite(minSubtotal) || minSubtotal < 0) {
          return { errors: { tiers: t.errTierMinSubtotal } };
        }
        built.push({ minSubtotal, amount });
      } else {
        const threshold = Math.floor(Number(tier.threshold));
        if (!Number.isFinite(threshold) || threshold < 0) {
          return {
            errors: {
              tiers: rateType === "weight_based" ? t.errTierWeight : t.errTierQuantity,
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
      return { errors: { overflowAmount: t.errAmount } };
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
    if (minDays === "invalid") dayErrors.estimatedDeliveryMinDays = t.errDays;
    if (maxDays === "invalid") dayErrors.estimatedDeliveryMaxDays = t.errDays;
    if (typeof minDays === "number" && typeof maxDays === "number" && minDays > maxDays) {
      dayErrors.estimatedDeliveryMaxDays = t.errMaxLessMin;
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
        toast.success(t.toastRateSaved);
      } else {
        await apiClient.createShippingRate(workspaceId, zoneId, payload);
        toast.success(fmt(t.toastAdded, { name: payload.name }));
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
        label={t.nameLabel}
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.name}
        placeholder={t.rateNamePlaceholder}
      />

      <Field label={t.rateTypeLabel} error={fieldErrors.rateType}>
        {({ id }) => (
          <Select id={id} value={rateType} onChange={(e) => setRateType(e.target.value as ShippingRateType)}>
            {(Object.keys(rateTypeLabel) as ShippingRateType[]).map((type) => (
              <option key={type} value={type}>
                {rateTypeLabel[type]}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {rateType === "flat" && (
        <MoneyInput
          label={t.amountLabel}
          required
          value={flatAmount}
          onChange={setFlatAmount}
          error={fieldErrors.amount}
        />
      )}

      {rateType === "free" && <p className="text-sm text-ink-soft">{t.freeNoSettings}</p>}

      {showTiers && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ink-soft">{t.tiersLabel}</span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setTiers((prev) => [...prev, { threshold: "", amount: "" }])}
            >
              {t.addTier}
            </Button>
          </div>
          {fieldErrors.tiers && <p className="text-xs font-medium text-danger">{fieldErrors.tiers}</p>}
          {tiers.map((tier, i) => (
            <div key={i} className="rounded-xl border border-line bg-paper p-3">
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
                        dir="ltr"
                        value={tier.threshold}
                        onChange={(e) => setTier(i, { threshold: e.target.value })}
                      />
                    )}
                  </Field>
                )}
                <MoneyInput label={t.amountLabel} value={tier.amount} onChange={(v) => setTier(i, { amount: v })} />
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
                    {t.removeTier}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showOverflow && (
        <MoneyInput
          label={t.overflowAmount}
          value={overflowAmount}
          onChange={setOverflowAmount}
          error={fieldErrors.overflowAmount}
          hint={t.overflowHint}
        />
      )}

      <TextField
        label={t.carrierCode}
        value={carrierCode}
        onChange={(e) => setCarrierCode(e.target.value)}
        error={fieldErrors.carrierCode}
        hint={t.optional}
        dir="ltr"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t.estMin} error={fieldErrors.estimatedDeliveryMinDays} hint={t.estMinHint}>
          {({ id, ...aria }) => (
            <Input
              id={id}
              {...aria}
              type="number"
              min={0}
              max={3650}
              dir="ltr"
              value={estMinDays}
              onChange={(e) => setEstMinDays(e.target.value)}
            />
          )}
        </Field>
        <Field label={t.estMax} error={fieldErrors.estimatedDeliveryMaxDays} hint={t.optional}>
          {({ id, ...aria }) => (
            <Input
              id={id}
              {...aria}
              type="number"
              min={0}
              max={3650}
              dir="ltr"
              value={estMaxDays}
              onChange={(e) => setEstMaxDays(e.target.value)}
            />
          )}
        </Field>
      </div>

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {c.cancel}
        </Button>
        <Button type="submit" disabled={saving || name.trim() === ""}>
          {saving ? c.saving : rate ? t.saveRate : t.addRate}
        </Button>
      </div>
    </form>
  );
}

function TaxRateForm({
  taxRate,
  onDone,
  onCancel,
}: {
  taxRate?: TaxRate;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useT(SHIPPING_TAX_STRINGS);
  const c = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [name, setName] = useState(taxRate?.name ?? "");
  const [country, setCountry] = useState(taxRate?.country ?? "");
  const [region, setRegion] = useState(taxRate?.region ?? "");
  const [rate, setRate] = useState(taxRate ? basisPointsToPercentInput(taxRate.rateBasisPoints) : "");
  const [appliesToShipping, setAppliesToShipping] = useState(taxRate?.appliesToShipping ?? false);
  const [pricesIncludeTax, setPricesIncludeTax] = useState(taxRate?.pricesIncludeTax ?? false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const bp = percentToBasisPoints(rate);
    if (!Number.isFinite(bp) || bp < 0) {
      setFieldErrors({ rateBasisPoints: t.errPercent });
      return;
    }
    const countryValue = country.trim().toUpperCase();
    if (countryValue && countryValue.length !== 2) {
      setFieldErrors({ country: t.errCountryCode });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        country: countryValue || null,
        region: region.trim() || null,
        rateBasisPoints: bp,
        appliesToShipping,
        pricesIncludeTax,
      };
      if (taxRate) {
        await apiClient.updateTaxRate(workspaceId, taxRate.id, payload);
        toast.success(t.toastTaxSaved);
      } else {
        await apiClient.createTaxRate(workspaceId, payload);
        toast.success(fmt(t.toastAdded, { name: payload.name }));
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
        label={t.nameLabel}
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={fieldErrors.name}
        placeholder={t.taxNamePlaceholder}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={t.countryLabel}
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          error={fieldErrors.country}
          hint={t.countryHint}
          placeholder="EG"
          dir="ltr"
        />
        <TextField
          label={t.regionLabel}
          value={region}
          onChange={(e) => setRegion(e.target.value)}
          error={fieldErrors.region}
          hint={t.optional}
        />
      </div>

      <Field label={t.rateLabel} required error={fieldErrors.rateBasisPoints} hint={t.rateHint}>
        {({ id, ...aria }) => (
          <div className="relative" dir="ltr">
            <Input
              id={id}
              {...aria}
              type="number"
              min={0}
              step="0.01"
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              className="pe-8"
            />
            <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3 text-sm text-ink-soft">
              %
            </span>
          </div>
        )}
      </Field>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={appliesToShipping} onChange={(e) => setAppliesToShipping(e.target.checked)} />
        {t.appliesToShipping}
      </label>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={pricesIncludeTax} onChange={(e) => setPricesIncludeTax(e.target.checked)} />
        {t.pricesAlreadyInclude}
      </label>

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          {c.cancel}
        </Button>
        <Button type="submit" disabled={saving || name.trim() === ""}>
          {saving ? c.saving : taxRate ? t.saveTaxRate : t.addTaxRate}
        </Button>
      </div>
    </form>
  );
}

/**
 * Storewide shipping/tax knobs kept in `workspace.settings` and saved through
 * the same `PATCH /workspaces/:id` used elsewhere. A blank money field is sent
 * as `null` (clear the key), never 0 — matching the backend's merge, where a
 * missing key is left untouched and `null` resets it to "not configured".
 * `taxEnabled` is owned by the page so the tax section below can react to it
 * before a save lands.
 */
function StoreShippingTaxSettings({
  workspace,
  taxEnabled,
  onTaxEnabledChange,
  onSaved,
}: {
  workspace: Workspace | null;
  taxEnabled: boolean;
  onTaxEnabledChange: (value: boolean) => void;
  onSaved: () => Promise<void> | void;
}) {
  const t = useT(SHIPPING_TAX_STRINGS);
  const c = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const settings = workspace?.settings;

  const [freeShippingThreshold, setFreeShippingThreshold] = useState(
    minorToMajorInput(settings?.free_shipping_threshold_amount)
  );
  const [defaultShippingRate, setDefaultShippingRate] = useState(
    minorToMajorInput(settings?.default_shipping_rate_amount)
  );
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  /** "" → null (clear the key); a valid ≥ 0 amount → minor units; else "invalid". */
  function parseAmount(input: string): number | null | "invalid" {
    if (input.trim() === "") return null;
    const minor = majorToMinor(input);
    if (!Number.isFinite(minor) || minor < 0) return "invalid";
    return minor;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    const threshold = parseAmount(freeShippingThreshold);
    const fallback = parseAmount(defaultShippingRate);
    const errs: Record<string, string> = {};
    if (threshold === "invalid") errs.free_shipping_threshold_amount = t.errAmount;
    if (fallback === "invalid") errs.default_shipping_rate_amount = t.errAmount;
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }

    setSaving(true);
    try {
      await apiClient.updateWorkspace(workspaceId, {
        settings: {
          free_shipping_threshold_amount: threshold === "invalid" ? null : threshold,
          default_shipping_rate_amount: fallback === "invalid" ? null : fallback,
          tax_enabled: taxEnabled,
        },
      });
      toast.success(t.toastSettingsSaved);
      await onSaved();
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
      <h2 className="font-display text-lg font-semibold text-ink">{t.settingsTitle}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t.settingsDesc}</p>

      <form onSubmit={submit} className="mt-4 space-y-4">
        {formError && <Alert variant="danger">{formError}</Alert>}

        <div className="grid gap-4 sm:grid-cols-2">
          <MoneyInput
            label={t.freeThreshold}
            value={freeShippingThreshold}
            onChange={setFreeShippingThreshold}
            error={fieldErrors.free_shipping_threshold_amount}
            hint={t.freeThresholdHint}
          />
          <MoneyInput
            label={t.defaultRate}
            value={defaultShippingRate}
            onChange={setDefaultShippingRate}
            error={fieldErrors.default_shipping_rate_amount}
            hint={t.defaultRateHint}
          />
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={taxEnabled} onChange={(e) => onTaxEnabledChange(e.target.checked)} />
          {t.chargeTax}
        </label>

        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? c.saving : t.saveSettings}
          </Button>
        </div>
      </form>
    </section>
  );
}
