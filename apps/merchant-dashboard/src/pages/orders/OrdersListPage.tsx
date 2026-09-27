import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Download, Search, ShoppingBag, Workflow } from "lucide-react";
import { Button, Input, cn } from "@store-builder/ui";
import type { Order, OrderCounts, OrderListFilters, OrderListSort } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCursorList } from "@/lib/useCursorList";
import { useAsync } from "@/lib/useAsync";
import { formatDateTime, formatMoney, humanize } from "@/lib/format";
import { rangeWindows, type AnalyticsRange } from "@/lib/analytics";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadMore } from "@/components/LoadMore";
import { Select } from "@/components/Select";
import { fmt, useCommon, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Orders",
    description: "Every order, with where it came from and where it stands.",
    tabAll: "All",
    tabPending: "Awaiting confirmation",
    tabConfirmed: "Confirmed",
    tabUnreachable: "Unreachable",
    tabPostponed: "Postponed",
    tabUnfulfilled: "Unfulfilled",
    tabDelivered: "Delivered",
    tabReturned: "Returned",
    tabUnpaid: "Unpaid",
    tabCancelled: "Cancelled",
    tabsLabel: "Order status",
    searchPlaceholder: "Search order number, name or phone",
    period: "Period",
    allTime: "All time",
    yesterday: "Yesterday",
    last365: "Last 365 days",
    channel: "Channel",
    anyChannel: "All channels",
    channelStore: "Online store",
    channelFunnel: "Funnels",
    payment: "Payment",
    anyPayment: "Any payment method",
    sort: "Sort",
    sortNewest: "Newest first",
    sortOldest: "Oldest first",
    sortTotalDesc: "Highest total",
    sortTotalAsc: "Lowest total",
    colOrder: "Order",
    colDate: "Date",
    colCustomer: "Customer",
    colChannel: "Channel",
    colTotal: "Total",
    colPayment: "Payment",
    colConfirmation: "Confirmation",
    colFulfillment: "Fulfilment",
    colItems: "Items",
    itemsCount: "{n} items",
    itemsOne: "1 item",
    cancelledBadge: "Cancelled",
    selectAll: "Select all loaded orders",
    selectOne: "Select order {n}",
    selected: "{n} selected",
    clearSelection: "Clear",
    exportSelected: "Export selected",
    exportLoaded: "Export CSV",
    exportHint: "Exports the orders loaded on this page.",
    emptyTitle: "No orders match",
    emptyDesc: "Try another tab, clear the search, or widen the period.",
    emptyAllTitle: "No orders yet",
    emptyAllDesc: "Orders from your store and funnels will show up here the moment they come in.",
    loadedOf: "{loaded} of {total} orders",
  },
  ar: {
    title: "الطلبات",
    description: "كل طلب، جه منين ووصل لفين.",
    tabAll: "الكل",
    tabPending: "مستنية التأكيد",
    tabConfirmed: "متأكدة",
    tabUnreachable: "مردّوش",
    tabPostponed: "متأجلة",
    tabUnfulfilled: "لسه ما اتشحنتش",
    tabDelivered: "اتسلّمت",
    tabReturned: "مرتجعة",
    tabUnpaid: "مش مدفوعة",
    tabCancelled: "ملغية",
    tabsLabel: "حالة الطلب",
    searchPlaceholder: "دوّر برقم الطلب أو الاسم أو التليفون",
    period: "الفترة",
    allTime: "كل الوقت",
    yesterday: "إمبارح",
    last365: "آخر 365 يوم",
    channel: "القناة",
    anyChannel: "كل القنوات",
    channelStore: "المتجر الإلكتروني",
    channelFunnel: "مسارات البيع",
    payment: "الدفع",
    anyPayment: "أي طريقة دفع",
    sort: "الترتيب",
    sortNewest: "الأحدث الأول",
    sortOldest: "الأقدم الأول",
    sortTotalDesc: "الأعلى قيمة",
    sortTotalAsc: "الأقل قيمة",
    colOrder: "الطلب",
    colDate: "التاريخ",
    colCustomer: "العميل",
    colChannel: "القناة",
    colTotal: "الإجمالي",
    colPayment: "الدفع",
    colConfirmation: "التأكيد",
    colFulfillment: "الشحن",
    colItems: "القطع",
    itemsCount: "{n} قطعة",
    itemsOne: "قطعة واحدة",
    cancelledBadge: "ملغي",
    selectAll: "اختار كل الطلبات المعروضة",
    selectOne: "اختار الطلب {n}",
    selected: "{n} مختار",
    clearSelection: "إلغاء الاختيار",
    exportSelected: "تصدير المختار",
    exportLoaded: "تصدير CSV",
    exportHint: "بيصدّر الطلبات المعروضة في الصفحة.",
    emptyTitle: "مفيش طلبات مطابقة",
    emptyDesc: "جرّب تبويب تاني أو امسح البحث أو وسّع الفترة.",
    emptyAllTitle: "مفيش طلبات لسه",
    emptyAllDesc: "طلبات المتجر ومسارات البيع هتظهر هنا أول ما تيجي.",
    loadedOf: "{loaded} من {total} طلب",
  },
} satisfies Messages;

