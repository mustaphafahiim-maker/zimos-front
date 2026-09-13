import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Button, cn } from "@store-builder/ui";
import { Headphones, Phone, Trophy, UserPlus } from "lucide-react";
import type { Agent } from "@/mock/types2";
import { mockApi } from "@/mock/api";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { useT, useLocale, fmt, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Select } from "@/components/Select";
import { BarChart } from "@/components/charts";
import { useToast } from "@/components/Toast";
import { AGENT_STATUS_DOT, AGENT_STATUS_TONE, agentInitials, agentStatusLabel, formatDuration, isToday } from "./shared";

const STRINGS = {
  en: {
    title: "Agents",
    description: "Your confirmation team — who is on the phones right now and how they are doing today.",
    backLabel: "Call center",
    invite: "Invite agent",
    inviteToast: "Invite sent — manage team members in Settings › Team.",
    kpiOnline: "Agents online",
    kpiOnlineHint: "Online or on a call",
    kpiCalls: "Calls today",
    kpiCallsHint: "Across the team",
    kpiConfirmed: "Confirmed today",
    kpiConfirmedHint: "Team rate {rate}",
    empty: "No agents yet — invite your first confirmation agent.",
    ext: "Ext.",
    callsToday: "Calls today",
    confirmed: "Confirmed",
    confRate: "Conf. rate",
    avgHandle: "Avg handle",
    statusFor: "Status for {name}",
    toastStatus: "{name} is now {status}.",
    colAgent: "Agent",
    colStatus: "Status",
    colCalls: "Calls",
    colConfirmed: "Confirmed",
    colRate: "Rate",
    colAvgHandle: "Avg handle",
    byHour: "Today by hour",
    byHourHint: "Calls started per hour",
    nCalls: "{n} calls",
    workingHoursBefore: "Working hours are set in",
    workingHoursLink: "call center settings",
    workingHoursAfter: ".",
  },
  ar: {
    title: "الموظفون",
    description: "فريق تأكيد الطلبات — من يجري المكالمات الآن وكيف كان أداؤهم اليوم.",
    backLabel: "مركز الاتصال",
    invite: "دعوة موظف",
    inviteToast: "تم إرسال الدعوة — أدِر أعضاء الفريق من الإعدادات › الفريق.",
    kpiOnline: "الموظفون المتصلون",
    kpiOnlineHint: "متصل أو في مكالمة",
    kpiCalls: "مكالمات اليوم",
    kpiCallsHint: "على مستوى الفريق",
    kpiConfirmed: "تم تأكيده اليوم",
    kpiConfirmedHint: "معدل الفريق {rate}",
    empty: "لا يوجد موظفون بعد — ادعُ أول موظف لتأكيد الطلبات.",
    ext: "تحويلة",
    callsToday: "مكالمات اليوم",
    confirmed: "تم التأكيد",
    confRate: "معدل التأكيد",
    avgHandle: "متوسط مدة المكالمة",
    statusFor: "حالة {name}",
    toastStatus: "حالة {name} الآن: {status}.",
    colAgent: "الموظف",
    colStatus: "الحالة",
    colCalls: "المكالمات",
    colConfirmed: "تم التأكيد",
    colRate: "المعدل",
    colAvgHandle: "متوسط المدة",
    byHour: "مكالمات اليوم حسب الساعة",
    byHourHint: "عدد المكالمات التي بدأت في كل ساعة",
    nCalls: "{n} مكالمة",
    workingHoursBefore: "تُضبط ساعات العمل من",
    workingHoursLink: "إعدادات مركز الاتصال",
    workingHoursAfter: ".",
  },
} satisfies Messages;

const STATUSES: Agent["status"][] = ["online", "on_call", "break", "offline"];

function rate(confirmed: number, calls: number): string {
  if (calls === 0) return "—";
  return `${Math.round((confirmed / calls) * 100)}%`;
}

