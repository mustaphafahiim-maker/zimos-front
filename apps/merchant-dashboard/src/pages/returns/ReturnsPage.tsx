import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Tabs, TabsList, TabsTrigger } from "@store-builder/ui";
import { Check, Info, PackageCheck, RotateCcw, X, XCircle } from "lucide-react";
import type { Order, ReturnRequest, ReturnStatus } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { ApiError, getErrorMessage } from "@/lib/errors";
import { formatDate, humanize } from "@/lib/format";
import { useT, useCommon, useLocale, fmt, type Locale, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { HBarList } from "@/components/charts";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Returns",
    description: "Customer return requests on delivered orders — approve, reject and restock.",
    kpiRequested: "Awaiting decision",
    kpiRequestedHint: "Requested, not yet approved or rejected",
    kpiRestock: "Awaiting restock",
    kpiRestockHint: "Approved, items not back in stock yet",
    kpiReceived: "Restocked",
    kpiReceivedHint: "Received and returned to inventory",
    kpiRejected: "Rejected",
    kpiRejectedHint: "Declined return requests",
    rtoNote: "RTO (shipped but never delivered) tracking needs a carrier integration and isn't available yet — this page covers customer returns only.",
    empty: "No returns here.",
    colOrder: "Order",
    colCustomer: "Customer",
    colReason: "Reason",
    colItems: "Items",
    colCreated: "Created",
    approve: "Approve",
    reject: "Reject",
    restock: "Restock",
    done: "Done",
    closed: "Closed",
    toastApproved: "{order} return approved.",
    toastRejected: "{order} return rejected.",
    toastRestocked: "{order} items restocked.",
    permission: "You don't have permission to do that. Moderating returns needs orders.manage; restocking needs inventory.manage.",
    subscription: "This workspace needs an active subscription to make changes.",
    reasonsTitle: "Reasons breakdown",
    reasonsHint: "All returns, by reason.",
    noData: "No data yet.",
    tabOpen: "Open",
    tabClosed: "Closed",
    unitsN: "{n} units",
    unitsOne: "1 unit",
  },
  ar: {
    title: "المرتجعات",
    description: "طلبات إرجاع العملاء على الطلبات المُسلَّمة — قبول ورفض وإرجاع للمخزون.",
    kpiRequested: "بانتظار القرار",
    kpiRequestedHint: "مطلوبة ولم تُقبل أو تُرفض بعد",
    kpiRestock: "بانتظار الإرجاع للمخزون",
    kpiRestockHint: "مقبولة ولم تعد منتجاتها للمخزون بعد",
    kpiReceived: "أُعيدت للمخزون",
    kpiReceivedHint: "تم استلامها وإرجاعها للمخزون",
    kpiRejected: "مرفوضة",
    kpiRejectedHint: "طلبات إرجاع مرفوضة",
    rtoNote: "تتبّع الطلبات المرتدة (RTO — شُحنت ولم تُسلَّم) يحتاج إلى ربط مع شركة الشحن وغير متاح بعد — هذه الصفحة لمرتجعات العملاء فقط.",
    empty: "لا توجد مرتجعات هنا.",
    colOrder: "الطلب",
    colCustomer: "العميل",
    colReason: "السبب",
    colItems: "المنتجات",
    colCreated: "تاريخ الإنشاء",
    approve: "قبول",
    reject: "رفض",
    restock: "إرجاع للمخزون",
    done: "مكتمل",
    closed: "مغلق",
    toastApproved: "تم قبول مرتجع {order}.",
    toastRejected: "تم رفض مرتجع {order}.",
    toastRestocked: "تمت إعادة منتجات {order} إلى المخزون.",
    permission: "ليست لديك صلاحية لذلك. مراجعة المرتجعات تحتاج صلاحية إدارة الطلبات، والإرجاع للمخزون يحتاج صلاحية إدارة المخزون.",
    subscription: "تحتاج مساحة العمل إلى اشتراك نشط لإجراء التغييرات.",
    reasonsTitle: "توزيع الأسباب",
    reasonsHint: "كل المرتجعات حسب السبب.",
    noData: "لا توجد بيانات بعد.",
    tabOpen: "مفتوحة",
    tabClosed: "مغلقة",
    unitsN: "{n} قطع",
    unitsOne: "قطعة واحدة",
  },
} satisfies Messages;

type Tab = "all" | "open" | "closed";

// Backend REASON_CODES (returnService.js). Stored `reason` is "code" or "code: detail".
const REASON_LABEL: Record<Locale, Record<string, string>> = {
  en: {
    damaged: "Damaged",
    defective: "Defective",
    wrong_item: "Wrong item",
    not_as_described: "Not as described",
    no_longer_wanted: "No longer wanted",
    arrived_late: "Arrived late",
    other: "Other",
  },
  ar: {
    damaged: "تالف",
    defective: "به عيب",
    wrong_item: "منتج خاطئ",
    not_as_described: "مختلف عن الوصف",
    no_longer_wanted: "لم يعد يريده",
    arrived_late: "وصل متأخرًا",
    other: "أخرى",
  },
};

