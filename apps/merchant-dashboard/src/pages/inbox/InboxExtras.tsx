import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Alert, Button, cn } from "@store-builder/ui";
import {
  formatMoney,
  inboxAssign,
  inboxCreateQuickReply,
  inboxDeleteQuickReply,
  inboxGetCustomerPanel,
  inboxListAssignees,
  inboxListQuickReplies,
  type InboxAssignee,
  type InboxConversation,
  type InboxCustomerOrder,
  type InboxCustomerPanel,
  type InboxQuickReply,
  type OrderStage,
} from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { ContactActions } from "@/components/ContactActions";
import { DataState, SkeletonBar } from "@/components/DataState";
import { Field, TextField } from "@/components/Field";
import { IconCheck, IconDelete, IconPlus, IconQuote, IconSpinner, IconUser, IconUserAdd } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { Sheet } from "@/components/Sheet";
import { StatusBadge } from "@/components/StatusBadge";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { useAsync } from "@/lib/useAsync";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { refreshWorkCounts } from "@/lib/workCounts";
import { STAGE_TONE, useOrderLabels } from "@/pages/orders/orderLabels";
import { CHAT_TOOL, dialNumber } from "./inboxScreen";

/**
 * The inbox's additions around a thread (SPEC §14.3): who owns the chat, the
 * customer's facts and orders with their actions, and saved quick replies.
 * Each opens in a sheet; the conversation stays where it is underneath.
 */

const STRINGS = {
  en: {
    assignee: "Assigned to",
    assignTitle: "Who takes this conversation?",
    assignTo: "Assigned to {name}",
    unassigned: "Unassigned",
    assignedToast: "Conversation assigned.",
    unassignedToast: "Conversation unassigned.",
    panelTitle: "Customer",
    customerButton: "The customer and their orders",
    noCustomer: "No customer with this number yet. They become one with their first order.",
    viewCustomer: "Open customer",
    blacklisted: "Blocked customer",
    deliveryRate: "Delivery rate",
    deliveryRateHint: "{delivered} delivered of {total}",
    noRate: "No finished orders yet",
    percent: "{n}%",
    orders: "Latest orders",
    noOrders: "No orders yet.",
    confirm: "Confirm",
    cancel: "Cancel order",
    confirmed: "Order {n} confirmed.",
    cancelled: "Order {n} cancelled.",
    cancelTitle: "Cancel order {n}?",
    cancelDesc: "The order is cancelled and its stock is released.",
    cancelReason: "Cancelled from the WhatsApp inbox",
    cancelling: "Cancelling…",
    keep: "Keep order",
    createOrder: "New order",
    openOrder: "Open order {n}",
    quickReplies: "Quick replies",
    quickHint: "Pick one to put it in the message box.",
    noQuick: "No quick replies yet",
    noQuickHint: "Save the answers you type most, and send them in one tap.",
    newQuick: "New quick reply",
    quickTitle: "Title",
    quickTitleHint: "A few words you will recognise it by.",
    quickBody: "Text",
    save: "Save",
    saving: "Saving…",
    back: "Back",
    deleteQuick: "Delete quick reply {title}",
    quickDeleted: "Quick reply deleted.",
    quickSaved: "Quick reply saved.",
  },
  ar: {
    assignee: "متسندة لـ",
    assignTitle: "مين يمسك المحادثة دي؟",
    assignTo: "متسندة لـ {name}",
    unassigned: "مش متسندة",
    assignedToast: "المحادثة اتسندت.",
    unassignedToast: "المحادثة مبقتش متسندة لحد.",
    panelTitle: "العميل",
    customerButton: "العميل وأوردراته",
    noCustomer: "مفيش عميل بالرقم ده لسه. هيبقى عميل مع أول أوردر.",
    viewCustomer: "افتح صفحة العميل",
    blacklisted: "عميل محظور",
    deliveryRate: "نسبة الاستلام",
    deliveryRateHint: "{delivered} اتسلّموا من {total}",
    noRate: "لسه مفيش أوردرات خلصت",
    percent: "{n}٪",
    orders: "آخر الأوردرات",
    noOrders: "مفيش أوردرات لسه.",
    confirm: "أكّد",
    cancel: "الغي الأوردر",
    confirmed: "الأوردر {n} اتأكد.",
    cancelled: "الأوردر {n} اتلغى.",
    cancelTitle: "تلغي الأوردر {n}؟",
    cancelDesc: "الأوردر هيتلغي ومخزونه هيرجع.",
    cancelReason: "أُلغي من صندوق واتساب",
    cancelling: "بنلغي…",
    keep: "سيب الأوردر",
    createOrder: "أوردر جديد",
    openOrder: "افتح الأوردر {n}",
    quickReplies: "ردود سريعة",
    quickHint: "اختار رد يتحط في خانة الرسالة.",
    noQuick: "مفيش ردود سريعة لسه",
    noQuickHint: "احفظ الردود اللي بتكتبها كتير، وابعتها بضغطة.",
    newQuick: "رد سريع جديد",
    quickTitle: "العنوان",
    quickTitleHint: "كلمتين تعرف بيهم الرد.",
    quickBody: "النص",
    save: "حفظ",
    saving: "بنحفظ…",
    back: "رجوع",
    deleteQuick: "امسح الرد السريع {title}",
    quickDeleted: "الرد السريع اتمسح.",
    quickSaved: "الرد السريع اتحفظ.",
  },
} satisfies Messages;

