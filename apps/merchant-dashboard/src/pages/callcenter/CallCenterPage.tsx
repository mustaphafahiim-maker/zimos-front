import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ClipboardCheck, Headset, Phone, PhoneCall, Trophy } from "lucide-react";
import { Button, Card, Label } from "@store-builder/ui";
import type {
  ConfirmationAgent,
  ConfirmationAttempt,
  ConfirmationOutcome,
  ConfirmationTask,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useCursorList } from "@/lib/useCursorList";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatDateTime, formatMoney } from "@/lib/format";
import { formatCount } from "@/lib/analytics";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { FilterTabs } from "@/components/FilterTabs";
import { LoadMore } from "@/components/LoadMore";
import { StatusBadge } from "@/components/StatusBadge";
import { Select } from "@/components/Select";
import { DataTable, type Column } from "@/components/DataTable";

/**
 * The call centre's management view: how the confirmation queue is doing, how
 * each agent is doing, and the full call log.
 *
 * Making the calls themselves stays on the existing Confirmation Queue screen —
 * this one links there rather than repeating it, so there is one place where a
 * task is claimed and an outcome is recorded.
 */

const LOG_LIMIT = 50;
const AGENT_RANGES = [7, 30, 90] as const;
const OUTCOMES: ConfirmationOutcome[] = ["confirmed", "rejected", "unreachable", "postponed"];

