import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@store-builder/ui";
import { isInvalidCursorError, protectionBlockAndCancel, type FlaggedOrder } from "@store-builder/api-client";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCursorList } from "@/lib/useCursorList";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate, formatMoney } from "@/lib/format";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { FilterTabs } from "@/components/FilterTabs";
import { LoadMore } from "@/components/LoadMore";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useOrderLabels } from "@/pages/orders/orderLabels";

type Scope = "open" | "all";

/**
 * System role keys carrying orders.manage, which clearing a flag needs
 * (Backend core/security/permissions.js SYSTEM_ROLES; owner holds "*").
 * The dashboard sees only the role key, so a custom role with the permission
 * doesn't get the button; one without it that slips through gets the 403 toast.
 */
const CLEAR_FLAG_ROLES: ReadonlySet<string> = new Set(["owner", "workspace_manager", "order_operator"]);

const STRINGS = {
  en: {
    filterLabel: "Which flagged orders to show",
    scopeOpen: "Awaiting call",
    scopeAll: "All flagged",
    hint: "Orders a fraud rule flagged. Clearing a flag lets the order carry on as normal — it doesn't confirm or ship it.",
    emptyOpen: "No flagged orders are waiting on a call.",
    emptyAll: "No orders have been flagged.",
    unnamedCustomer: "Unnamed customer",
    reasons: "Why it was flagged",
    cancelled: "Cancelled",
    clear: "Clear flag",
    clearing: "Clearing…",
    cleared: "Flag cleared on {order}.",
    block: "Block and cancel",
    blockTitle: "Block and cancel {order}?",
    blockDescription: "The order is cancelled, its phone number is blocked from ordering, and its internet address is blocked from ordering and from seeing your store.",
    blocking: "Blocking…",
    keep: "Keep the order",
    blocked: "{order} was cancelled and its customer blocked.",
  },
  ar: {
    filterLabel: "الأوردرات المشتبه بها المعروضة",
    scopeOpen: "بانتظار المكالمة",
    scopeAll: "كل المشتبه بها",
    hint: "أوردرات ميّزتها إحدى قواعد الحماية من الاحتيال. إزالة العلامة تترك الأوردر يكمل مساره المعتاد — لا تؤكده ولا تشحنه.",
    emptyOpen: "لا توجد أوردرات مشتبه بها بانتظار المكالمة.",
    emptyAll: "لم يُميَّز أي أوردر كمشتبه به.",
    unnamedCustomer: "عميل بدون اسم",
    reasons: "سبب الاشتباه",
    cancelled: "ملغي",
    clear: "إزالة العلامة",
    clearing: "جارٍ الإزالة…",
    cleared: "تمت إزالة علامة الاشتباه عن {order}.",
    block: "حظر وإلغاء",
    blockTitle: "حظر وإلغاء {order}؟",
    blockDescription: "يُلغى الأوردر، ويُحظر رقم الهاتف من الطلب، ويُحظر عنوان الإنترنت من الطلب ومن رؤية متجرك.",
    blocking: "جارٍ الحظر…",
    keep: "إبقاء الأوردر",
    blocked: "تم إلغاء {order} وحظر العميل.",
  },
} satisfies Messages;

export function FlaggedOrdersTab() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const [scope, setScope] = useState<Scope>("open");
  const { currentWorkspace } = useWorkspace();
  const canClear = CLEAR_FLAG_ROLES.has(currentWorkspace?.role ?? "");

  const list = useCursorList<FlaggedOrder>(
    async (cursor) => {
      const page = await apiClient.listFlaggedOrders(workspaceId, {
        before: cursor,
        includeResolved: scope === "all",
      });
      return { items: page.orders, nextCursor: page.nextCursor };
    },
    [workspaceId, scope],
    // The cursor is an order id; once that order's flag is cleared it drops
    // out of the query and the server rejects it on "before".
    { isStaleCursor: (err) => isInvalidCursorError(err, "before") }
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-ink-soft">{t.hint}</p>
      <FilterTabs
        label={t.filterLabel}
        value={scope}
        onChange={setScope}
        tabs={[
          { value: "open", label: t.scopeOpen },
          { value: "all", label: t.scopeAll },
        ]}
        className="[&>button]:min-h-11"
      />

      <DataState
        loading={list.loading}
        error={list.error}
        empty={list.items.length === 0}
        emptyMessage={scope === "open" ? t.emptyOpen : t.emptyAll}
        onRetry={list.reload}
      >
        <ul className="space-y-3">
          {list.items.map((order) => (
            <li key={order.id}>
              <FlaggedOrderCard
                order={order}
                canClear={canClear}
                onCleared={() => list.setItems((prev) => prev.filter((o) => o.id !== order.id))}
              />
            </li>
          ))}
        </ul>
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </DataState>
    </div>
  );
}

