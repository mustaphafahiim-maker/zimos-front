import { useId, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { IconCaretDown } from "@/components/icons";
import { Alert, Button, Card, Input, cn } from "@store-builder/ui";
import {
  DELIVERY_MAX_DAYS_MAX,
  DELIVERY_MIN_DAYS_MAX,
  DELIVERY_SKIP_DAYS_MAX,
  deliveryEstimatesGet,
  deliveryEstimatesSave,
  storePlacesList,
  type DeliveryEstimateSettings,
  type DeliveryRange,
  type ShippingSettingsResponseWithPlaces,
  type StorePlace,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { parseWholeNumber } from "@/lib/wholeNumber";
import { fmt, getIntlLocale, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { SaveBar } from "@/components/SaveBar";

const STRINGS = {
  en: {
    title: "Delivery times",
    description:
      "Customers see “Get it … – …” on the product page, in the cart and at checkout, and the window is kept on the order.",
    toggle: "Show customers when their order arrives",
    hintOff: "Off: customers don't see a delivery date. Turn it on and set your usual delivery time.",
    hintOn: "Counted in working days from the day of the order, in your store's time zone.",
    usual: "Usual delivery time",
    usualHint: "For every place without its own time. Leave it empty to show no date there.",
    days: "working days",
    from: "Fewest days — {place}",
    to: "Most days — {place}",
    dash: "to",
    cutoff: "Same-day cutoff",
    cutoffNone: "None",
    cutoffHint: "Orders after {hour} ship the next day",
    cutoffNoneHint: "Every order counts from the day it's placed.",
    skip: "Days we don't deliver",
    skipHint: "These days don't count toward the delivery time.",
    skipMax: "At least one day has to stay a delivery day.",
    byGovernorate: "By governorate",
    byRegion: "By region",
    byPlaceHint: "Empty = the usual time.",
    ownCount: "With their own time: {n}",
    byOwn: "By your cities and areas",
    byOwnHint: "From your own list (Shipping → Places). Empty = the city's time, then the governorate's, then the usual one.",
    regionFromGovernorate: "Uses the time of {name} above",
    showCities: "{name}'s cities and areas",
    noCities: "No cities in this region yet.",
    placesError: "We couldn't load your cities and areas.",
    retry: "Try again",
    both: "Enter both numbers, or leave both empty.",
    bad: "Whole days: the first 0–{min}, the second 0–{max}.",
    order: "The first number can't be bigger than the second.",
    unsaved: "Unsaved changes",
    fixFirst: "Fix the marked times first.",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    saved: "Saved. Customers see the new times within 5 minutes.",
    noManage: "Changing delivery times needs the shipping permission. Ask the store owner.",
  },
  ar: {
    title: "مواعيد التوصيل",
    description: "العميل بيشوف «هيوصلك من … لـ …» في صفحة المنتج والسلة وصفحة الدفع، والمعاد بيتحفظ مع الأوردر.",
    toggle: "اعرض للعميل معاد وصول الأوردر",
    hintOff: "مقفولة: العميل مش بيشوف معاد توصيل. شغّلها وحط مدة التوصيل العادية.",
    hintOn: "بتتحسب بأيام الشغل من يوم الأوردر، بتوقيت متجرك.",
    usual: "مدة التوصيل العادية",
    usualHint: "لأي مكان مالوش مدة خاصة. سيبها فاضية لو مش عايز يظهر معاد هناك.",
    days: "يوم شغل",
    from: "أقل عدد أيام — {place}",
    to: "أكتر عدد أيام — {place}",
    dash: "لـ",
    cutoff: "آخر معاد لأوردرات اليوم",
    cutoffNone: "من غير",
    cutoffHint: "الأوردرات بعد الساعة {hour} بتتشحن تاني يوم",
    cutoffNoneHint: "كل أوردر بيتحسب من نفس يومه.",
    skip: "أيام مفيش فيها توصيل",
    skipHint: "الأيام دي مش بتتحسب من مدة التوصيل.",
    skipMax: "لازم يفضل يوم واحد على الأقل فيه توصيل.",
    byGovernorate: "حسب المحافظة",
    byRegion: "حسب المنطقة",
    byPlaceHint: "الفاضي بياخد المدة العادية.",
    ownCount: "بمدة خاصة: {n}",
    byOwn: "حسب مدنك ومناطقك",
    byOwnHint: "من قايمتك (الشحن ← المناطق). الفاضي بياخد مدة المدينة، وبعدين المحافظة، وبعدين المدة العادية.",
    regionFromGovernorate: "بتاخد مدة {name} اللي فوق",
    showCities: "مدن ومناطق {name}",
    noCities: "لسه مفيش مدن في المنطقة دي.",
    placesError: "معرفناش نحمّل مدنك ومناطقك.",
    retry: "جرّب تاني",
    both: "اكتب الرقمين، أو سيبهم فاضيين.",
    bad: "أيام صحيحة: الأول من ٠ لـ {min}، والتاني من ٠ لـ {max}.",
    order: "الرقم الأول مينفعش يكون أكبر من التاني.",
    unsaved: "في تغييرات مش محفوظة",
    fixFirst: "صلّح المدد اللي عليها علامة الأول.",
    save: "احفظ",
    saving: "بيحفظ…",
    cancel: "إلغاء",
    saved: "اتحفظ. العملاء هيشوفوا المواعيد الجديدة في خلال ٥ دقايق.",
    noManage: "تغيير مواعيد التوصيل محتاج صلاحية الشحن. اطلبها من صاحب المتجر.",
  },
} satisfies Messages;

type Text = Record<keyof (typeof STRINGS)["en"], string>;
type RangeDraft = { min: string; max: string };
type Draft = {
  enabled: boolean;
  usual: RangeDraft;
  regions: Record<string, RangeDraft>;
  places: Record<string, RangeDraft>;
  cutoff: string;
  skip: number[];
};
type Errors = Record<string, string>;

const EMPTY: RangeDraft = { min: "", max: "" };
// The week as Egypt reads it, Saturday first (0 = Sunday … 6 = Saturday, as the API counts).
const WEEK = [6, 0, 1, 2, 3, 4, 5];

const toRange = (r: DeliveryRange | null | undefined): RangeDraft =>
  r ? { min: String(r.minDays), max: String(r.maxDays) } : EMPTY;
const toRanges = (map: Record<string, DeliveryRange>) =>
  Object.fromEntries(Object.entries(map ?? {}).map(([k, v]) => [k, toRange(v)]));

function toDraft(s: DeliveryEstimateSettings): Draft {
  return {
    enabled: s.enabled,
    usual: toRange(s.default),
    regions: toRanges(s.regions),
    places: toRanges(s.places),
    cutoff: s.cutoffHour === null || s.cutoffHour === undefined ? "" : String(s.cutoffHour),
    skip: [...(s.skipDays ?? [])].sort(),
  };
}

const blank = (r: RangeDraft | undefined) => !r || (r.min.trim() === "" && r.max.trim() === "");

/** A comparable form of the draft: empty rows dropped, text trimmed. */
function signature(d: Draft): string {
  const rows = (m: Record<string, RangeDraft>) =>
    Object.entries(m)
      .filter(([, r]) => !blank(r))
      .map(([k, r]) => [k, r.min.trim(), r.max.trim()])
      .sort();
  return JSON.stringify([d.enabled, d.usual.min.trim(), d.usual.max.trim(), rows(d.regions), rows(d.places), d.cutoff, [...d.skip].sort()]);
}

/** A row's range, "empty" when both are blank, or the reason it's wrong. */
function parseRange(r: RangeDraft | undefined, t: Text): DeliveryRange | "empty" | { error: string } {
  if (blank(r)) return "empty";
  const min = parseWholeNumber(r!.min, 0, DELIVERY_MIN_DAYS_MAX);
  const max = parseWholeNumber(r!.max, 0, DELIVERY_MAX_DAYS_MAX);
  if (min === null || max === null) return { error: t.both };
  if (Number.isNaN(min) || Number.isNaN(max)) return { error: fmt(t.bad, { min: DELIVERY_MIN_DAYS_MAX, max: DELIVERY_MAX_DAYS_MAX }) };
  if (min > max) return { error: t.order };
  return { minDays: min, maxDays: max };
}

/** The range a row stands for while it's being edited: its own when valid, else none. */
function rangeOf(r: RangeDraft | undefined): DeliveryRange | null {
  if (blank(r)) return null;
  const min = parseWholeNumber(r!.min, 0, DELIVERY_MIN_DAYS_MAX);
  const max = parseWholeNumber(r!.max, 0, DELIVERY_MAX_DAYS_MAX);
  return typeof min === "number" && typeof max === "number" && !Number.isNaN(min) && !Number.isNaN(max) && min <= max
    ? { minDays: min, maxDays: max }
    : null;
}

function toBody(d: Draft, t: Text): { body: DeliveryEstimateSettings } | { errors: Errors } {
  const errors: Errors = {};
  const ranges = (m: Record<string, RangeDraft>, prefix: string) => {
    const out: Record<string, DeliveryRange> = {};
    for (const [key, row] of Object.entries(m)) {
      const r = parseRange(row, t);
      if (r === "empty") continue;
      if ("error" in r) errors[`${prefix}${key}`] = r.error;
      else out[key] = r;
    }
    return out;
  };
  const usual = parseRange(d.usual, t);
  if (usual !== "empty" && "error" in usual) errors.usual = usual.error;
  const regions = ranges(d.regions, "r:");
  const places = ranges(d.places, "p:");
  if (Object.keys(errors).length) return { errors };
  return {
    body: {
      enabled: d.enabled,
      default: usual === "empty" || "error" in usual ? null : usual,
      regions,
      places,
      cutoffHour: d.cutoff === "" ? null : Number(d.cutoff),
      skipDays: [...d.skip].sort(),
    },
  };
}

/** "2 PM" / «٢ م» in the viewer's language. */
function hourName(hour: number): string {
  return new Intl.DateTimeFormat(getIntlLocale(), { hour: "numeric", timeZone: "UTC" }).format(Date.UTC(2026, 0, 4, hour));
}

/** "Saturday" / «السبت»: 0 = Sunday … 6 = Saturday. */
function dayName(day: number): string {
  // 2026-01-04 was a Sunday.
  return new Intl.DateTimeFormat(getIntlLocale(), { weekday: "long", timeZone: "UTC" }).format(Date.UTC(2026, 0, 4 + day, 12));
}

/**
 * Shipping → «مواعيد التوصيل» (handoff 199): whether customers see a delivery
 * window, the usual working days, the same-day cutoff hour, the days nobody
 * delivers, and the days per governorate and — when the store keeps its own
 * list — per city and area. One save sends the whole setting.
 */
export function DeliveryTimesSection() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const settings = useAsync(() => deliveryEstimatesGet(apiClient, workspaceId), [workspaceId]);
  // The governorates (platform codes, the same list the shipping prices use) and the store's own places.
  const shipping = useAsync(() => apiClient.getShippingSettings(workspaceId), [workspaceId]);
  const places = useAsync(() => storePlacesList(apiClient, workspaceId), [workspaceId]);

  const loading = (settings.loading && !settings.data) || (shipping.loading && !shipping.data);
  return (
    <section className="space-y-4">
      <p className="px-1 text-sm leading-6 text-ink-soft">{t.description}</p>
      <DataState
        loading={loading}
        error={settings.error ?? shipping.error}
        onRetry={() => {
          if (settings.error) void settings.refresh();
          if (shipping.error) void shipping.refresh();
        }}
      >
        {settings.data && shipping.data && (
          <DeliveryForm
            key={JSON.stringify(settings.data)}
            initial={settings.data}
            shipping={shipping.data as ShippingSettingsResponseWithPlaces}
            places={places.data?.places ?? null}
            placesFailed={Boolean(places.error) && !isPermissionError(places.error)}
            onRetryPlaces={() => void places.refresh()}
            onSaved={(next) => settings.setData(next)}
          />
        )}
      </DataState>
    </section>
  );
}

function DeliveryForm({
  initial,
  shipping,
  places,
  placesFailed,
  onRetryPlaces,
  onSaved,
}: {
  initial: DeliveryEstimateSettings;
  shipping: ShippingSettingsResponseWithPlaces;
  places: StorePlace[] | null;
  placesFailed: boolean;
  onRetryPlaces: () => void;
  onSaved: (next: DeliveryEstimateSettings) => void;
}) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const ids = useId();
  const saved = useMemo(() => toDraft(initial), [initial]);
  const [draft, setDraft] = useState<Draft>(saved);
  const [errors, setErrors] = useState<Errors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = signature(draft) !== signature(saved);
  useReportDirty(dirty);
  const governorates = shipping.governorates ?? [];
  const regional = shipping.country === "SA";
  const visiblePlaces = (places ?? []).filter((p) => !p.hidden);
  const usual = rangeOf(draft.usual);

  const setRow = (kind: "regions" | "places", key: string, row: RangeDraft) => {
    setDraft((d) => ({ ...d, [kind]: { ...d[kind], [key]: row } }));
    setErrors((e) => ({ ...e, [`${kind === "regions" ? "r" : "p"}:${key}`]: "" }));
    setSaveError(null);
  };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaveError(null);
    const result = toBody(draft, t);
    if ("errors" in result) {
      setErrors(result.errors);
      setSaveError(t.fixFirst);
      const first = Object.keys(result.errors)[0];
      document.getElementById(`${ids}-${first}-min`)?.focus();
      return;
    }
    setSaving(true);
    try {
      const next = await deliveryEstimatesSave(apiClient, workspaceId, result.body);
      toast.success(t.saved);
      onSaved(next);
    } catch (err) {
      setSaveError(isPermissionError(err) ? t.noManage : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const ownGovCount = governorates.filter((g) => !blank(draft.regions[g.code])).length;
  const ownPlaceCount = visiblePlaces.reduce((n, region) => n + countSet(region, draft.places), 0);

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Card className="gap-0 p-4 sm:p-5">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink">
          <input
            type="checkbox"
            role="switch"
            className="size-5 shrink-0 cursor-pointer accent-primary"
            checked={draft.enabled}
            aria-describedby={`${ids}-switch`}
            disabled={saving}
            onChange={(e) => {
              const enabled = e.target.checked;
              setDraft((d) => ({ ...d, enabled }));
            }}
          />
          {t.toggle}
        </label>
        <p id={`${ids}-switch`} className="text-xs text-ink-soft">
          {draft.enabled ? t.hintOn : t.hintOff}
        </p>

        {draft.enabled && (
          <div className="mt-5 space-y-5 border-t border-line pt-5">
            <div className="space-y-1.5">
              <p id={`${ids}-usual-label`} className="text-sm font-medium text-ink">
                {t.usual}
              </p>
              <RangeInputs
                id={`${ids}-usual`}
                place={t.usual}
                value={draft.usual}
                fallback={null}
                error={errors.usual}
                disabled={saving}
                t={t}
                onChange={(usual) => {
                  setDraft((d) => ({ ...d, usual }));
                  setErrors((e) => ({ ...e, usual: "" }));
                }}
              />
              <p className={cn("text-xs", errors.usual ? "font-medium text-danger" : "text-ink-soft")}>{errors.usual || t.usualHint}</p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor={`${ids}-cutoff`} className="block text-sm font-medium text-ink">
                  {t.cutoff}
                </label>
                <Select
                  id={`${ids}-cutoff`}
                  value={draft.cutoff}
                  disabled={saving}
                  aria-describedby={`${ids}-cutoff-hint`}
                  onChange={(e) => setDraft((d) => ({ ...d, cutoff: e.target.value }))}
                  className="h-11"
                >
                  <option value="">{t.cutoffNone}</option>
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={String(h)}>
                      {hourName(h)}
                    </option>
                  ))}
                </Select>
                <p id={`${ids}-cutoff-hint`} className="text-xs text-ink-soft">
                  {draft.cutoff === "" ? t.cutoffNoneHint : fmt(t.cutoffHint, { hour: hourName(Number(draft.cutoff)) })}
                </p>
              </div>

              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium text-ink">{t.skip}</legend>
                <div className="flex flex-wrap gap-2">
                  {WEEK.map((day) => {
                    const on = draft.skip.includes(day);
                    const full = !on && draft.skip.length >= DELIVERY_SKIP_DAYS_MAX;
                    return (
                      <button
                        key={day}
                        type="button"
                        aria-pressed={on}
                        disabled={saving || full}
                        title={full ? t.skipMax : undefined}
                        onClick={() =>
                          setDraft((d) => ({ ...d, skip: on ? d.skip.filter((x) => x !== day) : [...d.skip, day].sort() }))
                        }
                        className={cn(
                          "min-h-11 cursor-pointer rounded-[var(--radius-pill)] px-3.5 text-sm ring-1 transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                          on ? "bg-primary-soft font-medium text-primary-dark ring-primary" : "bg-paper-raised text-ink ring-line-strong hover:bg-paper"
                        )}
                      >
                        {dayName(day)}
                      </button>
                    );
                  })}
                </div>
                <p className="text-xs text-ink-soft">{draft.skip.length >= DELIVERY_SKIP_DAYS_MAX ? t.skipMax : t.skipHint}</p>
              </fieldset>
            </div>
          </div>
        )}
      </Card>

      {draft.enabled && governorates.length > 0 && (
        <Fold
          title={regional ? t.byRegion : t.byGovernorate}
          hint={ownGovCount > 0 ? fmt(t.ownCount, { n: ownGovCount }) : t.byPlaceHint}
          open={ownGovCount > 0 || Object.keys(errors).some((k) => k.startsWith("r:") && errors[k])}
        >
          <ul className="divide-y divide-line">
            {governorates.map((g) => {
              const key = `r:${g.code}`;
              return (
                <RangeRow
                  key={g.code}
                  id={`${ids}-${key}`}
                  name={g[locale] || g.en}
                  value={draft.regions[g.code] ?? EMPTY}
                  fallback={usual}
                  error={errors[key]}
                  disabled={saving}
                  t={t}
                  onChange={(row) => setRow("regions", g.code, row)}
                />
              );
            })}
          </ul>
        </Fold>
      )}

      {draft.enabled && placesFailed && (
        <Alert variant="danger">
          <span className="flex flex-wrap items-center gap-3">
            {t.placesError}
            <Button type="button" variant="outline" className="min-h-11" onClick={onRetryPlaces}>
              {t.retry}
            </Button>
          </span>
        </Alert>
      )}

      {draft.enabled && visiblePlaces.length > 0 && (
        <Fold
          title={t.byOwn}
          hint={ownPlaceCount > 0 ? fmt(t.ownCount, { n: ownPlaceCount }) : t.byOwnHint}
          open={ownPlaceCount > 0}
        >
          <p className="px-4 pb-2 text-xs text-ink-soft sm:px-5">{t.byOwnHint}</p>
          <ul className="divide-y divide-line border-t border-line">
            {visiblePlaces.map((region) => {
              const govName = region.geoCode ? governorates.find((g) => g.code === region.geoCode) : undefined;
              const regionFallback =
                rangeOf(draft.places[region.id]) ??
                (region.geoCode ? rangeOf(draft.regions[region.geoCode]) : null) ??
                usual;
              return (
                <RegionGroup
                  key={region.id}
                  ids={ids}
                  region={region}
                  // A region the platform knows is set in the governorate list above.
                  governorateName={govName ? govName[locale] || govName.en : null}
                  regionFallback={region.geoCode ? (rangeOf(draft.regions[region.geoCode]) ?? usual) : usual}
                  childFallback={regionFallback}
                  draft={draft.places}
                  errors={errors}
                  disabled={saving}
                  t={t}
                  onChange={(id, row) => setRow("places", id, row)}
                />
              );
            })}
          </ul>
        </Fold>
      )}

      {saveError && !dirty && <Alert variant="danger">{saveError}</Alert>}

      {/* Unsaved changes: the shared save bar, above the phone dock. */}
      <SaveBar
        dirty={dirty}
        saving={saving}
        saveLabel={t.save}
        savingLabel={t.saving}
        discardLabel={t.cancel}
        onDiscard={() => {
          setDraft(saved);
          setErrors({});
          setSaveError(null);
        }}
        message={
          saveError ? (
            <span role="alert" className="text-danger">
              {saveError}
            </span>
          ) : (
            t.unsaved
          )
        }
      />
    </form>
  );
}

