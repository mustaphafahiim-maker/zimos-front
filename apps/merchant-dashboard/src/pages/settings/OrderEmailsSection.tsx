import { useState } from "react";
import { Alert, Button, cn } from "@store-builder/ui";
import { orderEmailDesignList, orderEmailDesignSave, type OrderEmailDesignTemplate, type OrderEmailKey } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { useToast } from "@/components/Toast";
import { OrderEmailSender } from "./OrderEmailSender";
import { SendingDomainSection } from "./SendingDomainSection";
import { OrderEmailEditor } from "./OrderEmailEditor";

/**
 * Settings → "Order emails" (SPEC §14.5): the emails customers get about
 * their orders. Each can be switched on, rewritten with variables, previewed
 * with sample values and sent to yourself as a test.
 */

const STRINGS = {
  en: {
    title: "Order emails",
    description:
      "Emails your customers get about their orders, sent under your store's name. Each one goes out only when it is switched on and the order has an email address.",
    readOnly: "Only the store owner or a workspace manager can change these emails.",
    name_order_confirmation: "Order received",
    when_order_confirmation: "When an order is placed",
    name_order_shipped: "Order shipped",
    when_order_shipped: "When the courier picks the order up",
    name_order_cancelled: "Order cancelled",
    when_order_cancelled: "When an order is cancelled",
    name_order_refunded: "Refund issued",
    when_order_refunded: "When an order is refunded",
    name_abandoned_cart: "Abandoned cart",
    when_abandoned_cart: "When a checkout is left unfinished",
    name_digital_delivery: "Digital product delivery",
    when_digital_delivery: "When a digital product is ready",
    name_subscription_started: "Subscription started",
    when_subscription_started: "When a subscription or installment plan starts — with the link where the customer changes their card or cancels. On unless you turn it off.",
    name_transfer_rejected: "Transfer rejected",
    when_transfer_rejected: "When you reject a transfer receipt (unless you untick “Tell the customer”) — with a link to send a new one",
    on: "On",
    off: "Off",
    switchLabel: "Send “{name}”",
    edit: "Edit",
    edited: "Edited",
    designed: "Designed",
    editTitle: "Edit “{name}”",
    saved: "Email saved.",
    enabled: "“{name}” is now sent to customers.",
    disabled: "“{name}” is switched off.",
  },
  ar: {
    title: "إيميلات الطلبات",
    description: "الرسائل التي تصل عملاءك بالبريد عن طلباتهم، باسم متجرك. كل رسالة تُرسل فقط إذا كانت مفعّلة وللطلب بريد إلكتروني.",
    readOnly: "يمكن لمالك المتجر أو مدير مساحة العمل فقط تغيير هذه الرسائل.",
    name_order_confirmation: "استلام الطلب",
    when_order_confirmation: "عند إنشاء الطلب",
    name_order_shipped: "شحن الطلب",
    when_order_shipped: "عند استلام شركة الشحن للطلب",
    name_order_cancelled: "إلغاء الطلب",
    when_order_cancelled: "عند إلغاء الطلب",
    name_order_refunded: "رد المبلغ",
    when_order_refunded: "عند رد مبلغ الطلب",
    name_abandoned_cart: "السلة المتروكة",
    when_abandoned_cart: "عند ترك صفحة الطلب دون إكماله",
    name_digital_delivery: "تسليم المنتج الرقمي",
    when_digital_delivery: "عند جاهزية المنتج الرقمي",
    name_subscription_started: "بداية الاشتراك",
    when_subscription_started: "لما اشتراك أو تقسيط يبدأ — برابط صفحة الاشتراك اللي العميل يغيّر منها بطاقته أو يلغي. شغّالة إلا لو قفلتها.",
    name_transfer_rejected: "رفض التحويل",
    when_transfer_rejected: "لما ترفض إيصال تحويل (إلا لو شلت علامة «بلّغ العميل») — برابط لرفع إيصال جديد",
    on: "مفعّلة",
    off: "متوقفة",
    switchLabel: "إرسال «{name}»",
    edit: "تعديل",
    edited: "معدّلة",
    designed: "متصممة",
    editTitle: "تعديل «{name}»",
    saved: "تم حفظ الرسالة.",
    enabled: "«{name}» تُرسل الآن للعملاء.",
    disabled: "تم إيقاف «{name}».",
  },
} satisfies Messages;

