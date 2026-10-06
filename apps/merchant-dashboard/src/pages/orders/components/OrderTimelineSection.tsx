import {
  ordersTimeline,
  type Order,
  type OrderStage,
  type OrderTimelineEvent,
  type ShipmentStatus,
} from "@store-builder/api-client";
import { providerName } from "@/lib/providers";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatDateTime, humanize } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Section } from "@/components/Section";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { STAGE_TONE, useOrderLabels } from "../orderLabels";

const STRINGS = {
  en: {
    title: "Timeline",
    description: "Everything that happened to this order: status changes, edits, notes, messages, webhooks and courier updates.",
    empty: "Nothing recorded yet.",
    placed: "Order placed",
    by_user: "by {name}",
    by_userUnknown: "by a team member",
    by_system: "automatically",
    by_carrier: "by the courier",
    by_customer: "by the customer",
    by_api: "through the API",
    reason_baseline: "Status when history started",
    reason_payment_expired: "Payment window expired",
    reason_customer_blocked: "Customer is blocked",
    reason_switched_to_cod: "Switched to cash on delivery",
    note_public: "Note shown to the customer",
    note_internal: "Internal note",
    automation: "Automation message · {trigger}",
    automation_sent: "sent",
    automation_failed: "failed",
    automation_skipped: "skipped",
    webhook: "Webhook {event}",
    webhook_delivered: "delivered",
    webhook_pending: "waiting to be sent",
    webhook_failed: "failed, will retry",
    webhook_exhausted: "failed",
    courier_update: "{carrier} update",
    message_email: "Email to the customer",
    message_sms: "SMS to the customer",
    message_whatsapp: "WhatsApp to the customer",
    message_push: "Notification to the customer's browser",
    message_sent: "sent",
    message_delivered: "delivered",
    message_read: "read",
    message_failed: "not sent",
    message_bot: "by the WhatsApp assistant",
    "a_order.update": "Address or notes edited",
    "a_order.meta_update": "Tags or flags changed",
    "a_order.archive": "Order archived",
    "a_order.unarchive": "Order restored from the archive",
    "a_order.financial_state_change": "Payment status changed",
    "a_order.payment_received": "Payment received",
    "a_order.payment_expired": "Payment window expired",
    "a_order.switched_to_cod": "Switched to cash on delivery",
    "a_order.reopened_after_payment": "Reopened after a late payment",
    "a_order.items_update": "Items edited",
    "a_shipment.create": "Shipment created",
    "a_shipment.update": "Shipment updated",
    "a_refund.create": "Refund recorded",
    "a_dropship.push_order": "Sent to the supplier",
    "a_dropship.status_update": "The supplier updated the order",
    "a_dropship.forward_failed": "Could not send to the supplier",
    supplierStatus: "At the supplier: {status}",
    waybill: "Tracking number {number}",
    courier: "Courier: {name}",
    tags: "Tags: {tags}",
  },
  ar: {
    title: "السجل الزمني",
    description: "كل ما حدث لهذا الأوردر: تغييرات الحالة والتعديلات والملاحظات والرسائل والـ webhooks وتحديثات شركة الشحن.",
    empty: "مفيش شيء مسجّل لسه.",
    placed: "تم إنشاء الأوردر",
    by_user: "بواسطة {name}",
    by_userUnknown: "بواسطة أحد أعضاء الفريق",
    by_system: "تلقائيًا",
    by_carrier: "من شركة الشحن",
    by_customer: "من العميل",
    by_api: "عن طريق الـ API",
    reason_baseline: "الحالة عند بدء السجل",
    reason_payment_expired: "انتهت مهلة الدفع",
    reason_customer_blocked: "العميل محظور",
    reason_switched_to_cod: "اتحوّل للدفع عند الاستلام",
    note_public: "ملاحظة ظاهرة للعميل",
    note_internal: "ملاحظة داخلية",
    automation: "رسالة تلقائية · {trigger}",
    automation_sent: "تم الإرسال",
    automation_failed: "فشلت",
    automation_skipped: "تم التخطي",
    webhook: "Webhook {event}",
    webhook_delivered: "اتسلّم",
    webhook_pending: "في انتظار الإرسال",
    webhook_failed: "فشل وسيُعاد",
    webhook_exhausted: "فشل",
    courier_update: "تحديث من {carrier}",
    message_email: "إيميل للعميل",
    message_sms: "رسالة SMS للعميل",
    message_whatsapp: "واتساب للعميل",
    message_push: "إشعار على متصفح العميل",
    message_sent: "اتبعت",
    message_delivered: "وصل",
    message_read: "اتقرا",
    message_failed: "ماتبعتش",
    message_bot: "من مساعد الواتساب",
    "a_order.update": "تعديل العنوان أو الملاحظات",
    "a_order.meta_update": "تغيير التاجز أو العلامات",
    "a_order.archive": "تمت أرشفة الأوردر",
    "a_order.unarchive": "تم استرجاع الأوردر من الأرشيف",
    "a_order.financial_state_change": "تغيّرت حالة الدفع",
    "a_order.payment_received": "تم استلام دفعة",
    "a_order.payment_expired": "انتهت مهلة الدفع",
    "a_order.switched_to_cod": "اتحوّل للدفع عند الاستلام",
    "a_order.reopened_after_payment": "أُعيد فتحه بعد دفع متأخر",
    "a_order.items_update": "تعديل المنتجات",
    "a_shipment.create": "تم إنشاء شحنة",
    "a_shipment.update": "تم تحديث الشحنة",
    "a_refund.create": "تم تسجيل استرداد",
    "a_dropship.push_order": "اتبعت للمورّد",
    "a_dropship.status_update": "المورّد حدّث الأوردر",
    "a_dropship.forward_failed": "معرفناش نبعته للمورّد",
    supplierStatus: "عند المورّد: {status}",
    waybill: "رقم التتبع {number}",
    courier: "شركة الشحن: {name}",
    tags: "التاجز: {tags}",
  },
} satisfies Messages;