function countSet(place: StorePlace, map: Record<string, RangeDraft>): number {
  const own = blank(map[place.id]) ? 0 : 1;
  return own + (place.children ?? []).filter((c) => !c.hidden).reduce((n, c) => n + countSet(c, map), 0);
}

/** A card that folds its long list behind a one-line summary. */
function Fold({ title, hint, open, children }: { title: string; hint: string; open: boolean; children: ReactNode }) {
  return (
    <details
      open={open || undefined}
      className="group rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line"
    >
      <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 sm:px-5 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-semibold text-ink">{title}</span>
          <span className="block text-xs text-ink-soft">{hint}</span>
        </span>
        <IconCaretDown className="size-5 shrink-0 text-ink-soft transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="pb-2">{children}</div>
    </details>
  );
}

/** Two day fields, "from" and "to"; their placeholders show what applies when they're left empty. */
function RangeInputs({
  id,
  place,
  value,
  fallback,
  error,
  disabled,
  t,
  onChange,
}: {
  id: string;
  place: string;
  value: RangeDraft;
  fallback: DeliveryRange | null;
  error?: string;
  disabled: boolean;
  t: Text;
  onChange: (next: RangeDraft) => void;
}) {
  // An empty pair reads as "inherited": a grey well showing what applies; a set pair is white.
  const field = cn("h-11 w-16 text-center tabular-nums", blank(value) ? "bg-paper" : "bg-paper-raised");
  return (
    <span className="inline-flex items-center gap-2 text-sm text-ink-soft">
      <Input
        id={`${id}-min`}
        type="text"
        inputMode="numeric"
        dir="ltr"
        autoComplete="off"
        maxLength={3}
        aria-label={fmt(t.from, { place })}
        aria-invalid={error ? true : undefined}
        placeholder={fallback ? String(fallback.minDays) : "—"}
        value={value.min}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, min: e.target.value })}
        className={field}
      />
      <span aria-hidden>{t.dash}</span>
      <Input
        id={`${id}-max`}
        type="text"
        inputMode="numeric"
        dir="ltr"
        autoComplete="off"
        maxLength={3}
        aria-label={fmt(t.to, { place })}
        aria-invalid={error ? true : undefined}
        placeholder={fallback ? String(fallback.maxDays) : "—"}
        value={value.max}
        disabled={disabled}
        onChange={(e) => onChange({ ...value, max: e.target.value })}
        className={field}
      />
      <span className="whitespace-nowrap text-xs">{t.days}</span>
    </span>
  );
}

