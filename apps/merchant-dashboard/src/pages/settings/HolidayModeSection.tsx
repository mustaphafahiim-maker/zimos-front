import { useEffect, useId, useState, type FormEvent } from "react";
import { Alert, Button, Input } from "@store-builder/ui";
import {
  HOLIDAY_MESSAGE_MAX,
  apiFieldProblems,
  holidayModeGet,
  holidayModeSave,
  type HolidayMode,
  type HolidayModeInput,
  type HolidayModeSettings,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { canManageStoreSettings } from "@/lib/fulfilmentAccess";
import { formatDateTime } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { Textarea } from "@/components/Textarea";
import { SaveBar } from "@/components/SaveBar";
import { SettingsGroup, SettingsSwitch } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { PaneSkeleton, SettingsCard } from "./sections/SettingsCard";

const STRINGS = {
  en: {
    title: "Holiday mode",
    description:
      "Closing for a few days? Pause orders, or keep taking them and tell customers when they ship. Orders you enter yourself in the dashboard are never stopped.",
    toggle: "Turn on holiday mode",
    hintOff: "Off: the store takes orders as usual.",
    hintOn: "The store shows a holiday banner on every page.",
    onNow: "On now",
    startsOn: "Starts {date}",
    endedOn: "Ended {date}",
    modeLegend: "During the holiday",
    pause: "Pause orders",
    pauseHint: "The store and the cart keep working, but customers can't place an order: the order buttons say “Orders are paused for now”.",
    delay: "Take orders, ship later",
    delayHint: "Orders come in as usual and get the “Holiday” tag. Customers see when their order ships.",
    from: "From",
    fromHint: "Empty = from now.",
    until: "Until",
    untilHint: "Empty = until you switch it off.",
    untilPast: "This time has passed, so the holiday is not on any more.",
    errUntil: "The holiday has to end after it starts.",
    clear: "Clear",
    shipsFrom: "Orders ship from",
    shipsFromHint: "Customers see this date. Empty = the day the holiday ends.",
    message: "Message to customers",
    messageHint: "Shown in the banner at the top of the store.",
    messageAr: "Arabic",
    messageEn: "English",
    placeholderAr: "المتجر في إجازة العيد وهنرجع نشحن يوم 11 أكتوبر.",
    placeholderEn: "We're away for the holiday and ship again on 11 October.",
    save: "Save",
    saving: "Saving…",
    discard: "Discard changes",
    saved: "Saved. The store shows the change right away.",
    noManage: "Changing holiday mode needs the store settings permission. Ask the store owner.",
  },
  ar: {
    title: "وضع الإجازة",
    description: "قافل كام يوم؟ وقّف الأوردرات، أو كمّل استقبالها وعرّف العميل هتتشحن إمتى. الأوردرات اللي تسجّلها بنفسك من الداشبورد مش بتتوقف.",
    toggle: "شغّل وضع الإجازة",
    hintOff: "مقفول: المتجر بيستقبل الأوردرات عادي.",
    hintOn: "المتجر بيعرض شريط الإجازة في كل الصفحات.",
    onNow: "شغّال دلوقتي",
    startsOn: "هيبدأ {date}",
    endedOn: "خلص {date}",
    modeLegend: "في الإجازة",
    pause: "وقّف الأوردرات",
    pauseHint: "المتجر والسلة شغّالين، بس العميل مش هيقدر يطلب: زراير الطلب بيتكتب عليها «الطلبات موقوفة مؤقتًا».",
    delay: "اقبل الأوردرات واشحن بعدين",
    delayHint: "الأوردرات بتتسجّل عادي وبيتحط عليها علامة «إجازة»، والعميل بيشوف أوردره هيتشحن إمتى.",
    from: "من",
    fromHint: "فاضي = من دلوقتي.",
    until: "لحد",
    untilHint: "فاضي = لحد ما تقفله بنفسك.",
    untilPast: "الوقت ده عدّى، فالإجازة مبقتش شغّالة.",
    errUntil: "الإجازة لازم تخلص بعد ما تبدأ.",
    clear: "امسح",
    shipsFrom: "الأوردرات هتتشحن من",
    shipsFromHint: "التاريخ ده بيظهر للعميل. فاضي = يوم ما الإجازة تخلص.",
    message: "رسالة للعملاء",
    messageHint: "بتظهر في الشريط اللي فوق في المتجر.",
    messageAr: "بالعربي",
    messageEn: "بالإنجليزي",
    placeholderAr: "المتجر في إجازة العيد وهنرجع نشحن يوم 11 أكتوبر.",
    placeholderEn: "We're away for the holiday and ship again on 11 October.",
    save: "حفظ",
    saving: "بنحفظ…",
    discard: "تجاهل",
    saved: "اتحفظ. المتجر هيعرض التغيير على طول.",
    noManage: "تغيير وضع الإجازة محتاج صلاحية إعدادات المتجر. اطلبها من صاحب المتجر.",
  },
} satisfies Messages;

interface Draft {
  enabled: boolean;
  mode: HolidayMode;
  /** `datetime-local` values in the device's time; "" = open. */
  from: string;
  until: string;
  /** A day ("YYYY-MM-DD"); "" = the day the holiday ends. */
  shipsFrom: string;
  messageAr: string;
  messageEn: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** An ISO moment as a `datetime-local` value in the device's own time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** The ship date is a day, not a moment: kept at midday so it reads as the same day a few time zones either way. */
function fromLocalDay(ymd: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const d = new Date(`${ymd}T12:00:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toDraft(s: HolidayModeSettings): Draft {
  return {
    enabled: s.enabled === true,
    mode: s.mode === "delay" ? "delay" : "pause",
    from: toLocalInput(s.from),
    until: toLocalInput(s.until),
    shipsFrom: toLocalInput(s.shipsFrom).slice(0, 10),
    messageAr: s.message?.ar ?? "",
    messageEn: s.message?.en ?? "",
  };
}

function toBody(d: Draft): HolidayModeInput {
  const ar = d.messageAr.trim().slice(0, HOLIDAY_MESSAGE_MAX);
  const en = d.messageEn.trim().slice(0, HOLIDAY_MESSAGE_MAX);
  return {
    enabled: d.enabled,
    mode: d.mode,
    from: fromLocalInput(d.from),
    until: fromLocalInput(d.until),
    // Only a "delay" holiday has a ship date of its own; a paused store reopens when the holiday ends.
    shipsFrom: d.mode === "delay" ? fromLocalDay(d.shipsFrom) : null,
    message: ar || en ? { ar, en } : null,
  };
}

/**
 * Settings → Orders → «وضع الإجازة» (handoff 216; read orders.view, save
 * workspace.manage): pause the store's checkout, or keep taking orders and
 * ship later, between two dates — with the date orders ship again and a
 * message for the banner. «شغال دلوقتي» shows while the holiday is in force.
 */
export function HolidayModeSection() {
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const ids = useId();
  const canManage = canManageStoreSettings(currentWorkspace?.role);

  const settings = useAsync(() => holidayModeGet(apiClient, workspaceId), [workspaceId]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [untilError, setUntilError] = useState<string | null>(null);

  useEffect(() => {
    if (settings.data) setDraft(toDraft(settings.data));
  }, [settings.data]);

  const saved = settings.data;
  const dirty = Boolean(draft && saved && JSON.stringify(toBody(draft)) !== JSON.stringify(toBody(toDraft(saved))));
  const locked = saving || !canManage;
  useReportDirty(dirty && canManage);

  function patch(change: Partial<Draft>) {
    setDraft((current) => (current ? { ...current, ...change } : current));
    setError(null);
    if ("from" in change || "until" in change) setUntilError(null);
  }

  function discard() {
    if (saved) setDraft(toDraft(saved));
    setError(null);
    setUntilError(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || !draft || !canManage) return;
    const body = toBody(draft);
    if (body.from && body.until && new Date(body.until) <= new Date(body.from)) {
      setUntilError(t.errUntil);
      document.getElementById(`${ids}-until`)?.focus();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = await holidayModeSave(apiClient, workspaceId, body);
      settings.setData(next);
      toast.success(t.saved);
    } catch (err) {
      if (apiFieldProblems(err).some((p) => p.field === "until")) {
        setUntilError(t.errUntil);
        document.getElementById(`${ids}-until`)?.focus();
      } else {
        setError(isPermissionError(err) ? t.noManage : errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  // What the saved holiday is doing right now, beside the title.
  const now = Date.now();
  const state = !saved?.enabled
    ? null
    : saved.activeNow
      ? ({ tone: "warning", text: t.onNow } as const)
      : saved.from && new Date(saved.from).getTime() > now
        ? ({ tone: "info", text: fmt(t.startsOn, { date: formatDateTime(saved.from) }) } as const)
        : saved.until && new Date(saved.until).getTime() <= now
          ? ({ tone: "neutral", text: fmt(t.endedOn, { date: formatDateTime(saved.until) }) } as const)
          : null;
  const untilPassed = Boolean(draft?.enabled && draft.until && new Date(draft.until).getTime() <= now);

  return (
    <DataState
      loading={settings.loading && !settings.data}
      error={settings.data ? null : settings.error}
      onRetry={() => void settings.refresh()}
      skeleton={<PaneSkeleton rows={1} />}
    >
      {draft && (
          <form onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-[var(--bento-gap)]">
            {!canManage && <Alert>{t.noManage}</Alert>}

            <SettingsGroup
              footer={
                <>
                  {state && <StatusBadge value="holiday" tone={state.tone} text={state.text} className="mb-1.5" />}
                  <span className="block">{t.description}</span>
                </>
              }
            >
              <SettingsSwitch
                label={t.toggle}
                hint={draft.enabled ? t.hintOn : t.hintOff}
                checked={draft.enabled}
                disabled={locked}
                onChange={(enabled) => patch({ enabled })}
              />
            </SettingsGroup>

            {draft.enabled && (
              <>
                <SettingsCard>
                <fieldset disabled={locked} className="min-w-0 space-y-2">
                  <legend className="mb-2 text-[15px] leading-5 font-semibold text-ink">{t.modeLegend}</legend>
                  {(["pause", "delay"] as const).map((mode) => (
                    <label
                      key={mode}
                      className="flex min-h-11 cursor-pointer items-start gap-3 rounded-[0.875rem] border border-line p-3 transition-colors duration-[var(--dur-fade)] has-[:checked]:border-primary has-[:checked]:bg-primary-soft motion-reduce:transition-none"
                    >
                      <input
                        type="radio"
                        name={`${ids}-mode`}
                        className="mt-0.5 size-5 shrink-0 cursor-pointer accent-primary"
                        checked={draft.mode === mode}
                        onChange={() => patch({ mode })}
                      />
                      <span>
                        <span className="block text-sm font-semibold text-ink">{mode === "pause" ? t.pause : t.delay}</span>
                        <span className="block text-sm text-ink-soft">{mode === "pause" ? t.pauseHint : t.delayHint}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
                </SettingsCard>

                <SettingsCard className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <DateTimeField
                    id={`${ids}-from`}
                    label={t.from}
                    hint={t.fromHint}
                    clearLabel={t.clear}
                    value={draft.from}
                    disabled={locked}
                    onChange={(from) => patch({ from })}
                  />
                  <DateTimeField
                    id={`${ids}-until`}
                    label={t.until}
                    hint={untilPassed ? t.untilPast : t.untilHint}
                    warn={untilPassed}
                    error={untilError}
                    clearLabel={t.clear}
                    value={draft.until}
                    disabled={locked}
                    onChange={(until) => patch({ until })}
                  />
                </div>

                {draft.mode === "delay" && (
                  <div className="space-y-1.5">
                    <label htmlFor={`${ids}-ships`} className="block text-sm font-medium text-ink">
                      {t.shipsFrom}
                    </label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`${ids}-ships`}
                        type="date"
                        value={draft.shipsFrom}
                        disabled={locked}
                        aria-describedby={`${ids}-ships-hint`}
                        onChange={(e) => patch({ shipsFrom: e.target.value })}
                        className="h-11 w-full sm:w-56"
                      />
                      {draft.shipsFrom && (
                        <Button type="button" variant="ghost" className="min-h-11 text-ink-soft" disabled={locked} onClick={() => patch({ shipsFrom: "" })}>
                          {t.clear}
                        </Button>
                      )}
                    </div>
                    <p id={`${ids}-ships-hint`} className="text-xs text-ink-soft">
                      {t.shipsFromHint}
                    </p>
                  </div>
                )}
                </SettingsCard>

                <SettingsCard>
                <fieldset disabled={locked} className="min-w-0 space-y-2">
                  <legend className="text-[15px] leading-5 font-semibold text-ink">{t.message}</legend>
                  <p className="text-xs text-ink-soft">{t.messageHint}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <label htmlFor={`${ids}-ar`} className="block text-xs font-medium text-ink-soft">
                        {t.messageAr}
                      </label>
                      <Textarea
                        id={`${ids}-ar`}
                        dir="rtl"
                        lang="ar"
                        rows={3}
                        maxLength={HOLIDAY_MESSAGE_MAX}
                        value={draft.messageAr}
                        placeholder={t.placeholderAr}
                        onChange={(e) => patch({ messageAr: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <label htmlFor={`${ids}-en`} className="block text-xs font-medium text-ink-soft">
                        {t.messageEn}
                      </label>
                      <Textarea
                        id={`${ids}-en`}
                        dir="ltr"
                        lang="en"
                        rows={3}
                        maxLength={HOLIDAY_MESSAGE_MAX}
                        value={draft.messageEn}
                        placeholder={t.placeholderEn}
                        onChange={(e) => patch({ messageEn: e.target.value })}
                      />
                    </div>
                  </div>
                </fieldset>
                </SettingsCard>
              </>
            )}

            {error && <Alert variant="danger">{error}</Alert>}

            {canManage && (
              <SaveBar dirty={dirty} saving={saving} saveLabel={t.save} savingLabel={t.saving} discardLabel={t.discard} onDiscard={discard} />
            )}
          </form>
      )}
    </DataState>
  );
}

function DateTimeField({
  id,
  label,
  hint,
  warn = false,
  error,
  clearLabel,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  /** The hint is a warning (an end that has already passed). */
  warn?: boolean;
  error?: string | null;
  clearLabel: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="datetime-local"
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={`${id}-hint`}
          onChange={(e) => onChange(e.target.value)}
          className="h-11 min-w-0 flex-1"
        />
        {value && (
          <Button type="button" variant="ghost" className="min-h-11 shrink-0 text-ink-soft" disabled={disabled} onClick={() => onChange("")}>
            {clearLabel}
          </Button>
        )}
      </div>
      <p
        id={`${id}-hint`}
        role={error ? "alert" : undefined}
        className={error ? "text-xs font-medium text-danger" : warn ? "text-xs font-medium text-accent-dark" : "text-xs text-ink-soft"}
      >
        {error ?? hint}
      </p>
    </div>
  );
}