type Strings = Record<keyof (typeof STRINGS)["en"], string>;

function lookup(t: Strings, key: string): string | null {
  return key in t ? t[key as keyof Strings] : null;
}

function actorText(t: Strings, actor: OrderTimelineEvent["actor"]): string {
  if (actor.type === "user") return actor.name ? fmt(t.by_user, { name: actor.name }) : t.by_userUnknown;
  return lookup(t, `by_${actor.type}`) ?? t.by_system;
}

/** The second line of an audit row: the few facts worth reading. */
function auditDetail(t: Strings, after: Record<string, unknown> | null): string | null {
  if (!after) return null;
  const parts: string[] = [];
  if (typeof after.carrierCode === "string") parts.push(fmt(t.courier, { name: after.carrierCode }));
  if (typeof after.waybillNumber === "string") parts.push(fmt(t.waybill, { number: after.waybillNumber }));
  if (Array.isArray(after.tags)) parts.push(fmt(t.tags, { tags: after.tags.join("، ") || "—" }));
  if (typeof after.cancellationReason === "string") parts.push(after.cancellationReason);
  if (typeof after.externalStatus === "string") parts.push(fmt(t.supplierStatus, { status: humanize(after.externalStatus) }));
  if (typeof after.externalOrderId === "string") parts.push(after.externalOrderId);
  if (typeof after.error === "string") parts.push(after.error);
  return parts.length ? parts.join(" · ") : null;
}

/**
 * The order's whole story, newest first. `refreshKey` changes when the order
 * is reloaded, so anything done on the page shows up at once.
 */
