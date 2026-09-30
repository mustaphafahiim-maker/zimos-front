import { useId, useMemo, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Hourglass } from "lucide-react";
import { Alert, Button, Card } from "@store-builder/ui";
import {
  ORDER_SORTS,
  apiErrorDetails,
  isApiErrorCode,
  isInvalidCursorError,
  type ConfirmationAssignee,
  type ConfirmationAttempt,
  type ConfirmationAttemptSource,
  type ConfirmationChannel,
  type ConfirmationLockDetails,
  type ConfirmationOutcome,
  type ConfirmationQueueCounts,
  type ConfirmationQueueSort,
  type ConfirmationQueueTab,
  type ConfirmationTask,
  type RecordConfirmationOutcomePayload,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useCursorList } from "@/lib/useCursorList";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatAddress, formatDateTime, formatMoney } from "@/lib/format";
import { useListSort } from "@/lib/listSort";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { FilterTabs } from "@/components/FilterTabs";
import { LoadMore } from "@/components/LoadMore";
import { Modal } from "@/components/Modal";
import { TextField, Field } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { StatusBadge } from "@/components/StatusBadge";
import { Select } from "@/components/Select";
import { useOrderLabels } from "@/pages/orders/orderLabels";
import { OrderTimelineLines } from "@/pages/orders/components/OrderTimelineLines";
import { useManualCancelPrompt } from "@/pages/shipping/useManualCancelPrompt";
import { CONFIRM_ROLES, MANAGE_ROLES, minutesUntil, useNow } from "./confirmationRoles";
import { ChannelPicker, WhatsAppButton, useChannelLabels } from "./confirmationChannel";
import { CustomizationList } from "@/pages/orders/components/CustomizationList";

const OUTCOMES: ConfirmationOutcome[] = ["confirmed", "rejected", "unreachable", "postponed"];
const QUEUE_SORTS: readonly ConfirmationQueueSort[] = ["default", ...ORDER_SORTS];
const PAGE_SIZE = 50;

