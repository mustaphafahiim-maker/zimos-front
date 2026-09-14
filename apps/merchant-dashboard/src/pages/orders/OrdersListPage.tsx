import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Input, Kbd, Progress, Alert } from "@store-builder/ui";
import { Download, Plus, Printer, Search, Truck, X, XCircle } from "lucide-react";
import type {
  ConfirmationState,
  FinancialState,
  FulfillmentState,
  Order,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCursorList } from "@/lib/useCursorList";
import { getErrorMessage } from "@/lib/errors";
import { formatDate, formatMoney } from "@/lib/format";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { LoadMore } from "@/components/LoadMore";
import { Select } from "@/components/Select";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField } from "@/components/Field";
import { useToast } from "@/components/Toast";
import { useEnumLabel } from "./orderLabels";
import { filterOrders, ordersToCsvRows, toCsv } from "./newOrder";

const STRINGS = {
  en: {
    title: "Orders",
    description: "Every order, with its confirmation, payment, and fulfilment state.",
    newOrder: "New order",
    anyConfirmation: "Any confirmation",
    anyPayment: "Any payment",
    anyFulfilment: "Any fulfilment",
    confirmationFilter: "Filter by confirmation",
    paymentFilter: "Filter by payment",
    fulfilmentFilter: "Filter by fulfilment",
    searchPlaceholder: "Search loaded orders: number, name, phone, city",
    from: "From",
    to: "To",
    clearFilters: "Clear",
    localFilterNote: "Search and dates filter the {n} loaded orders — load more to widen.",
    empty: "No orders match these filters.",
    colOrder: "Order",
    colCustomer: "Customer",
    colTotal: "Total",
    colState: "State",
    colDate: "Date",
    badgeConf: "Conf",
    badgePay: "Pay",
    badgeShip: "Ship",
    selectAll: "Select all orders on this page",
    selectOrder: "Select order {order}",
    selected: "{n} selected",
    clearSelection: "Clear selection",
    bulkCancel: "Cancel",
    bulkShipment: "Create shipment",
    bulkWaybills: "Print waybills",
    bulkExport: "Export CSV",
    working: "{done} of {total}…",
    cancelTitle: "Cancel {n} orders?",
    cancelDescription: "Each order is cancelled one by one and its stock reservation released. Shipped orders will fail and be listed.",
    cancelConfirm: "Cancel orders",
    reason: "Reason",
    reasonPlaceholder: "Customer changed their mind",
    reasonRequired: "Enter a reason for the cancellation.",
    shipmentTitle: "Create shipments for {n} orders",
    shipmentHint: "One shipment per order. A tracking code is generated automatically; waybill number and tracking URL are optional.",
    carrier: "Carrier code",
    carrierPlaceholder: "bosta",
    carrierRequired: "Enter the carrier code.",
    waybillNumber: "Waybill number (optional)",
    trackingUrl: "Tracking URL (optional)",
    create: "Create shipments",
    resultTitle: "{action}: results",
    succeeded: "{n} succeeded",
    failed: "{n} failed",
    close: "Close",
    popupBlocked: "Your browser blocked the print window. Allow pop-ups for this site and try again.",
    waybillsWindowTitle: "Waybills",
    shortcutHint: "Press {key} for a new order",
    csvHeaders: "Order,Created,Customer,Phone,Governorate,City,Address,Items,Total,Currency,Payment method,Confirmation,Payment,Fulfilment,Cancelled",
  },
  ar: {
    title: "الطلبات",
    description: "كل الطلبات مع حالة التأكيد والدفع والشحن لكل طلب.",
    newOrder: "طلب جديد",
    anyConfirmation: "أي حالة تأكيد",
    anyPayment: "أي حالة دفع",
    anyFulfilment: "أي حالة شحن",
    confirmationFilter: "تصفية حسب التأكيد",
    paymentFilter: "تصفية حسب الدفع",
    fulfilmentFilter: "تصفية حسب الشحن",
    searchPlaceholder: "ابحث في الطلبات المحمّلة: الرقم، الاسم، الهاتف، المدينة",
    from: "من",
    to: "إلى",
    clearFilters: "مسح",
    localFilterNote: "البحث والتواريخ تُطبَّق على {n} طلب محمّل — حمّل المزيد لتوسيع النتائج.",
    empty: "لا توجد طلبات تطابق عوامل التصفية هذه.",
    colOrder: "الطلب",
    colCustomer: "العميل",
    colTotal: "الإجمالي",
    colState: "الحالة",
    colDate: "التاريخ",
    badgeConf: "التأكيد",
    badgePay: "الدفع",
    badgeShip: "الشحن",
    selectAll: "تحديد كل الطلبات في هذه الصفحة",
    selectOrder: "تحديد الطلب {order}",
    selected: "{n} محدد",
    clearSelection: "إلغاء التحديد",
    bulkCancel: "إلغاء",
    bulkShipment: "إنشاء شحنة",
    bulkWaybills: "طباعة البوالص",
    bulkExport: "تصدير CSV",
    working: "{done} من {total}…",
    cancelTitle: "إلغاء {n} طلبات؟",
    cancelDescription: "سيتم إلغاء كل طلب على حدة وتحرير المخزون المحجوز. الطلبات المشحونة ستفشل وتظهر في النتائج.",
    cancelConfirm: "إلغاء الطلبات",
    reason: "السبب",
    reasonPlaceholder: "العميل غيّر رأيه",
    reasonRequired: "أدخل سبب الإلغاء.",
    shipmentTitle: "إنشاء شحنات لـ {n} طلبات",
    shipmentHint: "شحنة واحدة لكل طلب. يتم توليد كود التتبع تلقائيًا؛ رقم البوليصة ورابط التتبع اختياريان.",
    carrier: "كود شركة الشحن",
    carrierPlaceholder: "bosta",
    carrierRequired: "أدخل كود شركة الشحن.",
    waybillNumber: "رقم البوليصة (اختياري)",
    trackingUrl: "رابط التتبع (اختياري)",
    create: "إنشاء الشحنات",
    resultTitle: "{action}: النتائج",
    succeeded: "نجح {n}",
    failed: "فشل {n}",
    close: "إغلاق",
    popupBlocked: "المتصفح منع نافذة الطباعة. اسمح بالنوافذ المنبثقة لهذا الموقع وحاول مرة أخرى.",
    waybillsWindowTitle: "بوالص الشحن",
    shortcutHint: "اضغط {key} لطلب جديد",
    csvHeaders: "الطلب,تاريخ الإنشاء,العميل,الهاتف,المحافظة,المدينة,العنوان,المنتجات,الإجمالي,العملة,طريقة الدفع,التأكيد,الدفع,الشحن,ملغي",
  },
} satisfies Messages;

