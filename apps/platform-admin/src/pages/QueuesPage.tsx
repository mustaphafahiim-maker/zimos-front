import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@store-builder/ui";
import { adminQueueJobs, adminQueues, adminRetryQueueJob, type AdminQueueJob } from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { Mono, Panel } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { apiClient } from "@/lib/apiClient";
import { formatDateTime, formatNumber, formatRelative } from "@/lib/format";

/**
 * Background work at a glance (SPEC §3.5): what each queue holds, when each
 * repeatable job last ran, and the jobs that failed for good — with a retry.
 */

function every(ms: number | null): string {
  if (!ms) return "—";
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)} min`;
  return `${Math.round(ms / 3600000)} h`;
}

export function QueuesPage() {
  const toast = useToast();
  const overview = useAsync(() => adminQueues(apiClient), []);
  const failed = useAsync(() => adminQueueJobs(apiClient, { status: "failed", limit: 100 }), []);
  const [retrying, setRetrying] = useState<string | null>(null);

  const data = overview.data;
  const totals = (data?.queues ?? []).reduce(
    (sum, q) => ({ pending: sum.pending + q.pending, active: sum.active + q.active, failed: sum.failed + q.failed, done: sum.done + q.completedLastDay }),
    { pending: 0, active: 0, failed: 0, done: 0 }
  );

  function reload() {
    void overview.refresh({ silent: true });
    void failed.refresh({ silent: true });
  }

  async function retry(job: AdminQueueJob) {
    setRetrying(job.id);
    try {
      await adminRetryQueueJob(apiClient, job.id);
      toast.success(`${job.name} is back in line.`);
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setRetrying(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="Queues"
        description="Background jobs, repeatable jobs and the event outbox."
        actions={
          <Button variant="outline" onClick={reload}>
            <RefreshCw /> Refresh
          </Button>
        }
      />
      <DataState loading={overview.loading} error={overview.error} onRetry={() => void overview.refresh()}>
        {data && (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <KpiCard label="Waiting" value={formatNumber(totals.pending)} />
              <KpiCard label="Running" value={formatNumber(totals.active)} />
              <KpiCard label="Failed" value={formatNumber(totals.failed)} />
              <KpiCard label="Done, last 24 h" value={formatNumber(totals.done)} />
              <KpiCard
                label="Outbox waiting"
                value={formatNumber(data.outbox.pending)}
                hint={data.outbox.oldestPendingAt ? `Oldest ${formatRelative(data.outbox.oldestPendingAt)}` : `Driver: ${data.driver}`}
              />
            </div>

            <Panel title="Queues" flush>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-start text-xs text-ink-soft uppercase">
                    <tr className="border-b border-line">
                      <th className="px-4 py-2 text-start font-medium">Queue</th>
                      <th className="px-4 py-2 text-end font-medium">Waiting</th>
                      <th className="px-4 py-2 text-end font-medium">Running</th>
                      <th className="px-4 py-2 text-end font-medium">Failed</th>
                      <th className="px-4 py-2 text-end font-medium">Done (24 h)</th>
                      <th className="px-4 py-2 text-start font-medium">Oldest waiting</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.queues.map((q) => (
                      <tr key={q.name}>
                        <td className="px-4 py-2">
                          <Mono>{q.name}</Mono>
                        </td>
                        <td className="px-4 py-2 text-end tabular-nums">{formatNumber(q.pending)}</td>
                        <td className="px-4 py-2 text-end tabular-nums">{formatNumber(q.active)}</td>
                        <td className="px-4 py-2 text-end tabular-nums">
                          {q.failed > 0 ? <StatusBadge tone="danger">{formatNumber(q.failed)}</StatusBadge> : "0"}
                        </td>
                        <td className="px-4 py-2 text-end tabular-nums">{formatNumber(q.completedLastDay)}</td>
                        <td className="px-4 py-2 text-ink-soft">{q.oldestPendingAt ? formatRelative(q.oldestPendingAt) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Repeatable jobs" description="Each runs on one worker at a time." flush>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-ink-soft uppercase">
                    <tr className="border-b border-line">
                      <th className="px-4 py-2 text-start font-medium">Job</th>
                      <th className="px-4 py-2 text-start font-medium">Every</th>
                      <th className="px-4 py-2 text-start font-medium">Last run</th>
                      <th className="px-4 py-2 text-start font-medium">Result</th>
                      <th className="px-4 py-2 text-start font-medium">Next run</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {data.schedules.map((s) => (
                      <tr key={s.name}>
                        <td className="px-4 py-2">
                          <Mono>{s.name}</Mono>
                        </td>
                        <td className="px-4 py-2">{every(s.everyMs)}</td>
                        <td className="px-4 py-2 text-ink-soft">
                          {s.lastRunAt ? `${formatRelative(s.lastRunAt)}${s.lastDurationMs !== null ? ` · ${s.lastDurationMs} ms` : ""}` : "Not yet"}
                        </td>
                        <td className="px-4 py-2">
                          {s.lastStatus === "failed" ? (
                            <span title={s.lastError ?? undefined}>
                              <StatusBadge tone="danger">Failed</StatusBadge>
                            </span>
                          ) : s.lastStatus === "ok" ? (
                            <StatusBadge tone="success">OK</StatusBadge>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="px-4 py-2 text-ink-soft">{s.nextRunAt ? formatDateTime(s.nextRunAt) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Failed jobs" description="Out of attempts. Retry puts a job back in line with a fresh set." flush>
              <DataState loading={failed.loading} error={failed.error} onRetry={() => void failed.refresh()}>
                {(failed.data ?? []).length === 0 ? (
                  <div className="p-4">
                    <EmptyBlock message="No failed jobs." />
                  </div>
                ) : (
                  <ul className="divide-y divide-line">
                    {(failed.data ?? []).map((job) => (
                      <li key={job.id} className="flex flex-wrap items-start gap-3 px-4 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 text-sm">
                            <Mono>{job.queue}</Mono>
                            <span className="font-medium text-ink">{job.name}</span>
                            <span className="text-xs text-ink-soft">
                              {job.attempts} of {job.maxAttempts} attempts · {formatRelative(job.finishedAt ?? job.createdAt)}
                            </span>
                          </p>
                          {job.lastError && <p className="mt-1 break-words text-xs text-danger">{job.lastError}</p>}
                        </div>
                        <Button size="sm" variant="outline" disabled={retrying === job.id} onClick={() => retry(job)}>
                          {retrying === job.id ? "Retrying…" : "Retry"}
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </DataState>
            </Panel>
          </div>
        )}
      </DataState>
    </div>
  );
}
