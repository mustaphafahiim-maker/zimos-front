import { useState, type ReactNode } from "react";
import { Button } from "@store-builder/ui";
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
import { pluralOf } from "@/lib/plural";
import { fmt, getIntlLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { IconCopy, IconDelete, IconLaunch, IconPause, IconPlay, type IconComponent } from "@/components/icons";
import { BulkBar, type BulkAction } from "@/components/list";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { useFunnelErrorMessage } from "./funnelAdapter";

/*
 * Bulk actions on the funnels list (frontend-handoff 166): the bar that rises
 * while funnels are ticked, the delete confirmation, and the list of funnels
 * that did not change. Each funnel goes through its own button's path on the
 * server (POST /funnels/bulk), so one refusal never blocks the others.
 */

const STRINGS = {
  en: {
    selected_one: "1 funnel selected",
    selected_other: "{n} funnels selected",
    publish: "Publish",
    pause: "Pause",
    resume: "Resume",
    duplicate: "Duplicate",
    delete: "Delete",
    max: "Up to {n} at a time. Untick a few.",
    noneLive: "None of them is live.",
    nonePaused: "None of them is paused.",
    deleteTitle: "Move {count} to the trash?",
    moveToTrash: "Move to trash",
    count_one: "1 funnel",
    count_other: "{n} funnels",
    deleteDescription: "It moves to the trash, where you can restore it for 30 days. Its link stops working right away.",
    deleting: "Deleting…",
    cancel: "Cancel",
    result: "{ok} done, {failed} not done",
    resultTitle: "These funnels did not change",
    unknownFunnel: "A funnel that is no longer there",
    problems: "It can't be published yet: open it and fix its problems ({n}).",
    close: "Close",
  },
  ar: {
    selected_one: "فانل واحد متحدد",
    selected_two: "فانلين متحددين",
    selected_few: "{n} فانلز متحددين",
    selected_other: "{n} فانل متحدد",
    publish: "انشر",
    pause: "وقّف",
    resume: "شغّل",
    duplicate: "اعمل نسخ",
    delete: "امسح",
    max: "لحد {n} في المرة. شيل التحديد من شوية.",
    noneLive: "مفيش فيهم فانل شغّال.",
    nonePaused: "مفيش فيهم فانل متوقف.",
    deleteTitle: "تنقل {count} لسلة المحذوفات؟",
    moveToTrash: "انقل للمحذوفات",
    count_one: "فانل واحد",
    count_two: "فانلين",
    count_few: "{n} فانلز",
    count_other: "{n} فانل",
    deleteDescription: "هيتنقل لسلة المحذوفات وتقدر ترجعه خلال 30 يوم. الرابط هيوقف فورًا.",
    deleting: "بنمسح…",
    cancel: "إلغاء",
    result: "{ok} اتعملوا، {failed} ماتعملوش",
    resultTitle: "الفانلز دي ماتغيرتش",
    unknownFunnel: "فانل مبقاش موجود",
    problems: "مينفعش يتنشر لسه: افتحه وصلّح مشاكله ({n}).",
    close: "اقفل",
  },
} satisfies Messages;

const ICONS: Record<FunnelBulkAction, IconComponent> = {
  publish: IconLaunch,
  pause: IconPause,
  resume: IconPlay,
  duplicate: IconCopy,
  delete: IconDelete,
};

/**
 * The bar over the funnels list while funnels are ticked. `onDone` gets the
 * answer so the page can refresh and keep the failed funnels selected.
 */
export function FunnelBulkBar({
  selected,
  onClear,
  onDone,
  extra,
}: {
  /** The ticked funnels that are on the page now. */
  selected: FunnelDto[];
  onClear: () => void;
  onDone: (response: FunnelBulkResponse) => void | Promise<void>;
  /** A line under the actions — the page's "select all". Optional: none by default. */
  extra?: ReactNode;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const describeError = useFunnelErrorMessage();
  const [running, setRunning] = useState<FunnelBulkAction | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [failures, setFailures] = useState<FunnelBulkResult[]>([]);

  const count = selected.length;
  const number = (n: number) => new Intl.NumberFormat(getIntlLocale()).format(n);
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

  // Pause needs a live funnel and Resume a paused one: off when none of the ticked ones can take it.
  const canPause = selected.some((f) => f.status === "published");
  const canResume = selected.some((f) => f.status === "paused");
  const tooManyReason = tooMany ? fmt(t.max, { n: number(FUNNEL_BULK_MAX) }) : undefined;
  const action = (id: FunnelBulkAction, label: string, enabled: boolean, why?: string): BulkAction => ({
    id,
    label,
    icon: ICONS[id],
    destructive: id === "delete",
    disabled: busy || tooMany || !enabled,
    disabledReason: tooManyReason ?? (enabled ? undefined : why),
    onSelect: () => (id === "delete" ? setConfirmDelete(true) : void run(id)),
  });
  const actions: BulkAction[] = [
    action("publish", t.publish, true),
    action("pause", t.pause, canPause, t.noneLive),
    action("resume", t.resume, canResume, t.nonePaused),
    action("duplicate", t.duplicate, true),
    action("delete", t.delete, true),
  ];

  return (
    <>
      <BulkBar
        count={count}
        label={pluralOf(t, "selected", count)}
        onClear={onClear}
        actions={actions}
        busy={busy}
        extra={
          tooManyReason || extra ? (
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {tooManyReason && <span className="font-medium text-accent-dark">{tooManyReason}</span>}
              {extra}
            </span>
          ) : undefined
        }
      />

      <ConfirmDialog
        open={confirmDelete}
        title={fmt(t.deleteTitle, { count: pluralOf(t, "count", count) })}
        description={t.deleteDescription}
        confirmLabel={t.moveToTrash}
        busyLabel={t.deleting}
        cancelLabel={t.cancel}
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => run("delete")}
      />

      <Sheet
        open={failures.length > 0}
        onOpenChange={(open) => {
          if (!open) setFailures([]);
        }}
        title={t.resultTitle}
        size="sm"
        footer={<Button onClick={() => setFailures([])}>{t.close}</Button>}
      >
        <ul className="space-y-2">
          {failures.map((result) => (
            <li key={result.funnelId} data-slot="funnel-failure" className="zimos-funnel-note rounded-[0.875rem] bg-paper-sunken/60 px-3.5 py-2.5">
              {result.name ? (
                <ViewLink
                  to={`/funnels/${result.funnelId}`}
                  className="inline-flex min-h-11 items-center text-sm font-medium text-ink underline-offset-4 hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary pointer-fine:min-h-0"
                  dir="auto"
                >
                  {result.name}
                </ViewLink>
              ) : (
                <span className="text-sm font-medium text-ink">{t.unknownFunnel}</span>
              )}
              <p className="text-sm leading-6 text-ink-soft">{reason(result)}</p>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