/** A small quiet heading over a block of a sheet. */
function BlockLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 flex min-h-6 items-center justify-between gap-3">
      <h3 className="text-xs leading-4 font-medium text-ink-soft">{children}</h3>
      {action}
    </div>
  );
}

// ------------------------------------------------------------------ assignee --

type Assigned = InboxConversation["assignedTo"];
type AssignTarget = Pick<InboxConversation, "id"> & { assignedTo?: Assigned };

/** The pill in a wide conversation header: who has it, and a press to change that. */
export function AssigneeButton({ conversation, onClick, className }: { conversation: AssignTarget; onClick: () => void; className?: string }) {
  const t = useT(STRINGS);
  const owner = conversation.assignedTo;
  const name = owner ? (owner.fullName ?? owner.id) : null;
  return (
    <Button
      type="button"
      variant="outline"
      aria-haspopup="dialog"
      aria-label={name ? fmt(t.assignTo, { name }) : t.unassigned}
      title={t.assignee}
      onClick={onClick}
      className={cn("h-11 max-w-44 shrink-0 gap-1.5 rounded-full px-3.5 text-[13px] pointer-fine:h-9", className)}
    >
      {name ? <IconUser className="size-4 shrink-0" aria-hidden /> : <IconUserAdd className="size-4 shrink-0" aria-hidden />}
      <span className={cn("min-w-0 truncate", !name && "text-ink-soft")}>{name ? <bdi>{name}</bdi> : t.unassigned}</span>
    </Button>
  );
}

/**
 * Who takes the conversation: nobody, or one of the teammates who can work the
 * inbox. A press assigns at once (the same call the old picker made) and the
 * toast can take it back.
 */