const STRINGS = {
  en: {
    title: "Confirmation queue",
    description: "Call each customer to confirm their order before it moves to fulfilment.",
    tabsLabel: "Queue tabs",
    tabPending: "Pending",
    tabInProgress: "In progress",
    tabDone: "Done",
    tabCount: "{label} ({n})",
    emptyPending: "No orders are waiting for confirmation right now.",
    emptyInProgress: "Nobody is on a call right now.",
    emptyDone: "No finished confirmations yet.",
    outcomeConfirmed: "Confirmed",
    outcomeRejected: "Rejected",
    outcomeUnreachable: "Unreachable",
    outcomePostponed: "Postponed",
    itemsOne: "1 item",
    itemsOther: "{n} items",
    attemptsOne: "1 previous attempt",
    attemptsOther: "{n} previous attempts",
    unnamedCustomer: "Unnamed customer",
    noPhone: "No phone number",
    claiming: "Claiming…",
    claimAndCall: "Claim & call",
    takeOver: "Take over",
    reclaim: "Claim again",
    release: "Release",
    releasing: "Releasing…",
    rejectionReason: "Rejection reason",
    rejectionPlaceholder: "Customer changed their mind",
    notes: "Notes",
    notesPlaceholder: "Anything worth recording from the call (optional).",
    saving: "Saving…",
    saveOutcome: "Save outcome",
    toastMarked: "{order} marked {outcome}.",
    toastReleased: "{order} is back in Pending.",
    callbackDue: "Callback due since {time}",
    callbackLater: "Callback scheduled for {time}",
    waitingTitle: "Waiting for the offers window",
    waitingBody:
      "The customer is still on the sales funnel's offers and may add to this order. It opens for confirmation in {n} min (at {time}), with its final total.",
    waitingSoon: "The customer is still on the sales funnel's offers. It opens for confirmation in a moment.",
    waitingCount: "{n} waiting for the offers window",
    lastAttempt: "Last: {outcome} by {agent}, {time}",
    yourClaim: "You're on this call · your claim expires in {n} min",
    yourClaimExpired: "Your claim expired. Claim it again before saving — someone else may take it.",
    heldBy: "{name} is on this call · claim expires in {n} min",
    heldByExpired: "{name}'s claim expired — anyone can take it over.",
    someone: "Another agent",
    lockedBy: "{name} is already on this call (claim expires in {n} min).",
    doneAt: "{outcome} · {time}",
    doneBy: "by {agent}",
    orderCancelled: "Order cancelled",
    history: "History ({n})",
    sourceQueue: "call",
    sourceOrderPage: "order page",
    sourceCorrection: "correction",
    corrected: "{from} → {to}",
    unknownAgent: "Unknown user",
    correct: "Correct outcome",
    correctTitle: "Correct {order}",
    correctToRejected:
      "Change to Rejected. Any courier booking that hasn't been collected is cancelled and the stock is released.",
    correctToConfirmed: "Change to Confirmed. The stock is reserved again; this fails if it has sold out.",
    correctReason: "Reason",
    correctReasonPlaceholder: "Customer called back",
    correctNotes: "Notes (optional)",
    correctSubmit: "Change to {outcome}",
    cancel: "Cancel",
    toastCorrected: "{order} changed to {outcome}.",
    sortLabel: "Sort",
    sort_default: "Queue order",
    sort_newest: "Newest first",
    sort_oldest: "Oldest first",
    sort_total_desc: "Total: high to low",
    sort_total_asc: "Total: low to high",
    assignmentFilter: "Assignment",
    filterAll: "All tasks",
    filterMine: "Assigned to me",
    filterUnassigned: "Unassigned",
    filterAgents: "Assigned to an agent",
    assignedTo: "Assigned to {name}",
    assignedToYou: "Assigned to you",
    notAssigned: "Not assigned",
    assignTo: "Assign {order} to",
    nobody: "Nobody (open to all)",
    assignedToast: "{order} assigned to {name}.",
    unassignedToast: "{order} is open to every agent again.",
    assignedToOther: "Assigned to {name}. Only they or a manager can take it.",
    selectTask: "Select {order}",
    selectAll: "Select all shown",
    selectedCount: "{n} selected",
    bulkAgent: "Agent for the selected tasks",
    chooseAgent: "Choose an agent",
    bulkAssign: "Assign",
    bulkUnassign: "Remove assignment",
    clearSelection: "Clear selection",
    bulkDone: "{n} tasks updated.",
    bulkSkipped: "{n} finished tasks were left as they were.",
    via: "via {channel}",
  },
  ar: {
    title: "قائمة التأكيد",
    description: "اتصل بكل عميل لتأكيد طلبه قبل أن ينتقل إلى التجهيز.",
    tabsLabel: "أقسام القائمة",
    tabPending: "بالانتظار",
    tabInProgress: "قيد التنفيذ",
    tabDone: "منتهية",
    tabCount: "{label} ({n})",
    emptyPending: "لا توجد طلبات بانتظار التأكيد حاليًا.",
    emptyInProgress: "لا أحد في مكالمة الآن.",
    emptyDone: "لا توجد تأكيدات منتهية بعد.",
    outcomeConfirmed: "مؤكد",
    outcomeRejected: "مرفوض",
    outcomeUnreachable: "تعذّر الوصول",
    outcomePostponed: "مؤجل",
    itemsOne: "منتج واحد",
    itemsOther: "{n} منتجات",
    attemptsOne: "محاولة سابقة واحدة",
    attemptsOther: "{n} محاولات سابقة",
    unnamedCustomer: "عميل بدون اسم",
    noPhone: "لا يوجد رقم هاتف",
    claiming: "جارٍ الاستلام…",
    claimAndCall: "استلام واتصال",
    takeOver: "استلام بدلًا منه",
    reclaim: "استلام مرة أخرى",
    release: "إرجاع للقائمة",
    releasing: "جارٍ الإرجاع…",
    rejectionReason: "سبب الرفض",
    rejectionPlaceholder: "غيّر العميل رأيه",
    notes: "ملاحظات",
    notesPlaceholder: "أي شيء يستحق التسجيل من المكالمة (اختياري).",
    saving: "جارٍ الحفظ…",
    saveOutcome: "حفظ النتيجة",
    toastMarked: "تم تعيين {order} كـ {outcome}.",
    toastReleased: "عاد {order} إلى قائمة الانتظار.",
    callbackDue: "موعد معاودة الاتصال حان منذ {time}",
    callbackLater: "معاودة الاتصال مجدولة في {time}",
    waitingTitle: "في انتظار نافذة العروض",
    waitingBody:
      "ما زال العميل في عروض مسار البيع وقد يضيف إلى هذا الطلب. يُتاح للتأكيد خلال {n} دقيقة (في {time}) بإجماليه النهائي.",
    waitingSoon: "ما زال العميل في عروض مسار البيع. يُتاح الطلب للتأكيد بعد لحظات.",
    waitingCount: "{n} في انتظار نافذة العروض",
    lastAttempt: "آخر محاولة: {outcome} بواسطة {agent}، {time}",
    yourClaim: "أنت في هذه المكالمة · ينتهي استلامك خلال {n} دقيقة",
    yourClaimExpired: "انتهت مدة استلامك. استلمه مرة أخرى قبل الحفظ — قد يستلمه شخص آخر.",
    heldBy: "{name} في هذه المكالمة · ينتهي الاستلام خلال {n} دقيقة",
    heldByExpired: "انتهت مدة استلام {name} — يمكن لأي شخص استلامه.",
    someone: "موظف آخر",
    lockedBy: "{name} في هذه المكالمة بالفعل (ينتهي الاستلام خلال {n} دقيقة).",
    doneAt: "{outcome} · {time}",
    doneBy: "بواسطة {agent}",
    orderCancelled: "أوردر ملغي",
    history: "السجل ({n})",
    sourceQueue: "مكالمة",
    sourceOrderPage: "صفحة الأوردر",
    sourceCorrection: "تصحيح",
    corrected: "{from} ← {to}",
    unknownAgent: "مستخدم غير معروف",
    correct: "تصحيح النتيجة",
    correctTitle: "تصحيح {order}",
    correctToRejected: "التغيير إلى مرفوض. تُلغى أي شحنة لم تُستلم بعد ويُحرَّر المخزون.",
    correctToConfirmed: "التغيير إلى مؤكد. يُحجز المخزون مرة أخرى، ويفشل ذلك إذا نفد.",
    correctReason: "السبب",
    correctReasonPlaceholder: "اتصل العميل مرة أخرى",
    correctNotes: "ملاحظات (اختياري)",
    correctSubmit: "التغيير إلى {outcome}",
    cancel: "إلغاء",
    toastCorrected: "تم تغيير {order} إلى {outcome}.",
    sortLabel: "الترتيب",
    sort_default: "ترتيب القائمة",
    sort_newest: "الأحدث أولًا",
    sort_oldest: "الأقدم أولًا",
    sort_total_desc: "الإجمالي: من الأعلى إلى الأقل",
    sort_total_asc: "الإجمالي: من الأقل إلى الأعلى",
    assignmentFilter: "التعيين",
    filterAll: "الكل",
    filterMine: "طلباتي",
    filterUnassigned: "غير معيّنة",
    filterAgents: "معيّنة لموظف",
    assignedTo: "المعيّن له: {name}",
    assignedToYou: "المعيّن له: أنت",
    notAssigned: "غير معيّن",
    assignTo: "تعيين {order} إلى",
    nobody: "لا أحد (متاح للجميع)",
    assignedToast: "تم تعيين {order} إلى {name}.",
    unassignedToast: "أصبح {order} متاحًا لجميع الموظفين.",
    assignedToOther: "معيّن لـ {name}، ولا يستلمه غيره إلا المدير.",
    selectTask: "تحديد {order}",
    selectAll: "تحديد كل المعروض",
    selectedCount: "المحدد: {n}",
    bulkAgent: "الموظف للمهام المحددة",
    chooseAgent: "اختر موظفًا",
    bulkAssign: "تعيين",
    bulkUnassign: "إلغاء التعيين",
    clearSelection: "إلغاء التحديد",
    bulkDone: "تم تحديث {n} من المهام.",
    bulkSkipped: "تُركت {n} من المهام المنتهية كما هي.",
    via: "عبر {channel}",
  },
} satisfies Messages;

