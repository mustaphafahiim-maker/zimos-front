import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Card } from "@store-builder/ui";
import type {
  Order,
  ReturnItemLine,
  ReturnReasonCode,
  ReturnRequest,
  ReturnStatus,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatDateTime, humanize } from "@/lib/format";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { FilterTabs, type FilterTab } from "@/components/FilterTabs";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";

/** "" is the All tab — the backend simply omits the status filter. */
type StatusFilter = "" | ReturnStatus;

const STRINGS = {
  en: {
    title: "Returns",
    description:
      "Returns opened against delivered orders. Approving one settles it with the customer; putting the units back on the shelf is a separate step.",
    filterLabel: "Filter returns by status",
    tabRequested: "Requested",
    tabApproved: "Approved",
    tabRejected: "Rejected",
    tabReceived: "Received",
    tabRefunded: "Refunded",
    tabAll: "All",
    statusRequested: "Requested",
    statusApproved: "Approved",
    statusRejected: "Rejected",
    statusReceived: "Received",
    statusRefunded: "Refunded",
    emptyRequested: "Nothing is waiting for a decision.",
    emptyApproved: "No approved returns are waiting to be restocked.",
    emptyRejected: "No returns have been rejected.",
    emptyReceived: "Nothing has been received back yet.",
    emptyRefunded: "No returns have been refunded.",
    emptyAll: "No returns yet. One can be opened from an order once it has been delivered.",
    openOrder: "View order",
    itemsLabel: "Items",
    reasonDamaged: "Damaged",
    reasonDefective: "Defective",
    reasonWrongItem: "Wrong item",
    reasonNotAsDescribed: "Not as described",
    reasonNoLongerWanted: "No longer wanted",
    reasonArrivedLate: "Arrived late",
    reasonOther: "Other",
    approve: "Approve",
    reject: "Reject",
    restock: "Restock units",
    restockedAt: "Restocked {date}",
    saving: "Saving…",
    toastApproved: "Return approved. Restock the units when they arrive back.",
    toastRejected: "Return rejected.",
    toastRestocked: "Returned units added back to stock.",
  },
  ar: {
    title: "المرتجعات",
    description:
      "المرتجعات المفتوحة على أوردرات تم تسليمها. الموافقة تنهي الأمر مع العميل، وإعادة القطع إلى المخزون خطوة منفصلة.",
    filterLabel: "تصفية المرتجعات حسب الحالة",
    tabRequested: "مطلوبة",
    tabApproved: "مقبولة",
    tabRejected: "مرفوضة",
    tabReceived: "مستلمة",
    tabRefunded: "مستردة",
    tabAll: "الكل",
    statusRequested: "مطلوب",
    statusApproved: "مقبول",
    statusRejected: "مرفوض",
    statusReceived: "مستلم",
    statusRefunded: "مسترد",
    emptyRequested: "لا يوجد ما ينتظر قرارًا.",
    emptyApproved: "لا توجد مرتجعات مقبولة تنتظر إعادة التخزين.",
    emptyRejected: "لا توجد مرتجعات مرفوضة.",
    emptyReceived: "لم يتم استلام أي مرتجع بعد.",
    emptyRefunded: "لا توجد مرتجعات تم ردّ قيمتها.",
    emptyAll: "لا توجد مرتجعات بعد. يمكن فتح مرتجع من الأوردر بعد تسليمه.",
    openOrder: "فتح الأوردر",
    itemsLabel: "العناصر",
    reasonDamaged: "تالف",
    reasonDefective: "به عيب",
    reasonWrongItem: "منتج خاطئ",
    reasonNotAsDescribed: "مخالف للوصف",
    reasonNoLongerWanted: "لم يعد مطلوبًا",
    reasonArrivedLate: "وصل متأخرًا",
    reasonOther: "سبب آخر",
    approve: "قبول",
    reject: "رفض",
    restock: "إعادة إلى المخزون",
    restockedAt: "أُعيد إلى المخزون {date}",
    saving: "جارٍ الحفظ…",
    toastApproved: "تم قبول المرتجع. أعد القطع إلى المخزون عند وصولها.",
    toastRejected: "تم رفض المرتجع.",
    toastRestocked: "تمت إعادة القطع المرتجعة إلى المخزون.",
  },
} satisfies Messages;

type Strings = Record<keyof typeof STRINGS.en, string>;

const REASON_KEYS = {
  damaged: "reasonDamaged",
  defective: "reasonDefective",
  wrong_item: "reasonWrongItem",
  not_as_described: "reasonNotAsDescribed",
  no_longer_wanted: "reasonNoLongerWanted",
  arrived_late: "reasonArrivedLate",
  other: "reasonOther",
} satisfies Record<ReturnReasonCode, keyof Strings>;