export function AgentsPage() {
  const t = useT(STRINGS);
  const { locale } = useLocale();
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
      const label = agentStatusLabel(status, locale);
      toast.success(fmt(t.toastStatus, { name: agent.name, status: locale === "en" ? label.toLowerCase() : label }));
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  return (
    <div className="min-w-0 max-w-6xl">
      <PageHeader
        title={t.title}
        description={t.description}
        back={{ to: "/call-center", label: t.backLabel }}
        actions={
          <Button onClick={() => toast.success(t.inviteToast)}>
            <UserPlus /> {t.invite}
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiCard label={t.kpiOnline} value={<span dir="ltr">{`${online} / ${list.length}`}</span>} hint={t.kpiOnlineHint} icon={<Headphones />} />
        <KpiCard label={t.kpiCalls} value={callsToday} hint={t.kpiCallsHint} icon={<Phone />} />
        <KpiCard label={t.kpiConfirmed} value={confirmedToday} hint={fmt(t.kpiConfirmedHint, { rate: rate(confirmedToday, callsToday) })} icon={<Trophy />} />
      </div>

      <DataState loading={agents.loading} error={agents.error} empty={list.length === 0} emptyMessage={t.empty} onRetry={() => agents.refresh()}>
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {list.map((a) => (
            <div key={a.id} className="min-w-0 rounded-2xl border border-line bg-paper-raised p-4">
              <div className="flex items-center gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft font-display text-sm font-semibold text-primary-dark" dir="auto">
                  {agentInitials(a.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink" dir="auto">
                    {a.name}
                  </p>
                  <p className="text-xs text-ink-soft">
                    {t.ext} <bdi>{a.extension}</bdi>
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <span className={cn("size-2 rounded-full", AGENT_STATUS_DOT[a.status])} />
                <StatusBadge value={a.status} tone={AGENT_STATUS_TONE[a.status]} />
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <dt className="text-ink-soft">{t.callsToday}</dt>
                <dd className="text-end tabular-nums text-ink">{a.callsToday}</dd>
                <dt className="text-ink-soft">{t.confirmed}</dt>
                <dd className="text-end tabular-nums text-success">{a.confirmedToday}</dd>
                <dt className="text-ink-soft">{t.confRate}</dt>
                <dd className="text-end tabular-nums text-ink" dir="ltr">
                  {rate(a.confirmedToday, a.callsToday)}
                </dd>
                <dt className="text-ink-soft">{t.avgHandle}</dt>
                <dd className="text-end tabular-nums text-ink">
                  <bdi>{a.avgHandleSeconds ? formatDuration(a.avgHandleSeconds) : "—"}</bdi>
                </dd>
              </dl>
              <Select value={a.status} onChange={(e) => setStatus(a, e.target.value as Agent["status"])} className="mt-3 h-8 py-1 text-xs" aria-label={fmt(t.statusFor, { name: a.name })}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {agentStatusLabel(s, locale)}
                  </option>
                ))}
              </Select>
            </div>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
          <div className="min-w-0 overflow-x-auto rounded-2xl border border-line bg-paper-raised">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-line bg-paper-raised text-start text-xs uppercase tracking-wide text-ink-soft">
                  <th className="px-4 py-3 text-start font-medium">#</th>
                  <th className="px-4 py-3 text-start font-medium">{t.colAgent}</th>
                  <th className="px-4 py-3 text-start font-medium">{t.colStatus}</th>
                  <th className="px-4 py-3 text-end font-medium">{t.colCalls}</th>
                  <th className="px-4 py-3 text-end font-medium">{t.colConfirmed}</th>
                  <th className="px-4 py-3 text-end font-medium">{t.colRate}</th>
                  <th className="px-4 py-3 text-end font-medium">{t.colAvgHandle}</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map((a, i) => (
                  <tr key={a.id} className="border-b border-line last:border-0 hover:bg-paper">
                    <td className="px-4 py-3 text-start tabular-nums text-ink-soft">{i === 0 && a.confirmedToday > 0 ? <Trophy className="size-4 text-accent-dark" /> : i + 1}</td>
                    <td className="px-4 py-3 text-start font-medium text-ink" dir="auto">
                      {a.name}
                    </td>
                    <td className="px-4 py-3 text-start">
                      <StatusBadge value={a.status} tone={AGENT_STATUS_TONE[a.status]} />
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums text-ink">{a.callsToday}</td>
                    <td className="px-4 py-3 text-end tabular-nums text-success">{a.confirmedToday}</td>
                    <td className="px-4 py-3 text-end tabular-nums text-ink">
                      <bdi>{rate(a.confirmedToday, a.callsToday)}</bdi>
                    </td>
                    <td className="px-4 py-3 text-end tabular-nums text-ink-soft">
                      <bdi>{a.avgHandleSeconds ? formatDuration(a.avgHandleSeconds) : "—"}</bdi>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="min-w-0 rounded-2xl border border-line bg-paper-raised p-4">
            <p className="text-sm font-medium text-ink">{t.byHour}</p>
            <p className="text-xs text-ink-soft">
              {t.byHourHint} <span dir="ltr">(08:00–23:00)</span>
            </p>
            <DataState loading={logs.loading} error={logs.error} onRetry={() => logs.refresh()}>
              <div dir="ltr">
                <BarChart points={byHour} height={140} className="mt-3" format={(v) => fmt(t.nCalls, { n: v })} />
                <div className="mt-1 flex justify-between text-[10px] text-ink-soft">
                  <span>08:00</span>
                  <span>15:00</span>
                  <span>23:00</span>
                </div>
              </div>
            </DataState>
            <p className="mt-3 text-xs text-ink-soft">
              {t.workingHoursBefore}{" "}
              <Link to="/call-center/settings" className="text-primary hover:underline">
                {t.workingHoursLink}
              </Link>
              {t.workingHoursAfter}
            </p>
          </div>
        </div>
      </DataState>
    </div>
  );
}