const CONFIRMATION: ConfirmationState[] = ["pending", "confirmed", "rejected", "unreachable", "postponed"];
const FINANCIAL: FinancialState[] = ["pending", "partially_paid", "paid", "failed", "refunded", "partially_refunded"];
const FULFILLMENT: FulfillmentState[] = ["unfulfilled", "partially_fulfilled", "fulfilled", "returned"];

interface BulkResult {
  action: string;
  ok: Order[];
  failed: Array<{ order: Order; reason: string }>;
}

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  return el.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
}

export function OrdersListPage() {
  const t = useT(STRINGS);
  const label = useEnumLabel();
  const workspaceId = useWorkspaceId();
  const navigate = useNavigate();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const [confirmationState, setConfirmationState] = useState<ConfirmationState | "">("");
  const [financialState, setFinancialState] = useState<FinancialState | "">("");
  const [fulfillmentState, setFulfillmentState] = useState<FulfillmentState | "">("");

  const q = params.get("q") ?? "";
  const from = params.get("from") ?? "";
  const to = params.get("to") ?? "";
  const setParam = (key: string, value: string) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true }
    );

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [shipOpen, setShipOpen] = useState(false);
  const [carrier, setCarrier] = useState("");
  const [waybillNumber, setWaybillNumber] = useState("");
  const [trackingUrl, setTrackingUrl] = useState("");
  const [shipError, setShipError] = useState<string | null>(null);

  const list = useCursorList<Order>(
    (cursor) =>
      apiClient
        .listOrders(workspaceId, {
          cursor,
          limit: 50,
          confirmationState: confirmationState || undefined,
          financialState: financialState || undefined,
          fulfillmentState: fulfillmentState || undefined,
        })
        .then((r) => ({ items: r.orders, nextCursor: r.nextCursor })),
    [workspaceId, confirmationState, financialState, fulfillmentState]
  );

  const rows = useMemo(() => filterOrders(list.items, q, from, to), [list.items, q, from, to]);
  const hasLocalFilter = Boolean(q || from || to);
  const selectedOrders = list.items.filter((o) => selected.has(o.id));
  const allOnPageSelected = rows.length > 0 && rows.every((o) => selected.has(o.id));
  const someOnPageSelected = rows.some((o) => selected.has(o.id));
  const busy = progress !== null;

  // Drop selections that are no longer loaded (filters changed).
  useEffect(() => {
    setSelected((prev) => {
      const ids = new Set(list.items.map((o) => o.id));
      const next = new Set([...prev].filter((id) => ids.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [list.items]);

  // "N" opens a new order (ignored while typing or with modifiers).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "n" && e.key !== "N") return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (isTypingTarget(e.target) || document.querySelector('[role="dialog"]')) return;
      e.preventDefault();
      navigate("/orders/new");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) rows.forEach((o) => next.delete(o.id));
      else rows.forEach((o) => next.add(o.id));
      return next;
    });
  }

  /** Run `fn` for each order sequentially, tracking progress and collecting failures. */
  async function runBulk<T>(action: string, orders: Order[], fn: (o: Order) => Promise<T>) {
    const ok: Order[] = [];
    const failed: BulkResult["failed"] = [];
    const outputs: Array<{ order: Order; value: T }> = [];
    setProgress({ done: 0, total: orders.length });
    for (let i = 0; i < orders.length; i++) {
      const order = orders[i];
      try {
        outputs.push({ order, value: await fn(order) });
        ok.push(order);
      } catch (err) {
        failed.push({ order, reason: getErrorMessage(err) });
      }
      setProgress({ done: i + 1, total: orders.length });
    }
    setProgress(null);
    setResult({ action, ok, failed });
    return outputs;
  }

  async function bulkCancel() {
    if (!reason.trim()) throw new Error(t.reasonRequired);
    const orders = selectedOrders;
    setCancelOpen(false);
    await runBulk(t.bulkCancel, orders, (o) => apiClient.cancelOrder(workspaceId, o.id, reason.trim()));
    setReason("");
    setSelected(new Set());
    list.reload();
  }

  async function bulkShipment() {
    if (!carrier.trim()) {
      setShipError(t.carrierRequired);
      return;
    }
    setShipError(null);
    const orders = selectedOrders;
    setShipOpen(false);
    await runBulk(t.bulkShipment, orders, (o) =>
      apiClient.createShipment(workspaceId, o.id, {
        carrierCode: carrier.trim(),
        ...(waybillNumber.trim() ? { waybillNumber: waybillNumber.trim() } : {}),
        ...(trackingUrl.trim() ? { trackingUrl: trackingUrl.trim() } : {}),
      })
    );
    setSelected(new Set());
    list.reload();
  }

  async function bulkWaybills() {
    // Open the window synchronously (inside the click) so pop-up blockers allow it.
    const win = window.open("", "_blank");
    if (!win) {
      toast.error(t.popupBlocked);
      return;
    }
    win.document.title = t.waybillsWindowTitle;
    win.document.body.style.cssText = "margin:0;font-family:system-ui;background:#eef1f6";
    win.document.body.textContent = "…";
    const outputs = await runBulk(t.bulkWaybills, selectedOrders, (o) => apiClient.getWaybillPdf(workspaceId, o.id));
    if (outputs.length === 0) {
      win.close();
      return;
    }
    // No PDF-merge library in the bundle: stack every PDF in one window, one frame per waybill.
    const doc = win.document;
    doc.body.textContent = "";
    for (const { order, value } of outputs) {
      const url = URL.createObjectURL(value);
      const wrap = doc.createElement("section");
      wrap.style.cssText = "margin:12px;background:#fff;border-radius:12px;overflow:hidden";
      const h = doc.createElement("div");
      h.style.cssText = "display:flex;justify-content:space-between;padding:8px 12px;font-size:13px";
      const title = doc.createElement("strong");
      title.textContent = order.orderNumber;
      const open = doc.createElement("a");
      open.href = url;
      open.target = "_blank";
      open.textContent = "PDF ↗";
      h.append(title, open);
      const frame = doc.createElement("iframe");
      frame.src = url;
      frame.title = order.orderNumber;
      frame.style.cssText = "width:100%;height:90vh;border:0";
      wrap.append(h, frame);
      doc.body.append(wrap);
      win.setTimeout(() => URL.revokeObjectURL(url), 10 * 60_000);
    }
  }

  function bulkExport() {
    const csv = toCsv(ordersToCsvRows(selectedOrders, t.csvHeaders.split(",")));
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  return (
    <div className="max-w-6xl min-w-0">
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <Button onClick={() => navigate("/orders/new")} title={fmt(t.shortcutHint, { key: "N" })}>
            <Plus aria-hidden /> {t.newOrder}
            <Kbd className="ms-1 hidden sm:inline-flex">N</Kbd>
          </Button>
        }
      />

      <div className="mb-3 grid gap-3 sm:grid-cols-3">
        <Select aria-label={t.confirmationFilter} value={confirmationState} onChange={(e) => setConfirmationState(e.target.value as ConfirmationState | "")}>
          <option value="">{t.anyConfirmation}</option>
          {CONFIRMATION.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </Select>
        <Select aria-label={t.paymentFilter} value={financialState} onChange={(e) => setFinancialState(e.target.value as FinancialState | "")}>
          <option value="">{t.anyPayment}</option>
          {FINANCIAL.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </Select>
        <Select aria-label={t.fulfilmentFilter} value={fulfillmentState} onChange={(e) => setFulfillmentState(e.target.value as FulfillmentState | "")}>
          <option value="">{t.anyFulfilment}</option>
          {FULFILLMENT.map((s) => (
            <option key={s} value={s}>
              {label(s)}
            </option>
          ))}
        </Select>
      </div>

      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
          <Input aria-label={t.searchPlaceholder} placeholder={t.searchPlaceholder} value={q} onChange={(e) => setParam("q", e.target.value)} className="ps-9" />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          {t.from}
          <Input type="date" value={from} max={to || undefined} onChange={(e) => setParam("from", e.target.value)} className="w-auto" />
        </label>
        <label className="flex items-center gap-2 text-sm text-ink-soft">
          {t.to}
          <Input type="date" value={to} min={from || undefined} onChange={(e) => setParam("to", e.target.value)} className="w-auto" />
        </label>
        {hasLocalFilter && (
          <Button variant="ghost" size="sm" onClick={() => setParams({}, { replace: true })}>
            <X aria-hidden /> {t.clearFilters}
          </Button>
        )}
      </div>
      {hasLocalFilter && list.hasMore && <p className="-mt-2 mb-3 text-xs text-ink-muted">{fmt(t.localFilterNote, { n: list.items.length })}</p>}

      {(selected.size > 0 || busy) && (
        <div className="sticky top-16 z-20 mb-3 flex flex-wrap items-center gap-2 rounded-2xl border border-primary/30 bg-paper-raised px-4 py-2.5 shadow-[var(--shadow-pop)]" role="region" aria-label={fmt(t.selected, { n: selected.size })}>
          <span className="me-2 text-sm font-semibold text-ink">{fmt(t.selected, { n: selected.size })}</span>
          {busy ? (
            <div className="flex min-w-[200px] flex-1 items-center gap-3">
              <Progress value={progress.done} max={progress.total} className="flex-1" label={fmt(t.working, { done: progress.done, total: progress.total })} />
              <span className="text-xs tabular-nums text-ink-soft">{fmt(t.working, { done: progress.done, total: progress.total })}</span>
            </div>
          ) : (
            <>
              <Button size="sm" variant="outline" onClick={() => { setShipError(null); setShipOpen(true); }}>
                <Truck aria-hidden /> {t.bulkShipment}
              </Button>
              <Button size="sm" variant="outline" onClick={bulkWaybills}>
                <Printer aria-hidden /> {t.bulkWaybills}
              </Button>
              <Button size="sm" variant="outline" onClick={bulkExport}>
                <Download aria-hidden /> {t.bulkExport}
              </Button>
              <Button size="sm" variant="danger" onClick={() => { setReason(""); setCancelOpen(true); }}>
                <XCircle aria-hidden /> {t.bulkCancel}
              </Button>
              <Button size="sm" variant="ghost" className="ms-auto" onClick={() => setSelected(new Set())}>
                {t.clearSelection}
              </Button>
            </>
          )}
        </div>
      )}

      <DataState
        loading={list.loading}
        error={list.items.length ? null : list.error}
        empty={rows.length === 0}
        emptyMessage={t.empty}
        onRetry={list.reload}
      >
        <div className="overflow-x-auto rounded-2xl border border-line bg-paper-raised">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="sticky top-0 z-10 border-b border-line bg-paper-raised text-start text-xs uppercase tracking-wide text-ink-soft">
                <th className="w-10 px-4 py-3">
                  <input
                    type="checkbox"
                    aria-label={t.selectAll}
                    className="size-4 cursor-pointer accent-[var(--primary)]"
                    checked={allOnPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = !allOnPageSelected && someOnPageSelected;
                    }}
                    onChange={toggleAll}
                    disabled={busy}
                  />
                </th>
                <th className="px-4 py-3 text-start font-medium">{t.colOrder}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colCustomer}</th>
                <th className="px-4 py-3 text-end font-medium">{t.colTotal}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colState}</th>
                <th className="px-4 py-3 text-start font-medium">{t.colDate}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((order) => (
                <tr
                  key={order.id}
                  className={`border-b border-line last:border-0 hover:bg-paper-raised ${selected.has(order.id) ? "bg-primary-soft" : "bg-paper"}`}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label={fmt(t.selectOrder, { order: order.orderNumber })}
                      className="size-4 cursor-pointer accent-[var(--primary)]"
                      checked={selected.has(order.id)}
                      onChange={() => toggle(order.id)}
                      disabled={busy}
                    />
                  </td>
                  <td className="px-4 py-3 text-start">
                    <Link to={`/orders/${order.id}`} className="font-medium text-ink hover:text-primary">
                      <span dir="ltr">{order.orderNumber}</span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-start text-ink-soft">{order.contactSnapshot?.fullName || "—"}</td>
                  <td className="px-4 py-3 text-end tabular-nums text-ink-soft">
                    <bdi>{formatMoney(order.totalAmount, order.currency)}</bdi>
                  </td>
                  <td className="px-4 py-3 text-start">
                    <div className="flex flex-wrap gap-1">
                      <StatusBadge label={t.badgeConf} value={order.confirmationState} />
                      <StatusBadge label={t.badgePay} value={order.financialState} />
                      <StatusBadge label={t.badgeShip} value={order.fulfillmentState} />
                    </div>
                  </td>
                  <td className="px-4 py-3 text-start text-ink-soft">{formatDate(order.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <LoadMore hasMore={list.hasMore} loading={list.loadingMore} onClick={list.loadMore} />
      </DataState>

      <ConfirmDialog
        open={cancelOpen}
        title={fmt(t.cancelTitle, { n: selected.size })}
        description={t.cancelDescription}
        confirmLabel={t.cancelConfirm}
        destructive
        onCancel={() => setCancelOpen(false)}
        onConfirm={bulkCancel}
      >
        <TextField label={t.reason} required value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t.reasonPlaceholder} />
      </ConfirmDialog>

      <Modal
        open={shipOpen}
        onClose={() => setShipOpen(false)}
        title={fmt(t.shipmentTitle, { n: selected.size })}
        description={t.shipmentHint}
        footer={
          <>
            <Button variant="outline" onClick={() => setShipOpen(false)}>
              {t.close}
            </Button>
            <Button onClick={bulkShipment}>{t.create}</Button>
          </>
        }
      >
        <div className="space-y-4">
          <TextField label={t.carrier} required dir="ltr" value={carrier} placeholder={t.carrierPlaceholder} error={shipError ?? undefined} onChange={(e) => setCarrier(e.target.value)} />
          <TextField label={t.waybillNumber} dir="ltr" value={waybillNumber} onChange={(e) => setWaybillNumber(e.target.value)} />
          <TextField label={t.trackingUrl} dir="ltr" type="url" value={trackingUrl} onChange={(e) => setTrackingUrl(e.target.value)} />
        </div>
      </Modal>

      <Modal
        open={result !== null}
        onClose={() => setResult(null)}
        title={result ? fmt(t.resultTitle, { action: result.action }) : ""}
        footer={<Button onClick={() => setResult(null)}>{t.close}</Button>}
      >
        {result && (
          <div className="space-y-3 text-sm">
            <p className="flex flex-wrap gap-3">
              <span className="font-medium text-success">{fmt(t.succeeded, { n: result.ok.length })}</span>
              <span className={result.failed.length ? "font-medium text-danger" : "text-ink-muted"}>{fmt(t.failed, { n: result.failed.length })}</span>
            </p>
            {result.failed.length > 0 && (
              <Alert variant="danger">
                <ul className="space-y-1">
                  {result.failed.map((f) => (
                    <li key={f.order.id}>
                      <bdi dir="ltr" className="font-medium">{f.order.orderNumber}</bdi>: {f.reason}
                    </li>
                  ))}
                </ul>
              </Alert>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
