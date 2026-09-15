import { useMemo, useState } from "react";
import { Banknote, FileText, Receipt, Truck, Wallet } from "lucide-react";
import { Button, Input, useAsync } from "@store-builder/ui";
import { ApiError, type SettlementLinePayload, type UnsettledOrder } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { formatDate, formatMoney, majorToMinor, minorToMajorInput } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { KpiCard } from "@/components/KpiCard";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "COD settlements",
    description: "Match the cash couriers collected on delivered orders with what they actually transferred to you.",
    kpiUnsettled: "Unsettled orders",
    kpiDue: "Due from couriers",
    kpiReceived: "Received",
    kpiFees: "Courier fees",
    kpiDrafts: "Draft settlements",
    unsettledTitle: "Delivered, not settled yet",
    unsettledDesc: "Pick the orders a courier paid you for, adjust the amounts, then save a draft.",
    noUnsettled: "No unsettled COD orders",
    noUnsettledDesc: "Delivered cash-on-delivery orders with money still due will show up here.",
    carrierOrders: "{n} orders · {due} due",
    selectAll: "Select all",
    selectOrder: "Select order {number}",
    colOrder: "Order",
    colCustomer: "Customer",
    colWaybill: "Waybill",
    colDelivered: "Delivered",
    colDue: "Due",
    colCollected: "Collected",
    colFee: "Courier fee",
    feePerOrder: "Fee per order",
    applyFee: "Apply to selected",
    selectedCount: "{n} selected",
    createDraft: "Create draft settlement",
    creating: "Saving…",
    draftCreated: "Draft settlement saved",
    invalidAmount: "Enter a valid amount for order {number}.",
    exceedsDue: "Collected for order {number} is more than what's due.",
    settlementsTitle: "Settlements",
    noSettlements: "No settlements yet",
    noSettlementsDesc: "Draft settlements you create from the orders above will be listed here.",
    colDate: "Created",
    colCarrier: "Courier",
    colReference: "Reference",
    colStatus: "Status",
    colFees: "Fees",
    colNet: "Net",
    view: "View",
    detailTitle: "Settlement · {carrier}",
    notes: "Notes",
    period: "Period",
    confirmedAt: "Confirmed on {date}",
    confirm: "Confirm settlement",
    delete: "Delete draft",
    close: "Close",
    confirmTitle: "Confirm this settlement?",
    confirmDesc: "This records the collected amount as a payment on every order in it and marks them paid. A confirmed settlement can't be edited or deleted.",
    confirmed: "Settlement confirmed",
    deleteTitle: "Delete this draft?",
    deleteDesc: "The orders go back to the unsettled list. Nothing is recorded on them.",
    deleted: "Draft deleted",
    errNotSettleable: "One of the orders can't be settled anymore — refresh and try again.",
    errExceeds: "A collected amount is more than what's due on its order.",
    errConfirmed: "This settlement is already confirmed and can't be changed.",
    errEmpty: "This settlement has no orders.",
  },
  ar: {
    title: "تحصيل الشحن",
    description: "طابق الفلوس اللي شركات الشحن حصّلتها من الطلبات المتسلّمة مع اللي حوّلوهولك فعلاً.",
    kpiUnsettled: "طلبات لسه متسوّتش",
    kpiDue: "مستحق عند شركات الشحن",
    kpiReceived: "اللي وصلك",
    kpiFees: "مصاريف الشحن",
    kpiDrafts: "تسويات مسودة",
    unsettledTitle: "اتسلّمت ولسه متسوّتش",
    unsettledDesc: "اختار الطلبات اللي شركة الشحن دفعتلك تمنها، عدّل المبالغ، وبعدين احفظ مسودة.",
    noUnsettled: "مفيش طلبات دفع عند الاستلام محتاجة تسوية",
    noUnsettledDesc: "الطلبات اللي اتسلّمت ولسه ليك فلوس فيها هتظهر هنا.",
    carrierOrders: "{n} طلب · {due} مستحق",
    selectAll: "اختار الكل",
    selectOrder: "اختار الطلب {number}",
    colOrder: "الطلب",
    colCustomer: "العميل",
    colWaybill: "رقم البوليصة",
    colDelivered: "اتسلّم",
    colDue: "المستحق",
    colCollected: "المحصّل",
    colFee: "مصاريف الشحن",
    feePerOrder: "المصاريف لكل طلب",
    applyFee: "طبّق على المختار",
    selectedCount: "{n} مختار",
    createDraft: "اعمل مسودة تسوية",
    creating: "بنحفظ…",
    draftCreated: "اتحفظت مسودة التسوية",
    invalidAmount: "اكتب مبلغ صحيح للطلب {number}.",
    exceedsDue: "المحصّل للطلب {number} أكتر من المستحق.",
    settlementsTitle: "التسويات",
    noSettlements: "مفيش تسويات لسه",
    noSettlementsDesc: "المسودات اللي هتعملها من الطلبات اللي فوق هتظهر هنا.",
    colDate: "اتعملت",
    colCarrier: "شركة الشحن",
    colReference: "المرجع",
    colStatus: "الحالة",
    colFees: "المصاريف",
    colNet: "الصافي",
    view: "عرض",
    detailTitle: "تسوية · {carrier}",
    notes: "ملاحظات",
    period: "الفترة",
    confirmedAt: "اتأكدت يوم {date}",
    confirm: "أكّد التسوية",
    delete: "امسح المسودة",
    close: "قفل",
    confirmTitle: "تأكيد التسوية دي؟",
    confirmDesc: "ده هيسجّل المبلغ المحصّل كدفعة على كل طلب فيها ويعلّمهم مدفوعين. التسوية المتأكدة مينفعش تتعدّل أو تتمسح.",
    confirmed: "التسوية اتأكدت",
    deleteTitle: "مسح المسودة دي؟",
    deleteDesc: "الطلبات هترجع لقايمة اللي لسه متسوّتش ومش هيتسجّل عليها حاجة.",
    deleted: "المسودة اتمسحت",
    errNotSettleable: "طلب من الطلبات مبقاش ينفع يتسوّى — اعمل تحديث وجرّب تاني.",
    errExceeds: "فيه مبلغ محصّل أكتر من المستحق على الطلب بتاعه.",
    errConfirmed: "التسوية دي متأكدة خلاص ومينفعش تتغيّر.",
    errEmpty: "التسوية دي مفيهاش طلبات.",
  },
} satisfies Messages;