/**
 * The backend keeps one string: a reason code, or "code: the merchant's own
 * words". Split it back apart so the code can be translated and the detail
 * shown verbatim, in whatever language it was typed.
 */
function splitReason(reason: string): { code: string; detail: string | null } {
  const at = reason.indexOf(":");
  if (at === -1) return { code: reason.trim(), detail: null };
  return { code: reason.slice(0, at).trim(), detail: reason.slice(at + 1).trim() || null };
}

function reasonLabel(code: string, t: Strings): string {
  const key = REASON_KEYS[code as ReturnReasonCode] as keyof Strings | undefined;
  return key ? t[key] : humanize(code);
}

type OrderEntry =
  | { status: "loading" }
  | { status: "ready"; order: Order }
  | { status: "error" };

/**
 * GET /returns carries an `orderId` and nothing else — no order number, no
 * customer, no product names behind the returned lines. So each distinct order
 * is fetched separately, all of them in flight at once, and cached for the life
 * of the page so switching filters never refetches one.
 *
 * `allSettled`: an order that 404s (or that this role may not read) leaves its
 * card in the fallback state. It must never blank the queue — the return row
 * itself came back fine, and it is still actionable without the order.
 */
function useOrdersById(orderIds: string[]): Record<string, OrderEntry> {
  const workspaceId = useWorkspaceId();
  const [entries, setEntries] = useState<Record<string, OrderEntry>>({});
  // Ids already requested, so a re-render never re-fetches. Tied to the
  // workspace it was filled for: switching workspace invalidates the lot.
  const asked = useRef<{ workspaceId: string; ids: Set<string> }>({ workspaceId, ids: new Set() });
  const key = orderIds.join(",");

  useEffect(() => {
    let stale = false;
    if (asked.current.workspaceId !== workspaceId) {
      asked.current = { workspaceId, ids: new Set() };
      setEntries({});
    }
    const missing = orderIds.filter((id) => !asked.current.ids.has(id));
    if (missing.length === 0) return;
    for (const id of missing) asked.current.ids.add(id);

    setEntries((prev) => {
      const next = { ...prev };
      for (const id of missing) next[id] = { status: "loading" };
      return next;
    });

    void Promise.allSettled(
      missing.map((id) => apiClient.getOrder(workspaceId, id))
    ).then((results) => {
      if (stale) return;
      setEntries((prev) => {
        const next = { ...prev };
        results.forEach((result, i) => {
          const id = missing[i];
          next[id] =
            result.status === "fulfilled"
              ? { status: "ready", order: result.value }
              : { status: "error" };
        });
        return next;
      });
    });

    return () => {
      stale = true;
    };
    // `key` stands in for orderIds — a new array of the same ids is not a change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, key]);

  return entries;
}

export function ReturnsPage() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  // Requested first: this page is a decision queue before it is an archive.
  const [status, setStatus] = useState<StatusFilter>("requested");

  const list = useAsync(
    () => apiClient.listReturns(workspaceId, { status: status || undefined }),
    [workspaceId, status]
  );
  const returns = list.data ?? [];
  const orders = useOrdersById([...new Set(returns.map((r) => r.orderId))]);

  const tabs: ReadonlyArray<FilterTab<StatusFilter>> = [
    { value: "requested", label: t.tabRequested },
    { value: "approved", label: t.tabApproved },
    { value: "rejected", label: t.tabRejected },
    { value: "received", label: t.tabReceived },
    { value: "refunded", label: t.tabRefunded },
    { value: "", label: t.tabAll },
  ];

  const emptyMessage = {
    requested: t.emptyRequested,
    approved: t.emptyApproved,
    rejected: t.emptyRejected,
    received: t.emptyReceived,
    refunded: t.emptyRefunded,
    "": t.emptyAll,
  }[status];

  /** An updated row leaves the list when it no longer matches the active
   * filter — approving from the Requested tab, restocking from Approved. */
  function applyUpdate(updated: ReturnRequest) {
    list.setData((prev) => {
      const rows = prev ?? [];
      if (status && updated.status !== status) return rows.filter((r) => r.id !== updated.id);
      return rows.map((r) => (r.id === updated.id ? { ...r, ...updated } : r));
    });
  }

  return (
    <div className="max-w-3xl">
      <PageHeader title={t.title} description={t.description} />

      <div className="mb-4">
        <FilterTabs tabs={tabs} value={status} onChange={setStatus} label={t.filterLabel} />
      </div>

      <DataState
        loading={list.loading}
        error={list.error}
        empty={returns.length === 0}
        emptyMessage={emptyMessage}
        onRetry={() => list.refresh()}
      >
        <div className="space-y-3">
          {returns.map((ret) => (
            <ReturnCard
              key={ret.id}
              returnRequest={ret}
              orderEntry={orders[ret.orderId]}
              onUpdated={applyUpdate}
            />
          ))}
        </div>
      </DataState>
    </div>
  );
}

function ReturnCard({
  returnRequest: ret,
  orderEntry,
  onUpdated,
}: {
  returnRequest: ReturnRequest;
  orderEntry: OrderEntry | undefined;
  onUpdated: (updated: ReturnRequest) => void;
}) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const t = useT(STRINGS);
  const [busy, setBusy] = useState<"approve" | "reject" | "restock" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const order = orderEntry?.status === "ready" ? orderEntry.order : null;
  const { code, detail } = splitReason(ret.reason);

  const statusText = {
    requested: t.statusRequested,
    approved: t.statusApproved,
    rejected: t.statusRejected,
    received: t.statusReceived,
    refunded: t.statusRefunded,
  }[ret.status];

  /** The product name behind a returned line, once its order has landed: "…"
   * while that is still in flight, the short id if it never arrives. */
  function lineName(line: ReturnItemLine): string {
    const item = order?.items.find((i) => i.id === line.orderItemId);
    if (item) return item.productNameSnapshot;
    if (!orderEntry || orderEntry.status === "loading") return "…";
    return line.orderItemId.slice(0, 8);
  }

  async function run(action: "approve" | "reject" | "restock") {
    setBusy(action);
    setError(null);
    try {
      const updated =
        action === "restock"
          ? await apiClient.restockReturn(workspaceId, ret.id)
          : await apiClient.moderateReturn(workspaceId, ret.id, action);
      toast.success(
        action === "approve"
          ? t.toastApproved
          : action === "reject"
            ? t.toastRejected
            : t.toastRestocked
      );
      onUpdated(updated);
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(null);
    }
  }

  // The backend moderates only a `requested` return and restocks only an
  // approved (or received) one that hasn't been restocked yet — so these
  // buttons are absent, not disabled, whenever the call could only 409.
  const canModerate = ret.status === "requested";
  const canRestock =
    (ret.status === "approved" || ret.status === "received") && !ret.restockedAt;

  return (
    <Card className="space-y-3 p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to={`/orders/${ret.orderId}`}
            className={
              order
                ? "font-medium text-ink hover:text-primary"
                : "font-medium text-ink-soft hover:text-primary"
            }
          >
            {order ? order.orderNumber : t.openOrder}
          </Link>
          <p className="mt-0.5 text-sm text-ink-soft">
            {order?.contactSnapshot?.fullName
              ? `${order.contactSnapshot.fullName} · ${formatDate(ret.createdAt)}`
              : formatDate(ret.createdAt)}
          </p>
        </div>
        <StatusBadge value={ret.status} text={statusText} />
      </div>

      <div className="text-sm">
        <p className="text-ink">{reasonLabel(code, t)}</p>
        {/* Its own line, with dir="auto": the detail is the merchant's own
            words, not necessarily in the language the dashboard is set to, and
            on one line with the label the two scripts reorder into a tangle. */}
        {detail && (
          <p dir="auto" className="mt-0.5 text-ink-soft">
            {detail}
          </p>
        )}
      </div>

      <div>
        <span className="text-xs font-medium tracking-wide text-ink-soft uppercase">
          {t.itemsLabel}
        </span>
        <ul className="mt-1 space-y-0.5 text-sm text-ink">
          {ret.items.map((line) => (
            <li key={line.orderItemId} className="flex gap-2">
              <span className="tabular-nums text-ink-soft">{line.quantity}×</span>
              <span dir="auto" className="min-w-0">
                {lineName(line)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {ret.restockedAt && (
        <p className="text-sm text-ink-soft">
          {fmt(t.restockedAt, { date: formatDateTime(ret.restockedAt) })}
        </p>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      {(canModerate || canRestock) && (
        <div className="flex flex-wrap gap-2">
          {canModerate && (
            <>
              <Button size="sm" onClick={() => run("approve")} disabled={busy !== null}>
                {busy === "approve" ? t.saving : t.approve}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => run("reject")}
                disabled={busy !== null}
              >
                {busy === "reject" ? t.saving : t.reject}
              </Button>
            </>
          )}
          {canRestock && (
            <Button size="sm" onClick={() => run("restock")} disabled={busy !== null}>
              {busy === "restock" ? t.saving : t.restock}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