type Strings = Record<keyof typeof STRINGS.en, string>;

/** Outcome buttons and the toast, in the active locale. */
function useOutcomeLabels(): Record<ConfirmationOutcome, string> {
  const t = useT(STRINGS);
  return {
    confirmed: t.outcomeConfirmed,
    rejected: t.outcomeRejected,
    unreachable: t.outcomeUnreachable,
    postponed: t.outcomePostponed,
  };
}

function sourceLabel(t: Strings, source: ConfirmationAttemptSource): string {
  if (source === "order_page") return t.sourceOrderPage;
  if (source === "correction") return t.sourceCorrection;
  return t.sourceQueue;
}

/** What the viewer may do here, from their role key in this workspace. */
function useQueueAbilities() {
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const role = currentWorkspace?.role ?? "";
  return {
    userId: user?.id ?? null,
    canConfirm: CONFIRM_ROLES.has(role),
    canManage: MANAGE_ROLES.has(role),
  };
}

/** The assignment filter: every task, mine, nobody's, or one agent's (their user id). */
type AssignmentFilter = "all" | "me" | "unassigned" | (string & {});

export function ConfirmationQueuePage() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { canManage } = useQueueAbilities();
  // Waiting funnel orders turn into workable cards when their window opens.
  const now = useNow(30_000);
  const [tab, setTab] = useState<ConfirmationQueueTab>("pending");
  const [assignment, setAssignment] = useState<AssignmentFilter>("all");
  const assignmentId = useId();
  // Selection for a manager's bulk assignment; reset whenever the list changes shape.
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [bulkAgent, setBulkAgent] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);
  // "Queue order" is each tab's own order (due callbacks first on Pending),
  // as the queue has always been; the rest sort on the server by the order.
  const [sort, setSort] = useListSort<ConfirmationQueueSort>("zimos.confirmation.sort", QUEUE_SORTS, "default");
  const sortId = useId();

  const counts = useAsync(() => apiClient.getConfirmationQueueCounts(workspaceId), [workspaceId]);
  // Only a manager assigns, so only a manager needs the team.
  const assignees = useAsync(
    () => (canManage ? apiClient.listConfirmationAssignees(workspaceId) : Promise.resolve([] as ConfirmationAssignee[])),
    [workspaceId, canManage]
  );
  const list = useCursorList<ConfirmationTask>(
    async (cursor) => {
      const page = await apiClient.listConfirmationQueue(workspaceId, {
        status: tab,
        cursor,
        limit: PAGE_SIZE,
        sort,
        ...(assignment === "all" ? {} : { assignedTo: assignment }),
      });
      return { items: page.tasks, nextCursor: page.nextCursor };
    },
    [workspaceId, tab, sort, assignment],
    { isStaleCursor: (err) => isInvalidCursorError(err) }
  );
  const team = assignees.data ?? [];
  const openShown = useMemo(() => list.items.filter((task) => task.status !== "done"), [list.items]);
  const selectable = canManage && tab !== "done";
  const allShownSelected = openShown.length > 0 && openShown.every((task) => selected.has(task.id));

  function changeTab(next: ConfirmationQueueTab) {
    setTab(next);
    setSelected(new Set());
  }

  function changeAssignment(next: AssignmentFilter) {
    setAssignment(next);
    setSelected(new Set());
  }

  function toggle(taskId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  }

  async function assignSelected(userId: string | null) {
    setBulkBusy(true);
    setBulkError(null);
    try {
      const result = await apiClient.assignConfirmationTasks(workspaceId, [...selected], userId);
      const byId = new Map(result.tasks.map((task) => [task.id, task]));
      list.setItems((prev) => prev.map((task) => byId.get(task.id) ?? task));
      toast.success(fmt(t.bulkDone, { n: result.tasks.length }));
      const finished = result.skipped.filter((s) => s.code === "TASK_ALREADY_DONE").length;
      if (finished > 0) toast.success(fmt(t.bulkSkipped, { n: finished }));
      setSelected(new Set());
      void counts.refresh({ silent: true });
    } catch (err) {
      setBulkError(errorMessage(err));
    } finally {
      setBulkBusy(false);
    }
  }

  function tabLabel(label: string, key: keyof ConfirmationQueueCounts) {
    const n = counts.data?.[key];
    return n === undefined ? label : fmt(t.tabCount, { label, n });
  }

  // A task that changed in place (claimed, released, corrected) keeps its
  // spot until the next load, so the card an agent is working doesn't jump.
  function replaceTask(updated: ConfirmationTask) {
    list.setItems((prev) => prev.map((task) => (task.id === updated.id ? updated : task)));
    void counts.refresh({ silent: true });
  }

  function removeTask(taskId: string) {
    list.setItems((prev) => prev.filter((task) => task.id !== taskId));
    void counts.refresh({ silent: true });
  }

  const emptyMessage =
    tab === "pending" ? t.emptyPending : tab === "in_progress" ? t.emptyInProgress : t.emptyDone;

  return (
    <div className="max-w-3xl">
      <PageHeader title={t.title} description={t.description} />

      <div className="mb-3 flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <label htmlFor={assignmentId} className="text-sm text-ink-soft">
            {t.assignmentFilter}
          </label>
          <Select
            id={assignmentId}
            value={assignment}
            onChange={(e) => changeAssignment(e.target.value)}
            className="h-11 w-auto min-w-44"
          >
            <option value="all">{t.filterAll}</option>
            <option value="me">{t.filterMine}</option>
            <option value="unassigned">{t.filterUnassigned}</option>
            {canManage && team.length > 0 && (
              <optgroup label={t.filterAgents}>
                {team.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.fullName}
                  </option>
                ))}
              </optgroup>
            )}
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor={sortId} className="text-sm text-ink-soft">
            {t.sortLabel}
          </label>
          <Select
            id={sortId}
            value={sort}
            onChange={(e) => setSort(e.target.value as ConfirmationQueueSort)}
            className="h-11 w-auto min-w-48"
          >
            {QUEUE_SORTS.map((key) => (
              <option key={key} value={key}>
                {t[`sort_${key}`]}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <FilterTabs
        className="mb-4"
        label={t.tabsLabel}
        value={tab}
        onChange={changeTab}
        tabs={[
          { value: "pending", label: tabLabel(t.tabPending, "pending") },
          { value: "in_progress", label: tabLabel(t.tabInProgress, "inProgress") },
          { value: "done", label: tabLabel(t.tabDone, "done") },
        ]}
      />

      <DataState
        loading={list.loading}
        error={list.error}
        empty={list.items.length === 0}
        emptyMessage={emptyMessage}
        onRetry={list.reload}
      >
        {selectable && openShown.length > 0 && (
          <div
            role="region"
            aria-label={t.bulkAgent}
            className="mb-4 flex flex-wrap items-center gap-3 rounded-[0.5rem] border border-line bg-paper px-4 py-3"
          >
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={allShownSelected}
                onChange={() =>
                  setSelected(allShownSelected ? new Set() : new Set(openShown.map((task) => task.id)))
                }
              />
              {t.selectAll}
            </label>
            {selected.size > 0 && (
              <>
                <span className="text-sm font-medium text-ink" aria-live="polite">
                  {fmt(t.selectedCount, { n: selected.size })}
                </span>
                <Select
                  aria-label={t.bulkAgent}
                  value={bulkAgent}
                  onChange={(e) => setBulkAgent(e.target.value)}
                  className="h-11 w-auto min-w-44"
                  disabled={bulkBusy}
                >
                  <option value="">{t.chooseAgent}</option>
                  {team.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.fullName}
                    </option>
                  ))}
                </Select>
                <Button
                  className="min-h-11"
                  disabled={bulkBusy || !bulkAgent}
                  onClick={() => void assignSelected(bulkAgent)}
                >
                  {t.bulkAssign}
                </Button>
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={bulkBusy}
                  onClick={() => void assignSelected(null)}
                >
                  {t.bulkUnassign}
                </Button>
                <Button variant="ghost" className="min-h-11" disabled={bulkBusy} onClick={() => setSelected(new Set())}>
                  {t.clearSelection}
                </Button>
              </>
            )}
            {bulkError && (
              <Alert variant="danger" className="w-full">
                {bulkError}
              </Alert>
            )}
          </div>
        )}
        <div className="space-y-4">
          {list.items.map((task) =>
            task.status === "done" ? (
              <DoneCard key={task.id} task={task} onChanged={replaceTask} />
            ) : isWaiting(task, now) ? (
              <WaitingCard key={task.id} task={task} now={now} />
            ) : (
              <OpenCard
                key={task.id}
                task={task}
                team={team}
                selected={selectable ? selected.has(task.id) : undefined}
                onToggleSelected={() => toggle(task.id)}
                onChanged={replaceTask}
                onResolved={removeTask}
              />
            )
          )}
        </div>
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </DataState>
    </div>
  );
}