export function AssigneeSheet({
  open,
  onOpenChange,
  conversation,
  onAssigned,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: AssignTarget;
  onAssigned: (assignedTo: Assigned) => void;
}) {
  const t = useT(STRINGS);
  const toast = useToast();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const assignees = useCachedAsync<InboxAssignee[]>(`inbox-assignees:${workspaceId}`, () => inboxListAssignees(apiClient, workspaceId), [workspaceId]);
  // The choice on its way to the server ("" = nobody), or null when nothing is.
  const [busy, setBusy] = useState<string | null>(null);
  const current = conversation.assignedTo?.id ?? "";

  async function assign(userId: string, offerUndo: boolean) {
    const previous = current;
    setBusy(userId);
    try {
      const updated = await inboxAssign(apiClient, workspaceId, conversation.id, userId || null);
      onAssigned(updated.assignedTo);
      onOpenChange(false);
      const message = userId ? t.assignedToast : t.unassignedToast;
      if (offerUndo) toast.undo(message, () => assign(previous, false));
      else toast.success(message);
    } catch (err) {
      if (!offerUndo) throw err;
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  const list = assignees.data ?? [];
  // The current owner may have left the team: still show their name.
  const orphan = current && !list.some((u) => u.id === current) ? conversation.assignedTo : null;
  const options: Array<{ id: string; label: string; quiet?: boolean }> = [
    { id: "", label: t.unassigned, quiet: true },
    ...(orphan ? [{ id: orphan.id, label: orphan.fullName ?? orphan.id }] : []),
    ...list.map((u) => ({ id: u.id, label: u.fullName ?? u.id })),
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t.assignTitle} size="sm">
      <DataState
        loading={assignees.loading}
        error={assignees.data ? null : assignees.error}
        onRetry={() => void assignees.refresh()}
        skeleton={
          <div className="space-y-4 py-2">
            <SkeletonBar className="h-3.5 w-1/3" />
            <SkeletonBar className="h-3.5 w-1/2" />
            <SkeletonBar className="h-3.5 w-2/5" />
          </div>
        }
      >
        <div role="radiogroup" aria-label={t.assignee} className="-mx-2 flex flex-col">
          {options.map((option) => {
            const chosen = option.id === current;
            return (
              <button
                key={option.id || "nobody"}
                type="button"
                role="radio"
                aria-checked={chosen}
                disabled={busy !== null}
                onClick={() => {
                  if (chosen) onOpenChange(false);
                  else void assign(option.id, true);
                }}
                data-slot="chat-choice"
                className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-[0.875rem] px-3 text-start text-[15px] text-ink transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary disabled:cursor-progress aria-checked:font-semibold motion-reduce:transition-none"
              >
                <span
                  aria-hidden
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-full",
                    option.quiet ? "bg-paper-sunken text-ink-soft" : "bg-primary-soft text-primary"
                  )}
                >
                  {option.quiet ? <IconUserAdd className="size-[18px]" /> : <IconUser className="size-[18px]" weight={chosen ? "fill" : "regular"} />}
                </span>
                <span className="min-w-0 flex-1 truncate">{option.quiet ? option.label : <bdi>{option.label}</bdi>}</span>
                {busy === option.id ? (
                  <IconSpinner className="size-4 shrink-0 animate-spin text-ink-soft motion-reduce:animate-none" weight="bold" aria-hidden />
                ) : chosen ? (
                  <IconCheck className="size-4 shrink-0 text-primary" weight="bold" aria-hidden />
                ) : null}
              </button>
            );
          })}
        </div>
      </DataState>
    </Sheet>
  );
}

// ------------------------------------------------------------ customer panel --

type PanelState = ReturnType<typeof useAsync<InboxCustomerPanel>>;

/**
 * The customer behind a conversation, their delivery rate and latest orders.
 * Read with the conversation, and again (quietly) whenever `refreshKey`
 * changes — the thread saw activity, so an order may have moved.
 */
