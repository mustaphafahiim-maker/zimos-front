import type { AutomationStep, AutomationStepType } from "@store-builder/api-client";
import { fmt, type Messages } from "@/i18n/LocaleContext";

/**
 * Words shared by the Automations page, its rule editor and the ready-made
 * templates: trigger names, step names and the one-line summary of a step.
 * Triggers and step types are open sets — an unknown one is shown as sent.
 */
export const AUTOMATION_STRINGS = {
  en: {
    "trigger_order.created": "Order placed",
    "trigger_order.confirmed": "Order confirmed",
    "trigger_order.rejected": "Order rejected",
    "trigger_order.cancelled": "Order cancelled",
    "trigger_order.shipped": "Order shipped",
    "trigger_order.out_for_delivery": "Out for delivery",
    "trigger_order.delivered": "Order delivered",
    "trigger_order.unreachable": "Customer did not answer",
    "trigger_order.postponed": "Order postponed",
    "trigger_order.returned": "Order returned",
    "trigger_order.payment_failed": "Payment failed",
    "trigger_order.transfer_rejected": "Transfer rejected",
    "trigger_order.digital_delivered": "Digital products ready",
    "trigger_checkout.abandoned": "Checkout abandoned",
    "trigger_lost_order.created": "Lost order recorded",
    "trigger_review.request": "Review request (days after delivery)",
    "trigger_lead.created": "New lead",
    "trigger_subscription.renewal_failed": "Subscription renewal failed",
    step_wait: "Wait",
    step_whatsapp_template: "WhatsApp template",
    step_sms: "SMS",
    step_email: "Email",
    step_webhook: "Webhook",
    step_add_tag: "Add tag to order",
    step_set_status: "Change order status",
    step_notify_team: "Notify the team",
    unit_minutes: "minutes",
    unit_hours: "hours",
    unit_days: "days",
    status_confirmed: "Confirmed",
    status_cancelled: "Cancelled",
    sumWait: "Wait {amount} {unit}",
    sumWhatsapp: "WhatsApp template “{template}”",
    sumSms: "SMS: {text}",
    sumEmail: "Email: {text}",
    sumWebhook: "POST to {text}",
    sumTag: "Tag the order “{text}”",
    sumStatus: "Mark the order {text}",
    sumNotify: "Notify the team: {text}",
  },
  ar: {
    "trigger_order.created": "إنشاء الطلب",
    "trigger_order.confirmed": "تأكيد الطلب",
    "trigger_order.rejected": "رفض الطلب",
    "trigger_order.cancelled": "إلغاء الطلب",
    "trigger_order.shipped": "شحن الطلب",
    "trigger_order.out_for_delivery": "خرج للتوصيل",
    "trigger_order.delivered": "تسليم الطلب",
    "trigger_order.unreachable": "العميل لم يرد",
    "trigger_order.postponed": "تأجيل الطلب",
    "trigger_order.returned": "إرجاع الطلب",
    "trigger_order.payment_failed": "فشل الدفع",
    "trigger_order.transfer_rejected": "رفض التحويل",
    "trigger_order.digital_delivered": "المنتجات الرقمية جاهزة",
    "trigger_checkout.abandoned": "ترك صفحة الطلب",
    "trigger_lost_order.created": "تسجيل طلب مفقود",
    "trigger_review.request": "طلب تقييم (بعد التسليم بأيام)",
    "trigger_lead.created": "عميل محتمل جديد",
    "trigger_subscription.renewal_failed": "فشل تجديد الاشتراك",
    step_wait: "انتظار",
    step_whatsapp_template: "قالب واتساب",
    step_sms: "رسالة SMS",
    step_email: "بريد إلكتروني",
    step_webhook: "Webhook",
    step_add_tag: "إضافة وسم للطلب",
    step_set_status: "تغيير حالة الطلب",
    step_notify_team: "تنبيه الفريق",
    unit_minutes: "دقيقة",
    unit_hours: "ساعة",
    unit_days: "يوم",
    status_confirmed: "مؤكد",
    status_cancelled: "ملغي",
    sumWait: "انتظار {amount} {unit}",
    sumWhatsapp: "قالب واتساب «{template}»",
    sumSms: "SMS: {text}",
    sumEmail: "بريد: {text}",
    sumWebhook: "إرسال إلى {text}",
    sumTag: "وسم الطلب بـ «{text}»",
    sumStatus: "تحويل الطلب إلى {text}",
    sumNotify: "تنبيه الفريق: {text}",
  },
} satisfies Messages;

export type AutomationStrings = Record<keyof (typeof AUTOMATION_STRINGS)["en"], string>;

const lookup = (t: AutomationStrings, key: string): string | undefined => (t as Record<string, string>)[key];

export const triggerLabel = (t: AutomationStrings, trigger: string) => lookup(t, `trigger_${trigger}`) ?? trigger;
export const stepTypeLabel = (t: AutomationStrings, type: AutomationStepType | string) => lookup(t, `step_${type}`) ?? type;

const clip = (text: string, max = 60) => (text.length > max ? `${text.slice(0, max)}…` : text);

/** One line describing what a step does. */
export function stepSummary(t: AutomationStrings, step: AutomationStep): string {
  switch (step.type) {
    case "wait":
      return fmt(t.sumWait, { amount: step.amount, unit: lookup(t, `unit_${step.unit}`) ?? step.unit });
    case "whatsapp_template":
      return fmt(t.sumWhatsapp, { template: step.template });
    case "sms":
      return fmt(t.sumSms, { text: clip(step.body) });
    case "email":
      return fmt(t.sumEmail, { text: clip(step.subject) });
    case "webhook":
      return fmt(t.sumWebhook, { text: clip(step.url, 40) });
    case "add_tag":
      return fmt(t.sumTag, { text: step.tag });
    case "set_status":
      return fmt(t.sumStatus, { text: lookup(t, `status_${step.status}`) ?? step.status });
    case "notify_team":
      return fmt(t.sumNotify, { text: clip(step.message) });
    default:
      return stepTypeLabel(t, (step as { type: string }).type);
  }
}

/** A blank step of the given type, for the editor's "add step". */
export function emptyStep(type: AutomationStepType): AutomationStep {
  switch (type) {
    case "wait":
      return { type, amount: 1, unit: "hours" };
    case "whatsapp_template":
      return { type, template: "", language: "ar", params: [] };
    case "sms":
      return { type, body: "" };
    case "email":
      return { type, subject: "", body: "" };
    case "webhook":
      return { type, url: "" };
    case "add_tag":
      return { type, tag: "" };
    case "set_status":
      return { type, status: "confirmed" };
    case "notify_team":
      return { type, message: "" };
  }
}

/** Why a step cannot be saved yet, or null. Mirrors the backend's rules. */
export function stepProblem(step: AutomationStep): boolean {
  switch (step.type) {
    case "wait":
      return !Number.isInteger(step.amount) || step.amount < 1 || step.amount > 720;
    case "whatsapp_template":
      return !/^[a-z0-9_]{1,512}$/.test(step.template) || !/^[a-z]{2,3}(_[A-Z]{2})?$/.test(step.language);
    case "sms":
      return step.body.trim() === "";
    case "email":
      return step.subject.trim() === "" || step.body.trim() === "";
    case "webhook":
      return !/^https?:\/\/\S+$/.test(step.url.trim());
    case "add_tag":
      return step.tag.trim() === "";
    case "notify_team":
      return step.message.trim() === "";
    default:
      return false;
  }
}
