import type { MerchantNotificationDto, MerchantNotificationType } from "@store-builder/api-client";
import { fmt, type Messages } from "@/i18n/LocaleContext";
import { formatMoney } from "@/lib/format";

/**
 * The server stores an order total as text ("250.00 EGP"). Shown in the
 * dashboard's own money format («٢٥٠٫٠٠ ج.م.») like every other amount
 * (re-audit N-10); anything that doesn't parse is shown as it came.
 */
function displayTotal(raw: string): string {
  const match = /^(-?\d+(?:\.\d+)?)\s+([A-Z]{3})$/.exec(raw.trim());
  if (!match) return raw;
  const [, amount, currency] = match;
  try {
    const digits = new Intl.NumberFormat("en", { style: "currency", currency }).resolvedOptions().maximumFractionDigits ?? 2;
    return formatMoney(Math.round(Number(amount) * 10 ** digits), currency);
  } catch {
    return raw;
  }
}

/**
 * Merchant notifications arrive with a title/body in the store's language
 * and the values they were built from in `data`. The dashboard renders the
 * types it knows in the viewer's language from those values, and shows the
 * stored title/body for anything else (announcements, a newer backend type).
 */
export const NOTIFICATION_STRINGS = {
  en: {
    type_order_new: "New orders",
    type_order_suspicious: "Suspicious orders",
    type_stock_low: "Low stock",
    type_integration_failed: "A connected service failed",
    type_export_ready: "Exports ready",
    type_shipping_batch_done: "Bulk shipping finished",
    type_announcement: "Announcements from Zimos",
    type_automation: "Alerts from your automations",
    type_plan_limit_reached: "Plan limits reached",
    limitLeadsTitle: "Your plan's new leads for this month are used up ({allowed})",
    limitLeadsBody: "Forms and the newsletter won't add new contacts until next month or a plan change. People you already know can still sign up.",
    limitStorageTitle: "Your plan's file storage is full",
    limitStorageBody: "Delete files you don't need, or change the plan, to upload new ones.",
    lang: "en",
    orderNewTitle: "New order {orderNumber}",
    orderNewMore: "{product} +{n} more",
    orderSuspiciousTitle: "Suspicious order {orderNumber}",
    orderSuspiciousBody: "The protection rules flagged this order for review before it is confirmed.",
    stockLowTitle: "Running low: {label}",
    stockLowBody: "{available} left in stock.",
    integrationFailedTitle: "Could not reach {integration}",
    reasonAuth: "The key or login was refused. Connect it again in settings.",
    reasonPermission: "The account lacks a permission this needs. Check the key's permissions with the provider.",
    reasonUnavailable: "The service didn't answer. It is tried again on its own; if it keeps happening, contact the provider.",
    reasonSignature: "Notifications arrived whose signature doesn't match the saved secret. Check the webhook secret in settings.",
    exportReadyTitle: "Your file is ready: {name}",
    exportFailedTitle: "Couldn't prepare your file: {name}",
    exportFailedBody: "Export again, or narrow the filters.",
    autoBookingFailedTitle: "Order {orderNumber} wasn't booked with {integration} automatically",
    autoBookingFailedBody: "{reason} Book it from the order page.",
    batchDoneTitle: "Booked {booked} of {total} orders with {carrier}",
    batchFailedBody: "{failed} weren't booked. Open the report to see why and send them again.",
  },
  ar: {
    type_order_new: "الطلبات الجديدة",
    type_order_suspicious: "الطلبات المشتبه بها",
    type_stock_low: "قرب نفاد المخزون",
    type_integration_failed: "تعطّل خدمة مربوطة",
    type_export_ready: "جاهزية ملفات التصدير",
    type_shipping_batch_done: "انتهاء الشحن المجمّع",
    type_announcement: "إعلانات زيموس",
    type_automation: "تنبيهات الأتمتة",
    type_plan_limit_reached: "الوصول لحدود الباقة",
    limitLeadsTitle: "خلص عدد العملاء المحتملين الجدد في باقتك للشهر ده ({allowed})",
    limitLeadsBody: "النماذج والنشرة البريدية مش هتضيف عملاء جدد لحد الشهر الجاي أو تغيير الباقة. اللي تعرفهم قبل كده يقدروا يشتركوا عادي.",
    limitStorageTitle: "مساحة الملفات في باقتك اتملت",
    limitStorageBody: "امسح ملفات مش محتاجها أو غيّر الباقة علشان ترفع ملفات جديدة.",
    lang: "ar",
    orderNewTitle: "طلب جديد {orderNumber}",
    orderNewMore: "{product} و{n} غيره",
    orderSuspiciousTitle: "طلب مشتبه به {orderNumber}",
    orderSuspiciousBody: "قواعد الحماية علّمت هذا الطلب للمراجعة قبل تأكيده.",
    stockLowTitle: "المخزون قارب على النفاد: {label}",
    stockLowBody: "المتاح {available} قطعة.",
    integrationFailedTitle: "تعذّر الاتصال بـ {integration}",
    reasonAuth: "المفتاح أو بيانات الدخول لم تعد مقبولة. أعد الربط من الإعدادات.",
    reasonPermission: "الحساب لا يملك صلاحية لهذا الإجراء. راجع صلاحيات المفتاح لدى مزوّد الخدمة.",
    reasonUnavailable: "الخدمة لم ترد. يُعاد المحاولة تلقائيًا، وإن استمر ذلك تواصل مع مزوّد الخدمة.",
    reasonSignature: "وصلت إشعارات لم يتطابق توقيعها مع المفتاح المحفوظ. تأكد من مفتاح الـ webhook في الإعدادات.",
    exportReadyTitle: "الملف جاهز: {name}",
    exportFailedTitle: "تعذّر تجهيز الملف: {name}",
    exportFailedBody: "جرّب التصدير مرة أخرى، أو ضيّق الفلاتر.",
    autoBookingFailedTitle: "لم يُحجز الطلب {orderNumber} تلقائيًا مع {integration}",
    autoBookingFailedBody: "{reason} احجزه من صفحة الطلب.",
    batchDoneTitle: "اتحجز {booked} من {total} أوردر مع {carrier}",
    batchFailedBody: "لم يُحجز {failed}. افتح التقرير لمعرفة السبب وإعادة إرسالها.",
  },
} satisfies Messages;

