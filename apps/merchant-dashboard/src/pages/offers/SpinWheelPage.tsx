import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { IconDelete, IconGift, IconPlus, IconSpinner } from "@/components/icons";
import { Alert, Button, Input, Label, cn } from "@store-builder/ui";
import {
  SPIN_WHEEL_LIMITS,
  spinWheelGet,
  spinWheelProblemOf,
  spinWheelSave,
  type Discount,
  type SpinWheelConfig,
  type SpinWheelOverview,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { parseWholeNumber } from "@/lib/wholeNumber";
import { formatMoney, formatPercent } from "@/lib/format";
import { fmt, getIntlLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState, SkeletonBar } from "@/components/DataState";
import { Section } from "@/components/Section";
import { Field, TextField } from "@/components/Field";
import { KpiCard } from "@/components/KpiCard";
import { SaveBar } from "@/components/SaveBar";
import { SettingsGroup, SettingsSwitch } from "@/components/settings";
import { ViewLink } from "@/components/ViewLink";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { SpinWheelArt } from "./SpinWheelArt";
import { FormProblem, OfferPage } from "./OfferKit";

/**
 * Spin to win (handoff 258), in the Offers hub: a popup with a wheel the
 * shopper spins once, for their mobile number and their consent to hear from
 * the store. An honest wheel — the server draws by the slices' weights and
 * the store shows every slice's real chance — so this screen shows the same
 * percentages while the weights are typed. A prize is one of the store's
 * discount codes; a code that has ended or run out leaves the draw by itself.
 */

const STRINGS = {
  en: {
    back: "Offers",
    title: "Spin to win",
    description: "A popup with a wheel: the visitor gives their mobile number, spins once, and sees the real chance of every slice.",
    stateOn: "On",
    stateOff: "Off",
    stateHidden: "Not showing",
    statSpins: "Spins",
    statPrizes: "Prizes",
    hiddenNotice: "The wheel is not showing in your store right now: none of its prizes can be won. Check the discount codes — they may have ended, run out or been switched off.",
    popupTitle: "The popup",
    popupHint: "Each spin adds the shopper to your contacts, with their consent to receive your offers. One spin per mobile number.",
    enable: "Show the wheel in my store",
    enableHintOn: "It opens once per visitor, after the delay below. Never on the cart, the checkout or a funnel.",
    enableHintOff: "Nobody sees it. Your slices are kept.",
    heading: "Title",
    headingPlaceholder: "Try your luck",
    text: "Text",
    textPlaceholder: "Spin the wheel for a discount on your first order",
    delay: "Opens after (seconds)",
    delayHint: "0 to 600 seconds after the visitor arrives.",
    delayError: "A whole number from 0 to 600.",
    slicesTitle: "Slices",
    slicesHint: "2 to 12 slices. A slice's weight is its chance against the others: 30 beside 70 wins 3 times in 10.",
    noCoupons: "A wheel needs at least one discount code to give as a prize.",
    noCouponsAction: "Create a discount code",
    slice: "Slice {n}",
    label: "Label",
    labelPlaceholderPrize: "10%",
    labelPlaceholderNone: "Better luck",
    labelError: "Write what the slice says.",
    prize: "Prize",
    noPrize: "No prize",
    couponGone: "A discount that is no longer in your store",
    couponNotLive: "not running",
    freeShipping: "Free shipping",
    buyXGetY: "Buy X get Y",
    weight: "Weight",
    weightError: "A whole number from 0 to 1000.",
    chance: "Chance",
    outZero: "Weight 0: this slice is out of the draw.",
    outCoupon: "This discount code is not running now, so the slice is out of the draw until it is.",
    outGone: "This slice's discount is gone. Choose another prize.",
    remove: "Remove slice {n}",
    add: "Add a slice",
    previewTitle: "Preview",
    previewHint: "What the visitor sees. Slices out of the draw are left out.",
    wheelLabel: "The wheel: {labels}",
    chances: "Chances",
    previewEmpty: "Give a prize a weight above 0 and the wheel shows here.",
    prizeNeeded: "At least one prize needs a weight above 0, with a discount code that is running.",
    fixFields: "Check the marked fields.",
    prize_not_coupon: "Every prize has to be one of your store's discounts with a code. Choose the prizes again.",
    no_prize_chance: "At least one prize needs a weight above 0.",
    save: "Save",
    saving: "Saving…",
    savedOn: "Saved. The wheel is on.",
    savedHidden: "Saved. The wheel is switched on, but it is not showing: no prize can be won right now.",
    savedOff: "Saved. The wheel is off.",
    starterNoPrize: "Better luck",
  },
  ar: {
    back: "العروض",
    title: "عجلة الحظ",
    description: "نافذة فيها عجلة: الزائر يكتب رقم موبايله ويلف مرة واحدة، وفرصة كل شريحة الحقيقية مكتوبة قدامه.",
    stateOn: "شغّالة",
    stateOff: "متوقفة",
    stateHidden: "مش ظاهرة",
    statSpins: "لفّات",
    statPrizes: "جوايز",
    hiddenNotice: "العجلة مش ظاهرة في متجرك دلوقتي: مفيش جايزة ينفع تتكسب. راجع أكواد الخصم — ممكن تكون خلصت أو اتوقفت.",
    popupTitle: "النافذة",
    popupHint: "كل لفّة بتضيف العميل لجهات الاتصال بموافقته على استقبال عروضك. لفّة واحدة لكل رقم موبايل.",
    enable: "اظهر العجلة في متجري",
    enableHintOn: "بتفتح مرة واحدة لكل زائر، بعد المدة اللي تحتها. ومش بتظهر في السلة ولا صفحة الطلب ولا مسار البيع.",
    enableHintOff: "محدش بيشوفها. الشرايح بتاعتك محفوظة.",
    heading: "العنوان",
    headingPlaceholder: "جرّب حظك",
    text: "النص",
    textPlaceholder: "لف العجلة وخد خصم على أول أوردر",
    delay: "تفتح بعد (ثانية)",
    delayHint: "من 0 لـ 600 ثانية من دخول الزائر.",
    delayError: "رقم صحيح من 0 لـ 600.",
    slicesTitle: "الشرايح",
    slicesHint: "من 2 لـ 12 شريحة. وزن الشريحة هو فرصتها قدام الباقي: 30 جنب 70 تكسب 3 مرات من كل 10.",
    noCoupons: "العجلة محتاجة كود خصم واحد على الأقل يبقى جايزة.",
    noCouponsAction: "اعمل كود خصم",
    slice: "شريحة {n}",
    label: "المكتوب على الشريحة",
    labelPlaceholderPrize: "10%",
    labelPlaceholderNone: "حظ أوفر",
    labelError: "اكتب اللي هيتكتب على الشريحة.",
    prize: "الجايزة",
    noPrize: "من غير جايزة",
    couponGone: "خصم مبقاش موجود في متجرك",
    couponNotLive: "مش شغّال",
    freeShipping: "شحن مجاني",
    buyXGetY: "اشتري X وخد Y",
    weight: "الوزن",
    weightError: "رقم صحيح من 0 لـ 1000.",
    chance: "الفرصة",
    outZero: "الوزن 0: الشريحة دي خارج السحب.",
    outCoupon: "كود الخصم ده مش شغّال دلوقتي، فالشريحة خارج السحب لحد ما يشتغل.",
    outGone: "خصم الشريحة دي اتمسح. اختار جايزة تانية.",
    remove: "امسح شريحة {n}",
    add: "ضيف شريحة",
    previewTitle: "المعاينة",
    previewHint: "اللي الزائر هيشوفه. الشرايح اللي خارج السحب مش بتظهر.",
    wheelLabel: "العجلة: {labels}",
    chances: "فرص الفوز",
    previewEmpty: "ادّي جايزة وزن أكبر من 0 والعجلة تظهر هنا.",
    prizeNeeded: "لازم جايزة واحدة على الأقل وزنها أكبر من 0، وكود الخصم بتاعها شغّال.",
    fixFields: "راجع الخانات المعلّمة.",
    prize_not_coupon: "كل جايزة لازم تكون خصم من متجرك وله كود. اختار الجوايز تاني.",
    no_prize_chance: "لازم جايزة واحدة على الأقل وزنها أكبر من 0.",
    save: "حفظ",
    saving: "بنحفظ…",
    savedOn: "اتحفظ. العجلة شغّالة.",
    savedHidden: "اتحفظ. العجلة متفعّلة بس مش ظاهرة: مفيش جايزة ينفع تتكسب دلوقتي.",
    savedOff: "اتحفظ. العجلة متوقفة.",
    starterNoPrize: "حظ أوفر",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

interface SliceDraft {
  /** The row's own key: the saved id, or a local one until the first save. */
  key: string;
  id?: string;
  label: string;
  /** "" = no prize. */
  discountId: string;
  weight: string;
}

interface Draft {
  enabled: boolean;
  title: string;
  text: string;
  delay: string;
  slices: SliceDraft[];
}

interface Loaded {
  overview: SpinWheelOverview;
  /** The store's discounts that have a code — the only ones a slice can give. */
  coupons: Discount[];
}

let localKey = 0;
const newKey = () => `new-${++localKey}`;

/** The same test as the server's draw: on, has a code, inside its dates, and not used up. */
function couponLive(d: Discount, now = Date.now()): boolean {
  return (
    d.status === "active" &&
    Boolean(d.code) &&
    (!d.startsAt || new Date(d.startsAt).getTime() <= now) &&
    (!d.endsAt || new Date(d.endsAt).getTime() > now) &&
    (d.usageLimit === null || d.usageLimit === undefined || d.usageCount < d.usageLimit)
  );
}

/** What a discount gives, short enough to stand on a slice: "10%", "EGP 50", "Free shipping". */
function couponValue(d: Discount, currency: string, t: Strings): string {
  switch (d.type) {
    case "percentage":
      return formatPercent(d.value);
    case "fixed":
      return formatMoney(d.value, currency);
    case "free_shipping":
      return t.freeShipping;
    default:
      return t.buyXGetY;
  }
}

function toDraft(config: SpinWheelConfig | null, coupons: Discount[], currency: string, t: Strings): Draft {
  if (config) {
    return {
      enabled: config.enabled,
      title: config.title ?? "",
      text: config.text ?? "",
      delay: String(config.delaySeconds),
      slices: config.slices.map((s) => ({ key: s.id ?? newKey(), id: s.id, label: s.label, discountId: s.discountId ?? "", weight: String(s.weight) })),
    };
  }
  // Never saved: a prize and a "no prize" to start from, switched off until the merchant says so.
  const first = coupons.find((c) => couponLive(c));
  return {
    enabled: false,
    title: "",
    text: "",
    delay: "10",
    slices: [
      { key: newKey(), label: first ? couponValue(first, currency, t) : "", discountId: first?.id ?? "", weight: "30" },
      { key: newKey(), label: t.starterNoPrize, discountId: "", weight: "70" },
    ],
  };
}

/** A chance (0–1) as the store writes it: "30%", "33.3%"; a dash for a slice out of the draw. */
function chanceText(ratio: number | null): string {
  if (ratio === null) return "—";
  return new Intl.NumberFormat(getIntlLocale(), { style: "percent", maximumFractionDigits: 1 }).format(ratio);
}

/** Two drafts say the same thing (the rows' local keys aside). */
function sameDraft(a: Draft, b: Draft): boolean {
  const bare = (d: Draft) =>
    JSON.stringify([d.enabled, d.title.trim(), d.text.trim(), d.delay.trim(), d.slices.map((s) => [s.id ?? null, s.label.trim(), s.discountId, s.weight.trim()])]);
  return bare(a) === bare(b);
}

type SliceErrors = Record<string, { label?: string; weight?: string }>;

export function SpinWheelPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const currency = currentWorkspace?.defaultCurrency ?? "EGP";
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const formId = useId();

  const loaded = useAsync<Loaded>(async () => {
    const [overview, discounts] = await Promise.all([spinWheelGet(apiClient, workspaceId), apiClient.listDiscounts(workspaceId)]);
    return { overview, coupons: discounts.filter((d) => d.code) };
  }, [workspaceId]);

  const data = loaded.data;
  const [draft, setDraft] = useState<Draft | null>(null);
  /** What the draft started from: the saved wheel, or the starter of a store that has none. */
  const [baseline, setBaseline] = useState<Draft | null>(null);
  const [sliceErrors, setSliceErrors] = useState<SliceErrors>({});
  const [delayError, setDelayError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The form starts from what is saved, and again after each save (not when only the stats are read again).
  const savedKey = data ? JSON.stringify([workspaceId, data.overview.config]) : null;
  const starter = useRef({ t, currency });
  starter.current = { t, currency };
  useEffect(() => {
    if (!savedKey || !data) return;
    const next = toDraft(data.overview.config, data.coupons, starter.current.currency, starter.current.t);
    setDraft(next);
    setBaseline(next);
    setSliceErrors({});
    setDelayError(null);
    setFailure(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedKey]);

  const dirty = Boolean(draft && baseline && !sameDraft(draft, baseline));
  useReportDirty(dirty);
  const couponById = new Map((data?.coupons ?? []).map((c) => [c.id, c]));

  // Every row as the draw would see it: its weight, whether its prize can be won now, and its chance.
  const rows = (draft?.slices ?? []).map((slice) => {
    const weight = parseWholeNumber(slice.weight, 0, SPIN_WHEEL_LIMITS.weightMax);
    const coupon = slice.discountId ? couponById.get(slice.discountId) : undefined;
    const gone = Boolean(slice.discountId) && !coupon;
    const live = !slice.discountId || (coupon ? couponLive(coupon) : false);
    const inDraw = weight !== null && weight > 0 && live;
    return { slice, weight, coupon, gone, live, inDraw };
  });
  const total = rows.reduce((sum, row) => sum + (row.inDraw ? (row.weight ?? 0) : 0), 0);
  const chanceOf = (row: (typeof rows)[number]) => (row.inDraw && total > 0 ? Math.round(((row.weight ?? 0) / total) * 1000) / 1000 : null);
  const drawn = rows.filter((row) => row.inDraw);
  const prizeInDraw = drawn.some((row) => row.slice.discountId);

  function set<K extends keyof Draft>(key: K, value: Draft[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
    setFailure(null);
  }

  function setSlice(key: string, patch: Partial<SliceDraft>) {
    setDraft((d) => (d ? { ...d, slices: d.slices.map((s) => (s.key === key ? { ...s, ...patch } : s)) } : d));
    setSliceErrors((e) => (e[key] ? { ...e, [key]: { ...e[key], ...(patch.label !== undefined ? { label: undefined } : {}), ...(patch.weight !== undefined ? { weight: undefined } : {}) } } : e));
    setFailure(null);
  }

  /** What a slice is called when the merchant has not named it: its prize ("10%"), or "Better luck" for none. */
  function autoLabel(discountId: string): string | null {
    if (!discountId) return t.starterNoPrize;
    const coupon = couponById.get(discountId);
    return coupon ? couponValue(coupon, currency, t) : null;
  }

  /** Choosing a prize also names the slice after it, unless the merchant wrote a label of their own. */
  function choosePrize(slice: SliceDraft, discountId: string) {
    const typed = slice.label.trim();
    const untouched = typed === "" || typed === autoLabel(slice.discountId);
    const label = untouched ? (autoLabel(discountId) ?? slice.label) : slice.label;
    setSlice(slice.key, { discountId, label: label.slice(0, SPIN_WHEEL_LIMITS.labelMax) });
  }

  function addSlice() {
    setDraft((d) => (d && d.slices.length < SPIN_WHEEL_LIMITS.maxSlices ? { ...d, slices: [...d.slices, { key: newKey(), label: "", discountId: "", weight: "10" }] } : d));
    setFailure(null);
  }

  function removeSlice(key: string) {
    setDraft((d) => (d && d.slices.length > SPIN_WHEEL_LIMITS.minSlices ? { ...d, slices: d.slices.filter((s) => s.key !== key) } : d));
    setFailure(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft || !data || saving) return;
    const delay = parseWholeNumber(draft.delay, 0, SPIN_WHEEL_LIMITS.delayMax);
    const found: SliceErrors = {};
    for (const row of rows) {
      const problems: { label?: string; weight?: string } = {};
      if (!row.slice.label.trim()) problems.label = t.labelError;
      if (row.weight === null || Number.isNaN(row.weight)) problems.weight = t.weightError;
      if (problems.label || problems.weight) found[row.slice.key] = problems;
    }
    setSliceErrors(found);
    setDelayError(delay === null || Number.isNaN(delay) ? t.delayError : null);
    if (delay === null || Number.isNaN(delay) || Object.keys(found).length > 0) {
      setFailure(t.fixFields);
      // The first marked field, wherever it is on the page.
      window.setTimeout(() => document.getElementById(formId)?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
      return;
    }
    // The server's own rule. (A prize whose code is not running yet may be saved: the wheel shows once it runs.)
    if (!rows.some((row) => row.slice.discountId && (row.weight ?? 0) > 0)) {
      setFailure(t.no_prize_chance);
      return;
    }

    const body: SpinWheelConfig = {
      enabled: draft.enabled,
      title: draft.title.trim() || null,
      text: draft.text.trim() || null,
      delaySeconds: delay,
      slices: rows.map((row) => ({
        ...(row.slice.id ? { id: row.slice.id } : {}),
        label: row.slice.label.trim(),
        discountId: row.slice.discountId || null,
        weight: row.weight ?? 0,
      })),
    };
    setSaving(true);
    setFailure(null);
    try {
      const config = await spinWheelSave(apiClient, workspaceId, body);
      // The save answers with the config only: what the shop shows and the counts are read again with it.
      const fresh = await spinWheelGet(apiClient, workspaceId).catch(() => null);
      loaded.setData((prev) => ({
        coupons: prev?.coupons ?? [],
        overview: fresh ?? { config, preview: prev?.overview.preview ?? null, stats: prev?.overview.stats ?? { spins: 0, prizes: 0 } },
      }));
      // Switched on with no prize to win (its codes are not running): saved, and said as it is.
      toast.success(!config.enabled ? t.savedOff : fresh && !fresh.preview ? t.savedHidden : t.savedOn);
    } catch (err) {
      const problem = spinWheelProblemOf(err);
      setFailure(problem ? t[problem] : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const saved = data?.overview.config ?? null;
  const badge = data ? (
    saved?.enabled && data.overview.preview ? (
      <StatusBadge value="active" tone="success" text={t.stateOn} />
    ) : saved?.enabled ? (
      <StatusBadge value="pending" tone="warning" text={t.stateHidden} />
    ) : (
      <StatusBadge value="disabled" tone="neutral" text={t.stateOff} />
    )
  ) : undefined;

  const count = (n: number) => new Intl.NumberFormat(getIntlLocale()).format(n);
  const NUMBER_INPUT = "h-11 text-center text-base tabular-nums md:h-10 md:text-sm";

  return (
    <OfferPage title={t.title} description={t.description} titleBadge={badge} width="wide">

      <DataState
        loading={loaded.loading}
        error={loaded.error}
        onRetry={() => void loaded.refresh()}
        skeleton={
          <div className="space-y-4">
            <div className="grid max-w-xl grid-cols-2 gap-[var(--bento-gap)]">
              {[0, 1].map((i) => (
                <div key={i} className="h-24 rounded-[var(--radius-card)] bg-paper-raised p-4 shadow-[var(--shadow-card)] ring-1 ring-line">
                  <SkeletonBar className="h-2.5 w-1/2" />
                  <SkeletonBar className="mt-5 h-6 w-2/3" />
                </div>
              ))}
            </div>
            <div className="rounded-[var(--radius-card)] bg-paper-raised p-4 shadow-[var(--shadow-card)] ring-1 ring-line">
              <SkeletonBar className="h-4 w-2/5" />
              <SkeletonBar className="mt-4 w-11/12" />
              <SkeletonBar className="mt-3 w-4/5" />
              <SkeletonBar className="mt-3 w-3/5" />
            </div>
          </div>
        }
      >
        {data && draft && (
          <div className="space-y-4">
            <div className="grid max-w-xl grid-cols-2 gap-[var(--bento-gap)]">
              <KpiCard label={t.statSpins} value={count(data.overview.stats.spins)} icon={<IconSpinner aria-hidden />} />
              <KpiCard label={t.statPrizes} value={count(data.overview.stats.prizes)} icon={<IconGift aria-hidden />} />
            </div>

            {saved?.enabled && !data.overview.preview && <Alert>{t.hiddenNotice}</Alert>}

            <form id={formId} onSubmit={submit} noValidate className="space-y-4">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem] xl:items-start">
                <div className="min-w-0 space-y-4">
                  <Section title={t.popupTitle} description={t.popupHint}>
                    <div className="space-y-4">
                      <SettingsGroup>
                        <SettingsSwitch
                          checked={draft.enabled}
                          onChange={(next) => set("enabled", next)}
                          label={t.enable}
                          hint={draft.enabled ? t.enableHintOn : t.enableHintOff}
                          disabled={saving}
                        />
                      </SettingsGroup>
                      <TextField
                        label={t.heading}
                        maxLength={SPIN_WHEEL_LIMITS.titleMax}
                        placeholder={t.headingPlaceholder}
                        value={draft.title}
                        disabled={saving}
                        onChange={(e) => set("title", e.target.value)}
                      />
                      <TextField
                        label={t.text}
                        maxLength={SPIN_WHEEL_LIMITS.textMax}
                        placeholder={t.textPlaceholder}
                        value={draft.text}
                        disabled={saving}
                        onChange={(e) => set("text", e.target.value)}
                      />
                      <Field label={t.delay} hint={t.delayHint} error={delayError ?? undefined}>
                        {(props) => (
                          <Input
                            {...props}
                            type="text"
                            inputMode="numeric"
                            dir="ltr"
                            autoComplete="off"
                            maxLength={3}
                            value={draft.delay}
                            disabled={saving}
                            onChange={(e) => {
                              set("delay", e.target.value);
                              setDelayError(null);
                            }}
                            className={cn(NUMBER_INPUT, "w-28", delayError && "border-danger focus-visible:ring-danger/30")}
                          />
                        )}
                      </Field>
                    </div>
                  </Section>

                  <Section title={t.slicesTitle} description={t.slicesHint}>
                    <div className="space-y-3">
                      {data.coupons.length === 0 && (
                        <Alert>
                          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                            <span className="min-w-0 flex-1 basis-56">{t.noCoupons}</span>
                            <ViewLink to="/discounts" className="inline-flex min-h-11 items-center font-medium text-primary hover:underline">
                              {t.noCouponsAction}
                            </ViewLink>
                          </div>
                        </Alert>
                      )}

                      {/* Column titles from sm up; on a phone every field carries its own label. */}
                      <div aria-hidden className="hidden gap-2 px-3 text-xs font-medium text-ink-soft sm:grid sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_5rem_4rem_2.75rem]">
                        <span>{t.label}</span>
                        <span>{t.prize}</span>
                        <span>{t.weight}</span>
                        <span>{t.chance}</span>
                        <span />
                      </div>

                      <ol className="space-y-2">
                        {rows.map((row, index) => (
                          <SliceRow
                            key={row.slice.key}
                            t={t}
                            index={index}
                            slice={row.slice}
                            coupons={data.coupons}
                            currency={currency}
                            gone={row.gone}
                            chance={chanceOf(row)}
                            note={
                              row.gone
                                ? t.outGone
                                : row.weight === 0
                                  ? t.outZero
                                  : row.slice.discountId && !row.live
                                    ? t.outCoupon
                                    : null
                            }
                            errors={sliceErrors[row.slice.key]}
                            disabled={saving}
                            canRemove={rows.length > SPIN_WHEEL_LIMITS.minSlices}
                            inputClass={NUMBER_INPUT}
                            onLabel={(label) => setSlice(row.slice.key, { label })}
                            onWeight={(weight) => setSlice(row.slice.key, { weight })}
                            onPrize={(discountId) => choosePrize(row.slice, discountId)}
                            onRemove={() => removeSlice(row.slice.key)}
                          />
                        ))}
                      </ol>

                      <Button
                        type="button"
                        variant="outline"
                        className="min-h-11 rounded-full px-4 md:min-h-9"
                        disabled={saving || rows.length >= SPIN_WHEEL_LIMITS.maxSlices}
                        onClick={addSlice}
                      >
                        <IconPlus className="size-4" aria-hidden />
                        {t.add}
                      </Button>
                    </div>
                  </Section>
                </div>

                <Section title={t.previewTitle} description={t.previewHint} className="xl:sticky xl:top-24">
                  {drawn.length === 0 ? (
                    <p className="rounded-[var(--radius)] bg-paper-sunken px-3 py-6 text-center text-sm text-ink-soft">{t.previewEmpty}</p>
                  ) : (
                    <div className="space-y-3">
                      <SpinWheelArt
                        className="mx-auto max-w-64"
                        slices={drawn.map((row) => ({ key: row.slice.key, label: row.slice.label }))}
                        label={fmt(t.wheelLabel, { labels: drawn.map((row) => row.slice.label.trim()).filter(Boolean).join(" · ") })}
                      />
                      <div className="text-center">
                        <p className="font-display text-base font-semibold text-ink">
                          <bdi>{draft.title.trim() || t.headingPlaceholder}</bdi>
                        </p>
                        {draft.text.trim() && (
                          <p className="mt-0.5 text-sm text-ink-soft">
                            <bdi>{draft.text.trim()}</bdi>
                          </p>
                        )}
                      </div>
                      <div>
                        <h3 className="text-xs font-semibold text-ink-soft">{t.chances}</h3>
                        <ul className="mt-1 divide-y divide-line text-sm">
                          {drawn.map((row) => (
                            <li key={row.slice.key} className="flex items-center justify-between gap-3 py-1.5">
                              <span className="flex min-w-0 items-center gap-1.5 text-ink">
                                {row.slice.discountId && <IconGift className="size-3.5 shrink-0 text-primary" aria-hidden />}
                                <bdi className="truncate">{row.slice.label.trim() || "—"}</bdi>
                              </span>
                              <span className="shrink-0 font-medium tabular-nums text-ink">{chanceText(chanceOf(row))}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      {!prizeInDraw && <p className="text-xs text-accent-dark">{t.prizeNeeded}</p>}
                    </div>
                  )}
                </Section>
              </div>

              <FormProblem>{failure}</FormProblem>

              <SaveBar
                dirty={dirty}
                saving={saving}
                saveLabel={t.save}
                savingLabel={t.saving}
                onDiscard={() => {
                  if (baseline) setDraft(baseline);
                  setSliceErrors({});
                  setDelayError(null);
                  setFailure(null);
                }}
              />
            </form>
          </div>
        )}
      </DataState>
    </OfferPage>
  );
}

function SliceRow({
  t,
  index,
  slice,
  coupons,
  currency,
  gone,
  chance,
  note,
  errors,
  disabled,
  canRemove,
  inputClass,
  onLabel,
  onWeight,
  onPrize,
  onRemove,
}: {
  t: Strings;
  index: number;
  slice: SliceDraft;
  coupons: Discount[];
  currency: string;
  /** The slice's discount is not one of the store's any more. */
  gone: boolean;
  /** 0–1, or null when the slice is out of the draw. */
  chance: number | null;
  note: string | null;
  errors?: { label?: string; weight?: string };
  disabled: boolean;
  canRemove: boolean;
  inputClass: string;
  onLabel: (label: string) => void;
  onWeight: (weight: string) => void;
  onPrize: (discountId: string) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const n = index + 1;
  const chanceLabel = chanceText(chance);
  // An archived code is offered only to the slice that already has it.
  const choices = coupons.filter((c) => c.status !== "archived" || c.id === slice.discountId);
  return (
    <li data-slot="offer-tier" data-invalid={errors?.label || errors?.weight ? "" : undefined} className="rounded-[1rem] bg-paper-raised p-3 ring-1 ring-line">
      {/* On a phone: the label, then the prize, then the weight with its chance beside it. From sm up: one row under the column titles. */}
      <div className="grid grid-cols-[5rem_minmax(0,1fr)_2.75rem] items-end gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_5rem_4rem_2.75rem] sm:items-center">
        <div className="col-span-3 min-w-0 space-y-1 sm:col-span-1">
          <Label htmlFor={`${id}-label`} className="sm:sr-only">
            {fmt(t.slice, { n })} — {t.label}
          </Label>
          <Input
            id={`${id}-label`}
            maxLength={SPIN_WHEEL_LIMITS.labelMax}
            placeholder={slice.discountId ? t.labelPlaceholderPrize : t.labelPlaceholderNone}
            value={slice.label}
            disabled={disabled}
            aria-invalid={errors?.label ? true : undefined}
            onChange={(e) => onLabel(e.target.value)}
            className={cn("h-11 text-base md:h-10 md:text-sm", errors?.label && "border-danger focus-visible:ring-danger/30")}
          />
        </div>
        <div className="col-span-3 min-w-0 space-y-1 sm:col-span-1">
          <Label htmlFor={`${id}-prize`} className="sm:sr-only">
            {t.prize}
          </Label>
          <Select id={`${id}-prize`} className="h-11 text-base md:h-10 md:text-sm" value={slice.discountId} disabled={disabled} onChange={(e) => onPrize(e.target.value)}>
            <option value="">{t.noPrize}</option>
            {gone && <option value={slice.discountId}>{t.couponGone}</option>}
            {choices.map((c) => (
              <option key={c.id} value={c.id}>
                {`${c.code} — ${couponValue(c, currency, t)}${couponLive(c) ? "" : ` (${t.couponNotLive})`}`}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-weight`} className="sm:sr-only">
            {t.weight}
          </Label>
          <Input
            id={`${id}-weight`}
            type="text"
            inputMode="numeric"
            dir="ltr"
            autoComplete="off"
            maxLength={4}
            value={slice.weight}
            disabled={disabled}
            aria-invalid={errors?.weight ? true : undefined}
            onChange={(e) => onWeight(e.target.value)}
            className={cn(inputClass, errors?.weight && "border-danger focus-visible:ring-danger/30")}
          />
        </div>
        {/* The live chance, beside the weight it comes from. */}
        <p data-chance className="pb-3 text-sm text-ink sm:pb-0">
          <span className="sm:sr-only">{t.chance}: </span>
          <span className="font-semibold tabular-nums">{chanceLabel}</span>
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11 rounded-full text-ink-soft hover:bg-danger-soft hover:text-danger"
          aria-label={fmt(t.remove, { n })}
          disabled={disabled || !canRemove}
          onClick={onRemove}
        >
          <IconDelete className="size-4" aria-hidden />
        </Button>
      </div>
      {(errors?.label || errors?.weight) && (
        <p role="alert" className="mt-2 text-xs font-medium text-danger">
          {[errors.label, errors.weight].filter(Boolean).join(" ")}
        </p>
      )}
      {note && !errors?.weight && <p className="mt-2 text-xs text-accent-dark">{note}</p>}
    </li>
  );
}
