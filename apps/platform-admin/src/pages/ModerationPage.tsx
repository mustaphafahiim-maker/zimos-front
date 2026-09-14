import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { Button, Textarea } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FilterChips } from "@/components/forms";
import { Panel } from "@/components/Panel";
import { Status, StatusBadge, humanize } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useAsync } from "@/lib/useAsync";
import { formatRelative } from "@/lib/format";
import { controlApi } from "@/mock/controlApi";
import type { ModerationReport, ReportStatus } from "@/mock/controlTypes";

type Filter = "open" | "resolved" | "all";
type Action = Exclude<ReportStatus, "open">;

const ACTION_COPY: Record<Action, { label: string; title: string; description: string; destructive: boolean; needsNote: boolean }> = {
  dismissed: { label: "Dismiss", title: "Dismiss report?", description: "No action is taken against the merchant.", destructive: false, needsNote: false },
  warned: { label: "Warn merchant", title: "Warn merchant?", description: "The owner receives a policy warning email with your note.", destructive: false, needsNote: true },
  unpublished: { label: "Unpublish product", title: "Unpublish product?", description: "The product is hidden from the storefront until the merchant appeals.", destructive: true, needsNote: false },
  suspended: { label: "Suspend store", title: "Suspend the whole store?", description: "The workspace is suspended: storefront offline, team signed out.", destructive: true, needsNote: true },
};

export function ModerationPage() {
  const toast = useToast();
  const { data, loading, error, refresh, setData } = useAsync(() => controlApi.listReports(), []);
  const [filter, setFilter] = useState<Filter>("open");
  const [pending, setPending] = useState<{ report: ModerationReport; action: Action } | null>(null);
  const [note, setNote] = useState("");

  const rows = useMemo(() => data ?? [], [data]);
  const filtered = rows.filter((r) => (filter === "all" ? true : filter === "open" ? r.status === "open" : r.status !== "open"));
  const copy = pending ? ACTION_COPY[pending.action] : null;

  return (
    <div>
      <PageHeader title="Moderation" description="Reported storefronts and products awaiting review." />
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        <FilterChips<Filter>
          className="mb-4"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "open", label: "Open", count: rows.filter((r) => r.status === "open").length },
            { value: "resolved", label: "Resolved", count: rows.filter((r) => r.status !== "open").length },
            { value: "all", label: "All", count: rows.length },
          ]}
        />
        {filtered.length === 0 ? (
          <EmptyBlock message={filter === "open" ? "The moderation queue is empty." : "No reports."} />
        ) : (
          <div className="space-y-3">
            {filtered.map((r) => (
              <Panel key={r.id}>
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge tone={r.targetType === "storefront" ? "primary" : "neutral"}>{r.targetType}</StatusBadge>
                      <StatusBadge tone="danger">{humanize(r.reason)}</StatusBadge>
                      <Status value={r.status === "open" ? "open" : "resolved"} label={humanize(r.status)} />
                      <span className="text-xs text-ink-soft">{r.reportsCount} report{r.reportsCount === 1 ? "" : "s"} · {formatRelative(r.createdAt)}</span>
                    </div>
                    <p className="text-sm font-semibold text-ink">{r.targetName}</p>
                    <p className="text-sm text-ink-soft">{r.details}</p>
                    <p className="text-xs text-ink-soft">
                      <Link to={`/workspaces/${r.workspaceId}`} className="font-medium text-primary hover:underline">{r.workspaceName}</Link> · reported by {r.reporterEmail}
                      {r.resolvedBy && ` · resolved by ${r.resolvedBy} ${formatRelative(r.resolvedAt)}`}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <a href={r.previewUrl} target="_blank" rel="noreferrer noopener" className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-line px-3 text-sm text-ink hover:border-line-strong">
                      <ExternalLink className="size-3.5" aria-hidden /> Preview
                    </a>
                    {r.status === "open" &&
                      (Object.keys(ACTION_COPY) as Action[])
                        .filter((a) => a !== "unpublished" || r.targetType === "product")
                        .map((a) => (
                          <Button key={a} size="sm" variant={ACTION_COPY[a].destructive ? "destructive" : "outline"} onClick={() => { setNote(""); setPending({ report: r, action: a }); }}>
                            {ACTION_COPY[a].label}
                          </Button>
                        ))}
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        )}
      </DataState>

      <ConfirmDialog
        open={!!pending}
        title={copy?.title ?? ""}
        description={copy ? `${pending?.report.targetName} — ${copy.description}` : undefined}
        confirmLabel={copy?.label}
        destructive={copy?.destructive}
        confirmDisabled={!!copy?.needsNote && !note.trim()}
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          if (!pending) return;
          const next = await controlApi.resolveReport(pending.report.id, pending.action, note);
          setData((prev) => (prev ?? []).map((x) => (x.id === next.id ? next : x)));
          toast.success(`Report ${humanize(pending.action).toLowerCase()}.`);
          setPending(null);
        }}
      >
        <label htmlFor="mod-note" className="text-sm font-medium text-ink">
          Note {copy?.needsNote && <span className="text-danger">*</span>}
        </label>
        <Textarea id="mod-note" className="mt-1.5" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Internal note / merchant notice" />
      </ConfirmDialog>
    </div>
  );
}
