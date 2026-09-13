import { useMemo, useState } from "react";
import { Alert, Button, Tabs, TabsList, TabsTrigger, cn } from "@store-builder/ui";
import { Check, Info, PackageCheck, PackageX, Phone, RotateCcw, Truck, Wallet, X } from "lucide-react";
import type { ReturnRequest } from "@/mock/types2";
import { mockApi } from "@/mock/api";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatMoney, humanize } from "@/lib/format";
import { useT, useCommon, useLocale, fmt, type Locale, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { HBarList } from "@/components/charts";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Returns & RTO",
    description: "Customer returns and undelivered COD parcels coming back to you.",
    kpiOpen: "Open requests",
    kpiOpenHint: "Requested, approved or awaiting restock",
    kpiRto: "RTO this month",
    kpiRtoHint: "Shipped but never delivered",
    kpiRate: "Return rate",
    kpiRateHint: "Of delivered orders, last 30 days",
    kpiRefund: "Refund pending",
    kpiRefundHint: "Customer returns not yet refunded",
    rtoExplainer: "RTO = order shipped but never delivered (unreachable / refused). It costs you shipping both ways — that's why confirmation matters.",
    tabCustomer: "Customer returns",
    tabRto: "RTO (undelivered)",
    empty: "No returns here.",
    colOrder: "Order",
    colCustomer: "Customer",
    colKind: "Kind",
    colReason: "Reason",
    colItems: "Items",
    colRefund: "Refund",
    colCarrier: "Carrier",
    colCreated: "Created",
    kindRto: "RTO",
    kindReturn: "Return",
    approve: "Approve",
    reject: "Reject",
    markReceived: "Mark received",
    restock: "Restock",
    refund: "Refund",
    done: "Done",
    closed: "Closed",
    toastApproved: "{order} return approved — pickup scheduled.",
    toastRejected: "{order} return rejected.",
    toastReceived: "{order} marked as received at warehouse.",
    toastRestocked: "{order} items restocked.",
    toastRefunded: "{amount} refunded for {order}.",
    reasonsTitle: "Reasons breakdown",
    reasonsHint: "All returns and RTOs, by reason.",
    noData: "No data yet.",
  },
  ar: {
    title: "المرتجعات والطلبات المرتدة",
    description: "مرتجعات العملاء وشحنات الدفع عند الاستلام التي لم تُسلَّم وتعود إليك.",
    kpiOpen: "طلبات مفتوحة",
    kpiOpenHint: "مطلوبة أو مقبولة أو بانتظار الإرجاع للمخزون",
    kpiRto: "المرتدة هذا الشهر",
    kpiRtoHint: "شُحنت ولم تُسلَّم",
    kpiRate: "نسبة المرتجعات",
    kpiRateHint: "من الطلبات المُسلَّمة، آخر 30 يوم",
    kpiRefund: "استرداد معلّق",
    kpiRefundHint: "مرتجعات عملاء لم يُرد مبلغها بعد",
    rtoExplainer: "الطلب المرتد (RTO) = طلب شُحن ولم يُسلَّم (تعذّر الوصول للعميل / رفض الاستلام). يكلّفك الشحن ذهابًا وإيابًا — ولهذا تأكيد الطلب مهم.",
    tabCustomer: "مرتجعات العملاء",
    tabRto: "مرتدة (لم تُسلَّم)",
    empty: "لا توجد مرتجعات هنا.",
    colOrder: "الطلب",
    colCustomer: "العميل",
    colKind: "النوع",
    colReason: "السبب",
    colItems: "المنتجات",
    colRefund: "الاسترداد",
    colCarrier: "شركة الشحن",
    colCreated: "تاريخ الإنشاء",
    kindRto: "مرتد",
    kindReturn: "مرتجع",
    approve: "قبول",
    reject: "رفض",
    markReceived: "تأكيد الاستلام",
    restock: "إرجاع للمخزون",
    refund: "رد المبلغ",
    done: "مكتمل",
    closed: "مغلق",
    toastApproved: "تم قبول مرتجع {order} — وتمت جدولة الاستلام من العميل.",
    toastRejected: "تم رفض مرتجع {order}.",
    toastReceived: "تم تأكيد استلام {order} في المخزن.",
    toastRestocked: "تمت إعادة منتجات {order} إلى المخزون.",
    toastRefunded: "تم رد {amount} للطلب {order}.",
    reasonsTitle: "توزيع الأسباب",
    reasonsHint: "كل المرتجعات والطلبات المرتدة حسب السبب.",
    noData: "لا توجد بيانات بعد.",
  },
} satisfies Messages;