export function useCustomerPanel(conversationId: string, refreshKey?: unknown): PanelState {
  const workspaceId = useWorkspaceId();
  const panel = useAsync(() => inboxGetCustomerPanel(apiClient, workspaceId, conversationId), [workspaceId, conversationId]);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void panel.refresh({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);
  return panel;
}

/** The header's way to the customer: how many orders they have as soon as that is known, the word «العميل» until then. */
export function CustomerButton({ panel, onClick, className }: { panel: PanelState; onClick: () => void; className?: string }) {
  const t = useT(STRINGS);
  const total = panel.data?.stats?.totalOrders;
  return (
    <Button
      type="button"
      variant="outline"
      aria-haspopup="dialog"
      aria-label={t.customerButton}
      title={t.customerButton}
      onClick={onClick}
      className={cn("h-11 shrink-0 gap-1.5 rounded-full px-3 text-[13px] max-sm:w-11 max-sm:px-0 pointer-fine:h-9 sm:px-3.5", className)}
    >
      <IconUser className="size-[18px] shrink-0 sm:size-4" aria-hidden />
      <span className="tabular-nums max-sm:sr-only">{typeof total === "number" && total > 0 ? countOf("order", total) : t.panelTitle}</span>
    </Button>
  );
}

/** The customer's facts, their delivery rate, their latest orders and what can be done to each: the body of the sheet. */
function CustomerFacts({
  conversation,
  data,
  busyOrder,
  onConfirm,
  onAskCancel,
}: {
  conversation: Pick<InboxConversation, "phone" | "customerName">;
  data: InboxCustomerPanel;
  busyOrder: string | null;
  onConfirm: (order: InboxCustomerOrder) => void;
  onAskCancel: (order: InboxCustomerOrder) => void;
}) {
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const rate = data.stats?.deliveryRate ?? null;
  // A new order for this customer: the number (and name) filled in, their last address offered.
  const newOrder = `/orders/new?${new URLSearchParams({ phone: conversation.phone, ...(conversation.customerName ? { name: conversation.customerName } : {}) })}`;

  return (
    <div data-slot="chat-customer" className="space-y-5">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2.5">
          <div className="min-w-0">
            <p className="text-[15px] leading-6 font-medium text-ink tabular-nums">
              <bdi dir="ltr">{conversation.phone}</bdi>
            </p>
            {data.customer?.email && (
              <p className="truncate text-[13px] leading-5 text-ink-soft">
                <bdi dir="ltr">{data.customer.email}</bdi>
              </p>
            )}
          </div>
          <ContactActions phone={dialNumber(conversation.phone)} name={data.customer?.fullName || conversation.customerName} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {data.customer?.isBlacklisted && <StatusBadge value="blocked" tone="danger" text={t.blacklisted} />}
          {data.customer ? (
            <ViewLink
              to={`/customers/${data.customer.id}`}
              className="inline-flex min-h-11 items-center rounded-sm text-sm font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary pointer-fine:min-h-8"
            >
              {t.viewCustomer}
            </ViewLink>
          ) : (
            <p className="text-[13px] leading-5 text-ink-soft">{t.noCustomer}</p>
          )}
        </div>
      </section>

      {data.stats && (
        <section>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs leading-4 font-medium text-ink-soft">{t.deliveryRate}</span>
            <span className="text-[17px] leading-6 font-semibold text-ink tabular-nums">
              {rate === null ? "—" : <bdi dir="ltr">{fmt(t.percent, { n: rate })}</bdi>}
            </span>
          </div>
          <div data-slot="chat-rate" className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper-sunken" aria-hidden>
            <div
              className={cn("h-full rounded-full", (rate ?? 0) >= 60 ? "bg-success" : "bg-danger")}
              style={{ width: `${Math.max(0, Math.min(100, rate ?? 0))}%` }}
            />
          </div>
          <p className="mt-1.5 text-[13px] leading-5 text-ink-soft">
            {rate === null ? t.noRate : fmt(t.deliveryRateHint, { delivered: data.stats.delivered, total: countOf("order", data.stats.totalOrders) })}
          </p>
        </section>
      )}

      <section>
        <BlockLabel
          action={
            <Button variant="outline" asChild className="h-11 gap-1.5 rounded-full px-3.5 text-[13px] pointer-fine:h-9">
              <ViewLink to={newOrder}>
                <IconPlus className="size-4" weight="bold" aria-hidden />
                {t.createOrder}
              </ViewLink>
            </Button>
          }
        >
          {t.orders}
        </BlockLabel>
        {data.orders.length === 0 ? (
          <p className="text-sm leading-6 text-ink-soft">{t.noOrders}</p>
        ) : (
          <ul className="space-y-2">
            {data.orders.map((order) => {
              const stage = order.stage as OrderStage;
              const open = !["delivered", "returned", "cancelled"].includes(order.stage);
              const canConfirm = order.stage === "pending_confirmation" || order.stage === "needs_follow_up";
              const canCancel = ["pending_confirmation", "needs_follow_up", "ready_to_ship", "awaiting_payment"].includes(order.stage);
              const working = busyOrder === order.id;
              return (
                <li key={order.id} data-slot="chat-order" className="rounded-[1rem] bg-paper-sunken/60 px-3.5 py-3 ring-1 ring-line">
                  <div className="flex items-center justify-between gap-2">
                    <ViewLink
                      to={`/orders/${order.id}`}
                      aria-label={fmt(t.openOrder, { n: order.orderNumber })}
                      className="rounded-sm text-[15px] leading-6 font-semibold text-primary tabular-nums hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    >
                      <bdi dir="ltr">{order.orderNumber}</bdi>
                    </ViewLink>
                    <StatusBadge value={order.stage} tone={STAGE_TONE[stage] ?? "neutral"} text={labels.stage(stage)} />
                  </div>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] leading-5 text-ink-soft">
                    <bdi className="font-medium text-ink tabular-nums">{formatMoney(order.totalAmount, order.currency)}</bdi>
                    <span aria-hidden>·</span>
                    <span>{formatDate(order.createdAt)}</span>
                  </p>
                  {open && (canConfirm || canCancel) && (
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {canConfirm && (
                        <Button
                          type="button"
                          aria-busy={working || undefined}
                          disabled={working}
                          onClick={() => onConfirm(order)}
                          className="h-11 gap-1.5 rounded-full px-4 text-[13px] pointer-fine:h-9"
                        >
                          {working ? (
                            <IconSpinner className="size-4 animate-spin motion-reduce:animate-none" weight="bold" aria-hidden />
                          ) : (
                            <IconCheck className="size-4" weight="bold" aria-hidden />
                          )}
                          {t.confirm}
                        </Button>
                      )}
                      {canCancel && (
                        <Button
                          type="button"
                          variant="ghost"
                          disabled={working}
                          onClick={() => onAskCancel(order)}
                          className="h-11 rounded-full px-4 text-[13px] text-danger hover:text-danger pointer-fine:h-9"
                        >
                          {t.cancel}
                        </Button>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

/**
 * The customer of a conversation, in a sheet: from the bottom on a phone, a
 * panel on the end edge from 640px — the conversation stays in place beside
 * it. Confirming an order happens in the sheet; cancelling one asks first, and
 * the sheet steps aside for that question (two sheets are never stacked) and
 * comes back with the answer.
 */
export function CustomerSheet({
  open,
  onOpenChange,
  conversation,
  panel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: Pick<InboxConversation, "id" | "phone" | "customerName">;
  panel: PanelState;
}) {
  const t = useT(STRINGS);
  const toast = useToast();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const [busyOrder, setBusyOrder] = useState<string | null>(null);
  const [toCancel, setToCancel] = useState<InboxCustomerOrder | null>(null);

  async function confirm(order: InboxCustomerOrder) {
    setBusyOrder(order.id);
    try {
      await apiClient.confirmOrder(workspaceId, order.id, undefined, "whatsapp");
      toast.success(fmt(t.confirmed, { n: order.orderNumber }));
      refreshWorkCounts();
      await panel.refresh({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyOrder(null);
    }
  }

  const data = panel.data;
  const name = data?.customer?.fullName || conversation.customerName || null;

  return (
    <>
      <Sheet
        open={open && !toCancel}
        onOpenChange={onOpenChange}
        side="auto-end"
        title={name ? <bdi>{name}</bdi> : t.panelTitle}
        description={name ? t.panelTitle : undefined}
      >
        <DataState
          loading={panel.loading && !data}
          error={data ? null : panel.error}
          onRetry={() => void panel.refresh()}
          skeleton={
            <div className="space-y-5">
              <div className="space-y-2.5">
                <SkeletonBar className="h-4 w-2/5" />
                <SkeletonBar className="w-3/5" />
              </div>
              <div className="space-y-2.5">
                <SkeletonBar className="w-1/3" />
                <SkeletonBar className="h-1.5 w-full" />
              </div>
              <SkeletonBar className="h-20 w-full rounded-[1rem]" />
              <SkeletonBar className="h-20 w-full rounded-[1rem]" />
            </div>
          }
        >
          {data && <CustomerFacts conversation={conversation} data={data} busyOrder={busyOrder} onConfirm={(order) => void confirm(order)} onAskCancel={setToCancel} />}
        </DataState>
      </Sheet>

      <ConfirmDialog
        open={Boolean(toCancel)}
        title={toCancel ? fmt(t.cancelTitle, { n: toCancel.orderNumber }) : ""}
        description={t.cancelDesc}
        confirmLabel={t.cancel}
        cancelLabel={t.keep}
        busyLabel={t.cancelling}
        destructive
        onCancel={() => setToCancel(null)}
        onConfirm={async () => {
          if (!toCancel) return;
          await apiClient.cancelOrder(workspaceId, toCancel.id, t.cancelReason);
          toast.success(fmt(t.cancelled, { n: toCancel.orderNumber }));
          setToCancel(null);
          refreshWorkCounts();
          await panel.refresh({ silent: true });
        }}
      />
    </>
  );
}

// -------------------------------------------------------------- quick replies --

/**
 * The quick-replies tool beside the message box: a sheet with the saved
 * answers — a press puts one in the box — and the way to save a new one,
 * starting from what is already typed. Deleting one answers with a toast that
 * can bring it back.
 */
export function QuickRepliesButton({ onPick, draft }: { onPick: (text: string) => void; draft?: string }) {
  const t = useT(STRINGS);
  const toast = useToast();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const replies = useAsync(async () => (open ? inboxListQuickReplies(apiClient, workspaceId) : []), [workspaceId, open]);

  function close() {
    setOpen(false);
    setAdding(false);
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (saving || !title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      await inboxCreateQuickReply(apiClient, workspaceId, { title: title.trim(), body: body.trim() });
      setAdding(false);
      setTitle("");
      setBody("");
      toast.success(t.quickSaved);
      await replies.refresh({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(reply: InboxQuickReply) {
    try {
      await inboxDeleteQuickReply(apiClient, workspaceId, reply.id);
      // Out of the list at once; the read behind it only confirms.
      replies.setData((prev) => (prev ?? []).filter((r) => r.id !== reply.id));
      toast.undo(t.quickDeleted, async () => {
        await inboxCreateQuickReply(apiClient, workspaceId, { title: reply.title, body: reply.body });
        await replies.refresh({ silent: true });
      });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  const list = replies.data ?? [];

  return (
    <>
      <button
        type="button"
        aria-label={t.quickReplies}
        title={t.quickReplies}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
        data-slot="chat-tool"
        className={CHAT_TOOL}
      >
        <IconQuote className="size-5" aria-hidden />
      </button>

      <Modal
        open={open}
        onClose={close}
        title={adding ? t.newQuick : t.quickReplies}
        description={adding ? undefined : t.quickHint}
        footer={
          adding ? (
            <>
              <Button type="button" variant="outline" className="rounded-full px-5" onClick={() => setAdding(false)} disabled={saving}>
                {t.back}
              </Button>
              <Button type="submit" form={formId} className="rounded-full px-5" disabled={saving || !title.trim() || !body.trim()}>
                {saving ? t.saving : t.save}
              </Button>
            </>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="gap-1.5 rounded-full px-5"
              onClick={() => {
                setBody(draft?.trim() ?? "");
                setAdding(true);
              }}
            >
              <IconPlus className="size-4" weight="bold" aria-hidden />
              {t.newQuick}
            </Button>
          )
        }
      >
        {adding ? (
          <form id={formId} onSubmit={save} className="space-y-4" noValidate>
            <TextField label={t.quickTitle} hint={t.quickTitleHint} value={title} maxLength={80} dir="auto" onChange={(e) => setTitle(e.target.value)} />
            <Field label={t.quickBody}>
              {({ id }) => (
                <Textarea
                  id={id}
                  dir="auto"
                  rows={4}
                  maxLength={4096}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="text-base md:text-sm"
                />
              )}
            </Field>
          </form>
        ) : (
          <DataState
            loading={replies.loading}
            error={replies.error}
            onRetry={() => void replies.refresh()}
            skeleton={
              <div className="space-y-5 py-1">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="space-y-2">
                    <SkeletonBar className="h-3.5 w-1/3" />
                    <SkeletonBar className="w-4/5" />
                  </div>
                ))}
              </div>
            }
          >
            {list.length === 0 ? (
              <Alert>
                <p className="font-medium text-ink">{t.noQuick}</p>
                <p className="text-ink-soft">{t.noQuickHint}</p>
              </Alert>
            ) : (
              <ul className="-mx-2 flex flex-col">
                {list.map((reply) => (
                  <li key={reply.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        onPick(reply.body);
                        close();
                      }}
                      data-slot="chat-choice"
                      className="min-h-12 min-w-0 flex-1 cursor-pointer rounded-[0.875rem] px-3 py-2 text-start transition-[background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
                    >
                      <span className="block truncate text-sm leading-5 font-semibold text-ink" dir="auto">
                        {reply.title}
                      </span>
                      <span className="line-clamp-2 block text-[13px] leading-5 text-ink-soft" dir="auto">
                        {reply.body}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={fmt(t.deleteQuick, { title: reply.title })}
                      title={fmt(t.deleteQuick, { title: reply.title })}
                      onClick={() => void remove(reply)}
                      className={cn(CHAT_TOOL, "hover:text-danger")}
                    >
                      <IconDelete className="size-[18px]" aria-hidden />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </DataState>
        )}
      </Modal>
    </>
  );
}