/** Order number, items, total, risk flags and the customer's contact — every card's top half. */
function OrderSummary({ task, aside, contactAction }: { task: ConfirmationTask; aside?: ReactNode; contactAction?: ReactNode }) {
  const t = useT(STRINGS);
  const orderLabels = useOrderLabels();
  const now = useNow(60_000);
  const { order } = task;
  const riskFlags = order.riskFlags ?? [];
  const contact = order.contactSnapshot;
  const itemCount = order.items.length;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={`/orders/${order.id}`}
              className="font-display text-lg font-medium text-ink hover:text-primary"
            >
              <bdi dir="ltr">{order.orderNumber}</bdi>
            </Link>
            {riskFlags.length > 0 && (
              <StatusBadge value="flagged" tone="danger" text={orderLabels.flagged} />
            )}
            {order.cancelledAt && <StatusBadge value="cancelled" text={t.orderCancelled} />}
          </div>
          <p className="mt-0.5 text-sm text-ink-soft">
            {itemCount === 1 ? t.itemsOne : fmt(t.itemsOther, { n: itemCount })} ·{" "}
            {formatMoney(order.totalAmount, order.currency)}
          </p>
          {riskFlags.length > 0 && (
            <p className="mt-0.5 text-xs font-medium text-danger">
              {riskFlags.map((flag) => orderLabels.riskFlag(flag)).join(" · ")}
            </p>
          )}
          <OrderTimelineLines order={order} now={now} className="mt-1" />
        </div>
        {aside}
      </div>

      {/* The customer's answers to products' custom fields — confirmed on the call too. */}
      {order.items
        .filter((item) => item.customizations && item.customizations.length > 0)
        .map((item) => (
          <div key={item.id} className="space-y-1">
            <p className="text-xs font-medium text-ink-soft">{item.productNameSnapshot}</p>
            <CustomizationList customizations={item.customizations} compact />
          </div>
        ))}

      <div className="rounded-[0.5rem] bg-paper px-4 py-3">
        <p className="text-sm font-medium text-ink">{contact.fullName || t.unnamedCustomer}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-2">
          <p className="font-display text-xl font-medium text-ink">
            {contact.phone ? (
              <a href={`tel:${contact.phone}`} className="hover:text-primary">
                <bdi dir="ltr">{contact.phone}</bdi>
              </a>
            ) : (
              <span className="text-ink-soft">{t.noPhone}</span>
            )}
          </p>
          {contactAction}
        </div>
        <p className="mt-1 text-sm text-ink-soft">{formatAddress(order.shippingAddressSnapshot)}</p>
      </div>
    </>
  );
}