function parseReason(reason: string): { code: string; detail: string | null } {
  const idx = reason.indexOf(":");
  if (idx === -1) return { code: reason.trim(), detail: null };
  return { code: reason.slice(0, idx).trim(), detail: reason.slice(idx + 1).trim() || null };
}

function reasonLabel(locale: Locale, code: string): string {
  return REASON_LABEL[locale][code] ?? humanize(code);
}

const isOpen = (r: ReturnRequest) => r.status === "requested" || (r.status === "approved" && !r.restockedAt);

export function ReturnsPage() {
  const t = useT(STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const list = useAsync(() => apiClient.listReturns(workspaceId), [workspaceId]);
  const [tab, setTab] = useState<Tab>("all");
  const [busy, setBusy] = useState<string | null>(null);

  const returns = list.data ?? [];

  // Returns only carry orderId — join order number / customer / item names from each order.
  const orderIdsKey = useMemo(() => Array.from(new Set(returns.map((r) => r.orderId))).sort().join(","), [returns]);
  const orders = useAsync(async () => {
    const ids = orderIdsKey ? orderIdsKey.split(",") : [];
    const results = await Promise.allSettled(ids.map((id) => apiClient.getOrder(workspaceId, id)));
    const map = new Map<string, Order>();
    results.forEach((res) => {
      if (res.status === "fulfilled") map.set(res.value.id, res.value);
    });
    return map;
  }, [workspaceId, orderIdsKey]);

  const kpis = useMemo(
    () => ({
      requested: returns.filter((r) => r.status === "requested").length,
      awaitingRestock: returns.filter((r) => r.status === "approved" && !r.restockedAt).length,
      received: returns.filter((r) => r.status === "received").length,
      rejected: returns.filter((r) => r.status === "rejected").length,
    }),
    [returns]
  );

  const reasons = useMemo(() => {
    const counts = new Map<string, number>();
    returns.forEach((r) => {
      const { code } = parseReason(r.reason);
      counts.set(code, (counts.get(code) ?? 0) + 1);
    });
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([code, value]) => ({ label: reasonLabel(locale, code), value }));
  }, [returns, locale]);

  const rows = returns
    .filter((r) => tab === "all" || (tab === "open" ? isOpen(r) : !isOpen(r)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  function actionError(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.status === 403) return t.permission;
      if (err.status === 402 || err.code === "SUBSCRIPTION_REQUIRED") return t.subscription;
    }
    return getErrorMessage(err);
  }

  async function run(r: ReturnRequest, op: () => Promise<ReturnRequest>, message: string) {
    setBusy(r.id);
    try {
      const updated = await op();
      list.setData((prev) => (prev ?? []).map((x) => (x.id === r.id ? { ...x, ...updated } : x)));
      toast.success(message);
    } catch (err) {
      toast.error(actionError(err));
      void list.refresh({ silent: true });
    } finally {
      setBusy(null);
    }
  }

  function orderLabel(r: ReturnRequest): string {
    return orders.data?.get(r.orderId)?.orderNumber ?? r.orderId.slice(0, 8);
  }

  function actions(r: ReturnRequest) {
    const disabled = busy === r.id;
    const order = orderLabel(r);
    // State machine (returnService): requested -> approve | reject; approved|received (not restocked) -> restock (-> received).
    if (r.status === "requested") {
      return (
        <>
          <Button size="sm" variant="ghost" className="text-success" disabled={disabled} onClick={() => run(r, () => apiClient.moderateReturn(workspaceId, r.id, "approve"), fmt(t.toastApproved, { order }))}>
            <Check /> {t.approve}
          </Button>
          <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" disabled={disabled} onClick={() => run(r, () => apiClient.moderateReturn(workspaceId, r.id, "reject"), fmt(t.toastRejected, { order }))}>
            <X /> {t.reject}
          </Button>
        </>
      );
    }
    if ((r.status === "approved" || r.status === "received") && !r.restockedAt) {
      return (
        <Button size="sm" variant="ghost" disabled={disabled} onClick={() => run(r, () => apiClient.restockReturn(workspaceId, r.id), fmt(t.toastRestocked, { order }))}>
          <RotateCcw /> {t.restock}
        </Button>
      );
    }
    if (r.restockedAt) return <span className="text-xs text-ink-soft">{t.done}</span>;
    return <span className="text-xs text-ink-soft">{t.closed}</span>;
  }

  function itemsLabel(r: ReturnRequest): string {
    const order = orders.data?.get(r.orderId);
    if (order) {
      const byId = new Map(order.items.map((i) => [i.id, i]));
      return r.items
        .map((line) => `${byId.get(line.orderItemId)?.productNameSnapshot ?? "—"} × ${line.quantity}`)
        .join(locale === "ar" ? "، " : ", ");
    }
    const units = r.items.reduce((a, l) => a + l.quantity, 0);
    return units === 1 ? t.unitsOne : fmt(t.unitsN, { n: units });
  }

  const statusTone = (s: ReturnStatus) =>
    (({ requested: "warning", approved: "info", rejected: "danger", received: "success", refunded: "neutral" }) as const)[s];

  return (
    <div className="max-w-6xl">
      <PageHeader title={t.title} description={t.description} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={t.kpiRequested} value={list.data ? kpis.requested : "—"} hint={t.kpiRequestedHint} icon={<RotateCcw />} />
        <KpiCard label={t.kpiRestock} value={list.data ? kpis.awaitingRestock : "—"} hint={t.kpiRestockHint} icon={<Check />} />
        <KpiCard label={t.kpiReceived} value={list.data ? kpis.received : "—"} hint={t.kpiReceivedHint} icon={<PackageCheck />} />
        <KpiCard label={t.kpiRejected} value={list.data ? kpis.rejected : "—"} hint={t.kpiRejectedHint} icon={<XCircle />} />
      </div>

      <Alert variant="info" className="mb-6 border-primary/30 bg-primary-soft/40">
        <Info />
        <p className="text-sm text-ink-soft">{t.rtoNote}</p>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <Tabs value={tab} onValueChange={(v) => setTab(String(v) as Tab)} className="mb-3">
            <TabsList variant="line">
              <TabsTrigger value="all">{c.all}</TabsTrigger>
              <TabsTrigger value="open">{t.tabOpen}</TabsTrigger>
              <TabsTrigger value="closed">{t.tabClosed}</TabsTrigger>
            </TabsList>
          </Tabs>

          <DataState loading={list.loading} error={list.error} empty={rows.length === 0} emptyMessage={t.empty} onRetry={() => list.refresh()}>
            <div className="overflow-x-auto rounded-2xl border border-line bg-paper-raised">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="sticky top-0 z-10 bg-paper-raised">
                  <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                    <th className="px-4 py-3 text-start font-medium">{t.colOrder}</th>
                    <th className="px-4 py-3 text-start font-medium">{t.colCustomer}</th>
                    <th className="px-4 py-3 text-start font-medium">{t.colReason}</th>
                    <th className="px-4 py-3 text-start font-medium">{t.colItems}</th>
                    <th className="px-4 py-3 text-start font-medium">{c.status}</th>
                    <th className="px-4 py-3 text-start font-medium">{t.colCreated}</th>
                    <th className="px-4 py-3 font-medium">
                      <span className="sr-only">{c.actions}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const order = orders.data?.get(r.orderId);
                    const { code, detail } = parseReason(r.reason);
                    return (
                      <tr key={r.id} className="border-b border-line last:border-0 hover:bg-paper">
                        <td className="px-4 py-3 text-start font-mono text-xs">
                          <Link to={`/orders/${r.orderId}`} className="text-primary hover:underline">
                            <bdi dir="ltr">{orderLabel(r)}</bdi>
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-start">
                          <p className="text-ink" dir="auto">
                            {order?.contactSnapshot?.fullName ?? "—"}
                          </p>
                          {order?.contactSnapshot?.phone && (
                            <p className="font-mono text-[11px] text-ink-soft">
                              <bdi dir="ltr">{order.contactSnapshot.phone}</bdi>
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-start text-ink-soft">
                          <p>{reasonLabel(locale, code)}</p>
                          {detail && (
                            <p className="max-w-[200px] truncate text-[11px]" dir="auto" title={detail}>
                              {detail}
                            </p>
                          )}
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-3 text-start text-ink" dir="auto">
                          {itemsLabel(r)}
                        </td>
                        <td className="px-4 py-3 text-start">
                          <StatusBadge value={r.status} tone={statusTone(r.status)} />
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-start text-xs text-ink-soft">{formatDate(r.createdAt)}</td>
                        <td className="whitespace-nowrap px-4 py-3 text-end">{actions(r)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </DataState>
        </div>

        <div className="rounded-2xl border border-line bg-paper-raised p-4">
          <p className="text-sm font-medium text-ink">{t.reasonsTitle}</p>
          <p className="mb-3 text-xs text-ink-soft">{t.reasonsHint}</p>
          {reasons.length ? <HBarList rows={reasons} format={(v) => `${v}`} /> : <p className="text-xs text-ink-soft">{t.noData}</p>}
        </div>
      </div>
    </div>
  );
}