interface RowDraft {
  checked: boolean;
  collected: string;
  fee: string;
}

export function SettlementsPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();

  const summary = useAsync(() => apiClient.getSettlementSummary(workspaceId), [workspaceId]);
  const unsettled = useAsync(() => apiClient.listUnsettledOrders(workspaceId), [workspaceId]);
  const settlements = useAsync(() => apiClient.listSettlements(workspaceId, { limit: 50 }), [workspaceId]);

  const [rows, setRows] = useState<Record<string, RowDraft>>({});
  const [feeByCarrier, setFeeByCarrier] = useState<Record<string, string>>({});
  const [creating, setCreating] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pending, setPending] = useState<"confirm" | "delete" | null>(null);

  const detail = useAsync(() => (openId ? apiClient.getSettlement(workspaceId, openId) : Promise.resolve(null)), [workspaceId, openId]);

  const orders = unsettled.data?.orders ?? [];
  const carriers = unsettled.data?.carriers ?? [];
  const byCarrier = useMemo(() => {
    const map: Record<string, UnsettledOrder[]> = {};
    for (const o of orders) (map[o.carrierCode] ??= []).push(o);
    return map;
  }, [orders]);
  const currency = orders[0]?.currency ?? "EGP";
  const money = (v: number | null | undefined, cur = currency) => <bdi dir="ltr">{formatMoney(v ?? 0, cur)}</bdi>;

  const rowOf = (o: UnsettledOrder): RowDraft => rows[o.orderId] ?? { checked: false, collected: minorToMajorInput(o.dueAmount), fee: "" };
  const patchRow = (o: UnsettledOrder, patch: Partial<RowDraft>) => setRows((prev) => ({ ...prev, [o.orderId]: { ...rowOf(o), ...patch } }));

  function errorText(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.code === "ORDER_NOT_SETTLEABLE") return t.errNotSettleable;
      if (err.code === "COLLECTED_EXCEEDS_DUE") return t.errExceeds;
      if (err.code === "SETTLEMENT_CONFIRMED") return t.errConfirmed;
      if (err.code === "SETTLEMENT_EMPTY") return t.errEmpty;
    }
    return getErrorMessage(err);
  }

  function refreshAll() {
    summary.refresh();
    unsettled.refresh();
    settlements.refresh();
  }

  function applyFee(carrier: string) {
    const fee = feeByCarrier[carrier] ?? "";
    setRows((prev) => {
      const next = { ...prev };
      for (const o of byCarrier[carrier] ?? []) {
        const r = prev[o.orderId] ?? { checked: false, collected: minorToMajorInput(o.dueAmount), fee: "" };
        if (r.checked) next[o.orderId] = { ...r, fee };
      }
      return next;
    });
  }

  async function createDraft(carrier: string) {
    const picked = (byCarrier[carrier] ?? []).filter((o) => rowOf(o).checked);
    const lines: SettlementLinePayload[] = [];
    for (const o of picked) {
      const r = rowOf(o);
      const collected = majorToMinor(r.collected);
      const fee = r.fee.trim() === "" ? 0 : majorToMinor(r.fee);
      if (!Number.isFinite(collected) || collected < 0 || !Number.isFinite(fee) || fee < 0) {
        toast.error(fmt(t.invalidAmount, { number: o.orderNumber }));
        return;
      }
      if (collected > o.dueAmount) {
        toast.error(fmt(t.exceedsDue, { number: o.orderNumber }));
        return;
      }
      lines.push({ orderId: o.orderId, collectedAmount: collected, feeAmount: fee });
    }
    if (lines.length === 0) return;
    setCreating(carrier);
    try {
      const created = await apiClient.createSettlement(workspaceId, { carrierCode: carrier, lines });
      toast.success(t.draftCreated);
      setRows((prev) => {
        const next = { ...prev };
        for (const l of lines) delete next[l.orderId];
        return next;
      });
      refreshAll();
      setOpenId(created.id);
    } catch (err) {
      toast.error(errorText(err));
    } finally {
      setCreating(null);
    }
  }

  const s = summary.data;
  const list = settlements.data?.settlements ?? [];
  const d = detail.data;

  return (
    <div className="min-w-0 max-w-6xl">
      <PageHeader title={t.title} description={t.description} />

      {s && (
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <KpiCard label={t.kpiUnsettled} value={s.unsettledOrders} icon={<Truck />} />
          <KpiCard label={t.kpiDue} value={money(s.dueFromCouriers)} icon={<Wallet />} />
          <KpiCard label={t.kpiReceived} value={money(s.received)} icon={<Banknote />} />
          <KpiCard label={t.kpiFees} value={money(s.courierFees)} icon={<Receipt />} />
          <KpiCard label={t.kpiDrafts} value={s.draftSettlements} icon={<FileText />} />
        </div>
      )}

      <section className="mb-8">
        <h2 className="font-display text-lg font-semibold text-ink">{t.unsettledTitle}</h2>
        <p className="mb-3 text-sm text-ink-soft">{t.unsettledDesc}</p>
        <DataState loading={unsettled.loading && !unsettled.data} error={unsettled.error} onRetry={() => unsettled.refresh()}>
          {carriers.length === 0 ? (
            <EmptyState icon={<Truck />} title={t.noUnsettled} description={t.noUnsettledDesc} />
          ) : (
            <div className="space-y-4">
              {carriers.map((c) => {
                const group = byCarrier[c.carrierCode] ?? [];
                const selected = group.filter((o) => rowOf(o).checked);
                const allChecked = group.length > 0 && selected.length === group.length;
                return (
                  <div key={c.carrierCode} className="rounded-2xl border border-line bg-paper-raised">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
                      <div>
                        <p className="font-semibold text-ink" dir="auto">
                          {c.carrierCode}
                        </p>
                        <p className="text-xs text-ink-soft">
                          {fmt(t.carrierOrders, { n: c.orders, due: formatMoney(c.dueAmount, currency) })}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Input
                          inputMode="decimal"
                          placeholder="0.00"
                          value={feeByCarrier[c.carrierCode] ?? ""}
                          onChange={(e) => setFeeByCarrier((prev) => ({ ...prev, [c.carrierCode]: e.target.value }))}
                          aria-label={`${t.feePerOrder} (${c.carrierCode})`}
                          className="h-9 w-28 tabular"
                        />
                        <Button size="sm" variant="outline" disabled={selected.length === 0} onClick={() => applyFee(c.carrierCode)}>
                          {t.applyFee}
                        </Button>
                        <span className="text-xs text-ink-soft">{fmt(t.selectedCount, { n: selected.length })}</span>
                        <Button size="sm" disabled={selected.length === 0 || creating !== null} onClick={() => createDraft(c.carrierCode)}>
                          {creating === c.carrierCode ? t.creating : t.createDraft}
                        </Button>
                      </div>
                    </div>
                    <div className="min-w-0 overflow-x-auto">
                      <table className="w-full min-w-[820px] text-sm">
                        <thead>
                          <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                            <th className="px-4 py-2 text-start font-medium">
                              <input
                                type="checkbox"
                                className="size-4 accent-primary"
                                checked={allChecked}
                                aria-label={`${t.selectAll} (${c.carrierCode})`}
                                onChange={(e) =>
                                  setRows((prev) => {
                                    const next = { ...prev };
                                    for (const o of group) next[o.orderId] = { ...rowOf(o), checked: e.target.checked };
                                    return next;
                                  })
                                }
                              />
                            </th>
                            <th className="px-4 py-2 text-start font-medium">{t.colOrder}</th>
                            <th className="px-4 py-2 text-start font-medium">{t.colCustomer}</th>
                            <th className="px-4 py-2 text-start font-medium">{t.colWaybill}</th>
                            <th className="px-4 py-2 text-start font-medium">{t.colDelivered}</th>
                            <th className="px-4 py-2 text-end font-medium">{t.colDue}</th>
                            <th className="px-4 py-2 text-end font-medium">{t.colCollected}</th>
                            <th className="px-4 py-2 text-end font-medium">{t.colFee}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.map((o) => {
                            const r = rowOf(o);
                            return (
                              <tr key={o.orderId} className="border-b border-line last:border-0">
                                <td className="px-4 py-2 text-start">
                                  <input
                                    type="checkbox"
                                    className="size-4 accent-primary"
                                    checked={r.checked}
                                    aria-label={fmt(t.selectOrder, { number: o.orderNumber })}
                                    onChange={(e) => patchRow(o, { checked: e.target.checked })}
                                  />
                                </td>
                                <td className="px-4 py-2 text-start font-medium text-ink" dir="ltr">
                                  <bdi>{o.orderNumber}</bdi>
                                </td>
                                <td className="px-4 py-2 text-start text-ink" dir="auto">
                                  {o.customerName ?? "—"}
                                </td>
                                <td className="px-4 py-2 text-start text-ink-soft">
                                  <bdi dir="ltr">{o.waybillNumber ?? "—"}</bdi>
                                </td>
                                <td className="px-4 py-2 text-start text-ink-soft">{formatDate(o.deliveredAt)}</td>
                                <td className="px-4 py-2 text-end tabular text-ink">{money(o.dueAmount, o.currency)}</td>
                                <td className="px-4 py-2 text-end">
                                  <Input
                                    inputMode="decimal"
                                    value={r.collected}
                                    onChange={(e) => patchRow(o, { collected: e.target.value })}
                                    aria-label={`${t.colCollected} ${o.orderNumber}`}
                                    className="ms-auto h-8 w-28 tabular"
                                  />
                                </td>
                                <td className="px-4 py-2 text-end">
                                  <Input
                                    inputMode="decimal"
                                    placeholder="0.00"
                                    value={r.fee}
                                    onChange={(e) => patchRow(o, { fee: e.target.value })}
                                    aria-label={`${t.colFee} ${o.orderNumber}`}
                                    className="ms-auto h-8 w-24 tabular"
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DataState>
      </section>

      <section>
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">{t.settlementsTitle}</h2>
        <DataState loading={settlements.loading && !settlements.data} error={settlements.error} onRetry={() => settlements.refresh()}>
          {list.length === 0 ? (
            <EmptyState icon={<FileText />} title={t.noSettlements} description={t.noSettlementsDesc} />
          ) : (
            <div className="min-w-0 overflow-x-auto rounded-2xl border border-line bg-paper-raised">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                    <th className="px-4 py-3 text-start font-medium">{t.colDate}</th>
                    <th className="px-4 py-3 text-start font-medium">{t.colCarrier}</th>
                    <th className="px-4 py-3 text-start font-medium">{t.colReference}</th>
                    <th className="px-4 py-3 text-start font-medium">{t.colStatus}</th>
                    <th className="px-4 py-3 text-end font-medium">{t.colCollected}</th>
                    <th className="px-4 py-3 text-end font-medium">{t.colFees}</th>
                    <th className="px-4 py-3 text-end font-medium">{t.colNet}</th>
                    <th className="px-4 py-3 text-end font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((row) => (
                    <tr key={row.id} className="border-b border-line last:border-0 hover:bg-paper">
                      <td className="px-4 py-3 text-start text-ink-soft">{formatDate(row.createdAt)}</td>
                      <td className="px-4 py-3 text-start text-ink" dir="auto">
                        {row.carrierCode}
                      </td>
                      <td className="px-4 py-3 text-start text-ink-soft" dir="auto">
                        {row.reference || "—"}
                      </td>
                      <td className="px-4 py-3 text-start">
                        <StatusBadge value={row.status} />
                      </td>
                      <td className="px-4 py-3 text-end tabular text-ink">{money(row.collectedAmount, row.currency ?? currency)}</td>
                      <td className="px-4 py-3 text-end tabular text-ink">{money(row.feesAmount, row.currency ?? currency)}</td>
                      <td className="px-4 py-3 text-end tabular font-medium text-ink">{money(row.netAmount, row.currency ?? currency)}</td>
                      <td className="px-4 py-3 text-end">
                        <Button size="sm" variant="outline" onClick={() => setOpenId(row.id)} aria-label={`${t.view} ${row.carrierCode} ${formatDate(row.createdAt)}`}>
                          {t.view}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </DataState>
      </section>

      <Modal
        open={!!openId && pending === null}
        onClose={() => setOpenId(null)}
        title={d ? fmt(t.detailTitle, { carrier: d.carrierCode }) : t.settlementsTitle}
        className="max-w-3xl"
        footer={
          d && (
            <div className="flex flex-wrap justify-end gap-2">
              {d.status === "draft" && (
                <>
                  <Button variant="outline" onClick={() => setPending("delete")}>
                    {t.delete}
                  </Button>
                  <Button onClick={() => setPending("confirm")}>{t.confirm}</Button>
                </>
              )}
              {d.status !== "draft" && (
                <Button variant="outline" onClick={() => setOpenId(null)}>
                  {t.close}
                </Button>
              )}
            </div>
          )
        }
      >
        <DataState loading={detail.loading && !d} error={detail.error} onRetry={() => detail.refresh()}>
          {d && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <StatusBadge value={d.status} />
                {d.reference && (
                  <span className="text-ink-soft" dir="auto">
                    {d.reference}
                  </span>
                )}
                {(d.periodStart || d.periodEnd) && (
                  <span className="text-ink-soft">
                    {t.period}: {formatDate(d.periodStart)} – {formatDate(d.periodEnd)}
                  </span>
                )}
                {d.confirmedAt && <span className="text-ink-soft">{fmt(t.confirmedAt, { date: formatDate(d.confirmedAt) })}</span>}
              </div>
              <div className="grid grid-cols-3 gap-3 text-sm">
                <div className="rounded-xl border border-line p-3">
                  <p className="text-ink-soft">{t.colCollected}</p>
                  <p className="tabular font-semibold text-ink">{money(d.collectedAmount, d.currency ?? currency)}</p>
                </div>
                <div className="rounded-xl border border-line p-3">
                  <p className="text-ink-soft">{t.colFees}</p>
                  <p className="tabular font-semibold text-ink">{money(d.feesAmount, d.currency ?? currency)}</p>
                </div>
                <div className="rounded-xl border border-line p-3">
                  <p className="text-ink-soft">{t.colNet}</p>
                  <p className="tabular font-semibold text-ink">{money(d.netAmount, d.currency ?? currency)}</p>
                </div>
              </div>
              <div className="min-w-0 overflow-x-auto">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-soft">
                      <th className="px-3 py-2 text-start font-medium">{t.colOrder}</th>
                      <th className="px-3 py-2 text-start font-medium">{t.colCustomer}</th>
                      <th className="px-3 py-2 text-start font-medium">{t.colStatus}</th>
                      <th className="px-3 py-2 text-end font-medium">{t.colDue}</th>
                      <th className="px-3 py-2 text-end font-medium">{t.colCollected}</th>
                      <th className="px-3 py-2 text-end font-medium">{t.colFee}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.lines.map((l) => (
                      <tr key={l.orderId} className="border-b border-line last:border-0">
                        <td className="px-3 py-2 text-start font-medium text-ink">
                          <bdi dir="ltr">{l.orderNumber ?? "—"}</bdi>
                        </td>
                        <td className="px-3 py-2 text-start text-ink" dir="auto">
                          {l.customerName ?? "—"}
                        </td>
                        <td className="px-3 py-2 text-start">{l.financialState ? <StatusBadge value={l.financialState} /> : "—"}</td>
                        <td className="px-3 py-2 text-end tabular text-ink">{l.orderTotal === null ? "—" : money(l.orderTotal, d.currency ?? currency)}</td>
                        <td className="px-3 py-2 text-end tabular text-ink">{money(l.collectedAmount, d.currency ?? currency)}</td>
                        <td className="px-3 py-2 text-end tabular text-ink">{money(l.feeAmount, d.currency ?? currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {d.notes && (
                <p className="text-sm text-ink-soft" dir="auto">
                  <span className="font-medium text-ink">{t.notes}: </span>
                  {d.notes}
                </p>
              )}
            </div>
          )}
        </DataState>
      </Modal>

      <ConfirmDialog
        open={pending === "confirm"}
        title={t.confirmTitle}
        description={t.confirmDesc}
        confirmLabel={t.confirm}
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          if (!openId) return;
          try {
            await apiClient.confirmSettlement(workspaceId, openId);
          } catch (err) {
            throw new Error(errorText(err));
          }
          toast.success(t.confirmed);
          setPending(null);
          detail.refresh();
          refreshAll();
        }}
      />
      <ConfirmDialog
        open={pending === "delete"}
        title={t.deleteTitle}
        description={t.deleteDesc}
        confirmLabel={t.delete}
        destructive
        onCancel={() => setPending(null)}
        onConfirm={async () => {
          if (!openId) return;
          try {
            await apiClient.deleteSettlement(workspaceId, openId);
          } catch (err) {
            throw new Error(errorText(err));
          }
          toast.success(t.deleted);
          setPending(null);
          setOpenId(null);
          refreshAll();
        }}
      />
    </div>
  );
}