type Tab =
  | "all"
  | "pending"
  | "confirmed"
  | "unreachable"
  | "postponed"
  | "unfulfilled"
  | "delivered"
  | "returned"
  | "unpaid"
  | "cancelled";

const TABS: Tab[] = ["all", "pending", "confirmed", "unreachable", "postponed", "unfulfilled", "delivered", "returned", "unpaid", "cancelled"];

/** What each tab asks the API for. Every tab but "cancelled" hides cancelled orders. */
function tabFilters(tab: Tab): OrderListFilters {
  switch (tab) {
    case "all":
      return { cancelled: false };
    case "cancelled":
      return { cancelled: true };
    case "unfulfilled":
      return { cancelled: false, fulfillmentState: "unfulfilled" };
    case "delivered":
      return { cancelled: false, fulfillmentState: "fulfilled" };
    case "returned":
      return { cancelled: false, fulfillmentState: "returned" };
    case "unpaid":
      return { cancelled: false, financialState: "pending" };
    default:
      return { cancelled: false, confirmationState: tab };
  }
}

function countOf(counts: OrderCounts | null, tab: Tab): number | null {
  if (!counts) return null;
  switch (tab) {
    case "all":
      return counts.all - counts.cancelled;
    case "delivered":
      return counts.fulfilled;
    default:
      return counts[tab];
  }
}

type Period = "all" | AnalyticsRange;

