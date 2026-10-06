import { useState } from "react";
import { Link } from "react-router-dom";
import { Copy, Pause, Play, Rocket, Trash2, X } from "lucide-react";
import { Button, Spinner, cn } from "@store-builder/ui";
import {
  FUNNEL_BULK_MAX,
  funnelBulk,
  funnelBulkErrorOf,
  funnelsProblemsOf,
  type FunnelBulkAction,
  type FunnelBulkResponse,
  type FunnelBulkResult,
  type FunnelDto,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useFunnelErrorMessage } from "./funnelAdapter";

/*
 * Bulk actions on the funnels list (frontend-handoff 166): the bar shown while
 * funnels are ticked, the delete confirmation, and the list of funnels that
 * did not change. Each funnel goes through its own button's path on the
 * server (POST /funnels/bulk), so one refusal never blocks the others.
 */

const STRINGS = {
  en: {
    toolbar: "Bulk actions",
    selected: "{n} selected",
    clear: "Clear selection",
    publish: "Publish",
    pause: "Pause",
    resume: "Resume",
    duplicate: "Duplicate",
    delete: "Delete",
    working: "Working…",
    max: "Up to 50 at a time",
    deleteTitle: "Delete {n} funnels? This can't be undone.",
    deleteDescription: "Their steps and share links stop working at once. Orders already placed are kept.",
    deleting: "Deleting…",
    cancel: "Cancel",
    result: "{ok} done, {failed} failed",
    resultTitle: "These funnels were not changed",
    unknownFunnel: "A funnel that no longer exists",
    problems: "Can't be published yet: open it in the editor and fix its problems ({n}).",
    close: "Close",
  },
  ar: {
    toolbar: "إجراءات جماعية",
    selected: "{n} متحدد",
    clear: "شيل التحديد",
    publish: "نشر",
    pause: "إيقاف",
    resume: "تشغيل",
    duplicate: "نسخ",
    delete: "حذف",
    working: "ثانية واحدة…",
    max: "لحد ٥٠ مرة واحدة",
    deleteTitle: "حذف {n} مسار بيع؟ مش هتقدر ترجعهم.",
    deleteDescription: "خطواتهم ولينكات المشاركة هتقف فورًا. الأوردرات اللي اتعملت قبل كده محفوظة.",
    deleting: "بيتحذف…",
    cancel: "إلغاء",
    result: "{ok} اتعملوا، {failed} ماتعملوش",
    resultTitle: "مسارات البيع دي ماتغيرتش",
    unknownFunnel: "مسار بيع مبقاش موجود",
    problems: "مينفعش يتنشر لسه: افتحه في المحرر وصلّح المشاكل ({n}).",
    close: "إغلاق",
  },
} satisfies Messages;

const ICONS: Record<FunnelBulkAction, typeof Play> = {
  publish: Rocket,
  pause: Pause,
  resume: Play,
  duplicate: Copy,
  delete: Trash2,
};

/**
 * The bar above the funnels table while funnels are ticked. `onDone` gets the
 * answer so the page can refresh and keep the failed funnels selected.
 */
