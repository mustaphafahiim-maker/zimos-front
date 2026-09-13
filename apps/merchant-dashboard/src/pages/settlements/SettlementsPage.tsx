import { useMemo, useRef, useState } from "react";
import { Alert, Button, Label, cn } from "@store-builder/ui";
import { AlertTriangle, Banknote, CalendarClock, Check, FileUp, Info, Scale, Wallet } from "lucide-react";
import type { Settlement, SettlementOrder } from "@/mock/types2";
import { mockApi } from "@/mock/api";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatMoney } from "@/lib/format";
import { useCommon, useLocale, useT, fmt, type Locale, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { KpiCard } from "@/components/KpiCard";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "COD settlements",
    description: "The cash carriers collected for you — what's due, what arrived, and what doesn't add up.",
    kpiExpected: "Expected",
    kpiExpectedHint: "Net payouts not yet received",
    kpiReceived: "Received this month",
    kpiReceivedHint: "Net after carrier & COD fees",
    kpiDisc: "Discrepancies",
    kpiDiscShort: "{amount} short",
    kpiDiscNone: "All payouts match",
    kpiDelay: "Avg. payout delay",
    kpiDelayValue: "{n} days",
    kpiDelayHint: "From delivery to cash in your account",
    info: "Carriers collect cash from customers and pay you weekly minus fees. ZIMOS matches each payout against your delivered orders so nothing goes missing.",
    carrier: "Carrier",
    allCarriers: "All carriers",
    empty: "No settlements match these filters.",
    colReference: "Reference",
    colPeriod: "Period",
    colOrders: "Orders",
    colCollected: "Collected",
    colCarrierFees: "Carrier fees",
    colCodFees: "COD fees",
    colNet: "Net",
    colReceived: "Received",
    markReceived: "Mark received",
    reconcile: "Reconcile",
    upload: "Upload carrier statement",
    receivedToast: "{ref} marked as received.",
    reconciledToast: "{ref} reconciled.",
    uploadedToast: "“{file}” uploaded for {ref} — matching against delivered orders.",
    reconcileTitle: "Reconcile {ref}",
    reconcileDesc: "Order-by-order comparison between what you shipped and what the carrier reported.",
    disputeToast: "Dispute raised with {carrier} for {ref}.",
    colOrder: "Order",
    colCustomer: "Customer",
    colOurCod: "Our COD",
    colCarrierStatus: "Carrier status",
    colCarrierReported: "Carrier reported",
    colDiff: "Diff",
    colMatch: "Match",
    matchedOf: "{matched} of {total}",
    matchedTotalDiff: "matched · total diff",
    matched: "Matched",
    notMatched: "Not matched",
    raiseDispute: "Raise dispute",
    accept: "Accept & mark reconciled",
  },
  ar: {
    title: "تسويات الدفع عند الاستلام",
    description: "النقدية التي حصّلتها شركات الشحن لصالحك — ما هو مستحق، وما وصل، وما لا يتطابق.",
    kpiExpected: "متوقعة",
    kpiExpectedHint: "صافي مدفوعات لم تُستلم بعد",
    kpiReceived: "المستلم هذا الشهر",
    kpiReceivedHint: "الصافي بعد رسوم الشحن والتحصيل",
    kpiDisc: "فروقات",
    kpiDiscShort: "عجز {amount}",
    kpiDiscNone: "كل المدفوعات متطابقة",
    kpiDelay: "متوسط مدة التحويل",
    kpiDelayValue: "{n} أيام",
    kpiDelayHint: "من التسليم حتى وصول النقدية إلى حسابك",
    info: "تحصّل شركات الشحن النقدية من العملاء وتحوّلها لك أسبوعيًا بعد خصم الرسوم. يطابق ZIMOS كل دفعة مع طلباتك المسلَّمة حتى لا يضيع شيء.",
    carrier: "شركة الشحن",
    allCarriers: "كل شركات الشحن",
    empty: "لا توجد تسويات تطابق هذه الفلاتر.",
    colReference: "المرجع",
    colPeriod: "الفترة",
    colOrders: "الطلبات",
    colCollected: "المُحصَّل",
    colCarrierFees: "رسوم الشحن",
    colCodFees: "رسوم التحصيل",
    colNet: "الصافي",
    colReceived: "تاريخ الاستلام",
    markReceived: "تحديد كمستلمة",
    reconcile: "مطابقة",
    upload: "رفع كشف حساب شركة الشحن",
    receivedToast: "تم تحديد {ref} كمستلمة.",
    reconciledToast: "تمت مطابقة {ref}.",
    uploadedToast: "تم رفع «{file}» للتسوية {ref} — جارٍ المطابقة مع الطلبات المسلَّمة.",
    reconcileTitle: "مطابقة {ref}",
    reconcileDesc: "مقارنة طلبًا بطلب بين ما شحنته وما أبلغت عنه شركة الشحن.",
    disputeToast: "تم فتح اعتراض مع {carrier} على {ref}.",
    colOrder: "الطلب",
    colCustomer: "العميل",
    colOurCod: "مبلغ التحصيل لدينا",
    colCarrierStatus: "حالة الشحنة",
    colCarrierReported: "المبلغ المُبلَّغ عنه",
    colDiff: "الفرق",
    colMatch: "التطابق",
    matchedOf: "{matched} من {total}",
    matchedTotalDiff: "متطابقة · إجمالي الفرق",
    matched: "متطابق",
    notMatched: "غير متطابق",
    raiseDispute: "فتح اعتراض",
    accept: "قبول وتحديد كمُطابقة",
  },
} satisfies Messages;

