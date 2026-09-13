import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Label } from "@store-builder/ui";
import { Clock, Download, Phone, PhoneIncoming, Play, ThumbsUp } from "lucide-react";
import type { CallLog, CallOutcome } from "@/mock/types2";
import { mockApi } from "@/mock/api";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatDateTime, humanize } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { OUTCOME_TONE, formatDuration } from "./shared";

type DateRange = "today" | "7d" | "all";

const OUTCOMES: CallOutcome[] = ["confirmed", "no_answer", "busy", "postponed", "cancelled", "wrong_number", "duplicate"];

function pct(n: number, d: number): string {
  return d === 0 ? "—" : `${Math.round((n / d) * 100)}%`;
}

function csvCell(v: string | number | null): string {
  const s = v === null ? "" : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function CallLogsPage() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const logs = useAsync(() => mockApi.listCallLogs(workspaceId), [workspaceId]);
  const agents = useAsync(() => mockApi.listAgents(workspaceId), [workspaceId]);

  const [agentId, setAgentId] = useState("all");
  const [outcome, setOutcome] = useState<"all" | CallOutcome>("all");
  const [range, setRange] = useState<DateRange>("7d");

  const rows = useMemo(() => {
    const all = logs.data ?? [];
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekAgo = now.getTime() - 7 * 86400000;
    return all
      .filter((l) => {
        if (agentId !== "all" && l.agentId !== agentId) return false;
        if (outcome !== "all" && l.outcome !== outcome) return false;
        const t = new Date(l.startedAt).getTime();
        if (range === "today" && t < startOfToday) return false;
        if (range === "7d" && t < weekAgo) return false;
        return true;
      })
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }, [logs.data, agentId, outcome, range]);

  const kpis = useMemo(() => {
    const total = rows.length;
    const reached = rows.filter((l) => l.durationSeconds > 0);
    const confirmed = rows.filter((l) => l.outcome === "confirmed").length;
    const avg = reached.length ? Math.round(reached.reduce((s, l) => s + l.durationSeconds, 0) / reached.length) : 0;
    return { total, reachRate: pct(reached.length, total), confRate: pct(confirmed, reached.length), avg };
  }, [rows]);

  function exportCsv() {
    const header = ["Time", "Order", "Agent", "Duration (s)", "Outcome", "Note", "Recording"];
    const lines = rows.map((l) => [l.startedAt, l.orderNumber, l.agentName, l.durationSeconds, l.outcome, l.note, l.recordingUrl ? "yes" : "no"].map(csvCell).join(","));
    const blob = new Blob(["﻿" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `call-logs-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} calls.`);
  }

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Call logs"
        description="Every confirmation call your team made, with outcome and recording."
        back={{ to: "/call-center", label: "Call center" }}
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download /> Export CSV
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Total calls" value={kpis.total} hint="In the selected range" icon={<Phone />} />
        <KpiCard label="Reach rate" value={kpis.reachRate} hint="Calls answered / total" icon={<PhoneIncoming />} />
        <KpiCard label="Confirmation rate" value={kpis.confRate} hint="Confirmed / reached" icon={<ThumbsUp />} />
        <KpiCard label="Avg duration" value={formatDuration(kpis.avg)} hint="Answered calls only" icon={<Clock />} />
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs text-ink-soft">Agent</Label>
          <Select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="mt-1 h-8 w-44 py-1">
            <option value="all">All agents</option>
            {(agents.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label className="text-xs text-ink-soft">Outcome</Label>
          <Select value={outcome} onChange={(e) => setOutcome(e.target.value as "all" | CallOutcome)} className="mt-1 h-8 w-40 py-1">
            <option value="all">All outcomes</option>
            {OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {humanize(o)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label className="text-xs text-ink-soft">Date</Label>
          <Select value={range} onChange={(e) => setRange(e.target.value as DateRange)} className="mt-1 h-8 w-32 py-1">
            <option value="today">Today</option>
            <option value="7d">Last 7 days</option>
            <option value="all">All time</option>
          </Select>
        </div>
        <p className="ml-auto text-xs text-ink-soft">{rows.length} calls</p>
      </div>

      <DataState loading={logs.loading} error={logs.error} empty={rows.length === 0} emptyMessage="No calls in this range." onRetry={() => logs.refresh()}>
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-line bg-paper-raised text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-medium">Time</th>
                <th className="px-4 py-3 font-medium">Order</th>
                <th className="px-4 py-3 font-medium">Agent</th>
                <th className="px-4 py-3 font-medium">Duration</th>
                <th className="px-4 py-3 font-medium">Outcome</th>
                <th className="px-4 py-3 font-medium">Note</th>
                <th className="px-4 py-3 font-medium">Recording</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l: CallLog) => (
                <tr key={l.id} className="border-b border-line last:border-0 hover:bg-paper-raised">
                  <td className="whitespace-nowrap px-4 py-3 text-xs text-ink-soft">{formatDateTime(l.startedAt)}</td>
                  <td className="px-4 py-3">
                    <Link to={`/orders/${l.orderId}`} className="font-medium text-primary hover:underline">
                      {l.orderNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-ink" dir="auto">
                    {l.agentName}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs tabular-nums text-ink">{l.durationSeconds > 0 ? formatDuration(l.durationSeconds) : <span className="text-ink-soft">—</span>}</td>
                  <td className="px-4 py-3">
                    <StatusBadge value={l.outcome} tone={OUTCOME_TONE[l.outcome]} />
                  </td>
                  <td className="max-w-[260px] truncate px-4 py-3 text-ink-soft" dir="auto" title={l.note ?? undefined}>
                    {l.note ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    {l.recordingUrl ? (
                      <Button size="xs" variant="outline" onClick={() => toast.error("Recording playback needs a VoIP provider — connect one in Settings.")}>
                        <Play /> Play
                      </Button>
                    ) : (
                      <span className="text-xs text-ink-soft">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>
    </div>
  );
}