export function FunnelBulkBar({
  selected,
  onClear,
  onDone,
}: {
  /** The ticked funnels that are on the page now. */
  selected: FunnelDto[];
  onClear: () => void;
  onDone: (response: FunnelBulkResponse) => void | Promise<void>;
}) {
  const t = useT(STRINGS);
  const { intlLocale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const describeError = useFunnelErrorMessage();
  const [running, setRunning] = useState<FunnelBulkAction | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [failures, setFailures] = useState<FunnelBulkResult[]>([]);

  const count = selected.length;
  const number = (n: number) => new Intl.NumberFormat(intlLocale).format(n);
  const tooMany = count > FUNNEL_BULK_MAX;
  const busy = running !== null;

  async function run(action: FunnelBulkAction) {
    setRunning(action);
    try {
      const response = await funnelBulk(apiClient, workspaceId, { action, funnelIds: selected.map((f) => f.id) });
      const message = fmt(t.result, { ok: number(response.succeeded), failed: number(response.failed) });
      if (response.failed > 0) toast.error(message);
      else toast.success(message);
      // One dialog at a time: the delete confirmation closes before the list of refusals opens.
      setConfirmDelete(false);
      setFailures(response.results.filter((r) => !r.ok));
      await onDone(response);
    } catch (err) {
      // The whole request was refused: a missing permission, the store's
      // subscription, or the connection.
      const message = describeError(err);
      // The delete confirmation shows it in place and stays open.
      if (action === "delete") throw new Error(message);
      toast.error(message);
    } finally {
      setRunning(null);
    }
  }

  /** One funnel's refusal in the reader's words. */
  function reason(result: FunnelBulkResult): string {
    const err = funnelBulkErrorOf(result);
    if (!err) return "";
    const problems = funnelsProblemsOf(err);
    if (problems.length > 0) return fmt(t.problems, { n: number(problems.length) });
    return describeError(err);
  }

  if (count === 0 && failures.length === 0) return null;

  // Pause needs a live funnel and Resume a paused one: off when none of the ticked ones can take it.
  const canPause = selected.some((f) => f.status === "published");
  const canResume = selected.some((f) => f.status === "paused");
  const actions: Array<{ action: FunnelBulkAction; label: string; enabled: boolean }> = [
    { action: "publish", label: t.publish, enabled: true },
    { action: "pause", label: t.pause, enabled: canPause },
    { action: "resume", label: t.resume, enabled: canResume },
    { action: "duplicate", label: t.duplicate, enabled: true },
    { action: "delete", label: t.delete, enabled: true },
  ];

  return (
    <>
      {count > 0 && (
        <div
          role="group"
          aria-label={t.toolbar}
          // Sticks just under the top bar (h-14: top-0 on phones, top-3 from md).
          className="sticky top-16 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-primary/40 bg-primary-soft px-3 py-2 shadow-[var(--shadow-raised)] md:top-[4.75rem]"
        >
          <span className="text-sm font-medium text-ink" aria-live="polite">
            {fmt(t.selected, { n: number(count) })}
          </span>
          {tooMany && (
            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-dark">{t.max}</span>
          )}
          {/* Phones: a second row of five equal buttons, icon over label; wider screens: one line. */}
          <div className="order-last grid w-full grid-cols-5 gap-1.5 sm:order-none sm:flex sm:w-auto sm:flex-wrap sm:items-center">
            {actions.map(({ action, label, enabled }) => {
              const Icon = ICONS[action];
              return (
                <Button
                  key={action}
                  size="sm"
                  variant={action === "delete" ? "danger" : "outline"}
                  className={cn(
                    "h-auto min-h-11 flex-col gap-0.5 px-1 py-1.5 text-xs sm:h-8 sm:min-h-9 sm:flex-row sm:gap-1 sm:px-2.5 sm:py-0 sm:text-sm",
                    action !== "delete" && "bg-paper-raised"
                  )}
                  disabled={busy || tooMany || !enabled}
                  title={tooMany ? t.max : undefined}
                  aria-busy={running === action || undefined}
                  onClick={() => (action === "delete" ? setConfirmDelete(true) : void run(action))}
                >
                  {running === action ? <Spinner className="size-4" /> : <Icon className="size-4" aria-hidden />}
                  {label}
                  {running === action && <span className="sr-only">{t.working}</span>}
                </Button>
              );
            })}
          </div>
          <Button variant="ghost" size="sm" className="ms-auto min-h-11 sm:min-h-9" disabled={busy} onClick={onClear}>
            <X className="size-4" aria-hidden />
            {t.clear}
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title={fmt(t.deleteTitle, { n: number(count) })}
        description={t.deleteDescription}
        confirmLabel={t.delete}
        busyLabel={t.deleting}
        cancelLabel={t.cancel}
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => run("delete")}
      />

      <Modal
        open={failures.length > 0}
        onClose={() => setFailures([])}
        title={t.resultTitle}
        footer={
          <Button className="min-h-11" onClick={() => setFailures([])}>
            {t.close}
          </Button>
        }
      >
        <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
          {failures.map((result) => (
            <li key={result.funnelId} className="rounded-[var(--radius)] bg-paper-sunken/60 px-3 py-2">
              {result.name ? (
                <Link
                  to={`/funnels/${result.funnelId}`}
                  className="text-sm font-medium text-ink hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
                  dir="auto"
                >
                  {result.name}
                </Link>
              ) : (
                <span className="text-sm font-medium text-ink">{t.unknownFunnel}</span>
              )}
              <p className="mt-0.5 text-sm text-ink-soft">{reason(result)}</p>
            </li>
          ))}
        </ul>
      </Modal>
    </>
  );
}
