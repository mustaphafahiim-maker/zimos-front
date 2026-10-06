import { useState } from "react";
import { Link } from "react-router-dom";
import { MessageSquareText, Pencil, RefreshCw, Undo2, Upload } from "lucide-react";
import { Button } from "@store-builder/ui";
import {
  funnelsList,
  marketplaceSubmissions,
  marketplaceUpdateSubmission,
  marketplaceWithdrawSubmission,
  type MarketplaceSubmission,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatDate } from "@/lib/format";
import { useMarketplaceErrorMessage } from "@/lib/errorMessages";
import { fmt, useT } from "@/i18n/LocaleContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { TemplatePicture } from "./MarketplaceBrowser";
import { ShareTemplateDialog } from "./ShareTemplateDialog";
import { MARKET_STRINGS, STATUS_TONE, categoryLabel, countsLine, statusLabel, type MarketStrings } from "./marketplaceStrings";

/**
 * "Your templates" (handoff 192): every funnel this store sent to the
 * marketplace, newest first, with where its review stands and the reviewer's
 * note. Edit changes the card; Resubmit takes a fresh copy of the funnel's
 * pages for review; Withdraw takes it off the marketplace for good (funnels
 * other stores already copied stay theirs).
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
  const [editing, setEditing] = useState<MarketplaceSubmission | null>(null);
  const [resubmitting, setResubmitting] = useState<MarketplaceSubmission | null>(null);
  const [withdrawing, setWithdrawing] = useState<MarketplaceSubmission | null>(null);

  const replace = (next: MarketplaceSubmission) =>
    list.setData((prev) => ({
      names: prev?.names ?? new Map(),
      submissions: (prev?.submissions ?? []).map((s) => (s.id === next.id ? next : s)),
    }));

  const submissions = list.data?.submissions ?? [];

  return (
    <>
      <DataState loading={list.loading} error={list.error} onRetry={() => void list.refresh()}>
        {submissions.length === 0 ? (
          <EmptyState
            icon={<Upload />}
            title={t.mineEmptyTitle}
            description={t.mineEmptyBody}
            action={
              <Button onClick={() => onShare()}>
                <Upload className="size-4" aria-hidden /> {t.share}
              </Button>
            }
          />
        ) : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {submissions.map((s) => (
              <li key={s.id}>
                <SubmissionCard
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

function SubmissionCard({
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
  const withdrawn = s.status === "withdrawn";
  return (
    <article className="flex h-full flex-col rounded-[var(--radius-card)] bg-paper-raised p-4 shadow-[var(--shadow-card)] ring-1 ring-line">
      <div className="flex gap-3">
        <TemplatePicture t={t} template={s} className="size-16 shrink-0 rounded-xl [&>span]:hidden" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="min-w-0 break-words text-[15px] font-medium text-ink" dir="auto">
              {s.name}
            </h3>
            <StatusBadge value={s.status} text={statusLabel(t, s.status)} tone={STATUS_TONE[s.status]} />
          </div>
          {/* The kind as a chip: a "·" beside Arabic digits reads as a zero («٠»). */}
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
            <span className="rounded-full bg-paper-sunken px-2 py-0.5 text-ink">{categoryLabel(t, s.category)}</span>
            <span>{countsLine(t, s.stepCount, s.usesCount)}</span>
          </p>
          <p className="flex flex-wrap gap-x-3 text-xs text-ink-soft">
            <span>{fmt(t.sentOn, { date: formatDate(s.createdAt) })}</span>
            {s.reviewedAt && <span>{fmt(t.reviewedOn, { date: formatDate(s.reviewedAt) })}</span>}
          </p>
        </div>
      </div>

      <p className="mt-3 text-sm text-ink-soft">{t[`hint_${s.status}`]}</p>
      {s.reviewNote && (
        <div className="mt-2 rounded-xl bg-accent-soft px-3 py-2">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-accent-dark">
            <MessageSquareText className="size-3.5" aria-hidden /> {t.reviewNote}
          </p>
          <p className="mt-0.5 whitespace-pre-line text-sm text-ink" dir="auto">
            {s.reviewNote}
          </p>
        </div>
      )}
      <p className="mt-2 text-xs text-ink-soft">
        {s.funnelId === null ? (
          t.funnelDeleted
        ) : funnelName ? (
          <Link to={`/funnels/${s.funnelId}`} className="inline-flex min-h-11 items-center text-primary underline-offset-4 hover:underline sm:min-h-0" dir="auto">
            {fmt(t.fromFunnel, { name: funnelName })}
          </Link>
        ) : null}
      </p>

      <div className="mt-auto flex flex-wrap gap-2 pt-3">
        {withdrawn ? (
          s.funnelId && (
            <Button variant="outline" size="sm" onClick={onShareAgain}>
              <Upload className="size-4" aria-hidden /> {t.shareAgain}
            </Button>
          )
        ) : (
          <>
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Pencil className="size-4" aria-hidden /> {t.edit}
            </Button>
            {s.funnelId && (
              <Button variant={s.status === "rejected" ? "default" : "outline"} size="sm" onClick={onResubmit}>
                <RefreshCw className="size-4" aria-hidden /> {t.resubmit}
              </Button>
            )}
            <Button variant="ghost" size="sm" className="ms-auto text-danger hover:bg-danger-soft" onClick={onWithdraw}>
              <Undo2 className="size-4 rtl:-scale-x-100" aria-hidden /> {t.withdraw}
            </Button>
          </>
        )}
      </div>
    </article>
  );
}
