import { useState } from "react";
import { Button } from "@store-builder/ui";
import {
  funnelsList,
  marketplaceSubmissions,
  marketplaceUpdateSubmission,
  marketplaceWithdrawSubmission,
  type MarketplaceSubmission,
  type MarketplaceSubmissionStatus,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatDate } from "@/lib/format";
import { useMarketplaceErrorMessage } from "@/lib/errorMessages";
import { fmt, useT } from "@/i18n/LocaleContext";
import { IconEdit, IconFunnels, IconMessage, IconRefresh, IconUndo, IconUpload } from "@/components/icons";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ContextMenu, type ContextMenuItem } from "@/components/ContextMenu";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { ChipRow, ListSkeleton, type ChipItem } from "@/components/list";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { useViewNavigate } from "@/lib/viewTransition";
import { ItemMenu } from "@/pages/catalog/media/ItemMenu";
import { TemplatePicture } from "./MarketplaceBrowser";
import { ShareTemplateDialog } from "./ShareTemplateDialog";
import { MARKET_STRINGS, STATUS_TONE, categoryLabel, countsLine, statusLabel, type MarketStrings } from "./marketplaceStrings";

type StateFilter = "all" | MarketplaceSubmissionStatus;
const STATES: MarketplaceSubmissionStatus[] = ["pending", "approved", "rejected", "withdrawn"];
const CHIP_TONE: Record<MarketplaceSubmissionStatus, ChipItem<StateFilter>["tone"]> = {
  pending: "attention",
  approved: "success",
  rejected: "danger",
  withdrawn: "default",
};

/**
 * «تمبلتاتي» (handoff 192): every funnel this store sent to the marketplace,
 * newest first, as a list — where its review stands as a chip, the reviewer's
 * note under it, and the state chips over the list to narrow it. Edit changes
 * the card; Resubmit takes a fresh copy of the funnel's pages for review;
 * Withdraw takes it off the marketplace for good (funnels other stores
 * already copied stay theirs).
 */
