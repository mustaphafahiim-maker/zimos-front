import { useEffect, useId, useState, type FormEvent } from "react";
import { Alert, Input } from "@store-builder/ui";
import {
  ORDER_NUMBER_AFFIX_MAX,
  ORDER_NUMBER_START_MAX,
  apiFieldProblems,
  orderNumbersGet,
  orderNumbersSave,
  type OrderNumbering,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { isPermissionError } from "@/lib/errors";
import { canManageStoreSettings } from "@/lib/fulfilmentAccess";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { SaveBar } from "@/components/SaveBar";
import { SettingsGroup, SettingsRow } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { PaneSkeleton } from "./sections/SettingsCard";

const STRINGS = {
  en: {
    prefix: "Prefix",
    suffix: "Suffix",
    start: "Start at",
    startHint: "Numbers never go back — a smaller start keeps the next number as it is",
    preview: "Your next order will be {nextOrderNumber}",
    keep: "Existing orders keep their numbers",
    affixError: "English letters, digits, # and - only, up to 10",
    startError: "A whole number from 1 to 1,000,000,000",
    save: "Save",
    saving: "Saving…",
    discard: "Discard changes",
    saved: "Saved. Your next order will be {nextOrderNumber}",
    viewOnly: "Only the store owner or a workspace manager can change the order numbers.",
  },
  ar: {
    prefix: "بادئة",
    suffix: "لاحقة",
    start: "ابدأ من",
    startHint: "الأرقام ما بترجعش لورا — لو كتبت رقم أصغر من الجاي هيفضل زي ما هو",
    preview: "الطلب الجاي هيبقى رقمه {nextOrderNumber}",
    keep: "الطلبات القديمة بتفضل بأرقامها",
    affixError: "حروف إنجليزي وأرقام و# و- بس، لحد ١٠",
    startError: "رقم صحيح من ١ لـ ١٬٠٠٠٬٠٠٠٬٠٠٠",
    save: "حفظ",
    saving: "بنحفظ…",
    discard: "تجاهل",
    saved: "اتحفظ. الطلب الجاي هيبقى رقمه {nextOrderNumber}",
    viewOnly: "صاحب المتجر أو مدير مساحة العمل بس اللي يقدر يغيّر ترقيم الطلبات.",
  },
} satisfies Messages;

interface Draft {
  prefix: string;
  suffix: string;
  start: string;
}

const AFFIX = /^[A-Za-z0-9#-]{0,10}$/;

function toDraft(data: OrderNumbering): Draft {
  return { prefix: data.prefix, suffix: data.suffix, start: String(data.start) };
}

/** Arabic-Indic digits typed on an Arabic keyboard count as digits. */
function asciiDigits(value: string): string {
  return value.trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** The start the draft means, or NaN when it is not one the API takes. */
function startOf(draft: Draft): number {
  const text = asciiDigits(draft.start);
  if (!/^\d{1,10}$/.test(text)) return Number.NaN;
  const n = Number(text);
  return n >= 1 && n <= ORDER_NUMBER_START_MAX ? n : Number.NaN;
}

/**
 * Settings → Orders → «ترقيم الطلبات» (handoff 381): the prefix, the suffix
 * and the number new orders start from, with the next order's number as it
 * will read. Reading needs orders.view, saving workspace.manage.
 */
export function OrderNumbersSection() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { currentWorkspace } = useWorkspace();
  const [forbidden, setForbidden] = useState(false);
  const canManage = canManageStoreSettings(currentWorkspace?.role) && !forbidden;

  const numbering = useAsync(() => orderNumbersGet(apiClient, workspaceId), [workspaceId]);
  const saved = numbering.data;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof Draft, string>>>({});
  const prefixId = useId();
  const suffixId = useId();
  const startId = useId();

  useEffect(() => {
    if (saved) setDraft(toDraft(saved));
  }, [saved]);

  const prefix = draft?.prefix.trim().toUpperCase() ?? "";
  const suffix = draft?.suffix.trim().toUpperCase() ?? "";
  const start = draft ? startOf(draft) : Number.NaN;
  const dirty = Boolean(draft && saved && (prefix !== saved.prefix || suffix !== saved.suffix || start !== saved.start));
  useReportDirty(dirty);

  // While typing: prefix + the higher of the start and the next number + suffix. Untouched, the server's own answer.
  const next = !saved ? "" : !dirty ? saved.nextOrderNumber : `${prefix}${Number.isNaN(start) ? saved.nextNumber : Math.max(start, saved.nextNumber)}${suffix}`;

  function patch(change: Partial<Draft>) {
    setDraft((current) => (current ? { ...current, ...change } : current));
    setError(null);
    setFieldErrors((current) => {
      const rest = { ...current };
      for (const key of Object.keys(change) as (keyof Draft)[]) delete rest[key];
      return rest;
    });
  }

  function discard() {
    if (saved) setDraft(toDraft(saved));
    setError(null);
    setFieldErrors({});
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || !draft) return;
    const problems: Partial<Record<keyof Draft, string>> = {};
    if (!AFFIX.test(draft.prefix.trim())) problems.prefix = t.affixError;
    if (!AFFIX.test(draft.suffix.trim())) problems.suffix = t.affixError;
    if (Number.isNaN(start)) problems.start = t.startError;
    if (Object.keys(problems).length > 0) {
      setFieldErrors(problems);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const out = await orderNumbersSave(apiClient, workspaceId, { prefix, suffix, start });
      numbering.setData(out);
      toast.success(fmt(t.saved, { nextOrderNumber: out.nextOrderNumber }));
    } catch (err) {
      const fields = apiFieldProblems(err);
      if (fields.length > 0) {
        const mapped: Partial<Record<keyof Draft, string>> = {};
        for (const problem of fields) {
          if (problem.field === "prefix" || problem.field === "suffix") mapped[problem.field] = t.affixError;
          else if (problem.field === "start") mapped.start = t.startError;
        }
        setFieldErrors(mapped);
        if (Object.keys(mapped).length === 0) setError(errorMessage(err));
      } else {
        if (isPermissionError(err)) setForbidden(true);
        setError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  const field = "h-11 text-base tabular-nums md:text-sm";
  return (
    <DataState loading={numbering.loading} error={numbering.error} onRetry={() => void numbering.refresh()} skeleton={<PaneSkeleton rows={3} />}>
      {draft && saved && (
        <form onSubmit={submit} noValidate className="flex min-w-0 flex-col gap-[var(--bento-gap)]">
          {!canManage && <Alert>{t.viewOnly}</Alert>}
          <SettingsGroup footer={t.keep}>
            <SettingsRow
              label={t.prefix}
              htmlFor={prefixId}
              error={fieldErrors.prefix}
              control={
                <Input
                  id={prefixId}
                  dir="ltr"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="#"
                  maxLength={ORDER_NUMBER_AFFIX_MAX}
                  value={draft.prefix}
                  disabled={!canManage || saving}
                  aria-invalid={fieldErrors.prefix ? true : undefined}
                  onChange={(e) => patch({ prefix: e.target.value })}
                  className={field}
                />
              }
            />
            <SettingsRow
              label={t.suffix}
              htmlFor={suffixId}
              error={fieldErrors.suffix}
              control={
                <Input
                  id={suffixId}
                  dir="ltr"
                  autoComplete="off"
                  autoCapitalize="characters"
                  spellCheck={false}
                  maxLength={ORDER_NUMBER_AFFIX_MAX}
                  value={draft.suffix}
                  disabled={!canManage || saving}
                  aria-invalid={fieldErrors.suffix ? true : undefined}
                  onChange={(e) => patch({ suffix: e.target.value })}
                  className={field}
                />
              }
            />
            <SettingsRow
              label={t.start}
              hint={t.startHint}
              htmlFor={startId}
              error={fieldErrors.start}
              control={
                <Input
                  id={startId}
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  autoComplete="off"
                  maxLength={10}
                  value={draft.start}
                  disabled={!canManage || saving}
                  aria-invalid={fieldErrors.start ? true : undefined}
                  onChange={(e) => patch({ start: e.target.value })}
                  className={field}
                />
              }
            />
          </SettingsGroup>

          <p data-slot="order-number-preview" aria-live="polite" className="px-4 text-sm leading-6 font-medium text-ink">
            <PreviewLine template={t.preview} value={next} />
          </p>

          {error && <Alert variant="danger">{error}</Alert>}

          {canManage && (
            <SaveBar dirty={dirty} saving={saving} saveLabel={t.save} savingLabel={t.saving} discardLabel={t.discard} onDiscard={discard} />
          )}
        </form>
      )}
    </DataState>
  );
}

/** The sentence with the number kept left-to-right inside it (`#1011` must not flip in Arabic). */
function PreviewLine({ template, value }: { template: string; value: string }) {
  const [before, after = ""] = template.split("{nextOrderNumber}");
  return (
    <>
      {before}
      <bdi dir="ltr" className="tabular-nums">
        {value}
      </bdi>
      {after}
    </>
  );
}