type Tab = "all" | "customer_return" | "rto";

const RETURN_RATE_LABEL = "9.4%";

const STATUS_TONE: Record<ReturnRequest["status"], "warning" | "info" | "danger" | "success" | "neutral"> = {
  requested: "warning",
  approved: "info",
  rejected: "danger",
  received: "success",
  restocked: "success",
  refunded: "neutral",
};

const REASON_LABEL: Record<Locale, Record<ReturnRequest["reason"], string>> = {
  en: {
    no_longer_wanted: "No longer wanted",
    not_as_described: "Not as described",
    wrong_item: "Wrong item",
    damaged: "Damaged",
    arrived_late: "Arrived late",
    rto_unreachable: "RTO — unreachable",
    rto_refused: "RTO — refused",
  },
  ar: {
    no_longer_wanted: "لم يعد يريده",
    not_as_described: "مختلف عن الوصف",
    wrong_item: "منتج خاطئ",
    damaged: "تالف",
    arrived_late: "وصل متأخرًا",
    rto_unreachable: "مرتد — تعذّر الوصول للعميل",
    rto_refused: "مرتد — رفض الاستلام",
  },
};

function reasonLabel(locale: Locale, reason: ReturnRequest["reason"]): string {
  return REASON_LABEL[locale][reason] ?? humanize(reason);
}

