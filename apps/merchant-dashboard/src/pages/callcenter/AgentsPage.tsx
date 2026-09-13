import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Button, cn } from "@store-builder/ui";
import { Headphones, Phone, Trophy, UserPlus } from "lucide-react";
import type { Agent } from "@/mock/types2";
import { mockApi } from "@/mock/api";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { humanize } from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Select } from "@/components/Select";
import { BarChart } from "@/components/charts";
import { useToast } from "@/components/Toast";
import { AGENT_STATUS_DOT, AGENT_STATUS_TONE, agentInitials, formatDuration, isToday } from "./shared";

const STATUSES: Agent["status"][] = ["online", "on_call", "break", "offline"];

function rate(confirmed: number, calls: number): string {
  if (calls === 0) return "—";
  return `${Math.round((confirmed / calls) * 100)}%`;
}

export function AgentsPage() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const agents = useAsync(() => mockApi.listAgents(workspaceId), [workspaceId]);
  const logs = useAsync(() => mockApi.listCallLogs(workspaceId), [workspaceId]);

  const list = agents.data ?? [];
  const online = list.filter((a) => a.status === "online" || a.status === "on_call").length;
  const callsToday = list.reduce((s, a) => s + a.callsToday, 0);
  const confirmedToday = list.reduce((s, a) => s + a.confirmedToday, 0);

  const leaderboard = useMemo(() => [...list].sort((a, b) => b.confirmedToday - a.confirmedToday || b.callsToday - a.callsToday), [list]);

  const byHour = useMemo(() => {
    const counts = Array.from({ length: 24 }, () => 0);
    const rows = logs.data ?? [];
    const today = rows.filter((l) => isToday(l.startedAt));
    for (const l of today.length > 0 ? today : rows) counts[new Date(l.startedAt).getHours()] += 1;
    return counts.map((value, h) => ({ label: `${String(h).padStart(2, "0")}:00`, value })).filter((_, h) => h >= 8 && h <= 23);
  }, [logs.data]);

  async function setStatus(agent: Agent, status: Agent["status"]) {
    try {
      await mockApi.setAgentStatus(workspaceId, agent.id, status);
      agents.setData((prev) => (prev ?? []).map((a) => (a.id === agent.id ? { ...a, status } : a)));
      toast.success(`${agent.name} is now ${humanize(status).toLowerCase()}.`);
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="Agents"
        description="Your confirmation team — who is on the phones right now and how they are doing today."
        back={{ to: "/call-center", label: "Call center" }}
        actions={
          <Button onClick={() => toast.success("Invite sent — manage team members in Settings › Team.")}>
            <UserPlus /> Invite agent
          </Button>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <KpiCard label="Agents online" value={`${online} / ${list.length}`} hint="Online or on a call" icon={<Headphones />} />
        <KpiCard label="Calls today" value={callsToday} hint="Across the team" icon={<Phone />} />
        <KpiCard label="Confirmed today" value={confirmedToday} hint={`Team rate ${rate(confirmedToday, callsToday)}`} icon={<Trophy />} />
      </div>

      <DataState loading={agents.loading} error={agents.error} empty={list.length === 0} emptyMessage="No agents yet — invite your first confirmation agent." onRetry={() => agents.refresh()}>
        <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {list.map((a) => (
            <div key={a.id} className="rounded-[var(--radius-card)] border border-line bg-paper-raised p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft font-display text-sm font-medium text-primary-dark" dir="auto">
                  {agentInitials(a.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink" dir="auto">
                    {a.name}
                  </p>
                  <p className="text-xs text-ink-soft">Ext. {a.extension}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className={cn("size-2 rounded-full", AGENT_STATUS_DOT[a.status])} />
                <StatusBadge value={a.status} tone={AGENT_STATUS_TONE[a.status]} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <dt className="text-ink-soft">Calls today</dt>
                <dd className="text-right tabular-nums text-ink">{a.callsToday}</dd>
                <dt className="text-ink-soft">Confirmed</dt>
                <dd className="text-right tabular-nums text-success">{a.confirmedToday}</dd>
                <dt className="text-ink-soft">Conf. rate</dt>
                <dd className="text-right tabular-nums text-ink">{rate(a.confirmedToday, a.callsToday)}</dd>
                <dt className="text-ink-soft">Avg handle</dt>
                <dd className="text-right tabular-nums text-ink">{a.avgHandleSeconds ? formatDuration(a.avgHandleSeconds) : "—"}</dd>
              </dl>
              <Select value={a.status} onChange={(e) => setStatus(a, e.target.value as Agent["status"])} className="mt-3 h-8 py-1 text-xs" aria-label={`Status for ${a.name}`}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {humanize(s)}
                  </option>
                ))}
              </Select>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line bg-paper-raised text-left text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Agent</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 text-right font-medium">Calls</th>
                  <th className="px-4 py-3 text-right font-medium">Confirmed</th>
                  <th className="px-4 py-3 text-right font-medium">Rate</th>
                  <th className="px-4 py-3 text-right font-medium">Avg handle</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((a, i) => (
                  <tr key={a.id} className="border-b border-line last:border-0 hover:bg-paper-raised">
                    <td className="px-4 py-3 tabular-nums text-ink-soft">{i === 0 && a.confirmedToday > 0 ? <Trophy className="size-4 text-accent-dark" /> : i + 1}</td>
                    <td className="px-4 py-3 font-medium text-ink" dir="auto">
                      {a.name}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge value={a.status} tone={AGENT_STATUS_TONE[a.status]} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink">{a.callsToday}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-success">{a.confirmedToday}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink">{rate(a.confirmedToday, a.callsToday)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-ink-soft">{a.avgHandleSeconds ? formatDuration(a.avgHandleSeconds) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-[var(--radius-card)] border border-line bg-paper-raised p-4">
            <p className="text-sm font-medium text-ink">Today by hour</p>
            <p className="text-xs text-ink-soft">Calls started per hour (08:00–23:00)</p>
            <DataState loading={logs.loading} error={logs.error} onRetry={() => logs.refresh()}>
              <BarChart points={byHour} height={140} className="mt-3" format={(v) => `${v} calls`} />
              <div className="mt-1 flex justify-between text-[10px] text-ink-soft">
                <span>08:00</span>
                <span>15:00</span>
                <span>23:00</span>
              </div>
            </DataState>
            <p className="mt-3 text-xs text-ink-soft">
              Working hours are set in{" "}
              <Link to="/call-center/settings" className="text-primary hover:underline">
                call center settings
              </Link>
              .
            </p>
          </div>
        </div>
      </DataState>
    </div>
  );
}