export function OrderTimelineSection({ order, refreshKey }: { order: Order; refreshKey: string }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS) as Strings;
  const labels = useOrderLabels();
  const timeline = useAsync(() => ordersTimeline(apiClient, workspaceId, order.id), [workspaceId, order.id, refreshKey]);
  const events = timeline.data ?? [];

  function body(event: OrderTimelineEvent) {
    const d = event.data;
    if (event.type === "status") {
      const from = d.from as OrderStage | null;
      const to = d.to as OrderStage;
      const reason = typeof d.reason === "string" ? (lookup(t, `reason_${d.reason}`) ?? d.reason) : null;
      return (
        <>
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            {from ? (
              <>
                <StatusBadge value={from} tone="neutral" text={labels.stage(from)} />
                <span aria-hidden className="text-ink-soft rtl:rotate-180">
                  →
                </span>
              </>
            ) : (
              <span className="text-ink-soft">{t.placed}</span>
            )}
            <StatusBadge value={to} tone={STAGE_TONE[to]} text={labels.stage(to)} />
          </div>
          {reason && <p className="mt-1 text-sm text-ink">{reason}</p>}
        </>
      );
    }
    if (event.type === "note") {
      return (
        <>
          <p className="text-sm font-medium text-ink">{d.visibility === "public" ? t.note_public : t.note_internal}</p>
          <p className="mt-1 whitespace-pre-line text-sm text-ink">{String(d.body ?? "")}</p>
        </>
      );
    }
    if (event.type === "automation") {
      const status = lookup(t, `automation_${String(d.status)}`) ?? humanize(String(d.status));
      return (
        <>
          <p className="text-sm font-medium text-ink">
            {fmt(t.automation, { trigger: String(d.trigger) })} — {status}
          </p>
          {typeof d.detail === "string" && d.detail && <p className="mt-1 text-sm text-ink-soft">{d.detail}</p>}
        </>
      );
    }
    if (event.type === "courier") {
      const status = typeof d.status === "string" ? (d.status as ShipmentStatus) : null;
      return (
        <>
          <div className="flex flex-wrap items-center gap-1.5 text-sm">
            <span className="font-medium text-ink">{fmt(t.courier_update, { carrier: providerName(String(d.carrierCode ?? "")) })}</span>
            {status && <StatusBadge value={status} tone="neutral" text={labels.shipment(status)} />}
          </div>
          {typeof d.description === "string" && d.description && (
            <p className="mt-1 text-sm text-ink-soft">
              <bdi>{d.description}</bdi>
            </p>
          )}
        </>
      );
    }
    if (event.type === "message") {
      const channel = lookup(t, `message_${String(d.channel)}`) ?? humanize(String(d.channel));
      const status = lookup(t, `message_${String(d.status)}`) ?? humanize(String(d.status));
      const failed = d.status === "failed";
      return (
        <>
          <p className="text-sm font-medium text-ink">
            {channel} — <span className={failed ? "text-danger" : undefined}>{status}</span>
          </p>
          {typeof d.subject === "string" && d.subject && (
            <p className="mt-1 text-sm text-ink">
              <bdi>{d.subject}</bdi>
            </p>
          )}
          {failed && typeof d.error === "string" && d.error && (
            <p className="mt-1 text-xs text-ink-soft">
              <bdi>{d.error}</bdi>
            </p>
          )}
        </>
      );
    }
    if (event.type === "webhook") {
      const status = lookup(t, `webhook_${String(d.status)}`) ?? humanize(String(d.status));
      return (
        <p className="text-sm font-medium text-ink">
          <bdi dir="ltr">{fmt(t.webhook, { event: String(d.eventType) })}</bdi> — {status}
        </p>
      );
    }
    const action = String(d.action);
    const detail = auditDetail(t, (d.after as Record<string, unknown> | null) ?? null);
    return (
      <>
        <p className="text-sm font-medium text-ink">{lookup(t, `a_${action}`) ?? humanize(action.replace(/\./g, " "))}</p>
        {detail && <p className="mt-1 text-sm text-ink-soft">{detail}</p>}
      </>
    );
  }

  return (
    <Section title={t.title} description={t.description}>
      <DataState
        loading={timeline.loading && !timeline.data}
        error={timeline.error}
        onRetry={() => timeline.refresh()}
        empty={events.length === 0}
        emptyMessage={t.empty}
      >
        <ol className="space-y-4 border-s border-line ps-4">
          {events.map((event) => (
            <li key={event.id} className="relative">
              <span
                aria-hidden
                className="absolute -start-[1.3rem] top-1.5 size-2.5 rounded-full border-2 border-paper-raised bg-line-strong"
              />
              {body(event)}
              <p className="mt-1 text-xs text-ink-soft">
                <time dateTime={event.at}>{formatDateTime(event.at)}</time>
                {" · "}
                {event.type === "message" && event.data.bot ? t.message_bot : actorText(t, event.actor)}
              </p>
            </li>
          ))}
        </ol>
      </DataState>
    </Section>
  );
}
