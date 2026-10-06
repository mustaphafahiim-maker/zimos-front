import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { MessageSquareQuote, Plus, Trash2, X } from "lucide-react";
import { Alert, Button, cn } from "@store-builder/ui";
import {
  formatMoney,
  inboxAssign,
  inboxCreateQuickReply,
  inboxDeleteQuickReply,
  inboxGetCustomerPanel,
  inboxListAssignees,
  inboxListQuickReplies,
  type InboxConversation,
  type InboxCustomerOrder,
  type OrderStage,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField, Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { STAGE_TONE, useOrderLabels } from "@/pages/orders/orderLabels";

/**
 * The inbox's additions around a thread (SPEC §14.3): who owns the chat, the
 * customer panel with their orders and actions, and saved quick replies.
 */

const STRINGS = {
  en: {
    assignee: "Assigned to",
    unassigned: "Unassigned",
    assignedToast: "Conversation assigned.",
    unassignedToast: "Conversation unassigned.",
    panelTitle: "Customer",
    closePanel: "Close customer panel",
    noCustomer: "No customer with this number yet. They become one with their first order.",
    viewCustomer: "Open customer",
    blacklisted: "Blocked customer",
    deliveryRate: "Delivery rate",
    deliveryRateHint: "{delivered} delivered of {total} orders",
    noRate: "No finished orders yet",
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
    createOrder: "Create order",
    quickReplies: "Quick replies",
    noQuick: "No quick replies yet. Save the answers you type most.",
    newQuick: "New quick reply",
    quickTitle: "Title",
    quickBody: "Text",
    save: "Save",
    saving: "Saving…",
    back: "Back",
    deleteQuick: "Delete quick reply {title}",
    use: "Use",
  },
  ar: {
    assignee: "مُسندة إلى",
    unassigned: "غير مُسندة",
    assignedToast: "تم إسناد المحادثة.",
    unassignedToast: "تم إلغاء إسناد المحادثة.",
    panelTitle: "العميل",
    closePanel: "إغلاق لوحة العميل",
    noCustomer: "لا يوجد عميل بهذا الرقم بعد. يصبح عميلًا مع أول طلب.",
    viewCustomer: "فتح صفحة العميل",
    blacklisted: "عميل محظور",
    deliveryRate: "نسبة الاستلام",
    deliveryRateHint: "{delivered} تم تسليمها من {total} طلب",
    noRate: "لا توجد طلبات منتهية بعد",
    orders: "آخر الطلبات",
    noOrders: "لا توجد طلبات بعد.",
    confirm: "تأكيد",
    cancel: "إلغاء الطلب",
    confirmed: "تم تأكيد الطلب {n}.",
    cancelled: "تم إلغاء الطلب {n}.",
    cancelTitle: "إلغاء الطلب {n}؟",
    cancelDesc: "سيُلغى الطلب ويعود مخزونه.",
    cancelReason: "أُلغي من صندوق واتساب",
    cancelling: "بنلغي…",
    keep: "إبقاء الطلب",
    createOrder: "إنشاء طلب",
    quickReplies: "ردود سريعة",
    noQuick: "لا توجد ردود سريعة بعد. احفظ الإجابات التي تكتبها كثيرًا.",
    newQuick: "رد سريع جديد",
    quickTitle: "العنوان",
    quickBody: "النص",
    save: "حفظ",
    saving: "بنحفظ…",
    back: "رجوع",
    deleteQuick: "حذف الرد السريع {title}",
    use: "استخدام",
  },
} satisfies Messages;

// ------------------------------------------------------------------ assignee --

/** The "assigned to" picker in the thread header. */
export function AssigneeSelect({
  conversation,
  onAssigned,
}: {
  conversation: Pick<InboxConversation, "id"> & { assignedTo?: InboxConversation["assignedTo"] };
  onAssigned: (assignedTo: InboxConversation["assignedTo"]) => void;
}) {
  const t = useT(STRINGS);
  const toast = useToast();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const assignees = useAsync(() => inboxListAssignees(apiClient, workspaceId), [workspaceId]);
  const [busy, setBusy] = useState(false);
  const current = conversation.assignedTo?.id ?? "";

  async function change(userId: string) {
    setBusy(true);
    try {
      const updated = await inboxAssign(apiClient, workspaceId, conversation.id, userId || null);
      onAssigned(updated.assignedTo);
      toast.success(userId ? t.assignedToast : t.unassignedToast);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const list = assignees.data ?? [];
  // The current owner may have left the team: still show their name.
  const orphan = current && !list.some((u) => u.id === current) ? conversation.assignedTo : null;

  return (
    <Select aria-label={t.assignee} value={current} disabled={busy || assignees.loading} onChange={(e) => void change(e.target.value)} className="h-8 w-auto max-w-40 py-1 text-xs">
      <option value="">{t.unassigned}</option>
      {orphan && <option value={orphan.id}>{orphan.fullName ?? orphan.id}</option>}
      {list.map((u) => (
        <option key={u.id} value={u.id}>
          {u.fullName ?? u.id}
        </option>
      ))}
    </Select>
  );
}

// ------------------------------------------------------------ customer panel --

/** The panel beside a thread: the customer, their delivery rate, latest orders and actions. */
export function CustomerPanel({
  conversation,
  refreshKey,
  onClose,
  className,
}: {
  conversation: Pick<InboxConversation, "id" | "phone" | "customerName">;
  /** Changes when the thread saw activity, so the orders are re-read. */
  refreshKey?: unknown;
  onClose?: () => void;
  className?: string;
}) {
  const t = useT(STRINGS);
  const toast = useToast();
  const labels = useOrderLabels();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const panel = useAsync(() => inboxGetCustomerPanel(apiClient, workspaceId, conversation.id), [workspaceId, conversation.id]);
  const [busyOrder, setBusyOrder] = useState<string | null>(null);
  const [toCancel, setToCancel] = useState<InboxCustomerOrder | null>(null);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    void panel.refresh({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  async function confirm(order: InboxCustomerOrder) {
    setBusyOrder(order.id);
    try {
      await apiClient.confirmOrder(workspaceId, order.id, undefined, "whatsapp");
      toast.success(fmt(t.confirmed, { n: order.orderNumber }));
      await panel.refresh({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyOrder(null);
    }
  }

  const data = panel.data;
  return (
    <aside className={cn("flex min-h-0 flex-col", className)} aria-label={t.panelTitle}>
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <h2 className="text-sm font-semibold text-ink">{t.panelTitle}</h2>
        {onClose && (
          <Button size="icon-sm" variant="ghost" onClick={onClose} aria-label={t.closePanel}>
            <X className="size-4" aria-hidden />
          </Button>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <DataState loading={panel.loading} error={panel.error} onRetry={() => void panel.refresh()}>
          {data && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-ink">
                  <bdi>{data.customer?.fullName || conversation.customerName || conversation.phone}</bdi>
                </p>
                <p className="text-xs text-ink-soft">
                  <bdi dir="ltr">{conversation.phone}</bdi>
                </p>
                {data.customer?.email && (
                  <p className="text-xs text-ink-soft">
                    <bdi dir="ltr">{data.customer.email}</bdi>
                  </p>
                )}
                {data.customer?.isBlacklisted && <StatusBadge className="mt-1" value="blocked" tone="danger" text={t.blacklisted} />}
                {data.customer ? (
                  <Link to={`/customers/${data.customer.id}`} className="mt-1 inline-block text-xs font-medium text-primary hover:underline">
                    {t.viewCustomer}
                  </Link>
                ) : (
                  <p className="mt-2 text-xs text-ink-soft">{t.noCustomer}</p>
                )}
              </div>

              {data.stats && (
                <div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-xs font-medium text-ink">{t.deliveryRate}</span>
                    <span className="text-sm font-semibold text-ink">{data.stats.deliveryRate === null ? "—" : `${data.stats.deliveryRate}%`}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper" aria-hidden>
                    <div
                      className={cn("h-full rounded-full", (data.stats.deliveryRate ?? 0) >= 60 ? "bg-success" : "bg-danger")}
                      style={{ width: `${data.stats.deliveryRate ?? 0}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-ink-soft">
                    {data.stats.deliveryRate === null ? t.noRate : fmt(t.deliveryRateHint, { delivered: data.stats.delivered, total: data.stats.totalOrders })}
                  </p>
                </div>
              )}

              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-soft">{t.orders}</h3>
                  {/* A new order for this customer: the number (and name) filled in, their last address offered. */}
                  <Link
                    to={`/orders/new?${new URLSearchParams({ phone: conversation.phone, ...(conversation.customerName ? { name: conversation.customerName } : {}) })}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {t.createOrder}
                  </Link>
                </div>
                {data.orders.length === 0 ? (
                  <p className="text-xs text-ink-soft">{t.noOrders}</p>
                ) : (
                  <ul className="space-y-2">
                    {data.orders.map((order) => {
                      const stage = order.stage as OrderStage;
                      const open = !["delivered", "returned", "cancelled"].includes(order.stage);
                      return (
                        <li key={order.id} className="rounded-[0.5rem] border border-line p-2">
                          <div className="flex items-center justify-between gap-2">
                            <Link to={`/orders/${order.id}`} className="text-sm font-medium text-primary hover:underline">
                              <bdi dir="ltr">{order.orderNumber}</bdi>
                            </Link>
                            <StatusBadge value={order.stage} tone={STAGE_TONE[stage] ?? "neutral"} text={labels.stage(stage)} />
                          </div>
                          <p className="mt-0.5 text-xs text-ink-soft">
                            {formatMoney(order.totalAmount, order.currency)} · {formatDate(order.createdAt)}
                          </p>
                          {open && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {(order.stage === "pending_confirmation" || order.stage === "needs_follow_up") && (
                                <Button size="sm" variant="outline" disabled={busyOrder === order.id} onClick={() => void confirm(order)}>
                                  {t.confirm}
                                </Button>
                              )}
                              {["pending_confirmation", "needs_follow_up", "ready_to_ship", "awaiting_payment"].includes(order.stage) && (
                                <Button size="sm" variant="ghost" disabled={busyOrder === order.id} onClick={() => setToCancel(order)}>
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
              </div>
            </div>
          )}
        </DataState>
      </div>

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
          await panel.refresh({ silent: true });
        }}
      />
    </aside>
  );
}

// -------------------------------------------------------------- quick replies --

/** The quick-replies button beside the composer: pick one to fill the box, or save a new one. */
export function QuickRepliesMenu({ onPick, draft }: { onPick: (text: string) => void; draft?: string }) {
  const t = useT(STRINGS);
  const toast = useToast();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);
  const replies = useAsync(async () => (open ? inboxListQuickReplies(apiClient, workspaceId) : []), [workspaceId, open]);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function save(e: FormEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!title.trim() || !body.trim()) return;
    setSaving(true);
    try {
      await inboxCreateQuickReply(apiClient, workspaceId, { title: title.trim(), body: body.trim() });
      setAdding(false);
      setTitle("");
      setBody("");
      await replies.refresh({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    try {
      await inboxDeleteQuickReply(apiClient, workspaceId, id);
      await replies.refresh({ silent: true });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  }

  return (
    <div ref={root} className="relative">
      <Button type="button" size="icon" variant="outline" aria-label={t.quickReplies} title={t.quickReplies} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <MessageSquareQuote className="size-4" aria-hidden />
      </Button>
      {open && (
        <div className="absolute bottom-full start-0 z-20 mb-2 w-80 max-w-[85vw] rounded-[0.5rem] border border-line bg-paper-raised p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-ink">{t.quickReplies}</h3>
            {!adding && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  setBody(draft?.trim() ?? "");
                  setAdding(true);
                }}
              >
                <Plus className="size-4" aria-hidden />
                {t.newQuick}
              </Button>
            )}
          </div>

          {adding ? (
            // A div, not a form: this sits inside the composer's <form>.
            <div className="space-y-3">
              <TextField label={t.quickTitle} value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} />
              <Field label={t.quickBody}>
                {({ id }) => <Textarea id={id} dir="auto" rows={3} maxLength={4096} value={body} onChange={(e) => setBody(e.target.value)} />}
              </Field>
              <div className="flex justify-end gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setAdding(false)} disabled={saving}>
                  {t.back}
                </Button>
                <Button type="button" size="sm" onClick={(e) => void save(e)} disabled={saving || !title.trim() || !body.trim()}>
                  {saving ? t.saving : t.save}
                </Button>
              </div>
            </div>
          ) : (
            <DataState loading={replies.loading} error={replies.error} onRetry={() => void replies.refresh()}>
              {(replies.data ?? []).length === 0 ? (
                <Alert>{t.noQuick}</Alert>
              ) : (
                <ul className="max-h-64 space-y-1 overflow-y-auto">
                  {(replies.data ?? []).map((reply) => (
                    <li key={reply.id} className="flex items-start gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          onPick(reply.body);
                          setOpen(false);
                        }}
                        className="min-w-0 flex-1 cursor-pointer rounded px-2 py-1.5 text-start hover:bg-paper"
                      >
                        <span className="block truncate text-sm font-medium text-ink" dir="auto">
                          {reply.title}
                        </span>
                        <span className="line-clamp-2 block text-xs text-ink-soft" dir="auto">
                          {reply.body}
                        </span>
                      </button>
                      <Button type="button" size="icon-sm" variant="ghost" aria-label={fmt(t.deleteQuick, { title: reply.title })} onClick={() => void remove(reply.id)}>
                        <Trash2 className="size-4" aria-hidden />
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </DataState>
          )}
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------------- filters --

const SCOPE_STRINGS = {
  en: { label: "Filter conversations", all: "All", mine: "Mine", unread: "Unread", customer: "Customer" },
  ar: { label: "تصفية المحادثات", all: "الكل", mine: "محادثاتي", unread: "غير المقروءة", customer: "العميل" },
} satisfies Messages;

export type InboxScope = "all" | "mine" | "unread";

/** All / assigned to me / unread, with how many open conversations wait in each. */
export function InboxScopeTabs({
  value,
  onChange,
  counts,
}: {
  value: InboxScope;
  onChange: (scope: InboxScope) => void;
  counts: { mine: number; unread: number } | null;
}) {
  const t = useT(SCOPE_STRINGS);
  const withCount = (label: string, n: number | undefined) => (n ? `${label} (${n})` : label);
  const tabs: Array<{ value: InboxScope; label: string }> = [
    { value: "all", label: t.all },
    { value: "mine", label: withCount(t.mine, counts?.mine) },
    { value: "unread", label: withCount(t.unread, counts?.unread) },
  ];
  return (
    <div role="radiogroup" aria-label={t.label} className="flex flex-wrap gap-1">
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          role="radio"
          aria-checked={value === tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "cursor-pointer rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
            value === tab.value ? "border-primary bg-primary-soft text-primary-dark dark:text-primary" : "border-line text-ink-soft hover:text-ink"
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

/** The header button that opens the customer panel where there is no room for the side column. */
export function CustomerPanelButton({ onClick, className }: { onClick: () => void; className?: string }) {
  const t = useT(SCOPE_STRINGS);
  return (
    <Button size="sm" variant="ghost" className={className} onClick={onClick}>
      {t.customer}
    </Button>
  );
}