/** A funnel order still in its offer window: listed, not workable yet. */
const isWaiting = (task: ConfirmationTask, now: number) =>
  task.status === "queued" && Boolean(task.availableAt) && new Date(task.availableAt as string).getTime() > now;

/**
 * The shopper may still add an upsell to this order, so nobody works it yet:
 * the order number and when it opens, nothing to act on (the server refuses a
 * claim until then). It turns into the normal card by itself when the time
 * comes; the funnel may also close the window early.
 */
function WaitingCard({ task, now }: { task: ConfirmationTask; now: number }) {
  const t = useT(STRINGS);
  const minutes = minutesUntil(task.availableAt ?? null, now);
  return (
    <Card className="flex flex-wrap items-start gap-3 border-dashed p-5" aria-label={fmt(t.waitingCount, { n: 1 })}>
      <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-dark" aria-hidden>
        <Hourglass className="size-5" />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="flex flex-wrap items-center gap-2 text-sm">
          <bdi dir="ltr" className="font-semibold text-ink">
            {task.order.orderNumber}
          </bdi>
          <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-dark">{t.waitingTitle}</span>
        </p>
        <p className="text-sm text-ink-soft">
          {minutes > 0
            ? fmt(t.waitingBody, { n: minutes, time: formatDateTime(task.availableAt as string) })
            : t.waitingSoon}
        </p>
      </div>
    </Card>
  );
}