export type NotificationStrings = Record<keyof (typeof NOTIFICATION_STRINGS)["en"], string>;

const str = (value: unknown): string => (typeof value === "string" || typeof value === "number" ? String(value) : "");
/** A count as a number, so `fmt` writes it with the viewer's digits. */
const num = (value: unknown): number | string => {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : str(value);
};

export function notificationTypeLabel(t: NotificationStrings, type: MerchantNotificationType): string {
  return t[`type_${type.replace(".", "_")}` as keyof NotificationStrings] ?? type;
}

export function notificationText(t: NotificationStrings, n: MerchantNotificationDto): { title: string; body: string | null } {
  const d = n.data ?? {};
  switch (n.type) {
    case "order.new":
      if (!d.orderNumber) break;
      // SPEC §20.1: the product, the total and the governorate (older rows: the customer and the total).
      if (d.product !== undefined) {
        const more = Number(d.moreProducts) || 0;
        const product = str(d.product);
        const place = d.governorate && typeof d.governorate === "object" ? str((d.governorate as Record<string, unknown>)[t.lang]) : str(d.governorate);
        return {
          title: fmt(t.orderNewTitle, { orderNumber: str(d.orderNumber) }),
          body: [more && product ? fmt(t.orderNewMore, { product, n: more }) : product, displayTotal(str(d.total)), place].filter(Boolean).join(" · ") || null,
        };
      }
      return {
        title: fmt(t.orderNewTitle, { orderNumber: str(d.orderNumber) }),
        body: [str(d.customerName), displayTotal(str(d.total))].filter(Boolean).join(" — ") || null,
      };
    case "order.suspicious":
      if (!d.orderNumber) break;
      return { title: fmt(t.orderSuspiciousTitle, { orderNumber: str(d.orderNumber) }), body: t.orderSuspiciousBody };
    case "stock.low":
      if (!d.label) break;
      return {
        title: fmt(t.stockLowTitle, { label: str(d.label) }),
        body: fmt(t.stockLowBody, { available: str(d.available) }),
      };
    case "integration.failed":
      if (!d.integration) break;
      // An order the store's courier could not book on its own (shipping/carrierBooking.js).
      if (d.orderNumber) {
        return {
          title: fmt(t.autoBookingFailedTitle, { orderNumber: str(d.orderNumber), integration: str(d.integration) }),
          body: fmt(t.autoBookingFailedBody, { reason: str(d.reason) }).trim(),
        };
      }
      // gateway / carrier / whatsapp alerts (notifications/integrationAlerts.js) name a reason.
      if (d.kind) {
        const why: Record<string, string> = { auth: t.reasonAuth, permission: t.reasonPermission, unavailable: t.reasonUnavailable, signature: t.reasonSignature };
        return { title: fmt(t.integrationFailedTitle, { integration: str(d.integration) }), body: why[str(d.reason)] ?? null };
      }
      return { title: fmt(t.integrationFailedTitle, { integration: str(d.integration) }), body: str(d.message) || null };
    case "shipping.batch_done":
      if (d.total === undefined) break;
      return {
        title: fmt(t.batchDoneTitle, { booked: num(d.booked), total: num(d.total), carrier: str(d.carrierName) || str(d.carrierCode) }),
        body: Number(d.failed) > 0 ? fmt(t.batchFailedBody, { failed: str(d.failed) }) : null,
      };
    case "plan.limit_reached":
      if (d.limit === "leads") return { title: fmt(t.limitLeadsTitle, { allowed: str(d.allowed) }), body: t.limitLeadsBody };
      if (d.limit === "storage_bytes") return { title: t.limitStorageTitle, body: t.limitStorageBody };
      break;
    case "export.ready":
      if (!d.name) break;
      if (d.failed) return { title: fmt(t.exportFailedTitle, { name: str(d.name) }), body: t.exportFailedBody };
      return { title: fmt(t.exportReadyTitle, { name: str(d.name) }), body: null };
  }
  return { title: n.title, body: n.body };
}