export function ReturnsPage() {
  const t = useT(STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const list = useAsync(() => mockApi.listReturns(workspaceId), [workspaceId]);
  const [tab, setTab] = useState<Tab>("all");
  const [busy, setBusy] = useState<string | null>(null);

  const returns = list.data ?? [];

  const kpis = useMemo(() => {
    const now = new Date();
    const open = returns.filter((r) => r.status === "requested" || r.status === "approved" || r.status === "received").length;
    const rtoMonth = returns.filter((r) => r.kind === "rto" && new Date(r.createdAt).getMonth() === now.getMonth() && new Date(r.createdAt).getFullYear() === now.getFullYear()).length;
    const refundPending = returns.filter((r) => r.kind === "customer_return" && r.status !== "refunded" && r.status !== "rejected").reduce((a, r) => a + r.refundAmount, 0);
    return { open, rtoMonth, refundPending };
  }, [returns]);

  const reasons = useMemo(() => {
    const counts = new Map<ReturnRequest["reason"], number>();
    returns.forEach((r) => counts.set(r.reason, (counts.get(r.reason) ?? 0) + 1));
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([reason, value]) => ({ label: reasonLabel(locale, reason), value }));
  }, [returns, locale]);

  const rows = returns.filter((r) => tab === "all" || r.kind === tab).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  async function advance(r: ReturnRequest, status: ReturnRequest["status"], message: string) {
    setBusy(r.id);
    list.setData((prev) => (prev ?? []).map((x) => (x.id === r.id ? { ...x, status } : x)));
    try {
      await mockApi.setReturnStatus(workspaceId, r.id, status);
      toast.success(message);
    } catch (err) {
      toast.error(getErrorMessage(err));
      list.refresh({ silent: true });
    } finally {
      setBusy(null);
    }
  }

  function actions(r: ReturnRequest) {
    const disabled = busy === r.id;
    const order = r.orderNumber;
    switch (r.status) {
      case "requested":
        return (
          <>
            <Button size="sm" variant="ghost" className="text-success" disabled={disabled} onClick={() => advance(r, "approved", fmt(t.toastApproved, { order }))}>
              <Check /> {t.approve}
            </Button>
            <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" disabled={disabled} onClick={() => advance(r, "rejected", fmt(t.toastRejected, { order }))}>
              <X /> {t.reject}
            </Button>
          </>
        );
      case "approved":
        return (
          <Button size="sm" variant="ghost" disabled={disabled} onClick={() => advance(r, "received", fmt(t.toastReceived, { order }))}>
            <PackageCheck /> {t.markReceived}
          </Button>
        );
      case "received":
        return (
          <Button size="sm" variant="ghost" disabled={disabled} onClick={() => advance(r, "restocked", fmt(t.toastRestocked, { order }))}>
            <RotateCcw /> {t.restock}
          </Button>
        );
      case "restocked":
        return r.kind === "customer_return" ? (
          <Button
            size="sm"
            variant="ghost"
            className="text-primary"
            disabled={disabled}
            onClick={() => advance(r, "refunded", fmt(t.toastRefunded, { amount: formatMoney(r.refundAmount, r.currency), order }))}
          >
            <Wallet /> {t.refund}
          </Button>
        ) : (
          <span className="text-xs text-ink-soft">{t.done}</span>
        );
      default:
        return <span className="text-xs text-ink-soft">{t.closed}</span>;
    }
  }

  return (
    <div className="max-w-6xl">
      <PageHeader title={t.title} description={t.description} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={t.kpiOpen} value={kpis.open} hint={t.kpiOpenHint} icon={<RotateCcw />} />
        <KpiCard label={t.kpiRto} value={kpis.rtoMonth} hint={t.kpiRtoHint} icon={<PackageX />} />
        <KpiCard label={t.kpiRate} value={RETURN_RATE_LABEL} hint={t.kpiRateHint} icon={<Truck />} />
        <KpiCard label={t.kpiRefund} value={formatMoney(kpis.refundPending)} hint={t.kpiRefundHint} icon={<Wallet />} />
      </div>

      <Alert variant="info" className="mb-6 border-primary/30 bg-primary-soft/40">
        <Info />
        <p className="text-sm text-ink-soft">{t.rtoExplainer}</p>
      </Alert>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="min-w-0">
          <Tabs value={tab} onValueChange={(v) => setTab(String(v) as Tab)} className="mb-3">
            <TabsList variant="line">
              <TabsTrigger value="all">{c.all}</TabsTrigger>
              <TabsTrigger value="customer_return">{t.tabCustomer}</TabsTrigger>
              <TabsTrigger value="rto">{t.tabRto}</TabsTrigger>
            </TabsList>
          </Tabs>

          <DataState loading={list.loading} error={list.error} empty={rows.length === 0} emptyMessage={t.empty} onRetry={() => list.refresh()}>
            <div className="overflow-x-auto rounded-2xl border border-line bg-paper-raised">
              <table className="w-full min-w-[960px] text-sm">
                <thead className="sticky top-0 z-10 bg-paper-raised">
                  <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                    <th className="px-4 py-3 text-start font-medium">{t.colOrder}</th>
                    <th className="px-4 py-3 text-start font-medium">{t.colCustomer}</th>
                    <th className="px-4 py-3 text-start font-medium">{t.colKind}</th>
                    <th className="px-4 py-3 text-start font-medium">{t.colReason}</th>
                    <th className="px-4 py-3 text-start font-medium">{t.colItems}</th>
                    <th className="px-4 py-3 text-end font-medium">{t.colRefund}</th>
                    <th className="px-4 py-3 text-start font-medium">{t.colCarrier}</th>
                    <th className="px-4 py-3 text-start font-medium">{c.status}</th>
                    <th className="px-4 py-3 text-start font-medium">{t.colCreated}</th>
                    <th className="px-4 py-3 font-medium">
                      <span className="sr-only">{c.actions}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b border-line last:border-0 hover:bg-paper">
                      <td className="px-4 py-3 text-start font-mono text-xs text-ink">
                        <bdi dir="ltr">{r.orderNumber}</bdi>
                      </td>
                      <td className="px-4 py-3 text-start">
                        <p className="text-ink" dir="auto">
                          {r.customerName}
                        </p>
                        <p className="inline-flex items-center gap-1 font-mono text-[11px] text-ink-soft">
                          <Phone className="size-3" /> <bdi dir="ltr">{r.phone}</bdi>
                        </p>
                      </td>
                      <td className="px-4 py-3 text-start">
                        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", r.kind === "rto" ? "bg-warning-soft text-warning" : "bg-primary-soft text-primary-dark")}>
                          {r.kind === "rto" ? t.kindRto : t.kindReturn}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-start text-ink-soft">{reasonLabel(locale, r.reason)}</td>
                      <td className="max-w-[200px] truncate px-4 py-3 text-start text-ink" dir="auto">
                        {r.items.map((i) => `${i.productName} × ${i.quantity}`).join(locale === "ar" ? "، " : ", ")}
                      </td>
                      <td className="px-4 py-3 text-end tabular-nums text-ink">{r.refundAmount ? formatMoney(r.refundAmount, r.currency) : "—"}</td>
                      <td className="px-4 py-3 text-start text-xs text-ink-soft">{r.carrierName ?? "—"}</td>
                      <td className="px-4 py-3 text-start">
                        <StatusBadge value={r.status} tone={STATUS_TONE[r.status]} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-start text-xs text-ink-soft">{formatDate(r.createdAt)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-end">{actions(r)}</td>
                    </tr>
                  ))}
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
