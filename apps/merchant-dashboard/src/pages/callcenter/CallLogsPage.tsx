import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Label } from "@store-builder/ui";
import { Clock, Download, Phone, PhoneIncoming, Play, ThumbsUp } from "lucide-react";
import type { CallLog, CallOutcome } from "@/mock/types2";
import { mockApi } from "@/mock/api";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@store-builder/ui";
import { formatDateTime } from "@/lib/format";
import { useT, useCommon, useLocale, fmt, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { OUTCOME_TONE, formatDuration, outcomeLabel } from "./shared";

const STRINGS = {
  en: {
    title: "Call logs",
    description: "Every confirmation call your team made, with outcome and recording.",
    backLabel: "Call center",
    kpiTotal: "Total calls",
    kpiTotalHint: "In the selected range",
    kpiReach: "Reach rate",
    kpiReachHint: "Calls answered / total",
    kpiConf: "Confirmation rate",
    kpiConfHint: "Confirmed / reached",
    kpiAvg: "Avg duration",
    kpiAvgHint: "Answered calls only",
    agent: "Agent",
    allAgents: "All agents",
    outcome: "Outcome",
    allOutcomes: "All outcomes",
    date: "Date",
    allTime: "All time",
    nCalls: "{n} calls",
    empty: "No calls in this range.",
    colTime: "Time",
    colOrder: "Order",
    colAgent: "Agent",
    colDuration: "Duration",
    colOutcome: "Outcome",
    colNote: "Note",
    colRecording: "Recording",
    play: "Play",
    playError: "Recording playback needs a VoIP provider — connect one in Settings.",
    exported: "Exported {n} calls.",
  },
  ar: {
    title: "سجل المكالمات",
    description: "كل مكالمات التأكيد التي أجراها فريقك، مع النتيجة والتسجيل.",
    backLabel: "مركز الاتصال",
    kpiTotal: "إجمالي المكالمات",
    kpiTotalHint: "خلال الفترة المحددة",
    kpiReach: "معدل الرد",
    kpiReachHint: "المكالمات التي تم الرد عليها / الإجمالي",
    kpiConf: "معدل التأكيد",
    kpiConfHint: "تم التأكيد / تم الرد",
    kpiAvg: "متوسط المدة",
    kpiAvgHint: "المكالمات التي تم الرد عليها فقط",
    agent: "الموظف",
    allAgents: "كل الموظفين",
    outcome: "النتيجة",
    allOutcomes: "كل النتائج",
    date: "التاريخ",
    allTime: "كل الأوقات",
    nCalls: "{n} مكالمة",
    empty: "لا توجد مكالمات في هذه الفترة.",
    colTime: "الوقت",
    colOrder: "الطلب",
    colAgent: "الموظف",
    colDuration: "المدة",
    colOutcome: "النتيجة",
    colNote: "ملاحظة",
    colRecording: "التسجيل",
    play: "تشغيل",
    playError: "تشغيل التسجيلات يتطلب مزوّد خدمة VoIP — اربط مزوّدًا من الإعدادات.",
    exported: "تم تصدير {n} مكالمة.",
  },
} satisfies Messages;

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
  const t = useT(STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
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
        const time = new Date(l.startedAt).getTime();
        if (range === "today" && time < startOfToday) return false;
        if (range === "7d" && time < weekAgo) return false;
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
    // CSV headers and values stay in English so exported files are stable for spreadsheets/integrations.
    const header = ["Time", "Order", "Agent", "Duration (s)", "Outcome", "Note", "Recording"];
    const lines = rows.map((l) => [l.startedAt, l.orderNumber, l.agentName, l.durationSeconds, l.outcome, l.note, l.recordingUrl ? "yes" : "no"].map(csvCell).join(","));
    const blob = new Blob(["﻿" + [header.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `call-logs-${range}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(fmt(t.exported, { n: rows.length }));
  }

  return (
    <div className="min-w-0 max-w-6xl">
      <PageHeader
        title={t.title}
        description={t.description}
        back={{ to: "/call-center", label: t.backLabel }}
        actions={
          <Button variant="outline" onClick={exportCsv} disabled={rows.length === 0}>
            <Download /> {c.exportCsv}
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={t.kpiTotal} value={kpis.total} hint={t.kpiTotalHint} icon={<Phone />} />
        <KpiCard label={t.kpiReach} value={<bdi>{kpis.reachRate}</bdi>} hint={t.kpiReachHint} icon={<PhoneIncoming />} />
        <KpiCard label={t.kpiConf} value={<bdi>{kpis.confRate}</bdi>} hint={t.kpiConfHint} icon={<ThumbsUp />} />
        <KpiCard label={t.kpiAvg} value={<span dir="ltr">{formatDuration(kpis.avg)}</span>} hint={t.kpiAvgHint} icon={<Clock />} />
      </div>

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs text-ink-soft">{t.agent}</Label>
          <Select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="mt-1 h-8 w-44 py-1" aria-label={t.agent}>
            <option value="all">{t.allAgents}</option>
            {(agents.data ?? []).map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label className="text-xs text-ink-soft">{t.outcome}</Label>
          <Select value={outcome} onChange={(e) => setOutcome(e.target.value as "all" | CallOutcome)} className="mt-1 h-8 w-40 py-1" aria-label={t.outcome}>
            <option value="all">{t.allOutcomes}</option>
            {OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {outcomeLabel(o, locale)}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label className="text-xs text-ink-soft">{t.date}</Label>
          <Select value={range} onChange={(e) => setRange(e.target.value as DateRange)} className="mt-1 h-8 w-36 py-1" aria-label={t.date}>
            <option value="today">{c.today}</option>
            <option value="7d">{c.last7}</option>
            <option value="all">{t.allTime}</option>
          </Select>
        </div>
        <p className="ms-auto text-xs text-ink-soft">{fmt(t.nCalls, { n: rows.length })}</p>
      </div>

      <DataState loading={logs.loading} error={logs.error} empty={rows.length === 0} emptyMessage={t.empty} onRetry={() => logs.refresh()}>
        <div className="max-h-[70vh] overflow-auto rounded-2xl border border-line bg-paper-raised">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="sticky top-0 z-10 bg-paper-raised">
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 text-start font-medium">{t.colTime}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colOrder}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colAgent}</th>
                <th className="px-4 py-3 text-end font-medium">{t.colDuration}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colOutcome}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colNote}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colRecording}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l: CallLog) => (
                <tr key={l.id} className="border-b border-line last:border-0 hover:bg-paper">
                  <td className="whitespace-nowrap px-4 py-3 text-start text-xs text-ink-soft">{formatDateTime(l.startedAt)}</td>
                  <td className="px-4 py-3 text-start">
                    <Link to={`/orders/${l.orderId}`} className="font-medium text-primary hover:underline">
                      <bdi>{l.orderNumber}</bdi>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-start text-ink" dir="auto">
                    {l.agentName}
                  </td>
                  <td className="px-4 py-3 text-end font-mono text-xs tabular-nums text-ink">{l.durationSeconds > 0 ? <bdi>{formatDuration(l.durationSeconds)}</bdi> : <span className="text-ink-soft">—</span>}</td>
                  <td className="px-4 py-3 text-start">
                    <StatusBadge value={l.outcome} tone={OUTCOME_TONE[l.outcome]} />
                  </td>
                  <td className="max-w-[260px] truncate px-4 py-3 text-start text-ink-soft" dir="auto" title={l.note ?? undefined}>
                    {l.note ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-start">
                    {l.recordingUrl ? (
                      <Button size="xs" variant="outline" onClick={() => toast.error(t.playError)}>
                        <Play /> {t.play}
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
