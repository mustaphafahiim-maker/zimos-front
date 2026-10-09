import { useId, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { IconSchedule } from "@/components/icons";
import { Alert, Button, Card, Input } from "@store-builder/ui";
import {
  DELIVERY_SLOT_LEAD_DAYS_MAX,
  DELIVERY_SLOT_NOTE_MAX,
  apiFieldProblems,
  deliverySlotSettingsGet,
  deliverySlotSettingsSave,
  type DeliverySlotSettings,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { canManageStoreSettings } from "@/lib/fulfilmentAccess";
import { countOf } from "@/lib/plural";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { fmt, useT } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { SaveBar } from "@/components/SaveBar";
import { SettingsGroup, SettingsSwitch } from "@/components/settings";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { ClosedDaysCalendar } from "./ClosedDaysCalendar";
import { DELIVERY_SLOT_STRINGS } from "./deliverySlotStrings";
import { slotSignature, toSlotBody, toSlotDraft, type SlotErrors, type SlotSettingsDraft } from "./slotDraft";
import { storeToday } from "./slotText";
import { WeeklySlotsGrid } from "./WeeklySlotsGrid";

/**
 * Shipping → «مواعيد التوصيل» (handoff 221): the day and time slots a shopper
 * chooses from at checkout — on / off, whether a slot is required, the
 * earliest day, the order cutoff time, how many days ahead, the week's slots
 * with their capacity, the closed days and a note. One save sends the whole
 * setting (workspace.manage); the slots keep the ids the API gave them.
 *
 * It shares the tab with the delivery estimate (handoff 199), which tells the
 * shopper when an order arrives; this one lets them choose.
 */
export function DeliverySlotsSection() {
  const workspaceId = useWorkspaceId();
  const t = useT(DELIVERY_SLOT_STRINGS);
  const settings = useAsync(() => deliverySlotSettingsGet(apiClient, workspaceId), [workspaceId]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-ink">{t.title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-ink-soft">{t.description}</p>
        </div>
        <Button asChild variant="outline" className="min-h-11 gap-1.5 rounded-full px-4">
          <Link to="/orders/delivery-schedule">
            <IconSchedule className="size-4" aria-hidden />
            {t.openSchedule}
          </Link>
        </Button>
      </div>
      <DataState loading={settings.loading && !settings.data} error={settings.data ? null : settings.error} onRetry={() => void settings.refresh()}>
        {settings.data && <SlotForm key={JSON.stringify(settings.data)} initial={settings.data} onSaved={(next) => settings.setData(next)} />}
      </DataState>
    </section>
  );
}

function SlotForm({ initial, onSaved }: { initial: DeliverySlotSettings; onSaved: (next: DeliverySlotSettings) => void }) {
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const t = useT(DELIVERY_SLOT_STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const ids = useId();
  const canManage = canManageStoreSettings(currentWorkspace?.role);
  const today = storeToday(currentWorkspace?.timezone);

  const saved = useMemo(() => toSlotDraft(initial, today), [initial, today]);
  const [draft, setDraft] = useState<SlotSettingsDraft>(saved);
  const [errors, setErrors] = useState<SlotErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const dirty = slotSignature(draft) !== slotSignature(saved);
  useReportDirty(dirty);
  const locked = saving || !canManage;

  function patch(change: Partial<SlotSettingsDraft>, cleared?: string) {
    setDraft((d) => ({ ...d, ...change }));
    setSaveError(null);
    if (cleared) setErrors((e) => (e[cleared] ? { ...e, [cleared]: "" } : e));
  }

  /** Brings the first marked field into view and gives it the cursor. */
  function focusFirst(found: SlotErrors) {
    const first = Object.keys(found).find((k) => found[k]);
    if (!first) return;
    const target =
      first === "horizon" || first === "notice"
        ? document.getElementById(`${ids}-${first}`)
        : first === "weekly"
          ? document.getElementById(`${ids}-weekly`)
          : document.getElementById(`${ids}-${first}-from`);
    target?.scrollIntoView({ block: "center" });
    target?.focus({ preventScroll: true });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || !canManage) return;
    setSaveError(null);
    const result = toSlotBody(draft, t);
    if ("errors" in result) {
      setErrors(result.errors);
      setSaveError(result.errors.weekly ?? t.fixFirst);
      focusFirst(result.errors);
      return;
    }
    setErrors({});
    setSaving(true);
    try {
      const next = await deliverySlotSettingsSave(apiClient, workspaceId, result.body);
      toast.success(t.saved);
      onSaved(next);
    } catch (err) {
      // A 422 names the slot as weekly.<day>.<index>: say it on that row.
      const rows: SlotErrors = {};
      for (const problem of apiFieldProblems(err)) {
        const at = /^weekly\.([0-6])\.(\d+)\./.exec(problem.field);
        const key = at ? result.sent[at[1]]?.[Number(at[2])] : undefined;
        if (key) rows[key] = t.errOrder;
      }
      if (Object.keys(rows).length > 0) {
        setErrors(rows);
        setSaveError(t.fixFirst);
        focusFirst(rows);
      } else {
        setSaveError(isPermissionError(err) ? t.noManage : errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  const earliestName = (days: number) => (days === 0 ? t.today : days === 1 ? t.tomorrow : fmt(t.inDays, { days: countOf("day", days) }));

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      {!canManage && <Alert>{t.noManage}</Alert>}

      {/* The two switches are one group of rows, as System Settings draws them; the fields they open follow in their own pane. */}
      <SettingsGroup>
        <SettingsSwitch
          label={t.toggle}
          hint={draft.enabled ? t.hintOn : t.hintOff}
          checked={draft.enabled}
          disabled={locked}
          onChange={(enabled) => patch({ enabled }, "weekly")}
        />
        {draft.enabled && (
          <SettingsSwitch
            label={t.required}
            hint={draft.required ? t.requiredOn : t.requiredOff}
            checked={draft.required}
            disabled={locked}
            onChange={(required) => patch({ required })}
          />
        )}
      </SettingsGroup>

      {draft.enabled && (
        <Card className="gap-0 p-4 sm:p-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label htmlFor={`${ids}-earliest`} className="block text-sm font-medium text-ink">
                {t.earliest}
              </label>
              <Select
                id={`${ids}-earliest`}
                className="h-11"
                value={String(draft.leadDays)}
                disabled={locked}
                aria-describedby={`${ids}-earliest-hint`}
                onChange={(e) => patch({ leadDays: Number(e.target.value) })}
              >
                {Array.from({ length: DELIVERY_SLOT_LEAD_DAYS_MAX + 1 }, (_, days) => (
                  <option key={days} value={days}>
                    {earliestName(days)}
                  </option>
                ))}
              </Select>
              <p id={`${ids}-earliest-hint`} className="text-xs text-ink-soft">
                {t.earliestHint}
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor={`${ids}-cutoff`} className="block text-sm font-medium text-ink">
                {t.cutoff}
              </label>
              <div className="flex items-center gap-2">
                <Input
                  id={`${ids}-cutoff`}
                  type="time"
                  dir="ltr"
                  value={draft.cutoffTime}
                  disabled={locked}
                  aria-describedby={`${ids}-cutoff-hint`}
                  onChange={(e) => patch({ cutoffTime: e.target.value })}
                  className="h-11 w-32 tabular-nums"
                />
                {draft.cutoffTime && (
                  <Button type="button" variant="ghost" className="min-h-11 rounded-full px-4 text-ink-soft" disabled={locked} onClick={() => patch({ cutoffTime: "" })}>
                    {t.cutoffClear}
                  </Button>
                )}
              </div>
              <p id={`${ids}-cutoff-hint`} className="text-xs text-ink-soft">
                {draft.cutoffTime ? t.cutoffHint : t.cutoffNoneHint}
              </p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor={`${ids}-horizon`} className="block text-sm font-medium text-ink">
                {t.horizon}
              </label>
              <Input
                id={`${ids}-horizon`}
                type="text"
                inputMode="numeric"
                dir="ltr"
                autoComplete="off"
                maxLength={2}
                value={draft.horizon}
                disabled={locked}
                aria-invalid={errors.horizon ? true : undefined}
                aria-describedby={`${ids}-horizon-hint`}
                onChange={(e) => patch({ horizon: e.target.value }, "horizon")}
                className="h-11 w-24 text-center tabular-nums"
              />
              <p id={`${ids}-horizon-hint`} className={errors.horizon ? "text-xs font-medium text-danger" : "text-xs text-ink-soft"}>
                {errors.horizon || t.horizonHint}
              </p>
            </div>

            {/* Only when today can be chosen: how soon a slot of today may start. */}
            {draft.leadDays === 0 && (
              <div className="space-y-1.5">
                <label htmlFor={`${ids}-notice`} className="block text-sm font-medium text-ink">
                  {t.notice}
                </label>
                <Input
                  id={`${ids}-notice`}
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  autoComplete="off"
                  maxLength={4}
                  value={draft.notice}
                  disabled={locked}
                  aria-invalid={errors.notice ? true : undefined}
                  aria-describedby={`${ids}-notice-hint`}
                  onChange={(e) => patch({ notice: e.target.value }, "notice")}
                  className="h-11 w-24 text-center tabular-nums"
                />
                <p id={`${ids}-notice-hint`} className={errors.notice ? "text-xs font-medium text-danger" : "text-xs text-ink-soft"}>
                  {errors.notice || t.noticeHint}
                </p>
              </div>
            )}
          </div>
        </Card>
      )}

      {draft.enabled && (
        <>
          <Card className="gap-0 p-4 sm:p-5">
            <h3 id={`${ids}-weekly`} tabIndex={-1} className="text-[15px] font-semibold text-ink outline-none">
              {t.weeklyTitle}
            </h3>
            <p className="mt-0.5 text-xs text-ink-soft">
              {t.weeklyHint} {t.capacity}: {t.capacityHint}.
            </p>
            {errors.weekly && (
              <p role="alert" className="mt-2 text-sm font-medium text-danger">
                {errors.weekly}
              </p>
            )}
            <div className="mt-4">
              <WeeklySlotsGrid
                week={draft.weekly}
                errors={errors}
                disabled={locked}
                idPrefix={ids}
                t={t}
                onChange={(weekly, touched) => {
                  setDraft((d) => ({ ...d, weekly }));
                  setSaveError(null);
                  setErrors((e) => {
                    if (!e.weekly && !(touched && e[touched])) return e;
                    return { ...e, weekly: "", ...(touched ? { [touched]: "" } : {}) };
                  });
                }}
              />
            </div>
          </Card>

          <Card className="gap-0 p-4 sm:p-5">
            <h3 className="text-[15px] font-semibold text-ink">{t.closedTitle}</h3>
            <p className="mt-0.5 text-xs text-ink-soft">{t.closedHint}</p>
            <div className="mt-3">
              <ClosedDaysCalendar
                closed={draft.closedDates}
                week={draft.weekly}
                today={today}
                disabled={locked}
                t={t}
                onChange={(closedDates) => patch({ closedDates })}
              />
            </div>
          </Card>

          <Card className="gap-0 p-4 sm:p-5">
            <h3 className="text-[15px] font-semibold text-ink">{t.noteTitle}</h3>
            <p className="mt-0.5 text-xs text-ink-soft">{t.noteHint}</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor={`${ids}-note-ar`} className="block text-sm font-medium text-ink">
                  {t.noteAr}
                </label>
                <Textarea
                  id={`${ids}-note-ar`}
                  dir="rtl"
                  lang="ar"
                  rows={2}
                  maxLength={DELIVERY_SLOT_NOTE_MAX}
                  value={draft.noteAr}
                  placeholder={t.notePlaceholderAr}
                  disabled={locked}
                  onChange={(e) => patch({ noteAr: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor={`${ids}-note-en`} className="block text-sm font-medium text-ink">
                  {t.noteEn}
                </label>
                <Textarea
                  id={`${ids}-note-en`}
                  dir="ltr"
                  lang="en"
                  rows={2}
                  maxLength={DELIVERY_SLOT_NOTE_MAX}
                  value={draft.noteEn}
                  placeholder={t.notePlaceholderEn}
                  disabled={locked}
                  onChange={(e) => patch({ noteEn: e.target.value })}
                />
              </div>
            </div>
          </Card>
        </>
      )}

      {saveError && !dirty && <Alert variant="danger">{saveError}</Alert>}

      <SaveBar
        dirty={dirty && canManage}
        saving={saving}
        saveLabel={t.save}
        savingLabel={t.saving}
        discardLabel={t.discard}
        message={saveError ?? undefined}
        onDiscard={() => {
          setDraft(saved);
          setErrors({});
          setSaveError(null);
        }}
      />
    </form>
  );
}