function FlaggedOrderCard({
  order,
  canClear,
  onCleared,
}: {
  order: FlaggedOrder;
  canClear: boolean;
  onCleared: () => void;
}) {
  const t = useT(STRINGS);
  const labels = useOrderLabels();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [busy, setBusy] = useState(false);
  const [blocking, setBlocking] = useState(false);

  async function blockAndCancel() {
    try {
      await protectionBlockAndCancel(apiClient, workspaceId, order.id);
    } catch (err) {
      // ConfirmDialog shows a thrown Error's message as-is.
      throw new Error(errorMessage(err));
    }
    toast.success(fmt(t.blocked, { order: order.orderNumber }));
    setBlocking(false);
    onCleared();
  }

  async function clearFlag() {
    setBusy(true);
    try {
      await apiClient.approveFlaggedOrder(workspaceId, order.id);
      toast.success(fmt(t.cleared, { order: order.orderNumber }));
      onCleared();
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <article className="rounded-[var(--radius-card)] border border-line bg-paper-raised p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to={`/orders/${order.id}`}
          className="inline-flex min-h-11 items-center font-display text-lg font-medium text-ink hover:text-primary focus-visible:outline-2 focus-visible:outline-primary"
        >
          <bdi dir="ltr">{order.orderNumber}</bdi>
        </Link>
        <span className="text-sm font-medium text-ink">{formatMoney(order.totalAmount, order.currency)}</span>
      </div>

      <p className="text-sm text-ink-soft">
        {order.customerName || t.unnamedCustomer}
        {order.phone && (
          <>
            {" · "}
            {/* Masked for roles without customers.reveal_sensitive: the order page has the full number. */}
            {order.phone.includes("*") ? (
              <bdi dir="ltr">{order.phone}</bdi>
            ) : (
              <a href={`tel:${order.phone}`} className="inline-flex min-h-11 items-center hover:text-primary">
                <bdi dir="ltr">{order.phone}</bdi>
              </a>
            )}
          </>
        )}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <StatusBadge value="flagged" tone="danger" text={labels.flagged} />
        <StatusBadge value={order.confirmationState} text={labels.confirmation(order.confirmationState)} />
        {order.cancelled && <StatusBadge value="cancelled" text={t.cancelled} />}
        <span className="ms-auto text-xs text-ink-soft">{formatDate(order.createdAt)}</span>
      </div>

      {order.riskFlags.length > 0 && (
        <div className="mt-3">
          <h3 className="text-xs font-medium text-ink-soft">{t.reasons}</h3>
          <ul className="mt-1 flex flex-wrap gap-1.5">
            {order.riskFlags.map((flag) => (
              <li key={flag}>
                <StatusBadge value={flag} tone="warning" text={labels.riskFlag(flag)} />
              </li>
            ))}
          </ul>
        </div>
      )}

      {canClear && (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" onClick={clearFlag} disabled={busy} className="min-h-11">
            {busy ? t.clearing : t.clear}
          </Button>
          {!order.cancelled && (
            <Button variant="outline" onClick={() => setBlocking(true)} disabled={busy} className="min-h-11 text-danger">
              {t.block}
            </Button>
          )}
        </div>
      )}
      <ConfirmDialog
        open={blocking}
        title={fmt(t.blockTitle, { order: order.orderNumber })}
        description={t.blockDescription}
        confirmLabel={t.block}
        busyLabel={t.blocking}
        cancelLabel={t.keep}
        destructive
        onCancel={() => setBlocking(false)}
        onConfirm={blockAndCancel}
      />
    </article>
  );
}