function periodFilters(period: Period): Pick<OrderListFilters, "from" | "to"> {
  if (period === "all") return {};
  return rangeWindows(period).current;
}

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportCsv(orders: Order[]) {
  const header = ["order_number", "created_at", "customer", "phone", "channel", "total", "currency", "payment_method", "payment_state", "confirmation_state", "fulfillment_state", "items", "cancelled_at"];
  const rows = orders.map((o) => [
    o.orderNumber,
    o.createdAt,
    o.contactSnapshot?.fullName ?? "",
    o.contactSnapshot?.phone ?? "",
    o.funnel?.name ?? (o.funnelId ? "funnel" : "store"),
    (Number(o.totalAmount) / 100).toFixed(2),
    o.currency,
    o.paymentMethod,
    o.financialState,
    o.confirmationState,
    o.fulfillmentState,
    o.items?.length ?? "",
    o.cancelledAt ?? "",
  ]);
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
  const blob = new Blob([`﻿${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function OrdersListPage() {
  const t = useT(STRINGS);
  const c = useCommon();
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<Period>("all");
  const [source, setSource] = useState<"" | "store" | "funnel">("");
  const [paymentMethod, setPaymentMethod] = useState<Order["paymentMethod"] | "">("");
  const [sort, setSort] = useState<OrderListSort>("newest");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Search as you type, but only ask the API once the merchant pauses.
  useEffect(() => {
    const handle = setTimeout(() => setQ(query.trim()), 300);
    return () => clearTimeout(handle);
  }, [query]);

  const baseFilters = useMemo<OrderListFilters>(
    () => ({
      ...periodFilters(period),
      q: q || undefined,
      source: source || undefined,
      paymentMethod: paymentMethod || undefined,
    }),
    [period, q, source, paymentMethod]
  );
  const filtersKey = JSON.stringify(baseFilters);

  const counts = useAsync(() => apiClient.getOrderCounts(workspaceId, baseFilters), [workspaceId, filtersKey]);

  const list = useCursorList<Order>(
    (cursor) =>
      apiClient
        .listOrders(workspaceId, { ...baseFilters, ...tabFilters(tab), sort, cursor, limit: 50 })
        .then((r) => ({ items: r.orders, nextCursor: r.nextCursor })),
    [workspaceId, filtersKey, tab, sort]
  );

  useEffect(() => setSelected(new Set()), [filtersKey, tab, sort]);

  const tabLabel: Record<Tab, string> = {
    all: t.tabAll,
    pending: t.tabPending,
    confirmed: t.tabConfirmed,
    unreachable: t.tabUnreachable,
    postponed: t.tabPostponed,
    unfulfilled: t.tabUnfulfilled,
    delivered: t.tabDelivered,
    returned: t.tabReturned,
    unpaid: t.tabUnpaid,
    cancelled: t.tabCancelled,
  };
  const periodLabel: Record<Period, string> = {
    all: t.allTime,
    today: c.today,
    yesterday: t.yesterday,
    "7d": c.last7,
    "30d": c.last30,
    "90d": c.last90,
    "365d": t.last365,
  };

  const allSelected = list.items.length > 0 && list.items.every((o) => selected.has(o.id));
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(list.items.map((o) => o.id)));
  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const isFiltered = Boolean(q || source || paymentMethod || period !== "all" || tab !== "all");
  const tabTotal = countOf(counts.data ?? null, tab);

  return (
    <div className="min-w-0 max-w-7xl">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button variant="outline" size="sm" title={t.exportHint} disabled={list.items.length === 0} onClick={() => exportCsv(list.items)}>
            <Download className="size-4" aria-hidden /> {t.exportLoaded}
          </Button>
        }
      />

      <div className="rounded-xl bg-paper-raised shadow-xs ring-1 ring-foreground/10">
        <div role="tablist" aria-label={t.tabsLabel} className="flex gap-1 overflow-x-auto border-b border-line px-2 pt-2">
          {TABS.map((key) => {
            const n = countOf(counts.data ?? null, key);
            const active = tab === key;
            return (
              <button
                key={key}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setTab(key)}
                className={cn(
                  "-mb-px flex shrink-0 cursor-pointer items-center gap-1.5 rounded-t-lg border-b-2 px-3 py-2 text-[13px] font-medium transition-colors",
                  active ? "border-ink text-ink" : "border-transparent text-ink-soft hover:bg-paper hover:text-ink"
                )}
              >
                {tabLabel[key]}
                {n !== null && (
                  <span className={cn("tabular-nums rounded-full px-1.5 py-0.5 text-[11px]", active ? "bg-ink text-paper-raised" : "bg-paper text-ink-soft")}>
                    <bdi dir="ltr">{n}</bdi>
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <label className="relative min-w-56 flex-1">
            <span className="sr-only">{c.search}</span>
            <Search className="pointer-events-none absolute start-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
            <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t.searchPlaceholder} className="ps-8" />
          </label>
          <Select aria-label={t.period} value={period} onChange={(e) => setPeriod(e.target.value as Period)} className="h-9 w-auto">
            {(Object.keys(periodLabel) as Period[]).map((p) => (
              <option key={p} value={p}>
                {periodLabel[p]}
              </option>
            ))}
          </Select>
          <Select aria-label={t.channel} value={source} onChange={(e) => setSource(e.target.value as "" | "store" | "funnel")} className="h-9 w-auto">
            <option value="">{t.anyChannel}</option>
            <option value="store">{t.channelStore}</option>
            <option value="funnel">{t.channelFunnel}</option>
          </Select>
          <Select aria-label={t.payment} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as Order["paymentMethod"] | "")} className="h-9 w-auto">
            <option value="">{t.anyPayment}</option>
            {(["cod", "card", "wallet", "bank_transfer"] as const).map((m) => (
              <option key={m} value={m}>
                {humanize(m)}
              </option>
            ))}
          </Select>
          <Select aria-label={t.sort} value={sort} onChange={(e) => setSort(e.target.value as OrderListSort)} className="h-9 w-auto">
            <option value="newest">{t.sortNewest}</option>
            <option value="oldest">{t.sortOldest}</option>
            <option value="total_desc">{t.sortTotalDesc}</option>
            <option value="total_asc">{t.sortTotalAsc}</option>
          </Select>
        </div>

        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-line bg-paper px-3 py-2 text-sm">
            <span className="font-medium text-ink">{fmt(t.selected, { n: selected.size })}</span>
            <Button size="sm" variant="outline" onClick={() => exportCsv(list.items.filter((o) => selected.has(o.id)))}>
              <Download className="size-4" aria-hidden /> {t.exportSelected}
            </Button>
            <button type="button" className="cursor-pointer text-sm text-ink-soft hover:text-ink" onClick={() => setSelected(new Set())}>
              {t.clearSelection}
            </button>
          </div>
        )}

        <DataState loading={list.loading} error={list.items.length ? null : list.error} onRetry={list.reload}>
          {list.items.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={<ShoppingBag />}
                title={isFiltered ? t.emptyTitle : t.emptyAllTitle}
                description={isFiltered ? t.emptyDesc : t.emptyAllDesc}
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1040px] text-sm">
                <thead>
                  <tr className="border-b border-line text-start text-xs text-ink-soft">
                    <th className="w-10 px-3 py-2.5">
                      <input type="checkbox" aria-label={t.selectAll} checked={allSelected} onChange={toggleAll} className="size-4 cursor-pointer accent-primary" />
                    </th>
                    <th className="px-3 py-2.5 text-start font-medium">{t.colOrder}</th>
                    <th className="px-3 py-2.5 text-start font-medium">{t.colDate}</th>
                    <th className="px-3 py-2.5 text-start font-medium">{t.colCustomer}</th>
                    <th className="px-3 py-2.5 text-start font-medium">{t.colChannel}</th>
                    <th className="px-3 py-2.5 text-end font-medium">{t.colTotal}</th>
                    <th className="px-3 py-2.5 text-start font-medium">{t.colPayment}</th>
                    <th className="px-3 py-2.5 text-start font-medium">{t.colConfirmation}</th>
                    <th className="px-3 py-2.5 text-start font-medium">{t.colFulfillment}</th>
                    <th className="px-3 py-2.5 text-end font-medium">{t.colItems}</th>
                  </tr>
                </thead>
                <tbody>
                  {list.items.map((order) => {
                    const itemCount = order.items?.length ?? null;
                    const checked = selected.has(order.id);
                    return (
                      <tr
                        key={order.id}
                        onClick={() => navigate(`/orders/${order.id}`)}
                        className={cn("cursor-pointer border-b border-line last:border-0 hover:bg-paper", checked && "bg-primary-soft/40")}
                      >
                        <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            aria-label={fmt(t.selectOne, { n: order.orderNumber })}
                            checked={checked}
                            onChange={() => toggleOne(order.id)}
                            className="size-4 cursor-pointer accent-primary"
                          />
                        </td>
                        <td className="px-3 py-2.5">
                          <Link to={`/orders/${order.id}`} className="font-medium text-ink hover:text-primary" onClick={(e) => e.stopPropagation()}>
                            <bdi dir="ltr">{order.orderNumber}</bdi>
                          </Link>
                          {order.cancelledAt && (
                            <span className="ms-2 rounded-full bg-paper px-1.5 py-0.5 text-[11px] text-ink-soft">{t.cancelledBadge}</span>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2.5 text-ink-soft">{formatDateTime(order.createdAt)}</td>
                        <td className="px-3 py-2.5">
                          <span className="block text-ink" dir="auto">
                            {order.contactSnapshot?.fullName || "—"}
                          </span>
                          {order.contactSnapshot?.phone && (
                            <span className="block text-xs text-ink-soft" dir="ltr">
                              {order.contactSnapshot.phone}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-ink-soft">
                          <span className="inline-flex items-center gap-1.5">
                            {order.funnelId ? <Workflow className="size-3.5" aria-hidden /> : <ShoppingBag className="size-3.5" aria-hidden />}
                            <span dir="auto">{order.funnel?.name ?? (order.funnelId ? t.channelFunnel : t.channelStore)}</span>
                          </span>
                        </td>
                        <td className="tabular-nums whitespace-nowrap px-3 py-2.5 text-end text-ink">
                          <bdi dir="ltr">{formatMoney(order.totalAmount, order.currency)}</bdi>
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge value={order.financialState} />
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge value={order.confirmationState} />
                        </td>
                        <td className="px-3 py-2.5">
                          <StatusBadge value={order.fulfillmentState} />
                        </td>
                        <td className="tabular-nums px-3 py-2.5 text-end text-ink-soft">
                          {itemCount === null ? "—" : itemCount === 1 ? t.itemsOne : fmt(t.itemsCount, { n: itemCount })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between gap-3 px-3 py-2 text-xs text-ink-soft">
            <span>{tabTotal !== null && list.items.length > 0 ? fmt(t.loadedOf, { loaded: list.items.length, total: tabTotal }) : ""}</span>
            <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
          </div>
        </DataState>
      </div>
    </div>
  );
}