/** One place: its name, its two day fields, and what's wrong with them. */
function RangeRow({
  id,
  name,
  value,
  fallback,
  error,
  disabled,
  t,
  indent = 0,
  onChange,
}: {
  id: string;
  name: string;
  value: RangeDraft;
  fallback: DeliveryRange | null;
  error?: string;
  disabled: boolean;
  t: Text;
  indent?: 0 | 1 | 2;
  onChange: (next: RangeDraft) => void;
}) {
  return (
    <li className={cn("px-4 py-2 sm:px-5", indent === 1 && "ps-8 sm:ps-9", indent === 2 && "ps-12 sm:ps-14")}>
      {/* Phones: name, then the fields at the far end; wider screens keep the fields beside the name. */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-x-6">
        {/* The name narrows by its indent, so every level's fields line up. */}
        <span
          className={cn(
            "min-w-0 flex-1 text-sm sm:flex-none",
            indent === 0 ? "sm:w-56" : indent === 1 ? "sm:w-52" : "sm:w-[11.75rem]",
            blank(value) ? "text-ink-soft" : "font-medium text-ink"
          )}
        >
          <bdi>{name}</bdi>
        </span>
        <RangeInputs id={id} place={name} value={value} fallback={fallback} error={error} disabled={disabled} t={t} onChange={onChange} />
      </div>
      {error && <p className="mt-1 text-xs font-medium text-danger">{error}</p>}
    </li>
  );
}

/** A region of the store's own list: folded until opened, then its cities with their areas under them. */
function RegionGroup({
  ids,
  region,
  governorateName,
  regionFallback,
  childFallback,
  draft,
  errors,
  disabled,
  t,
  onChange,
}: {
  ids: string;
  region: StorePlace;
  governorateName: string | null;
  regionFallback: DeliveryRange | null;
  childFallback: DeliveryRange | null;
  draft: Record<string, RangeDraft>;
  errors: Errors;
  disabled: boolean;
  t: Text;
  onChange: (id: string, row: RangeDraft) => void;
}) {
  const { locale } = useLocale();
  const nameOf = (p: StorePlace) => (locale === "en" ? p.nameEn || p.nameAr : p.nameAr || p.nameEn);
  const cities = (region.children ?? []).filter((c) => !c.hidden);
  const hasErrors = cities.some((c) => errors[`p:${c.id}`] || (c.children ?? []).some((a) => errors[`p:${a.id}`]));
  const [open, setOpen] = useState(false);
  const shown = open || hasErrors;
  const set = countSet(region, draft) - (blank(draft[region.id]) ? 0 : 1);
  const panel = `${ids}-region-${region.id}`;

  return (
    <li>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2 sm:px-5">
        <button
          type="button"
          aria-expanded={shown}
          aria-controls={panel}
          aria-label={fmt(t.showCities, { name: nameOf(region) })}
          onClick={() => setOpen((o) => !o)}
          className="flex min-h-11 min-w-0 flex-1 cursor-pointer items-center gap-2 text-start"
        >
          <IconCaretDown className={cn("size-4 shrink-0 text-ink-soft transition-transform", shown && "rotate-180")} aria-hidden />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-ink">
              <bdi>{nameOf(region)}</bdi>
            </span>
            <span className="block text-xs text-ink-soft">
              {governorateName ? fmt(t.regionFromGovernorate, { name: governorateName }) : null}
              {governorateName && set > 0 ? " · " : null}
              {set > 0 ? fmt(t.ownCount, { n: set }) : null}
            </span>
          </span>
        </button>
        {/* A region the platform doesn't know has no row above: its own days go here. */}
        {!governorateName && (
          <RangeInputs
            id={`${ids}-p:${region.id}`}
            place={nameOf(region)}
            value={draft[region.id] ?? EMPTY}
            fallback={regionFallback}
            error={errors[`p:${region.id}`]}
            disabled={disabled}
            t={t}
            onChange={(row) => onChange(region.id, row)}
          />
        )}
      </div>
      {!governorateName && errors[`p:${region.id}`] && (
        <p className="px-4 pb-2 text-xs font-medium text-danger sm:px-5">{errors[`p:${region.id}`]}</p>
      )}
      {shown && (
        <ul id={panel} className="divide-y divide-line border-t border-line">
          {cities.length === 0 && <li className="px-8 py-3 text-xs text-ink-soft">{t.noCities}</li>}
          {cities.map((city) => {
            const cityFallback = rangeOf(draft[city.id]) ?? childFallback;
            return [
              <RangeRow
                key={city.id}
                id={`${ids}-p:${city.id}`}
                name={nameOf(city)}
                value={draft[city.id] ?? EMPTY}
                fallback={childFallback}
                error={errors[`p:${city.id}`]}
                disabled={disabled}
                t={t}
                indent={1}
                onChange={(row) => onChange(city.id, row)}
              />,
              ...(city.children ?? [])
                .filter((a) => !a.hidden)
                .map((area) => (
                  <RangeRow
                    key={area.id}
                    id={`${ids}-p:${area.id}`}
                    name={nameOf(area)}
                    value={draft[area.id] ?? EMPTY}
                    fallback={cityFallback}
                    error={errors[`p:${area.id}`]}
                    disabled={disabled}
                    t={t}
                    indent={2}
                    onChange={(row) => onChange(area.id, row)}
                  />
                )),
            ];
          })}
        </ul>
      )}
    </li>
  );
}
