import { useEffect, useState } from "react";
import { CircleCheck, Circle, Laptop, X } from "lucide-react";
import { Button, Modal, Spinner, cn } from "@store-builder/ui";
import type { Website, WebsiteRevisionSummary } from "@store-builder/api-client";
import { THEMES, type RendererLocale, type ThemeId } from "@store-builder/store-renderer";
import { apiClient } from "@/lib/apiClient";
import { formatDateTime } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { fmt } from "@/i18n/LocaleContext";
import { useBuilderT } from "./strings";

export function ProblemList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div role="alert" className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-danger">
      <p className="font-semibold">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 ps-5">
        {items.map((p, i) => (
          <li key={i}>
            <bdi>{p}</bdi>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function PublishDialog({
  open,
  busy,
  error,
  problems,
  onClose,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  error: string | null;
  problems: string[];
  onClose: () => void;
  onConfirm: () => void;
}) {
  const t = useBuilderT();
  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={t.publishTitle}
      description={t.publishBody}
      closeLabel={t.close}
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button type="button" onClick={onConfirm} disabled={busy}>
            {busy && <Spinner className="size-4" />}
            {busy ? t.publishing : t.publish}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        {error && <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
        <ProblemList title={t.cantPublish} items={problems} />
      </div>
    </Modal>
  );
}

export function ApplyThemeDialog({ themeId, uiLocale, busy, onClose, onApply }: { themeId: ThemeId | null; uiLocale: RendererLocale; busy: boolean; onClose: () => void; onApply: (mode: "style" | "pages") => void }) {
  const t = useBuilderT();
  const preset = themeId ? THEMES[themeId] : null;
  return (
    <Modal open={!!preset} onClose={() => !busy && onClose()} title={preset ? fmt(t.applyThemeTitle, { name: preset.name[uiLocale] }) : ""} description={t.applyThemeBody} closeLabel={t.close}>
      <div className="space-y-3">
        <p className="text-xs text-ink-soft">{t.applyPagesNote}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={busy} onClick={() => onApply("style")}>
            {t.applyStyleOnly}
          </Button>
          <Button type="button" disabled={busy} onClick={() => onApply("pages")}>
            {busy && <Spinner className="size-4" />}
            {t.applyStylePages}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function HistoryDialog({
  open,
  workspaceId,
  websiteId,
  liveRevisionId,
  onClose,
  onRolledBack,
}: {
  open: boolean;
  workspaceId: string;
  websiteId: string;
  liveRevisionId: string | null;
  onClose: () => void;
  onRolledBack: (website: Website, revisionNumber: number) => void;
}) {
  const t = useBuilderT();
  const [revisions, setRevisions] = useState<WebsiteRevisionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setRevisions(null);
    setError(null);
    apiClient
      .listWebsiteRevisions(workspaceId, websiteId)
      .then((r) => alive && setRevisions(r))
      .catch((err) => alive && setError(getErrorMessage(err)));
    return () => {
      alive = false;
    };
  }, [open, workspaceId, websiteId]);

  async function rollback(rev: WebsiteRevisionSummary) {
    setBusy(true);
    setError(null);
    try {
      const { website } = await apiClient.rollbackWebsite(workspaceId, websiteId, rev.id);
      onRolledBack(website, rev.revisionNumber);
      setConfirming(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={t.historyTitle} description={t.rollbackBody} closeLabel={t.close}>
      {error && <p className="mb-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{error}</p>}
      {!revisions && !error ? (
        <div className="flex justify-center py-6">
          <Spinner className="size-5" />
        </div>
      ) : revisions && revisions.length === 0 ? (
        <p className="py-4 text-center text-sm text-ink-soft">{t.historyEmpty}</p>
      ) : (
        <ul className="max-h-[50vh] divide-y divide-line overflow-y-auto rounded-xl border border-line">
          {(revisions ?? []).map((rev) => {
            const live = rev.id === liveRevisionId;
            return (
              <li key={rev.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {fmt(t.historyVersion, { n: rev.revisionNumber })}
                    {live && <span className="ms-2 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">{t.historyLive}</span>}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {formatDateTime(rev.createdAt)} · {fmt(t.historyPages, { n: rev.pageCount })}
                    {rev.note ? ` · ${rev.note}` : ""}
                  </p>
                </div>
                {!live &&
                  (confirming === rev.id ? (
                    <Button type="button" size="sm" disabled={busy} onClick={() => void rollback(rev)}>
                      {busy && <Spinner className="size-4" />}
                      {fmt(t.rollbackConfirm, { n: rev.revisionNumber })}
                    </Button>
                  ) : (
                    <Button type="button" size="sm" variant="outline" onClick={() => setConfirming(rev.id)}>
                      {t.rollback}
                    </Button>
                  ))}
              </li>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}

/** Someone else saved a page after we loaded it: take theirs or overwrite with ours. */
export function ConflictDialog({ pages, busy, onClose, onReload, onOverwrite }: { pages: string[]; busy: boolean; onClose: () => void; onReload: () => void; onOverwrite: () => void }) {
  const t = useBuilderT();
  return (
    <Modal open={pages.length > 0} onClose={() => !busy && onClose()} title={t.conflictTitle} description={t.conflictBody} closeLabel={t.close}>
      <div className="space-y-3">
        <ProblemList title={t.conflictPages} items={pages} />
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={busy} onClick={onReload}>
            {t.conflictReload}
          </Button>
          <Button type="button" disabled={busy} onClick={onOverwrite} className="bg-danger hover:bg-danger/90">
            {busy && <Spinner className="size-4" />}
            {t.conflictOverwrite}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

export function LeaveDialog({ open, busy, onClose, onSaveAndLeave, onLeave }: { open: boolean; busy: boolean; onClose: () => void; onSaveAndLeave: () => void; onLeave: () => void }) {
  const t = useBuilderT();
  return (
    <Modal open={open} onClose={onClose} title={t.leaveTitle} description={t.leaveBody} closeLabel={t.close}>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" onClick={onLeave} className="text-danger">
          {t.leaveAnyway}
        </Button>
        <Button type="button" variant="outline" onClick={onClose}>
          {t.cancel}
        </Button>
        <Button type="button" onClick={onSaveAndLeave} disabled={busy}>
          {busy && <Spinner className="size-4" />}
          {t.saveAndLeave}
        </Button>
      </div>
    </Modal>
  );
}

export type GuideStep = "theme" | "colors" | "content" | "publish";
export interface GuideState {
  dismissed: boolean;
  done: Record<GuideStep, boolean>;
}

export const GUIDE_STEPS: GuideStep[] = ["theme", "colors", "content", "publish"];

export function GuideChecklist({ state, onAction, onDismiss }: { state: GuideState; onAction: (step: GuideStep) => void; onDismiss: () => void }) {
  const t = useBuilderT();
  const done = GUIDE_STEPS.filter((s) => state.done[s]).length;
  const copy: Record<GuideStep, [string, string]> = {
    theme: [t.guideStep1, t.guideStep1Body],
    colors: [t.guideStep2, t.guideStep2Body],
    content: [t.guideStep3, t.guideStep3Body],
    publish: [t.guideStep4, t.guideStep4Body],
  };
  return (
    <aside aria-label={t.guideTitle} className="fixed bottom-4 start-4 z-50 w-80 rounded-2xl border border-line bg-paper-raised p-4 shadow-pop">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-sm font-bold text-ink">{t.guideTitle}</h2>
          <p className="text-xs text-ink-soft">{fmt(t.guideProgress, { done })}</p>
        </div>
        <button type="button" onClick={onDismiss} aria-label={t.guideDismiss} title={t.guideDismiss} className="cursor-pointer rounded-md p-1 text-ink-muted hover:bg-primary-soft hover:text-primary">
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={4} aria-valuenow={done}>
        <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${(done / 4) * 100}%` }} />
      </div>
      <ol className="mt-3 space-y-2">
        {GUIDE_STEPS.map((step, i) => (
          <li key={step} className="flex items-start gap-2">
            {state.done[step] ? <CircleCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> : <Circle className="mt-0.5 size-4 shrink-0 text-ink-muted" aria-hidden />}
            <div className="min-w-0 flex-1">
              <p className={cn("text-sm font-semibold", state.done[step] ? "text-ink-soft line-through" : "text-ink")}>
                {i + 1}. {copy[step][0]}
              </p>
              <p className="text-xs text-ink-soft">{copy[step][1]}</p>
            </div>
            {!state.done[step] && (
              <button type="button" onClick={() => onAction(step)} className="shrink-0 cursor-pointer rounded-md bg-primary-soft px-2 py-0.5 text-xs font-semibold text-primary hover:bg-primary hover:text-white">
                {t.guideGo}
              </button>
            )}
          </li>
        ))}
      </ol>
    </aside>
  );
}

export function UndoToast({ message, onUndo, onDismiss }: { message: string; onUndo: () => void; onDismiss: () => void }) {
  const t = useBuilderT();
  useEffect(() => {
    const id = window.setTimeout(onDismiss, 6000);
    return () => window.clearTimeout(id);
  }, [message, onDismiss]);
  return (
    <div role="status" className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-xl bg-zimos-navy px-4 py-2.5 text-sm text-white shadow-pop">
      <span>{message}</span>
      <button type="button" onClick={onUndo} className="cursor-pointer rounded-md px-2 py-0.5 font-semibold text-[#93c5fd] hover:bg-white/10">
        {t.undoAction}
      </button>
    </div>
  );
}

export function SmallScreenNotice({ onContinue }: { onContinue: () => void }) {
  const t = useBuilderT();
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-paper/95 p-6 backdrop-blur-sm">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary">
          <Laptop className="size-6" aria-hidden />
        </span>
        <h2 className="font-display text-lg font-semibold text-ink">{t.smallScreenTitle}</h2>
        <p className="mt-1 text-sm text-ink-soft">{t.smallScreenBody}</p>
        <Button type="button" variant="outline" className="mt-4" onClick={onContinue}>
          {t.continueAnyway}
        </Button>
      </div>
    </div>
  );
}
