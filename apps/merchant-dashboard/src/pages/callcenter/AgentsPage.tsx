import { useMemo, useState } from "react";
import { Headphones, Phone, Trophy } from "lucide-react";
import { useAsync } from "@store-builder/ui";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { Select } from "@/components/Select";
import { agentInitials } from "./shared";

const STRINGS = {
  en: {
    title: "Agents",
    description: "Your confirmation team and how each person is doing on confirmation calls.",
    backLabel: "Call center",
    range: "Period",
    lastNDays: "Last {n} days",
    kpiAgents: "Active agents",
    kpiAgentsHint: "Made at least one call attempt",
    kpiAttempts: "Call attempts",
    kpiAttemptsHint: "Across the team",
    kpiConfirmed: "Confirmed",
    kpiConfirmedHint: "Team rate {rate}",
    empty: "No call attempts in this period yet.",
    attempts: "Attempts",
    confirmed: "Confirmed",
    rejected: "Rejected",
    unreachable: "No answer",
    postponed: "Postponed",
    confRate: "Conf. rate",
    inProgress: "Working on now",
    colAgent: "Agent",
    colRole: "Role",
  },
  ar: {
    title: "الموظفين",
    description: "فريق تأكيد الطلبات وأداء كل واحد في مكالمات التأكيد.",
    backLabel: "مركز الاتصال",
    range: "الفترة",
    lastNDays: "آخر {n} يوم",
    kpiAgents: "الموظفين النشطين",
    kpiAgentsHint: "عمل محاولة اتصال واحدة على الأقل",
    kpiAttempts: "محاولات الاتصال",
    kpiAttemptsHint: "للفريق كله",
    kpiConfirmed: "اتأكدت",
    kpiConfirmedHint: "نسبة الفريق {rate}",
    empty: "مفيش محاولات اتصال في الفترة دي لسه.",
    attempts: "المحاولات",
    confirmed: "اتأكدت",
    rejected: "اترفضت",
    unreachable: "مردّش",
    postponed: "اتأجلت",
    confRate: "نسبة التأكيد",
    inProgress: "شغّال عليها دلوقتي",
    colAgent: "الموظف",
    colRole: "الدور",
  },
} satisfies Messages;

const RANGES = [7, 30, 90] as const;

function rateLabel(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate)}%`;
}

export function AgentsPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const [days, setDays] = useState<number>(30);
  const data = useAsync(() => apiClient.listConfirmationAgents(workspaceId, days), [workspaceId, days]);

  const list = useMemo(
    () => [...(data.data?.agents ?? [])].sort((a, b) => b.confirmed - a.confirmed || b.attempts - a.attempts),
    [data.data]
  );
  const attempts = list.reduce((s, a) => s + a.attempts, 0);
  const confirmed = list.reduce((s, a) => s + a.confirmed, 0);
  const decided = list.reduce((s, a) => s + a.confirmed + a.rejected, 0);
  const teamRate = decided > 0 ? (confirmed / decided) * 100 : null;
  const active = list.filter((a) => a.attempts > 0).length;

  return (
    <div className="min-w-0 max-w-6xl">
      <PageHeader
        title={t.title}
        description={t.description}
        back={{ to: "/call-center", label: t.backLabel }}
        actions={
          <Select value={String(days)} onChange={(e) => setDays(Number(e.target.value))} className="h-9 w-40 py-1" aria-label={t.range}>
            {RANGES.map((n) => (
              <option key={n} value={n}>
                {fmt(t.lastNDays, { n })}
              </option>
            ))}
          </Select>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiCard label={t.kpiAgents} value={active} hint={t.kpiAgentsHint} icon={<Headphones />} />
        <KpiCard label={t.kpiAttempts} value={attempts} hint={t.kpiAttemptsHint} icon={<Phone />} />
        <KpiCard label={t.kpiConfirmed} value={confirmed} hint={fmt(t.kpiConfirmedHint, { rate: rateLabel(teamRate) })} icon={<Trophy />} />
      </div>

      <DataState loading={data.loading} error={data.error} empty={list.length === 0} emptyMessage={t.empty} onRetry={() => data.refresh()}>
        <div className="min-w-0 overflow-x-auto rounded-2xl border border-line bg-paper-raised">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 text-start font-medium">#</th>
                <th className="px-4 py-3 text-start font-medium">{t.colAgent}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colRole}</th>
                <th className="px-4 py-3 text-end font-medium">{t.attempts}</th>
                <th className="px-4 py-3 text-end font-medium">{t.confirmed}</th>
                <th className="px-4 py-3 text-end font-medium">{t.rejected}</th>
                <th className="px-4 py-3 text-end font-medium">{t.unreachable}</th>
                <th className="px-4 py-3 text-end font-medium">{t.postponed}</th>
                <th className="px-4 py-3 text-end font-medium">{t.confRate}</th>
                <th className="px-4 py-3 text-end font-medium">{t.inProgress}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((a, i) => {
                const name = a.fullName || a.email;
                return (
                  <tr key={a.userId} className="border-b border-line last:border-0 hover:bg-paper">
                    <td className="px-4 py-3 text-start tabular-nums text-ink-soft">{i === 0 && a.confirmed > 0 ? <Trophy className="size-4 text-accent-dark" /> : i + 1}</td>
                    <td className="px-4 py-3 text-start">
                      <div className="flex items-center gap-2.5">
                        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft font-display text-xs font-semibold text-primary-dark" dir="auto">
                          {agentInitials(name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-ink" dir="auto">
                            {name}
                          </p>
                          {a.fullName && (
                            <p className="truncate text-xs text-ink-soft" dir="ltr">
                              {a.email}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-start text-ink-soft" dir="auto">
                      {a.role?.name ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums text-ink">{a.attempts}</td>
                    <td className="px-4 py-3 text-end tabular-nums text-success">{a.confirmed}</td>
                    <td className="px-4 py-3 text-end tabular-nums text-danger">{a.rejected}</td>
                    <td className="px-4 py-3 text-end tabular-nums text-warning">{a.unreachable}</td>
                    <td className="px-4 py-3 text-end tabular-nums text-ink">{a.postponed}</td>
                    <td className="px-4 py-3 text-end tabular-nums text-ink">
                      <bdi>{rateLabel(a.confirmationRate)}</bdi>
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums text-ink">{a.tasksInProgress}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </DataState>
    </div>
  );
}