function AttemptsBadge({ count }: { count: number }) {
  const t = useT(STRINGS);
  if (count === 0) return null;
  return (
    <span className="rounded-full border border-accent/40 bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-dark">
      {count === 1 ? t.attemptsOne : fmt(t.attemptsOther, { n: count })}
    </span>
  );
}

/** A pending or in-progress task: claim, record an outcome, release. */
function OpenCard({
  task,
  team,
  selected,
  onToggleSelected,
  onChanged,
  onResolved,
}: {
  task: ConfirmationTask;
  /** Members the task may be assigned to; empty unless the viewer manages orders. */
  team: ConfirmationAssignee[];
  /** Whether the card is ticked for bulk assignment; undefined hides the tick box. */
  selected?: boolean;
  onToggleSelected: () => void;
  onChanged: (task: ConfirmationTask) => void;
  onResolved: (taskId: string) => void;
}) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();
  const outcomeLabel = useOutcomeLabels();
  const { userId, canConfirm, canManage } = useQueueAbilities();
  const now = useNow();

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<ConfirmationOutcome | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [notes, setNotes] = useState("");
  // The channel belongs to one claim: a fresh claim starts from "call" again,
  // and opening WhatsApp while holding the claim picks WhatsApp.
  const [channelChoice, setChannelChoice] = useState<{ lockedAt: string | null; channel: ConfirmationChannel }>({
    lockedAt: null,
    channel: "call",
  });
  const channelLabel = useChannelLabels();
  const assignId = useId();

  const { order } = task;
  const inProgress = task.status === "in_progress";
  const mine = inProgress && task.lockedByUserId === userId;
  const expired = inProgress && minutesUntil(task.lockExpiresAt, now) === 0;
  const holderName = task.lockedBy?.fullName ?? t.someone;
  const rejectionMissing = outcome === "rejected" && rejectionReason.trim() === "";
  const lastAttempt = task.attempts[task.attempts.length - 1];
  const channel = channelChoice.lockedAt === task.lockedAt ? channelChoice.channel : "call";
  const pickChannel = (next: ConfirmationChannel) => setChannelChoice({ lockedAt: task.lockedAt, channel: next });
  const assignedToOther = Boolean(task.assignedTo) && task.assignedTo?.id !== userId;
  const assignedName = task.assignedTo?.fullName ?? t.someone;

  function describe(err: unknown): string {
    if (isApiErrorCode(err, "TASK_ALREADY_LOCKED")) {
      const lock = apiErrorDetails<ConfirmationLockDetails>(err);
      return fmt(t.lockedBy, {
        name: lock?.lockedBy?.fullName ?? t.someone,
        n: minutesUntil(lock?.lockExpiresAt ?? null, Date.now()),
      });
    }
    if (isApiErrorCode(err, "TASK_ASSIGNED_TO_OTHER")) {
      const details = apiErrorDetails<{ assignedTo: { fullName: string } | null }>(err);
      return fmt(t.assignedToOther, { name: details?.assignedTo?.fullName ?? t.someone });
    }
    return errorMessage(err);
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(describe(err));
    } finally {
      setBusy(false);
    }
  }

  const claim = () => run(async () => onChanged(await apiClient.claimConfirmationTask(workspaceId, task.id)));

  const release = () =>
    run(async () => {
      onChanged(await apiClient.releaseConfirmationTask(workspaceId, task.id));
      toast.success(fmt(t.toastReleased, { order: order.orderNumber }));
    });

  const assign = (userId: string) =>
    run(async () => {
      if (userId) {
        const updated = await apiClient.assignConfirmationTask(workspaceId, task.id, userId);
        onChanged(updated);
        toast.success(fmt(t.assignedToast, { order: order.orderNumber, name: updated.assignedTo?.fullName ?? "" }));
      } else {
        onChanged(await apiClient.unassignConfirmationTask(workspaceId, task.id));
        toast.success(fmt(t.unassignedToast, { order: order.orderNumber }));
      }
    });

  const save = () =>
    run(async () => {
      if (!outcome || rejectionMissing) return;
      const payload: RecordConfirmationOutcomePayload = { outcome, channel };
      if (notes.trim()) payload.notes = notes.trim();
      if (outcome === "rejected") payload.rejectionReason = rejectionReason.trim();
      await apiClient.recordConfirmationOutcome(workspaceId, task.id, payload);
      // Arabic has no letter case, so lowercasing is a no-op there.
      toast.success(
        fmt(t.toastMarked, { order: order.orderNumber, outcome: outcomeLabel[outcome].toLowerCase() })
      );
      onResolved(task.id);
    });

  let lockLine: string | null = null;
  if (mine) {
    lockLine = expired ? t.yourClaimExpired : fmt(t.yourClaim, { n: minutesUntil(task.lockExpiresAt, now) });
  } else if (inProgress) {
    lockLine = expired
      ? fmt(t.heldByExpired, { name: holderName })
      : fmt(t.heldBy, { name: holderName, n: minutesUntil(task.lockExpiresAt, now) });
  }

  let callbackLine: string | null = null;
  if (!inProgress && task.nextRetryAt) {
    const due = new Date(task.nextRetryAt).getTime() <= now;
    callbackLine = fmt(due ? t.callbackDue : t.callbackLater, { time: formatDateTime(task.nextRetryAt) });
  }

  return (
    <Card className="space-y-4 p-5">
      {selected !== undefined && (
        <label className="-mt-1 flex min-h-11 w-fit cursor-pointer items-center gap-2 text-sm text-ink-soft">
          <input type="checkbox" className="size-4 accent-primary" checked={selected} onChange={onToggleSelected} />
          {fmt(t.selectTask, { order: order.orderNumber })}
        </label>
      )}
      <OrderSummary
        task={task}
        aside={<AttemptsBadge count={task.attemptCount} />}
        contactAction={<WhatsAppButton order={order} onOpen={() => mine && !expired && pickChannel("whatsapp")} />}
      />

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm">
        <p className={task.assignedTo ? "font-medium text-ink" : "text-ink-soft"}>
          {!task.assignedTo
            ? t.notAssigned
            : task.assignedTo.id === userId
              ? t.assignedToYou
              : fmt(t.assignedTo, { name: assignedName })}
        </p>
        {canManage && team.length > 0 && (
          <>
            <label htmlFor={assignId} className="sr-only">
              {fmt(t.assignTo, { order: order.orderNumber })}
            </label>
            <Select
              id={assignId}
              value={task.assignedTo?.id ?? ""}
              onChange={(e) => assign(e.target.value)}
              disabled={busy}
              className="h-11 w-auto min-w-44"
            >
              <option value="">{t.nobody}</option>
              {team.map((agent) => (
                <option key={agent.id} value={agent.id}>
                  {agent.fullName}
                </option>
              ))}
            </Select>
          </>
        )}
      </div>

      {(callbackLine || lastAttempt) && (
        <div className="space-y-0.5 text-sm text-ink-soft">
          {callbackLine && <p className="font-medium text-accent-dark">{callbackLine}</p>}
          {lastAttempt && (
            <p>
              {fmt(t.lastAttempt, {
                outcome: outcomeLabel[lastAttempt.outcome],
                agent: lastAttempt.agent?.fullName ?? t.unknownAgent,
                time: formatDateTime(lastAttempt.createdAt),
              })}
              {lastAttempt.channel && <> · {fmt(t.via, { channel: channelLabel[lastAttempt.channel] })}</>}
            </p>
          )}
        </div>
      )}

      {lockLine && (
        <p className={mine && expired ? "text-sm font-medium text-danger" : "text-sm text-ink-soft"}>
          {lockLine}
        </p>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      {mine && !expired ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {OUTCOMES.map((o) => (
              <Button
                key={o}
                type="button"
                size="lg"
                variant={outcome === o ? "primary" : "outline"}
                onClick={() => setOutcome(o)}
                disabled={busy}
              >
                {outcomeLabel[o]}
              </Button>
            ))}
          </div>

          <ChannelPicker value={channel} onChange={pickChannel} disabled={busy} />

          {outcome === "rejected" && (
            <TextField
              label={t.rejectionReason}
              required
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder={t.rejectionPlaceholder}
            />
          )}

          <Field label={t.notes}>
            {({ id }) => (
              <Textarea
                id={id}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t.notesPlaceholder}
              />
            )}
          </Field>

          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={busy || !outcome || rejectionMissing}>
              {busy ? t.saving : t.saveOutcome}
            </Button>
            <Button variant="outline" onClick={release} disabled={busy}>
              {t.release}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          {canConfirm && (!inProgress || expired) && assignedToOther && !canManage ? (
            <p className="text-sm text-ink-soft">{fmt(t.assignedToOther, { name: assignedName })}</p>
          ) : (
            canConfirm &&
            (!inProgress || expired) && (
              <Button onClick={claim} disabled={busy}>
                {busy ? t.claiming : mine ? t.reclaim : inProgress ? t.takeOver : t.claimAndCall}
              </Button>
            )
          )}
          {inProgress && !mine && !expired && canManage && (
            <Button variant="outline" onClick={release} disabled={busy}>
              {busy ? t.releasing : t.release}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

/** A finished task: outcome, who and when, the attempt history, and a manager's correction. */
function DoneCard({ task, onChanged }: { task: ConfirmationTask; onChanged: (task: ConfirmationTask) => void }) {
  const t = useT(STRINGS);
  const outcomeLabel = useOutcomeLabels();
  const { canManage } = useQueueAbilities();
  const [correcting, setCorrecting] = useState(false);

  const outcome = task.outcome ?? "confirmed";
  const last = task.attempts[task.attempts.length - 1];

  return (
    <Card className="space-y-4 p-5">
      <OrderSummary task={task} aside={<StatusBadge value={outcome} text={outcomeLabel[outcome]} />} />

      <div className="space-y-1 text-sm text-ink-soft">
        <p>
          {fmt(t.doneAt, { outcome: outcomeLabel[outcome], time: formatDateTime(task.completedAt ?? task.updatedAt) })}
          {last?.agent && <> · {fmt(t.doneBy, { agent: last.agent.fullName })}</>}
        </p>
        {task.rejectionReason && <p className="text-ink">“{task.rejectionReason}”</p>}
      </div>

      {task.attempts.length > 0 && (
        <details className="rounded-[0.5rem] border border-line px-4 py-2 text-sm">
          <summary className="cursor-pointer font-medium text-ink">
            {fmt(t.history, { n: task.attempts.length })}
          </summary>
          <ol className="mt-2 space-y-2">
            {task.attempts.map((attempt) => (
              <AttemptRow key={attempt.id} attempt={attempt} />
            ))}
          </ol>
        </details>
      )}

      {task.correctable && canManage && (
        <Button variant="outline" onClick={() => setCorrecting(true)}>
          {t.correct}
        </Button>
      )}

      {correcting && (
        <CorrectOutcomeModal
          task={task}
          onClose={() => setCorrecting(false)}
          onCorrected={(updated) => {
            setCorrecting(false);
            onChanged(updated);
          }}
        />
      )}
    </Card>
  );
}

function AttemptRow({ attempt }: { attempt: ConfirmationAttempt }) {
  const t = useT(STRINGS);
  const outcomeLabel = useOutcomeLabels();
  const channelLabel = useChannelLabels();
  const what = attempt.previousOutcome
    ? fmt(t.corrected, { from: outcomeLabel[attempt.previousOutcome], to: outcomeLabel[attempt.outcome] })
    : outcomeLabel[attempt.outcome];
  return (
    <li className="border-b border-line pb-2 last:border-b-0 last:pb-0">
      <p className="text-ink">
        <span className="font-medium">{what}</span> · {sourceLabel(t, attempt.source)} ·{" "}
        {attempt.agent?.fullName ?? t.unknownAgent}
        {attempt.channel && <> · {fmt(t.via, { channel: channelLabel[attempt.channel] })}</>}
      </p>
      <p className="text-xs text-ink-soft">{formatDateTime(attempt.createdAt)}</p>
      {attempt.notes && <p className="mt-0.5 whitespace-pre-line text-ink-soft">{attempt.notes}</p>}
    </li>
  );
}

function CorrectOutcomeModal({
  task,
  onClose,
  onCorrected,
}: {
  task: ConfirmationTask;
  onClose: () => void;
  onCorrected: (task: ConfirmationTask) => void;
}) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const outcomeLabel = useOutcomeLabels();
  // The order's state is what gets corrected; the target is the other final outcome.
  const target = task.order.confirmationState === "rejected" ? "confirmed" : "rejected";
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const manualCancelPrompt = useManualCancelPrompt();

  async function correct(acknowledgeManualCancel: boolean) {
    const updated = await apiClient.correctConfirmationOutcome(workspaceId, task.id, {
      outcome: target,
      reason: reason.trim(),
      ...(notes.trim() ? { notes: notes.trim() } : {}),
      ...(acknowledgeManualCancel ? { acknowledgeManualCancel: true } : {}),
    });
    toast.success(
      fmt(t.toastCorrected, { order: task.order.orderNumber, outcome: outcomeLabel[target].toLowerCase() })
    );
    onCorrected(updated);
  }

  async function submit() {
    if (!reason.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await correct(false);
    } catch (err) {
      // Correcting to rejected cancels the courier booking; a courier without
      // a cancel API needs the merchant to cancel it there and confirm first.
      const offered = manualCancelPrompt.offer(err, async () => {
        try {
          await correct(true);
        } catch (retryErr) {
          throw new Error(errorMessage(retryErr));
        }
      });
      if (!offered) setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <>
      {manualCancelPrompt.dialog}
      <Modal
        // Hidden, not closed, while the manual-cancel step is up: the reason
        // and notes typed here are kept for the repeat.
        open={!manualCancelPrompt.isOpen}
        onClose={onClose}
        title={fmt(t.correctTitle, { order: task.order.orderNumber })}
        description={target === "rejected" ? t.correctToRejected : t.correctToConfirmed}
        footer={
          <>
            <Button variant="outline" onClick={onClose} disabled={busy}>
              {t.cancel}
            </Button>
            <Button
              variant={target === "rejected" ? "danger" : "primary"}
              onClick={submit}
              disabled={busy || !reason.trim()}
            >
              {busy ? t.saving : fmt(t.correctSubmit, { outcome: outcomeLabel[target] })}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {error && <Alert variant="danger">{error}</Alert>}
          <TextField
            label={t.correctReason}
            required
            maxLength={300}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t.correctReasonPlaceholder}
          />
          <Field label={t.correctNotes}>
            {({ id }) => (
              <Textarea id={id} value={notes} maxLength={600} onChange={(e) => setNotes(e.target.value)} />
            )}
          </Field>
        </div>
      </Modal>
    </>
  );
}