export function MySubmissions({ version, onShare }: { version: number; onShare: (funnelId?: string) => void }) {
  const t = useT(MARKET_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const marketError = useMarketplaceErrorMessage();
  const list = useAsync(
    () =>
      Promise.all([
        marketplaceSubmissions(apiClient, workspaceId),
        // Only for the source funnels' names: a failure leaves the rows without them.
        funnelsList(apiClient, workspaceId).catch(() => []),
      ]).then(([submissions, funnels]) => ({ submissions, names: new Map(funnels.map((f) => [f.id, f.name])) })),
    [workspaceId, version]
  );
  const [state, setState] = useState<StateFilter>("all");
  const [editing, setEditing] = useState<MarketplaceSubmission | null>(null);
  const [resubmitting, setResubmitting] = useState<MarketplaceSubmission | null>(null);
  const [withdrawing, setWithdrawing] = useState<MarketplaceSubmission | null>(null);

  const replace = (next: MarketplaceSubmission) =>
    list.setData((prev) => ({
      names: prev?.names ?? new Map(),
      submissions: (prev?.submissions ?? []).map((s) => (s.id === next.id ? next : s)),
    }));

  const submissions = list.data?.submissions ?? [];
  const shown = state === "all" ? submissions : submissions.filter((s) => s.status === state);
  const chips: ChipItem<StateFilter>[] = [
    { value: "all", label: t.all, count: submissions.length },
    ...STATES.map((s) => ({ value: s, label: statusLabel(t, s), count: submissions.filter((x) => x.status === s).length, tone: CHIP_TONE[s] })),
  ];

  return (
    <>
      <DataState loading={list.loading} error={list.error} onRetry={() => void list.refresh()} skeleton={<ListSkeleton variant="card" rows={3} />}>
        {submissions.length === 0 ? (
          <EmptyState
            icon={<IconUpload aria-hidden />}
            title={t.mineEmptyTitle}
            description={t.mineEmptyBody}
            action={
              <Button className="min-h-11 rounded-full px-5" onClick={() => onShare()}>
                <IconUpload className="size-4" aria-hidden /> {t.share}
              </Button>
            }
          />
        ) : (
          <div className="flex min-w-0 flex-col gap-3">
            <ChipRow items={chips} value={state} onChange={setState} label={t.states} />
            {shown.length === 0 ? (
              <p className="px-1 py-6 text-center text-sm text-ink-soft">{t.noneInState}</p>
            ) : (
              <ul aria-label={t.tabMine} className="flex max-w-3xl flex-col gap-2.5">
                {shown.map((s) => (
                  <li key={s.id}>
                    <SubmissionRow
                      t={t}
                      submission={s}
                      funnelName={s.funnelId ? (list.data?.names.get(s.funnelId) ?? null) : null}
                      onEdit={() => setEditing(s)}
                      onResubmit={() => setResubmitting(s)}
                      onWithdraw={() => setWithdrawing(s)}
                      onShareAgain={() => onShare(s.funnelId ?? undefined)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </DataState>

      <ShareTemplateDialog open={editing !== null} submission={editing} onClose={() => setEditing(null)} onSaved={replace} />

      <ConfirmDialog
        open={resubmitting !== null}
        title={resubmitting ? fmt(t.resubmitTitle, { name: resubmitting.name }) : t.resubmit}
        description={resubmitting?.status === "approved" ? `${t.resubmitBody} ${t.resubmitListed}` : t.resubmitBody}
        confirmLabel={t.resubmit}
        busyLabel={t.sending}
        onCancel={() => setResubmitting(null)}
        onConfirm={async () => {
          if (!resubmitting) return;
          try {
            replace(await marketplaceUpdateSubmission(apiClient, workspaceId, resubmitting.id, { resubmit: true }));
          } catch (err) {
            throw new Error(marketError(err));
          }
          toast.success(t.resubmitted);
          setResubmitting(null);
        }}
      />

      <ConfirmDialog
        open={withdrawing !== null}
        title={withdrawing ? fmt(t.withdrawTitle, { name: withdrawing.name }) : t.withdraw}
        description={t.withdrawBody}
        confirmLabel={t.withdraw}
        destructive
        onCancel={() => setWithdrawing(null)}
        onConfirm={async () => {
          if (!withdrawing) return;
          try {
            replace(await marketplaceWithdrawSubmission(apiClient, workspaceId, withdrawing.id));
          } catch (err) {
            throw new Error(marketError(err));
          }
          toast.success(t.withdrawn);
          setWithdrawing(null);
        }}
      />
    </>
  );
}

/**
 * One submission: its picture, name and state on the first line; what kind it
 * is, how often it was used and when it was sent under them; then what the
 * state means and the reviewer's note. The action that state calls for is the
 * one button; everything else is in «…» (and a right-click or a long press).
 */
function SubmissionRow({
  t,
  submission: s,
  funnelName,
  onEdit,
  onResubmit,
  onWithdraw,
  onShareAgain,
}: {
  t: MarketStrings;
  submission: MarketplaceSubmission;
  funnelName: string | null;
  onEdit: () => void;
  onResubmit: () => void;
  onWithdraw: () => void;
  onShareAgain: () => void;
}) {
  const navigate = useViewNavigate();
  const withdrawn = s.status === "withdrawn";
  const funnelId = s.funnelId;

  const menu: ContextMenuItem[] = [];
  if (withdrawn) {
    if (funnelId) menu.push({ id: "share", label: t.shareAgain, icon: IconUpload, onSelect: onShareAgain });
  } else {
    menu.push({ id: "edit", label: t.edit, icon: IconEdit, onSelect: onEdit });
    if (funnelId) menu.push({ id: "resubmit", label: t.resubmit, icon: IconRefresh, onSelect: onResubmit });
  }
  if (funnelId && funnelName) menu.push({ id: "funnel", label: t.openFunnel, icon: IconFunnels, onSelect: () => navigate(`/funnels/${funnelId}`) });
  if (!withdrawn) menu.push({ id: "withdraw", label: t.withdraw, icon: IconUndo, onSelect: onWithdraw, destructive: true, separatorBefore: true });

  // The one button: what this state asks for.
  const main = withdrawn
    ? funnelId
      ? { label: t.shareAgain, onClick: onShareAgain, strong: false }
      : null
    : s.status === "rejected" && funnelId
      ? { label: t.resubmit, onClick: onResubmit, strong: true }
      : { label: t.edit, onClick: onEdit, strong: false };
  const menuLabel = fmt(t.menuLabel, { name: s.name });

  return (
    <ContextMenu items={menu} label={menuLabel}>
      <article
        data-slot="submission-row"
        className="zimos-row-card rounded-[1.25rem] bg-paper-raised px-3.5 py-3 text-ink shadow-[var(--shadow-card)] ring-1 ring-line"
      >
        <div className="flex items-start gap-3">
          <TemplatePicture t={t} template={s} className="size-12 shrink-0 rounded-[0.875rem] [&>span]:hidden" />
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <h3 className="min-w-0 flex-1 truncate text-[15px] leading-[1.375rem] font-semibold text-ink" dir="auto">
                {s.name}
              </h3>
              <StatusBadge value={s.status} text={statusLabel(t, s.status)} tone={STATUS_TONE[s.status]} className="shrink-0" />
            </div>
            {/* The kind as a chip: a "·" beside Arabic digits reads as a zero («٠»). */}
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-ink-soft">
              <span className="rounded-full bg-paper-sunken px-2 py-0.5 text-ink">{categoryLabel(t, s.category)}</span>
              <span>{countsLine(t, s.stepCount, s.usesCount)}</span>
            </p>
            <p className="mt-0.5 flex flex-wrap gap-x-3 text-xs leading-5 text-ink-soft">
              <span>{fmt(t.sentOn, { date: formatDate(s.createdAt) })}</span>
              {s.reviewedAt && <span>{fmt(t.reviewedOn, { date: formatDate(s.reviewedAt) })}</span>}
            </p>
          </div>
        </div>

        <p className="mt-2.5 text-sm leading-6 text-ink-soft">{t[`hint_${s.status}`]}</p>
        {s.reviewNote && (
          <div className="zimos-funnel-warn mt-2 rounded-[0.875rem] bg-accent-soft px-3 py-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-accent-dark">
              <IconMessage className="size-3.5" aria-hidden /> {t.reviewNote}
            </p>
            <p className="mt-0.5 text-sm leading-6 whitespace-pre-line text-ink" dir="auto">
              {s.reviewNote}
            </p>
          </div>
        )}

        <div className="mt-1.5 flex items-center gap-2">
          <p className="min-w-0 flex-1 text-xs leading-5 text-ink-soft">
            {funnelId === null ? (
              t.funnelDeleted
            ) : funnelName ? (
              <ViewLink
                to={`/funnels/${funnelId}`}
                className="inline-flex min-h-11 max-w-full items-center text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-primary"
              >
                <bdi className="truncate">{fmt(t.fromFunnel, { name: funnelName })}</bdi>
              </ViewLink>
            ) : null}
          </p>
          {main && (
            <Button variant={main.strong ? "default" : "outline"} className="min-h-11 shrink-0 rounded-full px-4" onClick={main.onClick}>
              {main.label}
            </Button>
          )}
          <ItemMenu items={menu} label={menuLabel} />
        </div>
      </article>
    </ContextMenu>
  );
}
