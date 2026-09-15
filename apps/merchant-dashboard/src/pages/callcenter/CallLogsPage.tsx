import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Button, Label, useAsync } from "@store-builder/ui";
import type { ConfirmationAttemptEntry, ConfirmationOutcome } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useT, useLocale, fmt, type Locale, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { Select } from "@/components/Select";
import type { BadgeTone } from "./shared";

const STRINGS = {
  en: {
    title: "Call logs",
    description: "Every confirmation call attempt your team recorded, with its outcome and notes.",
    backLabel: "Call center",
    agent: "Agent",
    allAgents: "All agents",
    outcome: "Outcome",
    allOutcomes: "All outcomes",
    shown: "{n} attempts shown",
    empty: "No call attempts match these filters.",
    colTime: "Time",
    colOrder: "Order",
    colCustomer: "Customer",
    colAgent: "Agent",
    colAttempt: "Attempt",
    colOutcome: "Outcome",
    colNote: "Note",
    colTotal: "Total",
    loadMore: "Load more",
  },
  ar: {
    title: "سجل المكالمات",
    description: "كل محاولات مكالمات التأكيد اللي فريقك سجّلها، بالنتيجة والملاحظات.",
    backLabel: "مركز الاتصال",
    agent: "الموظف",
    allAgents: "كل الموظفين",
    outcome: "النتيجة",
    allOutcomes: "كل النتايج",
    shown: "ظاهر {n} محاولة",
    empty: "مفيش محاولات اتصال بالفلاتر دي.",
    colTime: "الوقت",
    colOrder: "الطلب",
    colCustomer: "العميل",
    colAgent: "الموظف",
    colAttempt: "المحاولة",
    colOutcome: "النتيجة",
    colNote: "ملاحظة",
    colTotal: "الإجمالي",
    loadMore: "هات أكتر",
  },
} satisfies Messages;

const OUTCOMES: ConfirmationOutcome[] = ["confirmed", "rejected", "unreachable", "postponed"];
const OUTCOME_TONE: Record<ConfirmationOutcome, BadgeTone> = {
  confirmed: "success",
  rejected: "danger",
  unreachable: "warning",
  postponed: "info",
};
const OUTCOME_LABEL: Record<Locale, Record<ConfirmationOutcome, string>> = {
  en: { confirmed: "Confirmed", rejected: "Rejected", unreachable: "No answer", postponed: "Postponed" },
  ar: { confirmed: "اتأكد", rejected: "اترفض", unreachable: "مردّش", postponed: "اتأجل" },
};

const PAGE_SIZE = 50;

export function CallLogsPage() {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const agents = useAsync(() => apiClient.listConfirmationAgents(workspaceId, 90), [workspaceId]);

  const [agentId, setAgentId] = useState("all");
  const [outcome, setOutcome] = useState<"all" | ConfirmationOutcome>("all");
  const [rows, setRows] = useState<ConfirmationAttemptEntry[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const callId = useRef(0);

  const load = useCallback(
    async (before: string | null) => {
      const id = ++callId.current;
      if (before) setLoadingMore(true);
      else setLoading(true);
      setError(null);
      try {
        const res = await apiClient.listConfirmationAttempts(workspaceId, {
          limit: PAGE_SIZE,
          before: before ?? undefined,
          agentUserId: agentId === "all" ? undefined : agentId,
          outcome: outcome === "all" ? undefined : outcome,
        });
        if (id !== callId.current) return;
        setRows((prev) => (before ? [...prev, ...res.attempts] : res.attempts));
        setCursor(res.nextCursor);
      } catch (err) {
        if (id === callId.current) setError(err);
      } finally {
        if (id === callId.current) {
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [workspaceId, agentId, outcome]
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  return (
    <div className="min-w-0 max-w-6xl">
      <PageHeader title={t.title} description={t.description} back={{ to: "/call-center", label: t.backLabel }} />

      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs text-ink-soft">{t.agent}</Label>
          <Select value={agentId} onChange={(e) => setAgentId(e.target.value)} className="mt-1 h-8 w-48 py-1" aria-label={t.agent}>
            <option value="all">{t.allAgents}</option>
            {(agents.data?.agents ?? []).map((a) => (
              <option key={a.userId} value={a.userId}>
                {a.fullName || a.email}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label className="text-xs text-ink-soft">{t.outcome}</Label>
          <Select value={outcome} onChange={(e) => setOutcome(e.target.value as "all" | ConfirmationOutcome)} className="mt-1 h-8 w-40 py-1" aria-label={t.outcome}>
            <option value="all">{t.allOutcomes}</option>
            {OUTCOMES.map((o) => (
              <option key={o} value={o}>
                {OUTCOME_LABEL[locale][o]}
              </option>
            ))}
          </Select>
        </div>
        <p className="ms-auto text-xs text-ink-soft">{fmt(t.shown, { n: rows.length })}</p>
      </div>

      <DataState loading={loading} error={error} empty={rows.length === 0} emptyMessage={t.empty} onRetry={() => void load(null)}>
        <div className="max-h-[70vh] overflow-auto rounded-2xl border border-line bg-paper-raised">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="sticky top-0 z-10 bg-paper-raised">
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 text-start font-medium">{t.colTime}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colOrder}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colCustomer}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colAgent}</th>
                <th className="px-4 py-3 text-end font-medium">{t.colAttempt}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colOutcome}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colNote}</th>
                <th className="px-4 py-3 text-end font-medium">{t.colTotal}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id} className="border-b border-line last:border-0 hover:bg-paper">
                  <td className="whitespace-nowrap px-4 py-3 text-start text-xs text-ink-soft">{formatDateTime(l.createdAt)}</td>
                  <td className="px-4 py-3 text-start">
                    {l.order ? (
                      <Link to={`/orders/${l.order.id}`} className="font-medium text-primary hover:underline">
                        <bdi>{l.order.orderNumber}</bdi>
                      </Link>
                    ) : (
                      <span className="text-ink-soft">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-start text-ink" dir="auto">
                    {l.order?.customerName ?? "—"}
                    {l.order?.phone && (
                      <span className="block font-mono text-xs text-ink-soft" dir="ltr">
                        {l.order.phone}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-start text-ink" dir="auto">
                    {l.agent.fullName || l.agent.email}
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums text-ink">{l.attemptNumber}</td>
                  <td className="px-4 py-3 text-start">
                    <StatusBadge value={l.outcome} label={OUTCOME_LABEL[locale][l.outcome]} tone={OUTCOME_TONE[l.outcome]} />
                  </td>
                  <td className="max-w-[260px] truncate px-4 py-3 text-start text-ink-soft" dir="auto" title={l.notes ?? undefined}>
                    {l.notes || "—"}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-end tabular-nums text-ink">
                    {l.order ? <bdi dir="ltr">{formatMoney(l.order.totalAmount, l.order.currency)}</bdi> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {cursor && (
          <div className="mt-4 flex justify-center">
            <Button variant="outline" disabled={loadingMore} onClick={() => void load(cursor)}>
              {t.loadMore}
            </Button>
          </div>
        )}
      </DataState>
    </div>
  );
}
