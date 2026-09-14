import { useMemo, useState } from "react";
import { Play, RefreshCw, RotateCw, XCircle } from "lucide-react";
import { Button, Table, TableBody, TableHeader, TableRow, cn } from "@store-builder/ui";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FilterChips } from "@/components/forms";
import { Mono, Panel, Td, Th } from "@/components/Panel";
import { StatusBadge, humanize, type Tone } from "@/components/StatusBadge";
import { Toggle } from "@store-builder/ui";
import { useAction } from "@/components/controls";
import { useAsync } from "@store-builder/ui";
import { formatDateTime, formatRelative } from "@/lib/format";
import { controlApi } from "@/mock/controlApi";
import type { BackgroundJob, JobStatus, JobType } from "@/mock/controlTypes";

const JOB_TONE: Record<JobStatus, Tone> = { queued: "info", running: "primary", succeeded: "success", failed: "danger", canceled: "neutral" };
type StatusFilter = "all" | JobStatus;
type TypeFilter = "all" | JobType;

export function JobsPage() {
  const jobs = useAsync(() => controlApi.listJobs(), []);
  const cron = useAsync(() => controlApi.listCron(), []);
  const [status, setStatus] = useState<StatusFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [cancelling, setCancelling] = useState<BackgroundJob | null>(null);
  const { busy, run } = useAction();

  const rows = useMemo(() => jobs.data ?? [], [jobs.data]);
  const filtered = rows.filter((j) => (status === "all" || j.status === status) && (type === "all" || j.type === type));
  const replaceJob = (j: BackgroundJob) => jobs.setData((prev) => (prev ?? []).map((x) => (x.id === j.id ? j : x)));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Jobs & queues"
        description="Background work: email sends, carrier sync, settlement imports, webhook deliveries."
        actions={<Button variant="outline" size="sm" onClick={() => { void jobs.refresh(); void cron.refresh(); }}><RefreshCw /> Refresh</Button>}
      />

      <DataState loading={jobs.loading} error={jobs.error} onRetry={() => void jobs.refresh()}>
        <div className="mb-4 flex flex-col gap-2">
          <FilterChips<StatusFilter>
            value={status}
            onChange={setStatus}
            options={(["all", "queued", "running", "failed", "succeeded", "canceled"] as const).map((s) => ({ value: s, label: humanize(s), count: s === "all" ? rows.length : rows.filter((j) => j.status === s).length }))}
          />
          <FilterChips<TypeFilter>
            value={type}
            onChange={setType}
            options={(["all", "email_send", "carrier_sync", "settlement_import", "webhook_delivery"] as const).map((t) => ({ value: t, label: humanize(t) }))}
          />
        </div>
        {filtered.length === 0 ? (
          <EmptyBlock message="No jobs match these filters." />
        ) : (
          <Panel flush title="Background jobs">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <Th>Job</Th>
                    <Th>Status</Th>
                    <Th>Attempts</Th>
                    <Th>Last error</Th>
                    <Th>Updated</Th>
                    <Th className="text-end">Actions</Th>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((j) => (
                    <TableRow key={j.id}>
                      <Td>
                        <span className="block font-medium">{j.label}</span>
                        <span className="text-xs text-ink-soft"><Mono>{j.id}</Mono> · {humanize(j.type)}{j.workspaceName ? ` · ${j.workspaceName}` : ""}</span>
                      </Td>
                      <Td><StatusBadge tone={JOB_TONE[j.status]} dot>{humanize(j.status)}</StatusBadge></Td>
                      <Td className={cn("tabular", j.attempts >= j.maxAttempts && "text-danger")}>{j.attempts}/{j.maxAttempts}</Td>
                      <Td className="max-w-64 truncate text-xs text-danger" >{j.lastError ?? <span className="text-ink-muted">—</span>}</Td>
                      <Td className="text-ink-soft" ><span title={formatDateTime(j.updatedAt)}>{formatRelative(j.updatedAt)}</span></Td>
                      <Td>
                        <div className="flex justify-end gap-1.5">
                          {(j.status === "failed" || j.status === "canceled") && (
                            <Button size="sm" variant="outline" disabled={busy === j.id} onClick={() => void run(j.id, () => controlApi.retryJob(j.id), "Job re-queued.").then((r) => r && replaceJob(r))}>
                              <RotateCw /> Retry
                            </Button>
                          )}
                          {(j.status === "queued" || j.status === "running") && (
                            <Button size="sm" variant="ghost" className="text-danger" onClick={() => setCancelling(j)}>
                              <XCircle /> Cancel
                            </Button>
                          )}
                        </div>
                      </Td>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
        )}
      </DataState>

      <DataState loading={cron.loading} error={cron.error} onRetry={() => void cron.refresh()} empty={!!cron.data && cron.data.length === 0} emptyMessage="No cron schedules.">
        <Panel flush title="Cron schedules">
          <ul className="divide-y divide-line">
            {(cron.data ?? []).map((c) => (
              <li key={c.id} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ink">
                    {c.name} <Mono>{c.expression}</Mono>
                    {c.lastStatus === "failed" && <StatusBadge tone="danger">Last run failed</StatusBadge>}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {c.description} · last run {formatRelative(c.lastRunAt)} · next {c.enabled ? formatRelative(c.nextRunAt) : "paused"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button size="sm" variant="outline" disabled={busy === `run-${c.id}`} onClick={() => void run(`run-${c.id}`, () => controlApi.runCronNow(c.id), `${c.name} ran.`).then((r) => r && cron.setData((prev) => (prev ?? []).map((x) => (x.id === r.id ? r : x))))}>
                    <Play /> Run now
                  </Button>
                  <Toggle
                    label={`${c.name} enabled`}
                    hideLabel
                    checked={c.enabled}
                    disabled={busy === `cron-${c.id}`}
                    onChange={(v) => void run(`cron-${c.id}`, () => controlApi.setCronEnabled(c.id, v), v ? "Schedule enabled." : "Schedule paused.").then((r) => r && cron.setData((prev) => (prev ?? []).map((x) => (x.id === r.id ? r : x))))}
                  />
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      </DataState>

      <ConfirmDialog
        open={!!cancelling}
        title="Cancel job?"
        description={`${cancelling?.label ?? ""} will stop and won't be retried automatically.`}
        confirmLabel="Cancel job"
        destructive
        onCancel={() => setCancelling(null)}
        onConfirm={async () => {
          if (!cancelling) return;
          replaceJob(await controlApi.cancelJob(cancelling.id));
          setCancelling(null);
        }}
      />
    </div>
  );
}