type T = Record<keyof (typeof STRINGS)["en"], string>;
const nameOf = (t: T, key: OrderEmailKey) => (t as Record<string, string>)[`name_${key}`] ?? key;
const whenOf = (t: T, key: OrderEmailKey) => (t as Record<string, string>)[`when_${key}`] ?? "";

export function OrderEmailsSection() {
  const t = useT(STRINGS);
  const toast = useToast();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const { data, error, loading, refresh, setData } = useAsync(() => orderEmailDesignList(apiClient, workspaceId), [workspaceId]);
  const [toggling, setToggling] = useState<string | null>(null);
  const [editing, setEditing] = useState<OrderEmailDesignTemplate | null>(null);

  const replace = (template: OrderEmailDesignTemplate) =>
    setData((prev) => (prev ? { ...prev, templates: prev.templates.map((x) => (x.key === template.key ? template : x)) } : (prev as never)));

  async function toggle(template: OrderEmailDesignTemplate) {
    setToggling(template.key);
    try {
      const updated = await orderEmailDesignSave(apiClient, workspaceId, template.key, { isEnabled: !template.isEnabled });
      replace(updated);
      toast.success(fmt(updated.isEnabled ? t.enabled : t.disabled, { name: nameOf(t, template.key) }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setToggling(null);
    }
  }

  return (
    <section id="order-emails" className="scroll-mt-6 rounded-[var(--radius-card)] border border-line p-5">
      <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t.description}</p>
      {/* The sender name and Reply-To (OrderEmailSender.tsx). */}
      <OrderEmailSender />
      {/* The store's own From domain (SendingDomainSection.tsx, item 173). */}
      <SendingDomainSection />

      <div className="mt-4">
        {isPermissionError(error) ? (
          <Alert>{t.readOnly}</Alert>
        ) : (
          <DataState loading={loading} error={error} onRetry={() => void refresh()}>
            <ul className="divide-y divide-line">
              {(data?.templates ?? []).map((template) => {
                const name = nameOf(t, template.key);
                return (
                  <li key={template.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink">
                        {name}
                        {template.isCustomised && <span className="ms-2 rounded-full bg-paper px-2 py-0.5 text-xs font-normal text-ink-soft">{template.blocks?.length ? t.designed : t.edited}</span>}
                      </p>
                      <p className="text-xs text-ink-soft">{whenOf(t, template.key)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(template)}>
                        {t.edit}
                      </Button>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={template.isEnabled}
                        aria-label={fmt(t.switchLabel, { name })}
                        disabled={toggling === template.key}
                        onClick={() => void toggle(template)}
                        className={cn(
                          "relative h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                          template.isEnabled ? "border-primary bg-primary" : "border-line-strong bg-paper"
                        )}
                      >
                        <span
                          className={cn(
                            "absolute top-0.5 size-4.5 rounded-full bg-paper-raised shadow-sm transition-[inset-inline-start]",
                            template.isEnabled ? "start-[1.375rem]" : "start-0.5"
                          )}
                        />
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </DataState>
        )}
      </div>

      {editing && data && (
        <OrderEmailEditor
          key={editing.key}
          layout="modal"
          title={fmt(t.editTitle, { name: nameOf(t, editing.key) })}
          template={editing}
          tokens={data.tokens}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            replace(updated);
            setEditing(null);
            toast.success(t.saved);
          }}
        />
      )}
    </section>
  );
}

