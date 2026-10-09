import { useId, useMemo, useState, type FormEvent } from "react";
import { Alert } from "@store-builder/ui";
import {
  hiddenPlacesOf,
  type ShippingPlacesPayload,
  type ShippingSettingsResponse,
  type ShippingSettingsResponseWithPlaces,
  type UpdateShippingSettingsPayload,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { getFieldErrors } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { minorToMajorInput } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { CardSkeleton, DataState } from "@/components/DataState";
import { ListSkeleton } from "@/components/list";
import { MoneyInput } from "@/components/MoneyInput";
import { SaveBar } from "@/components/SaveBar";
import { Select } from "@/components/Select";
import { SettingsGroup, SettingsRow } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { GovernorateTable, parseAmount } from "./sections/GovernorateTable";
import { ManualTrackingCard } from "./ManualTrackingCard";

const STRINGS = {
  en: {
    title: "Shipping prices",
    description:
      "What customers pay for shipping. The checkout shows this exact amount as soon as the customer picks their governorate, and the order is charged the same.",
    defaultRate: "Default shipping price",
    defaultRateHint: "Charged for any governorate without its own price. Leave blank to charge nothing.",
    threshold: "Free shipping from",
    thresholdHint: "Orders with a subtotal at or above this amount ship free. Leave blank to turn off.",
    carrier: "Default courier",
    carrierHint: "Preselected when you ship an order. You can pick another one per order; the customer's price never changes.",
    carrierNone: "No preference",
    carrierManual: "Manual (I book the courier myself)",
    carrierNotConnected: "{name} (not connected)",
    governorates: "Price per governorate",
    governoratesHint: "Leave a governorate blank to use the default price. Enter 0 to ship there free.",
    tierModeNote:
      "This store prices shipping by weight tier, so the prices per governorate below are not used until you switch back to rate pricing. The default price and free-shipping threshold still apply.",
    invalidAmount: "Enter an amount of 0 or more, or leave it blank.",
    fixFields: "Something needs fixing. Check the fields marked in red.",
    save: "Save shipping prices",
    saving: "Saving…",
    saved: "Shipping prices saved.",
    productNote: "Individual products can also ship free or add an extra fee — set it in each product's details.",
    regions: "Price per region",
    regionsHint: "Leave a region blank to use the default price. Enter 0 to ship there free.",
    allPrice: "One price for all",
    applyAll: "Apply to all",
    applyAllHint: "Fills every governorate shown below; change any of them after, then save.",
    hide: "Don't deliver here",
    hiddenCount: "{count} hidden: customers can't choose them at checkout.",
    govChanged_one: "1 governorate changed",
    govChanged_two: "2 governorates changed",
    govChanged_few: "{n} governorates changed",
    govChanged_many: "{n} governorates changed",
    govChanged_other: "{n} governorates changed",
    regionChanged_one: "1 region changed",
    regionChanged_two: "2 regions changed",
    regionChanged_few: "{n} regions changed",
    regionChanged_many: "{n} regions changed",
    regionChanged_other: "{n} regions changed",
  },
  ar: {
    title: "أسعار الشحن",
    description:
      "ما يدفعه العميل مقابل الشحن. تعرض صفحة الدفع هذا المبلغ نفسه بمجرد أن يختار العميل محافظته، ويُحاسَب الطلب عليه دون تغيير.",
    defaultRate: "سعر الشحن الأساسي",
    defaultRateHint: "ده اللي العميل بيدفعه لأي محافظة مالهاش سعر لوحدها. سيبه فاضي لو مش هتحسب شحن.",
    threshold: "الشحن مجاني من أول",
    thresholdHint: "الأوردر اللي قيمته توصل للمبلغ ده أو أكتر شحنه مجاني. سيبه فاضي لو مش عايزه.",
    carrier: "شركة الشحن الأساسية",
    carrierHint: "بتتختار لوحدها وأنت بتشحن الأوردر. تقدر تغيّرها في أي أوردر، وسعر العميل مش بيتغيّر.",
    carrierNone: "بدون تفضيل",
    carrierManual: "يدوي (بحجز مع شركة الشحن بنفسي)",
    carrierNotConnected: "{name} (مش مربوطة)",
    governorates: "السعر لكل محافظة",
    governoratesHint: "سيب المحافظة فاضية تاخد السعر الأساسي، أو اكتب 0 لو الشحن ليها مجاني.",
    tierModeNote:
      "المتجر ده بيحسب الشحن بشرائح الوزن، فأسعار المحافظات اللي تحت مش بتتستخدم لحد ما ترجع للتسعير بالأسعار. السعر الأساسي وحد الشحن المجاني لسه شغّالين.",
    invalidAmount: "اكتب مبلغ 0 أو أكتر، أو سيبه فاضي.",
    fixFields: "فيه حاجة محتاجة تتصلّح. راجع الخانات اللي بالأحمر.",
    save: "احفظ أسعار الشحن",
    saving: "بنحفظ…",
    saved: "أسعار الشحن اتحفظت.",
    productNote: "ممكن كمان تخلّي شحن منتج معيّن مجاني أو تزوّد عليه رسوم — من بيانات المنتج نفسه.",
    regions: "السعر لكل منطقة",
    regionsHint: "سيب المنطقة فاضية تاخد السعر الأساسي، أو اكتب 0 لو الشحن ليها مجاني.",
    allPrice: "سعر واحد للكل",
    applyAll: "طبّق على الكل",
    applyAllHint: "بيملا كل المحافظات اللي تحت؛ عدّل أي واحدة بعدها واحفظ.",
    hide: "مش بنوصّل هنا",
    hiddenCount: "{count} مخفية: العميل مش هيقدر يختارها في صفحة الدفع.",
    govChanged_one: "محافظة واحدة اتغيّرت",
    govChanged_two: "محافظتين اتغيّروا",
    govChanged_few: "{n} محافظات اتغيّرت",
    govChanged_many: "{n} محافظة اتغيّرت",
    govChanged_other: "{n} محافظة اتغيّرت",
    regionChanged_one: "منطقة واحدة اتغيّرت",
    regionChanged_two: "منطقتين اتغيّروا",
    regionChanged_few: "{n} مناطق اتغيّرت",
    regionChanged_many: "{n} منطقة اتغيّرت",
    regionChanged_other: "{n} منطقة اتغيّرت",
  },
} satisfies Messages;

/** The pane while it loads: the default-price card, then the table. */
function RatesSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--bento-gap)]">
      <CardSkeleton lines={2} />
      <ListSkeleton rows={8} variant="table" />
    </div>
  );
}

