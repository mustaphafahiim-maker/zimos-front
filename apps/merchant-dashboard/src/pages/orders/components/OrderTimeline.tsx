import type { Order, ReturnRequest } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatDateTime, formatMoney } from "@/lib/format";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { cn } from "@store-builder/ui";
import { useEnumLabel } from "../orderLabels";

const STRINGS = {
  en: {
    title: "Timeline",
    created: "Order created",
    createdBy: "{method} · {total}",
    confirmation: "Confirmation: {state}",
    confirmationPending: "Awaiting phone confirmation",
    payment: "Payment {status}",
    paymentState: "Payment: {state}",
    shipment: "Shipment {code} ({carrier})",
    shipped: "Shipped {code}",
    delivered: "Delivered {code}",
    fulfilment: "Fulfilment: {state}",
    returnReq: "Return {status}",
    restocked: "Return restocked",
    cancelled: "Order cancelled",
    lastUpdate: "Last updated",
    noTimestamp: "time not recorded",
  },
  ar: {
    title: "السجل الزمني",
    created: "تم إنشاء الطلب",
    createdBy: "{method} · {total}",
    confirmation: "التأكيد: {state}",
    confirmationPending: "في انتظار التأكيد الهاتفي",
    payment: "الدفع: {status}",
    paymentState: "حالة الدفع: {state}",
    shipment: "شحنة {code} ({carrier})",
    shipped: "تم شحن {code}",
    delivered: "تم تسليم {code}",
    fulfilment: "الشحن: {state}",
    returnReq: "مرتجع: {status}",
    restocked: "تمت إعادة المرتجع للمخزون",
    cancelled: "تم إلغاء الطلب",
    lastUpdate: "آخر تحديث",
    noTimestamp: "الوقت غير مسجل",
  },
} satisfies Messages;

type Tone = "neutral" | "success" | "warning" | "danger" | "primary";

interface Event {
  at: string | null;
  title: string;
  detail?: string;
  tone: Tone;
}

const DOT: Record<Tone, string> = {
  neutral: "bg-line-strong",
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
};

/** Built only from real order fields and timestamps (plus the order's returns). */
export function OrderTimeline({ order }: { order: Order }) {
  const t = useT(STRINGS);
  const label = useEnumLabel();
  const workspaceId = useWorkspaceId();
  const returns = useAsync(() => apiClient.listOrderReturns(workspaceId, order.id), [workspaceId, order.id, order.updatedAt]);

  const events: Event[] = [
    {
      at: order.createdAt,
      title: t.created,
      detail: fmt(t.createdBy, { method: label(order.paymentMethod), total: formatMoney(order.totalAmount, order.currency) }),
      tone: "primary",
    },
  ];

  // No confirmedAt column exists; show the current state (timestamp unknown).
  events.push({
    at: null,
    title: order.confirmationState === "pending" ? t.confirmationPending : fmt(t.confirmation, { state: label(order.confirmationState) }),
    tone: order.confirmationState === "confirmed" ? "success" : order.confirmationState === "pending" ? "warning" : "danger",
  });

  const payments = order.payments ?? [];
  for (const p of payments) {
    events.push({
      at: p.updatedAt ?? p.createdAt,
      title: fmt(t.payment, { status: label(p.status) }),
      detail: [p.providerCode, formatMoney(p.amount, p.currency), p.failureReason].filter(Boolean).join(" · "),
      tone: p.status === "captured" ? "success" : p.status === "failed" ? "danger" : "neutral",
    });
  }
  if (payments.length === 0) {
    events.push({ at: null, title: fmt(t.paymentState, { state: label(order.financialState) }), tone: order.financialState === "paid" ? "success" : "neutral" });
  }

  for (const s of order.shipments ?? []) {
    events.push({ at: s.createdAt, title: fmt(t.shipment, { code: s.trackingCode, carrier: s.carrierCode }), detail: label(s.status), tone: "neutral" });
    if (s.shippedAt) events.push({ at: s.shippedAt, title: fmt(t.shipped, { code: s.trackingCode }), tone: "primary" });
    if (s.deliveredAt) events.push({ at: s.deliveredAt, title: fmt(t.delivered, { code: s.trackingCode }), tone: "success" });
  }
  if (!(order.shipments ?? []).length) {
    events.push({ at: null, title: fmt(t.fulfilment, { state: label(order.fulfillmentState) }), tone: "neutral" });
  }

  for (const r of (returns.data ?? []) as ReturnRequest[]) {
    events.push({ at: r.createdAt, title: fmt(t.returnReq, { status: label(r.status) }), detail: r.reason, tone: "warning" });
    if (r.restockedAt) events.push({ at: r.restockedAt, title: t.restocked, tone: "neutral" });
  }

  if (order.cancelledAt) {
    events.push({ at: order.cancelledAt, title: t.cancelled, detail: order.cancellationReason ?? undefined, tone: "danger" });
  }

  const dated = events.filter((e) => e.at).sort((a, b) => new Date(a.at as string).getTime() - new Date(b.at as string).getTime());
  const undated = events.filter((e) => !e.at);
  const ordered = [dated[0], ...undated, ...dated.slice(1)].filter(Boolean) as Event[];

  return (
    <section className="rounded-2xl border border-line bg-paper-raised p-5">
      <h2 className="mb-4 text-base font-semibold text-ink">{t.title}</h2>
      <ol className="relative space-y-4 border-s border-line ps-5">
        {ordered.map((e, i) => (
          <li key={i} className="relative">
            <span className={cn("absolute -start-[1.6rem] top-1.5 size-2.5 rounded-full ring-4 ring-paper-raised", DOT[e.tone])} aria-hidden />
            <p className="text-sm font-medium text-ink">{e.title}</p>
            {e.detail && <p className="text-sm text-ink-soft">{e.detail}</p>}
            <p className="text-xs text-ink-muted">{e.at ? formatDateTime(e.at) : t.noTimestamp}</p>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-xs text-ink-muted">
        {t.lastUpdate}: {formatDateTime(order.updatedAt)}
      </p>
    </section>
  );
}