const STRINGS = {
  en: {
    title: "Call centre",
    description:
      "How your confirmation team is doing: what's waiting, who is calling, and every call they logged.",
    tabsLabel: "Call centre section",
    tabQueue: "Queue",
    tabAgents: "Agents",
    tabLogs: "Call log",

    openQueue: "Open the confirmation queue",
    queueHint: "Claiming a task and recording a call happens on the confirmation queue screen.",
    kpiWaiting: "Waiting to be called",
    kpiWaitingHint: "Tasks nobody has claimed yet",
    kpiOnCall: "Being called now",
    kpiOnCallHint: "Tasks an agent is holding",
    kpiRetry: "Waiting for a call-back",
    kpiRetryHint: "Tried already, due again later",
    kpiValue: "Value in the queue",
    kpiValueHint: "Total of the orders waiting",
    emptyQueue: "The queue is clear",
    emptyQueueDesc: "Every cash-on-delivery order has been called. New ones land here on their own.",
    colOrder: "Order",
    colCustomer: "Customer",
    colAttempts: "Attempts",
    colNextRetry: "Call back",
    colTotal: "Total",
    colState: "State",
    now: "Due now",

    range: "Period",
    lastNDays: "Last {n} days",
    kpiAgents: "Agents who called",
    kpiAgentsHint: "Made at least one attempt in this period",
    kpiAttempts: "Call attempts",
    kpiAttemptsHint: "Across the whole team",
    kpiConfirmed: "Confirmed",
    kpiConfirmedHint: "Team confirmation rate {rate}",
    emptyAgents: "No calls in this period",
    emptyAgentsDesc:
      "Once your team starts recording call outcomes, each agent's numbers show up here.",
    colAgent: "Agent",
    colRole: "Role",
    attempts: "Attempts",
    confirmed: "Confirmed",
    rejected: "Rejected",
    unreachable: "No answer",
    postponed: "Postponed",
    confRate: "Confirmation rate",
    inProgress: "Holding now",

    agentFilter: "Agent",
    allAgents: "All agents",
    outcomeFilter: "Outcome",
    allOutcomes: "All outcomes",
    shown: "{n} attempts loaded",
    emptyLogs: "No calls match these filters",
    emptyLogsDesc: "Try a different agent or outcome, or clear the filters.",
    colTime: "When",
    colAttempt: "Attempt",
    colOutcome: "Outcome",
    colNote: "Note",
    outcomeConfirmed: "Confirmed",
    outcomeRejected: "Rejected",
    outcomeUnreachable: "No answer",
    outcomePostponed: "Postponed",
    noName: "Unnamed agent",
  },
  ar: {
    title: "الكول سنتر",
    description: "فريق التأكيد شغله ماشي إزاي: إيه اللي مستني، مين بيكلّم، وكل مكالمة اتسجّلت.",
    tabsLabel: "قسم الكول سنتر",
    tabQueue: "القايمة",
    tabAgents: "الموظفين",
    tabLogs: "سجل المكالمات",

    openQueue: "افتح قايمة التأكيد",
    queueHint: "خد الطلب وسجّل نتيجة المكالمة من شاشة قايمة التأكيد.",
    kpiWaiting: "مستني مكالمة",
    kpiWaitingHint: "طلبات محدش خدها لسه",
    kpiOnCall: "بيتكلّم دلوقتي",
    kpiOnCallHint: "طلبات موظف ماسكها",
    kpiRetry: "مستني نكلّمه تاني",
    kpiRetryHint: "اتجرّب قبل كده ومعاده لسه جاي",
    kpiValue: "قيمة اللي في القايمة",
    kpiValueHint: "إجمالي الطلبات المستنية",
    emptyQueue: "القايمة فاضية",
    emptyQueueDesc: "كل طلبات الدفع عند الاستلام اتكلّمت. الجديد بينزل هنا لوحده.",
    colOrder: "الطلب",
    colCustomer: "العميل",
    colAttempts: "المحاولات",
    colNextRetry: "نكلّمه تاني",
    colTotal: "الإجمالي",
    colState: "الحالة",
    now: "دلوقتي",

    range: "الفترة",
    lastNDays: "آخر {n} يوم",
    kpiAgents: "موظفين كلّموا",
    kpiAgentsHint: "عمل محاولة واحدة على الأقل في الفترة دي",
    kpiAttempts: "محاولات الاتصال",
    kpiAttemptsHint: "للفريق كله",
    kpiConfirmed: "اتأكدت",
    kpiConfirmedHint: "نسبة تأكيد الفريق {rate}",
    emptyAgents: "مفيش مكالمات في الفترة دي",
    emptyAgentsDesc: "أول ما الفريق يبدأ يسجّل نتايج المكالمات، أرقام كل موظف هتظهر هنا.",
    colAgent: "الموظف",
    colRole: "الدور",
    attempts: "المحاولات",
    confirmed: "اتأكدت",
    rejected: "اترفضت",
    unreachable: "مردّش",
    postponed: "اتأجلت",
    confRate: "نسبة التأكيد",
    inProgress: "ماسك دلوقتي",

    agentFilter: "الموظف",
    allAgents: "كل الموظفين",
    outcomeFilter: "النتيجة",
    allOutcomes: "كل النتايج",
    shown: "متحمّل {n} محاولة",
    emptyLogs: "مفيش مكالمات بالفلاتر دي",
    emptyLogsDesc: "جرّب موظف تاني أو نتيجة تانية، أو شيل الفلاتر.",
    colTime: "إمتى",
    colAttempt: "المحاولة",
    colOutcome: "النتيجة",
    colNote: "ملاحظة",
    outcomeConfirmed: "اتأكد",
    outcomeRejected: "اترفض",
    outcomeUnreachable: "مردّش",
    outcomePostponed: "اتأجل",
    noName: "موظف من غير اسم",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];
type TabKey = "queue" | "agents" | "logs";

const OUTCOME_LABEL: Record<ConfirmationOutcome, keyof Strings> = {
  confirmed: "outcomeConfirmed",
  rejected: "outcomeRejected",
  unreachable: "outcomeUnreachable",
  postponed: "outcomePostponed",
};

const OUTCOME_TONE: Record<ConfirmationOutcome, "success" | "danger" | "warning" | "info"> = {
  confirmed: "success",
  rejected: "danger",
  unreachable: "warning",
  postponed: "info",
};

/** "Amr Hassan" -> "AH". Falls back to the first character of an email. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function ratePercent(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate)}%`;
}

export function CallCenterPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const [tab, setTab] = useState<TabKey>("queue");

  return (
    <div className="min-w-0 max-w-6xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button asChild variant="outline">
            <Link to="/confirmation-queue">
              <ClipboardCheck aria-hidden />
              {t.openQueue}
            </Link>
          </Button>
        }
      />

      <FilterTabs
        className="mb-4"
        label={t.tabsLabel}
        value={tab}
        onChange={setTab}
        tabs={[
          { value: "queue", label: t.tabQueue },
          { value: "agents", label: t.tabAgents },
          { value: "logs", label: t.tabLogs },
        ]}
      />

      {tab === "queue" && <QueueTab key={`queue-${workspaceId}`} />}
      {tab === "agents" && <AgentsTab key={`agents-${workspaceId}`} />}
      {tab === "logs" && <LogsTab key={`logs-${workspaceId}`} />}
    </div>
  );
}

// ------------------------------------------------------------------ Queue --

function QueueTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();

  // Two reads: the unclaimed backlog and whatever agents are holding right now.
  const queued = useAsync(
    () => apiClient.listConfirmationQueue(workspaceId, { status: "queued", limit: 200 }),
    [workspaceId]
  );
  const inProgress = useAsync(
    () => apiClient.listConfirmationQueue(workspaceId, { status: "in_progress", limit: 200 }),
    [workspaceId]
  );

  const tasks = queued.data ?? [];
  const held = inProgress.data ?? [];
  const now = Date.now();

  const waitingLater = tasks.filter(
    (task) => task.nextRetryAt !== null && new Date(task.nextRetryAt).getTime() > now
  ).length;
  const currency = tasks[0]?.order?.currency ?? "EGP";
  const queueValue = tasks.reduce((total, task) => total + Number(task.order?.totalAmount ?? 0), 0);

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">{t.queueHint}</p>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          label={t.kpiWaiting}
          value={<bdi dir="ltr">{formatCount(tasks.length - waitingLater)}</bdi>}
          hint={t.kpiWaitingHint}
          icon={<Phone />}
          to="/confirmation-queue"
        />
        <KpiCard
          label={t.kpiOnCall}
          value={<bdi dir="ltr">{formatCount(held.length)}</bdi>}
          hint={t.kpiOnCallHint}
          icon={<PhoneCall />}
        />
        <KpiCard
          label={t.kpiRetry}
          value={<bdi dir="ltr">{formatCount(waitingLater)}</bdi>}
          hint={t.kpiRetryHint}
        />
        <KpiCard
          label={t.kpiValue}
          value={<bdi dir="ltr">{formatMoney(queueValue, currency)}</bdi>}
          hint={t.kpiValueHint}
        />
      </div>

      <DataState
        loading={queued.loading && !queued.data}
        error={queued.error}
        onRetry={() => queued.refresh()}
      >
        {tasks.length === 0 ? (
          <EmptyState icon={<Headset />} title={t.emptyQueue} description={t.emptyQueueDesc} />
        ) : (
          <QueueTable tasks={tasks} t={t} now={now} />
        )}
      </DataState>
    </div>
  );
}

function QueueTable({ tasks, t, now }: { tasks: ConfirmationTask[]; t: Strings; now: number }) {
  const columns: ReadonlyArray<Column<ConfirmationTask>> = [
    {
      key: "order",
      header: t.colOrder,
      className: "font-medium",
      cell: (task) =>
        task.order ? (
          <Link to={`/orders/${task.order.id}`} className="text-primary hover:underline">
            <bdi dir="ltr">{task.order.orderNumber}</bdi>
          </Link>
        ) : (
          <span className="text-ink-soft">—</span>
        ),
    },
    {
      key: "customer",
      header: t.colCustomer,
      className: "text-ink",
      cell: (task) => (
        <span className="block" dir="auto">
          {task.order?.contactSnapshot?.fullName ?? "—"}
          {task.order?.contactSnapshot?.phone && (
            <span className="block text-xs text-ink-soft">
              <bdi dir="ltr">{task.order.contactSnapshot.phone}</bdi>
            </span>
          )}
        </span>
      ),
    },
    {
      key: "attempts",
      header: t.colAttempts,
      align: "end",
      className: "tabular-nums text-ink",
      cell: (task) => task.attemptCount,
    },
    {
      key: "nextRetry",
      header: t.colNextRetry,
      className: "whitespace-nowrap text-xs text-ink-soft",
      cell: (task) =>
        task.nextRetryAt === null || new Date(task.nextRetryAt).getTime() <= now
          ? t.now
          : formatDateTime(task.nextRetryAt),
    },
    {
      key: "total",
      header: t.colTotal,
      align: "end",
      className: "tabular-nums whitespace-nowrap text-ink",
      cell: (task) =>
        task.order ? (
          <bdi dir="ltr">{formatMoney(task.order.totalAmount, task.order.currency)}</bdi>
        ) : (
          "—"
        ),
    },
    {
      key: "state",
      header: t.colState,
      cell: (task) => <StatusBadge value={task.status} />,
    },
  ];

  return (
    <Card className="gap-0 p-0">
      <DataTable columns={columns} rows={tasks} rowKey={(task) => task.id} minWidth="52rem" />
    </Card>
  );
}

// ----------------------------------------------------------------- Agents --

function AgentsTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const [days, setDays] = useState<number>(30);
  const data = useAsync(
    () => apiClient.listConfirmationAgents(workspaceId, { days }),
    [workspaceId, days]
  );

  // Best first — the table is read as a scoreboard.
  const agents = useMemo(
    () =>
      [...(data.data?.agents ?? [])].sort(
        (a, b) => b.confirmed - a.confirmed || b.attempts - a.attempts
      ),
    [data.data]
  );

  const attempts = agents.reduce((sum, a) => sum + a.attempts, 0);
  const confirmed = agents.reduce((sum, a) => sum + a.confirmed, 0);
  const decided = agents.reduce((sum, a) => sum + a.confirmed + a.rejected, 0);
  const teamRate = decided > 0 ? (confirmed / decided) * 100 : null;
  const active = agents.filter((a) => a.attempts > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard
            label={t.kpiAgents}
            value={<bdi dir="ltr">{formatCount(active)}</bdi>}
            hint={t.kpiAgentsHint}
            icon={<Headset />}
          />
          <KpiCard
            label={t.kpiAttempts}
            value={<bdi dir="ltr">{formatCount(attempts)}</bdi>}
            hint={t.kpiAttemptsHint}
            icon={<Phone />}
          />
          <KpiCard
            label={t.kpiConfirmed}
            value={<bdi dir="ltr">{formatCount(confirmed)}</bdi>}
            hint={fmt(t.kpiConfirmedHint, { rate: ratePercent(teamRate) })}
            icon={<Trophy />}
          />
        </div>
        <Select
          value={String(days)}
          onChange={(e) => setDays(Number(e.target.value))}
          aria-label={t.range}
          className="h-9 w-auto min-w-40"
        >
          {AGENT_RANGES.map((n) => (
            <option key={n} value={n}>
              {fmt(t.lastNDays, { n })}
            </option>
          ))}
        </Select>
      </div>

      <DataState
        loading={data.loading && !data.data}
        error={data.error}
        onRetry={() => data.refresh()}
      >
        {agents.length === 0 ? (
          <EmptyState icon={<Headset />} title={t.emptyAgents} description={t.emptyAgentsDesc} />
        ) : (
          <Card className="gap-0 p-0">
            <DataTable
              columns={agentColumns(t)}
              rows={agents}
              rowKey={(agent) => agent.userId}
              minWidth="55rem"
            />
          </Card>
        )}
      </DataState>
    </div>
  );
}

function agentColumns(t: Strings): ReadonlyArray<Column<ConfirmationAgent>> {
  const num = (
    key: string,
    header: string,
    value: (agent: ConfirmationAgent) => number,
    tone = "text-ink"
  ): Column<ConfirmationAgent> => ({
    key,
    header,
    align: "end",
    className: `tabular-nums ${tone}`,
    cell: value,
  });

  return [
    {
      key: "agent",
      header: t.colAgent,
      cell: (agent) => {
        const name = agent.fullName || agent.email || t.noName;
        return (
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-dark dark:text-primary"
            >
              {initials(name)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium text-ink" dir="auto">
                {name}
              </p>
              {agent.fullName && agent.email && (
                <p className="truncate text-xs text-ink-soft">
                  <bdi dir="ltr">{agent.email}</bdi>
                </p>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "role",
      header: t.colRole,
      className: "text-ink-soft",
      cell: (agent) => (
        <span className="block" dir="auto">
          {agent.role?.name ?? "—"}
        </span>
      ),
    },
    num("attempts", t.attempts, (a) => a.attempts),
    num("confirmed", t.confirmed, (a) => a.confirmed, "text-success"),
    num("rejected", t.rejected, (a) => a.rejected, "text-danger"),
    num("unreachable", t.unreachable, (a) => a.unreachable, "text-accent-dark dark:text-accent"),
    num("postponed", t.postponed, (a) => a.postponed),
    {
      key: "rate",
      header: t.confRate,
      align: "end",
      className: "tabular-nums text-ink",
      cell: (agent) => <bdi dir="ltr">{ratePercent(agent.confirmationRate)}</bdi>,
    },
    num("inProgress", t.inProgress, (a) => a.tasksInProgress),
  ];
}

// ------------------------------------------------------------------- Logs --

function LogsTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();

  // 90 days so the picker still lists someone who stopped calling recently.
  const agents = useAsync(
    () => apiClient.listConfirmationAgents(workspaceId, { days: 90 }),
    [workspaceId]
  );
  const [agentUserId, setAgentUserId] = useState("");
  const [outcome, setOutcome] = useState<ConfirmationOutcome | "">("");

  const list = useCursorList(
    async (before) => {
      const page = await apiClient.listConfirmationAttempts(workspaceId, {
        limit: LOG_LIMIT,
        ...(before ? { before } : {}),
        ...(agentUserId ? { agentUserId } : {}),
        ...(outcome ? { outcome } : {}),
      });
      return { items: page.attempts, nextCursor: page.nextCursor };
    },
    [workspaceId, agentUserId, outcome]
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-xs text-ink-soft">{t.agentFilter}</Label>
          <Select
            value={agentUserId}
            onChange={(e) => setAgentUserId(e.target.value)}
            aria-label={t.agentFilter}
            className="mt-1 h-9 w-auto min-w-48"
          >
            <option value="">{t.allAgents}</option>
            {(agents.data?.agents ?? []).map((agent) => (
              <option key={agent.userId} value={agent.userId}>
                {agent.fullName || agent.email || t.noName}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label className="text-xs text-ink-soft">{t.outcomeFilter}</Label>
          <Select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value as ConfirmationOutcome | "")}
            aria-label={t.outcomeFilter}
            className="mt-1 h-9 w-auto min-w-40"
          >
            <option value="">{t.allOutcomes}</option>
            {OUTCOMES.map((value) => (
              <option key={value} value={value}>
                {t[OUTCOME_LABEL[value]]}
              </option>
            ))}
          </Select>
        </div>
        <p className="ms-auto text-xs text-ink-soft">{fmt(t.shown, { n: list.items.length })}</p>
      </div>

      <DataState loading={list.loading} error={list.error} onRetry={list.reload}>
        {list.items.length === 0 ? (
          <EmptyState icon={<Phone />} title={t.emptyLogs} description={t.emptyLogsDesc} />
        ) : (
          <Card className="gap-0 p-0">
            <DataTable
              columns={logColumns(t)}
              rows={list.items}
              rowKey={(attempt) => attempt.id}
              minWidth="60rem"
            />
          </Card>
        )}
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </DataState>
    </div>
  );
}

function logColumns(t: Strings): ReadonlyArray<Column<ConfirmationAttempt>> {
  return [
    {
      key: "time",
      header: t.colTime,
      className: "whitespace-nowrap text-xs text-ink-soft",
      cell: (attempt) => formatDateTime(attempt.createdAt),
    },
    {
      key: "order",
      header: t.colOrder,
      className: "font-medium",
      cell: (attempt) =>
        attempt.order ? (
          <Link to={`/orders/${attempt.order.id}`} className="text-primary hover:underline">
            <bdi dir="ltr">{attempt.order.orderNumber}</bdi>
          </Link>
        ) : (
          <span className="text-ink-soft">—</span>
        ),
    },
    {
      key: "customer",
      header: t.colCustomer,
      className: "text-ink",
      cell: (attempt) => (
        <span className="block" dir="auto">
          {attempt.order?.customerName ?? "—"}
          {attempt.order?.phone && (
            <span className="block text-xs text-ink-soft">
              <bdi dir="ltr">{attempt.order.phone}</bdi>
            </span>
          )}
        </span>
      ),
    },
    {
      key: "agent",
      header: t.colAgent,
      className: "text-ink",
      cell: (attempt) => (
        <span className="block" dir="auto">
          {attempt.agent.fullName || attempt.agent.email || t.noName}
        </span>
      ),
    },
    {
      key: "attempt",
      header: t.colAttempt,
      align: "end",
      className: "tabular-nums text-ink",
      cell: (attempt) => attempt.attemptNumber,
    },
    {
      key: "outcome",
      header: t.colOutcome,
      cell: (attempt) => (
        <StatusBadge
          value={attempt.outcome}
          tone={OUTCOME_TONE[attempt.outcome]}
          text={t[OUTCOME_LABEL[attempt.outcome]]}
        />
      ),
    },
    {
      key: "note",
      header: t.colNote,
      className: "max-w-[240px] truncate text-ink-soft",
      cell: (attempt) => (
        <span className="block truncate" dir="auto" title={attempt.notes ?? undefined}>
          {attempt.notes || "—"}
        </span>
      ),
    },
    {
      key: "total",
      header: t.colTotal,
      align: "end",
      className: "tabular-nums whitespace-nowrap text-ink",
      cell: (attempt) =>
        attempt.order ? (
          <bdi dir="ltr">{formatMoney(attempt.order.totalAmount, attempt.order.currency)}</bdi>
        ) : (
          "—"
        ),
    },
  ];
}