/**
 * The store's shipping prices: the default first, then the free-shipping
 * threshold and the default courier, then every governorate as one compact
 * table. Saved through PATCH /shipping/settings (shipping.manage), audited
 * server-side — one request carrying the whole map.
 */
export function ShippingSettingsSection({ onSaved }: { onSaved?: () => Promise<void> | void }) {
  const workspaceId = useWorkspaceId();
  const data = useAsync(() => apiClient.getShippingSettings(workspaceId), [workspaceId]);

  return (
    <DataState loading={data.loading} error={data.error} empty={false} onRetry={() => data.refresh()} skeleton={<RatesSkeleton />}>
      {data.data && (
        <SettingsForm
          // Re-seed the form from what the server saved.
          key={JSON.stringify(data.data.settings)}
          initial={data.data}
          onSaved={async (settings) => {
            data.setData({ ...data.data!, settings });
            await onSaved?.();
          }}
        />
      )}
    </DataState>
  );
}

function SettingsForm({
  initial,
  onSaved,
}: {
  initial: ShippingSettingsResponse;
  onSaved: (settings: ShippingSettingsResponse["settings"]) => Promise<void>;
}) {
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const carrierId = useId();
  const { settings, governorates, carriers } = initial;
  const currency = currentWorkspace?.defaultCurrency ?? "EGP";
  // Saudi stores price by region, Egyptian ones by governorate (with North Coast).
  const regional = (initial as ShippingSettingsResponseWithPlaces).country === "SA";

  // What the server holds, in the shape the fields are typed in: the start of the draft and what Discard puts back.
  const saved = useMemo(
    () => ({
      defaultRate: minorToMajorInput(settings.defaultRateAmount),
      threshold: minorToMajorInput(settings.freeShippingThresholdAmount),
      carrier: settings.defaultCarrierCode ?? "",
      rates: Object.fromEntries(governorates.map((g) => [g.code, minorToMajorInput(settings.governorateRates[g.code])])) as Record<string, string>,
      hidden: new Set(hiddenPlacesOf(settings)) as ReadonlySet<string>,
    }),
    [settings, governorates]
  );

  const [hidden, setHidden] = useState<Set<string>>(() => new Set(saved.hidden));
  const [defaultRate, setDefaultRate] = useState(saved.defaultRate);
  const [threshold, setThreshold] = useState(saved.threshold);
  const [carrier, setCarrier] = useState(saved.carrier);
  const [rates, setRates] = useState<Record<string, string>>(saved.rates);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Everything the form saves, as one string: while it differs from the one last saved, there are unsaved edits.
  const snapshot = JSON.stringify([
    defaultRate,
    threshold,
    carrier,
    rates,
    governorates.filter((g) => hidden.has(g.code)).map((g) => g.code),
  ]);
  const [savedSnapshot, setSavedSnapshot] = useState(snapshot);
  const dirty = snapshot !== savedSnapshot;

  // Tell the page, so a switch to another section asks before this form is unmounted with edits in it.
  useReportDirty(dirty);

  const changedPlaces = governorates.filter(
    (g) => (rates[g.code] ?? "").trim() !== (saved.rates[g.code] ?? "").trim() || hidden.has(g.code) !== saved.hidden.has(g.code)
  ).length;

  // The table speaks of a row by its code; the form's errors are keyed the way the API names the field.
  const rowErrors = useMemo(() => {
    const out: Record<string, string> = {};
    const prefix = "governorateRates.";
    for (const [key, message] of Object.entries(fieldErrors)) {
      if (key.startsWith(prefix)) out[key.slice(prefix.length)] = message;
    }
    return out;
  }, [fieldErrors]);

  function discard() {
    setDefaultRate(saved.defaultRate);
    setThreshold(saved.threshold);
    setCarrier(saved.carrier);
    setRates(saved.rates);
    setHidden(new Set(saved.hidden));
    setFieldErrors({});
    setFormError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFormError(null);

    const errs: Record<string, string> = {};
    const defaultAmount = parseAmount(defaultRate);
    const thresholdAmount = parseAmount(threshold);
    if (defaultAmount === "invalid") errs.defaultRateAmount = t.invalidAmount;
    if (thresholdAmount === "invalid") errs.freeShippingThresholdAmount = t.invalidAmount;
    const governorateRates: Record<string, number> = {};
    for (const g of governorates) {
      const amount = parseAmount(rates[g.code] ?? "");
      if (amount === "invalid") errs[`governorateRates.${g.code}`] = t.invalidAmount;
      else if (amount !== null) governorateRates[g.code] = amount;
    }
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setSaving(true);
    try {
      const payload: ShippingPlacesPayload = {
        defaultRateAmount: defaultAmount as number | null,
        freeShippingThresholdAmount: thresholdAmount as number | null,
        governorateRates,
        defaultCarrierCode: carrier || null,
        hiddenPlaces: governorates.filter((g) => hidden.has(g.code)).map((g) => g.code),
      };
      const next = await apiClient.updateShippingSettings(workspaceId, payload as UpdateShippingSettingsPayload);
      setSavedSnapshot(snapshot);
      toast.success(t.saved);
      await onSaved(next);
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const hasProblem = formError !== null || Object.keys(fieldErrors).length > 0;

  return (
    <form onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-[var(--bento-gap)]">
      {/* While the form is dirty the save bar at the end carries the error; one announcement, not two. */}
      {formError && !dirty && <Alert variant="danger">{formError}</Alert>}

      {/* The default price: the first thing on the pane, and the largest. */}
      <div
        data-slot="card"
        className="grid min-w-0 gap-x-5 gap-y-4 rounded-[var(--radius-card)] bg-card p-4 text-card-foreground shadow-[var(--shadow-card)] ring-1 ring-line [--radius-card:1.25rem] sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] sm:p-5"
      >
        <MoneyInput
          label={t.defaultRate}
          value={defaultRate}
          onChange={setDefaultRate}
          error={fieldErrors.defaultRateAmount}
          hint={t.defaultRateHint}
          currency={currency}
          className="[&_input]:h-14 [&_input]:ps-14 [&_input]:text-2xl [&_input]:font-semibold [&_input]:tabular-nums [&_label]:text-[15px] [&_label]:font-semibold"
        />
        <MoneyInput
          label={t.threshold}
          value={threshold}
          onChange={setThreshold}
          error={fieldErrors.freeShippingThresholdAmount}
          hint={t.thresholdHint}
          currency={currency}
          placeholder="—"
          className="[&_input]:h-11"
        />
      </div>

      <SettingsGroup>
        <SettingsRow
          label={t.carrier}
          hint={t.carrierHint}
          htmlFor={carrierId}
          error={fieldErrors.defaultCarrierCode}
          control={
            <Select id={carrierId} value={carrier} onChange={(e) => setCarrier(e.target.value)} className="h-11 w-auto max-w-full">
              <option value="">{t.carrierNone}</option>
              <option value="manual">{t.carrierManual}</option>
              {carriers.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.connected ? c.name : fmt(t.carrierNotConnected, { name: c.name })}
                </option>
              ))}
            </Select>
          }
        />
      </SettingsGroup>

      {/* Manual and imported waybills that update themselves (handoff 387); saves on its own. */}
      <ManualTrackingCard />

      <div className="min-w-0 pt-2">
        <div className="mb-2 px-4">
          <h3 className="text-[13px] leading-5 font-semibold text-ink-soft">{regional ? t.regions : t.governorates}</h3>
          <p className="mt-0.5 text-[13px] leading-5 text-ink-soft">{regional ? t.regionsHint : t.governoratesHint}</p>
        </div>
        {settings.pricingMode === "weight_tiers" && (
          <Alert variant="info" className="mb-3">
            {t.tierModeNote}
          </Alert>
        )}
        {fieldErrors.governorateRates && (
          <p role="alert" className="mb-2 px-4 text-[13px] font-medium text-danger">
            {fieldErrors.governorateRates}
          </p>
        )}
        <GovernorateTable
          governorates={governorates}
          regional={regional}
          currency={currency}
          rates={rates}
          hidden={hidden}
          savedRates={saved.rates}
          savedHidden={saved.hidden}
          defaultRate={defaultRate}
          errors={rowErrors}
          disabled={saving}
          onRatesChange={setRates}
          onHiddenChange={setHidden}
        />
        <p className="mt-2 px-4 text-[13px] leading-5 text-ink-soft">{t.productNote}</p>
      </div>

      <SaveBar
        dirty={dirty}
        saving={saving}
        onDiscard={discard}
        // The field that stopped the save may be several screens away from the bar.
        message={
          hasProblem ? (
            <span role="alert" className="text-danger">
              {formError ?? t.fixFields}
            </span>
          ) : changedPlaces > 0 ? (
            pluralOf(t, regional ? "regionChanged" : "govChanged", changedPlaces)
          ) : undefined
        }
      />
    </form>
  );
}