const STATUS_LABEL: Record<Locale, Record<Settlement["status"], string>> = {
  en: { expected: "Expected", received: "Received", discrepancy: "Discrepancy", reconciled: "Reconciled" },
  ar: { expected: "متوقعة", received: "مستلمة", discrepancy: "بها فروقات", reconciled: "تمت المطابقة" },
};

const CARRIER_STATUS_LABEL: Record<Locale, Record<SettlementOrder["carrierStatus"], string>> = {
  en: { delivered: "Delivered", returned: "Returned", lost: "Lost" },
  ar: { delivered: "تم التسليم", returned: "مرتجع", lost: "مفقود" },
};

const STATUS_TONE: Record<Settlement["status"], "info" | "success" | "danger" | "neutral"> = {
  expected: "info",
  received: "success",
  discrepancy: "danger",
  reconciled: "neutral",
};

const CARRIER_TONE: Record<string, string> = {
  bosta: "bg-danger-soft text-danger",
  jnt: "bg-danger-soft text-danger",
};

const AVG_PAYOUT_DELAY_DAYS = 6;

const th = "px-4 py-3 font-medium text-start";
const thNum = "px-4 py-3 font-medium text-end";

function CarrierChip({ carrierKey, name }: { carrierKey: string; name: string }) {
  return <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium", CARRIER_TONE[carrierKey] ?? "bg-primary-soft text-primary-dark")}>{name}</span>;
}

