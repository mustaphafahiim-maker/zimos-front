import type { MerchantNotificationDto, MerchantNotificationType } from "@store-builder/api-client";
import { fmt, type Messages } from "@/i18n/LocaleContext";

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
    type_announcement: "Announcements from Zimos",
    type_automation: "Alerts from your automations",
    orderNewTitle: "New order {orderNumber}",
    orderSuspiciousTitle: "Suspicious order {orderNumber}",
    orderSuspiciousBody: "The protection rules flagged this order for review before it is confirmed.",
    stockLowTitle: "Running low: {label}",
    stockLowBody: "{available} left in stock.",
    integrationFailedTitle: "Could not reach {integration}",
    exportReadyTitle: "Your file is ready: {name}",
  },
  ar: {
    type_order_new: "الطلبات الجديدة",
    type_order_suspicious: "الطلبات المشتبه بها",
    type_stock_low: "قرب نفاد المخزون",
    type_integration_failed: "تعطّل خدمة مربوطة",
    type_export_ready: "جاهزية ملفات التصدير",
    type_announcement: "إعلانات زيموس",
    type_automation: "تنبيهات الأتمتة",
    orderNewTitle: "طلب جديد {orderNumber}",
    orderSuspiciousTitle: "طلب مشتبه به {orderNumber}",
    orderSuspiciousBody: "قواعد الحماية علّمت هذا الطلب للمراجعة قبل تأكيده.",
    stockLowTitle: "المخزون قارب على النفاد: {label}",
    stockLowBody: "المتاح {available} قطعة.",
    integrationFailedTitle: "تعذّر الاتصال بـ {integration}",
    exportReadyTitle: "الملف جاهز: {name}",
  },
} satisfies Messages;

export type NotificationStrings = Record<keyof (typeof NOTIFICATION_STRINGS)["en"], string>;

const str = (value: unknown): string => (typeof value === "string" || typeof value === "number" ? String(value) : "");

export function notificationTypeLabel(t: NotificationStrings, type: MerchantNotificationType): string {
  return t[`type_${type.replace(".", "_")}` as keyof NotificationStrings] ?? type;
}

export function notificationText(t: NotificationStrings, n: MerchantNotificationDto): { title: string; body: string | null } {
  const d = n.data ?? {};
  switch (n.type) {
    case "order.new":
      if (!d.orderNumber) break;
      return {
        title: fmt(t.orderNewTitle, { orderNumber: str(d.orderNumber) }),
        body: [str(d.customerName), str(d.total)].filter(Boolean).join(" — ") || null,
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
      return { title: fmt(t.integrationFailedTitle, { integration: str(d.integration) }), body: str(d.message) || null };
    case "export.ready":
      if (!d.name) break;
      return { title: fmt(t.exportReadyTitle, { name: str(d.name) }), body: null };
  }
  return { title: n.title, body: n.body };
}