export function SettlementsPage() {
  const t = useT(STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const list = useAsync(() => mockApi.listSettlements(workspaceId), [workspaceId]);

  const [carrier, setCarrier] = useState<string>("all");
  const [status, setStatus] = useState<"all" | Settlement["status"]>("all");
  const [reconciling, setReconciling] = useState<Settlement | null>(null);
  const [uploadTarget, setUploadTarget] = useState<Settlement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const settlements = list.data ?? [];
  const carriers = useMemo(() => Array.from(new Map(settlements.map((s) => [s.carrierKey, s.carrierName])).entries()), [settlements]);

  const kpis = useMemo(() => {
    const now = new Date();
    const expected = settlements.filter((s) => s.status === "expected").reduce((a, s) => a + s.netAmount, 0);
    const receivedMonth = settlements
      .filter((s) => s.receivedAt && new Date(s.receivedAt).getMonth() === now.getMonth() && new Date(s.receivedAt).getFullYear() === now.getFullYear())
      .reduce((a, s) => a + s.netAmount, 0);
    const disc = settlements.filter((s) => s.status === "discrepancy");
    return { expected, receivedMonth, discCount: disc.length, discAmount: disc.reduce((a, s) => a + Math.abs(s.discrepancyAmount), 0) };
  }, [settlements]);

  const rows = settlements.filter((s) => (carrier === "all" || s.carrierKey === carrier) && (status === "all" || s.status === status));

  async function setSt(s: Settlement, next: Settlement["status"]) {
    list.setData((prev) => (prev ?? []).map((x) => (x.id === s.id ? { ...x, status: next, receivedAt: x.receivedAt ?? new Date().toISOString() } : x)));
    try {
      await mockApi.setSettlementStatus(workspaceId, s.id, next);
      toast.success(next === "received" ? fmt(t.receivedToast, { ref: s.reference }) : fmt(t.reconciledToast, { ref: s.reference }));
    } catch (err) {
      toast.error(getErrorMessage(err));
      list.refresh({ silent: true });
    }
  }

  function pickFile(s: Settlement) {
    setUploadTarget(s);
    requestAnimationFrame(() => fileRef.current?.click());
  }

  function onFile(files: FileList | null) {
    const f = files?.[0];
    if (f && uploadTarget) toast.success(fmt(t.uploadedToast, { file: f.name, ref: uploadTarget.reference }));
    if (fileRef.current) fileRef.current.value = "";
    setUploadTarget(null);
  }

  return (
    <div className="min-w-0 max-w-6xl">
      <PageHeader title={t.title} description={t.description} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label={t.kpiExpected} value={<bdi>{formatMoney(kpis.expected)}</bdi>} hint={t.kpiExpectedHint} icon={<Wallet />} />
        <KpiCard label={t.kpiReceived} value={<bdi>{formatMoney(kpis.receivedMonth)}</bdi>} hint={t.kpiReceivedHint} icon={<Banknote />} />
        <KpiCard
          label={t.kpiDisc}
          value={<bdi>{kpis.discCount}</bdi>}
          hint={kpis.discCount ? fmt(t.kpiDiscShort, { amount: formatMoney(kpis.discAmount) }) : t.kpiDiscNone}
          icon={<AlertTriangle />}
        />
        <KpiCard label={t.kpiDelay} value={fmt(t.kpiDelayValue, { n: AVG_PAYOUT_DELAY_DAYS })} hint={t.kpiDelayHint} icon={<CalendarClock />} />
      </div>

      <Alert variant="info" className="mb-6 border-primary/30 bg-primary-soft/40">
        <Info />
        <p className="text-sm text-ink-soft">{t.info}</p>
      </Alert>

      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-ink-soft">{t.carrier}</Label>
          <Select value={carrier} onChange={(e) => setCarrier(e.target.value)} className="h-8 w-40 py-1">
            <option value="all">{t.allCarriers}</option>
            {carriers.map(([k, n]) => (
              <option key={k} value={k}>
                {n}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-xs text-ink-soft">{c.status}</Label>
          <Select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className="h-8 w-40 py-1">
            <option value="all">{c.all}</option>
            <option value="expected">{STATUS_LABEL[locale].expected}</option>
            <option value="received">{STATUS_LABEL[locale].received}</option>
            <option value="discrepancy">{STATUS_LABEL[locale].discrepancy}</option>
            <option value="reconciled">{STATUS_LABEL[locale].reconciled}</option>
          </Select>
        </div>
      </div>

      <input ref={fileRef} type="file" accept=".csv,.xlsx,.pdf" className="hidden" onChange={(e) => onFile(e.target.files)} />

      <DataState loading={list.loading} error={list.error} empty={rows.length === 0} emptyMessage={t.empty} onRetry={() => list.refresh()}>
        <div className="max-h-[70vh] overflow-auto rounded-2xl border border-line bg-paper-raised">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="sticky top-0 z-10 bg-paper-raised">
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                <th className={th}>{t.carrier}</th>
                <th className={th}>{t.colReference}</th>
                <th className={th}>{t.colPeriod}</th>
                <th className={thNum}>{t.colOrders}</th>
                <th className={thNum}>{t.colCollected}</th>
                <th className={thNum}>{t.colCarrierFees}</th>
                <th className={thNum}>{t.colCodFees}</th>
                <th className={thNum}>{t.colNet}</th>
                <th className={th}>{c.status}</th>
                <th className={th}>{t.colReceived}</th>
                <th className={th}>
                  <span className="sr-only">{c.actions}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id} className="border-b border-line bg-paper last:border-0 hover:bg-paper-raised">
                  <td className="px-4 py-3 text-start">
                    <CarrierChip carrierKey={s.carrierKey} name={s.carrierName} />
                  </td>
                  <td className="px-4 py-3 text-start font-mono text-xs text-ink">
                    <span dir="ltr">{s.reference}</span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-start text-xs text-ink-soft">
                    <bdi>{formatDate(s.periodFrom)}</bdi> <span className="inline-block rtl:rotate-180">→</span> <bdi>{formatDate(s.periodTo)}</bdi>
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums text-ink">{s.ordersCount}</td>
                  <td className="px-4 py-3 text-end tabular-nums text-ink">
                    <bdi>{formatMoney(s.collectedAmount)}</bdi>
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums text-danger">
                    <bdi>−{formatMoney(s.carrierFeesAmount)}</bdi>
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums text-danger">
                    <bdi>−{formatMoney(s.codFeesAmount)}</bdi>
                  </td>
                  <td className="px-4 py-3 text-end font-medium tabular-nums text-ink">
                    <bdi>{formatMoney(s.netAmount)}</bdi>
                    {s.discrepancyAmount !== 0 && (
                      <span className="block text-[11px] font-normal text-danger">
                        <bdi>{formatMoney(s.discrepancyAmount)}</bdi>
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-start">
                    <StatusBadge value={s.status} tone={STATUS_TONE[s.status]} label={STATUS_LABEL[locale][s.status]} />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-start text-xs text-ink-soft">{s.receivedAt ? <bdi>{formatDate(s.receivedAt)}</bdi> : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-end">
                    {s.status === "expected" && (
                      <Button size="sm" variant="ghost" className="text-success" onClick={() => setSt(s, "received")}>
                        <Check /> {t.markReceived}
                      </Button>
                    )}
                    {(s.status === "received" || s.status === "discrepancy") && (
                      <Button size="sm" variant="ghost" onClick={() => setReconciling(s)}>
                        <Scale /> {t.reconcile}
                      </Button>
                    )}
                    <Button size="icon-sm" variant="ghost" aria-label={t.upload} title={t.upload} onClick={() => pickFile(s)}>
                      <FileUp />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>

      <Modal
        open={reconciling !== null}
        onClose={() => setReconciling(null)}
        title={reconciling ? fmt(t.reconcileTitle, { ref: reconciling.reference }) : t.reconcile}
        description={t.reconcileDesc}
        className="max-w-3xl"
      >
        {reconciling && (
          <ReconcilePanel
            key={reconciling.id}
            settlement={reconciling}
            onAccept={async () => {
              await setSt(reconciling, "reconciled");
              setReconciling(null);
            }}
            onDispute={() => {
              toast.success(fmt(t.disputeToast, { carrier: reconciling.carrierName, ref: reconciling.reference }));
              setReconciling(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
}

function ReconcilePanel({ settlement, onAccept, onDispute }: { settlement: Settlement; onAccept: () => Promise<void>; onDispute: () => void }) {
  const t = useT(STRINGS);
  const c = useCommon();
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const orders = useAsync(() => mockApi.getSettlementOrders(workspaceId, settlement.id), [workspaceId, settlement.id]);
  const [busy, setBusy] = useState(false);
  const rows: SettlementOrder[] = orders.data ?? [];
  const matched = rows.filter((r) => r.matched).length;
  const totalDiff = rows.reduce((a, r) => a + ((r.carrierReportedAmount ?? 0) - (r.carrierStatus === "delivered" ? r.codAmount : 0)), 0);

  return (
    <DataState loading={orders.loading} error={orders.error} onRetry={() => orders.refresh()}>
      <div className="max-h-[50vh] overflow-auto rounded-2xl border border-line bg-paper-raised">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="sticky top-0 z-10 bg-paper-raised">
            <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
              <th className="px-3 py-2 text-start font-medium">{t.colOrder}</th>
              <th className="px-3 py-2 text-start font-medium">{t.colCustomer}</th>
              <th className="px-3 py-2 text-end font-medium">{t.colOurCod}</th>
              <th className="px-3 py-2 text-start font-medium">{t.colCarrierStatus}</th>
              <th className="px-3 py-2 text-end font-medium">{t.colCarrierReported}</th>
              <th className="px-3 py-2 text-end font-medium">{t.colDiff}</th>
              <th className="px-3 py-2 text-center font-medium">{t.colMatch}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const expected = r.carrierStatus === "delivered" ? r.codAmount : 0;
              const diff = (r.carrierReportedAmount ?? 0) - expected;
              return (
                <tr key={r.orderNumber} className={cn("border-b border-line last:border-0", r.matched ? "bg-paper" : "bg-danger-soft/40")}>
                  <td className="px-3 py-2 text-start font-mono text-xs text-ink">
                    <span dir="ltr">{r.orderNumber}</span>
                  </td>
                  <td className="px-3 py-2 text-start text-ink" dir="auto">
                    {r.customerName}
                  </td>
                  <td className="px-3 py-2 text-end tabular-nums text-ink">
                    <bdi>{formatMoney(r.codAmount)}</bdi>
                  </td>
                  <td className="px-3 py-2 text-start">
                    <StatusBadge
                      value={r.carrierStatus}
                      tone={r.carrierStatus === "delivered" ? "success" : r.carrierStatus === "returned" ? "warning" : "danger"}
                      label={CARRIER_STATUS_LABEL[locale][r.carrierStatus]}
                    />
                  </td>
                  <td className="px-3 py-2 text-end tabular-nums text-ink">{r.carrierReportedAmount === null ? "—" : <bdi>{formatMoney(r.carrierReportedAmount)}</bdi>}</td>
                  <td className={cn("px-3 py-2 text-end tabular-nums", diff === 0 ? "text-ink-soft" : diff < 0 ? "text-danger" : "text-success")}>
                    {diff === 0 ? "0" : <bdi>{formatMoney(diff)}</bdi>}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {r.matched ? (
                      <Check className="mx-auto size-4 text-success" aria-label={t.matched} />
                    ) : (
                      <AlertTriangle className="mx-auto size-4 text-danger" aria-label={t.notMatched} />
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <p className="min-w-0 text-sm text-ink-soft">
          <span className="font-medium tabular-nums text-ink">{fmt(t.matchedOf, { matched, total: rows.length })}</span> {t.matchedTotalDiff}{" "}
          <span className={cn("font-medium tabular-nums", totalDiff === 0 ? "text-success" : "text-danger")}>
            <bdi>{formatMoney(totalDiff)}</bdi>
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="text-danger" onClick={onDispute} disabled={busy}>
            {t.raiseDispute}
          </Button>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onAccept();
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? c.saving : t.accept}
          </Button>
        </div>
      </div>
    </DataState>
  );
}
