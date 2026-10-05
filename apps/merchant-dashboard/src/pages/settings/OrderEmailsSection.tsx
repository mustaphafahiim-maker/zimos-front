import { useEffect, useRef, useState } from "react";
import { Alert, Button, cn } from "@store-builder/ui";
import {
  orderEmailsList,
  orderEmailsPreview,
  orderEmailsSendTest,
  orderEmailsUpdate,
  type OrderEmailKey,
  type OrderEmailPreview,
  type OrderEmailTemplateDto,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { Field, TextField } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { OrderEmailSender } from "./OrderEmailSender";

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
    name_transfer_rejected: "Transfer rejected",
    when_transfer_rejected: "When you reject a transfer receipt (unless you untick “Tell the customer”) — with a link to send a new one",
    on: "On",
    off: "Off",
    switchLabel: "Send “{name}”",
    edit: "Edit",
    edited: "Edited",
    editTitle: "Edit “{name}”",
    subject: "Subject",
    body: "Message",
    tokens: "Insert a detail:",
    preview: "Preview with a sample order",
    previewFrame: "Email preview",
    restore: "Use the built-in text",
    sendTest: "Send me a test",
    testSent: "Test sent to {to}.",
    testFailed: "The test could not be sent: {error}",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
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
    name_transfer_rejected: "رفض التحويل",
    when_transfer_rejected: "لما ترفض إيصال تحويل (إلا لو شلت علامة «بلّغ العميل») — برابط لرفع إيصال جديد",
    on: "مفعّلة",
    off: "متوقفة",
    switchLabel: "إرسال «{name}»",
    edit: "تعديل",
    edited: "معدّلة",
    editTitle: "تعديل «{name}»",
    subject: "العنوان",
    body: "نص الرسالة",
    tokens: "أدرج بيانًا:",
    preview: "معاينة على طلب تجريبي",
    previewFrame: "معاينة الرسالة",
    restore: "استخدام النص الأصلي",
    sendTest: "أرسل لي رسالة تجريبية",
    testSent: "تم إرسال الرسالة التجريبية إلى {to}.",
    testFailed: "تعذّر إرسال الرسالة التجريبية: {error}",
    save: "حفظ",
    saving: "جارٍ الحفظ…",
    cancel: "إلغاء",
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
  const { data, error, loading, refresh, setData } = useAsync(() => orderEmailsList(apiClient, workspaceId), [workspaceId]);
  const [toggling, setToggling] = useState<string | null>(null);
  const [editing, setEditing] = useState<OrderEmailTemplateDto | null>(null);

  const replace = (template: OrderEmailTemplateDto) =>
    setData((prev) => (prev ? { ...prev, templates: prev.templates.map((x) => (x.key === template.key ? template : x)) } : (prev as never)));

  async function toggle(template: OrderEmailTemplateDto) {
    setToggling(template.key);
    try {
      const updated = await orderEmailsUpdate(apiClient, workspaceId, template.key, { isEnabled: !template.isEnabled });
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
                        {template.isCustomised && <span className="ms-2 rounded-full bg-paper px-2 py-0.5 text-xs font-normal text-ink-soft">{t.edited}</span>}
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
        <EmailEditor
          key={editing.key}
          t={t}
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

function EmailEditor({
  t,
  template,
  tokens,
  onClose,
  onSaved,
}: {
  t: T;
  template: OrderEmailTemplateDto;
  tokens: string[];
  onClose: () => void;
  onSaved: (template: OrderEmailTemplateDto) => void;
}) {
  const toast = useToast();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [preview, setPreview] = useState<OrderEmailPreview | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const focused = useRef<"subject" | "body">("body");
  const name = nameOf(t, template.key);

  // The preview follows the text, a moment after the merchant stops typing.
  useEffect(() => {
    let stale = false;
    const id = window.setTimeout(async () => {
      try {
        const result = await orderEmailsPreview(apiClient, workspaceId, template.key, { subject, body });
        if (!stale) setPreview(result);
      } catch {
        /* the preview is a convenience; saving reports real errors */
      }
    }, 400);
    return () => {
      stale = true;
      window.clearTimeout(id);
    };
  }, [workspaceId, template.key, subject, body]);

  const insert = (token: string) => {
    const text = `{{${token}}}`;
    if (focused.current === "subject") setSubject((v) => `${v}${text}`);
    else setBody((v) => `${v}${text}`);
  };

  async function save() {
    if (!subject.trim() || !body.trim()) return;
    setSaving(true);
    setFormError(null);
    try {
      onSaved(await orderEmailsUpdate(apiClient, workspaceId, template.key, { subject: subject.trim(), body: body.trim() }));
    } catch (err) {
      setFormError(errorMessage(err));
      setSaving(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      const result = await orderEmailsSendTest(apiClient, workspaceId, template.key, { subject: subject.trim(), body: body.trim() });
      if (result.ok) toast.success(fmt(t.testSent, { to: result.to }));
      else toast.error(fmt(t.testFailed, { error: result.error ?? "" }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setTesting(false);
    }
  }

  const isDefault = subject === template.defaults.subject && body === template.defaults.body;

  return (
    <Modal
      open
      onClose={onClose}
      title={fmt(t.editTitle, { name })}
      className="max-w-3xl"
      footer={
        <>
          <Button variant="ghost" onClick={() => void sendTest()} disabled={testing || saving || !subject.trim() || !body.trim()}>
            {t.sendTest}
          </Button>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t.cancel}
          </Button>
          <Button onClick={() => void save()} disabled={saving || !subject.trim() || !body.trim()}>
            {saving ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-4">
          {formError && <Alert variant="danger">{formError}</Alert>}
          <TextField label={t.subject} dir="auto" maxLength={200} value={subject} onFocus={() => (focused.current = "subject")} onChange={(e) => setSubject(e.target.value)} />
          <Field label={t.body}>
            {({ id }) => (
              <Textarea id={id} dir="auto" rows={10} maxLength={10000} value={body} onFocus={() => (focused.current = "body")} onChange={(e) => setBody(e.target.value)} />
            )}
          </Field>
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-ink-soft">{t.tokens}</span>
            {tokens.map((token) => (
              <button
                key={token}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insert(token)}
                className="cursor-pointer rounded-full border border-line bg-paper px-2 py-0.5 font-mono text-ink-soft hover:border-primary hover:text-primary"
              >
                {token}
              </button>
            ))}
          </div>
          {!isDefault && (
            <button
              type="button"
              onClick={() => {
                setSubject(template.defaults.subject);
                setBody(template.defaults.body);
              }}
              className="cursor-pointer text-xs text-primary hover:underline"
            >
              {t.restore}
            </button>
          )}
        </div>

        <div className="min-w-0">
          <p className="mb-1.5 text-sm font-medium text-ink">{t.preview}</p>
          {preview && (
            <p className="mb-2 truncate rounded bg-paper px-2 py-1 text-xs text-ink" dir="auto">
              {preview.subject}
            </p>
          )}
          {/* sandbox with no allowances: the email's HTML can neither run scripts nor reach the dashboard. */}
          <iframe
            title={t.previewFrame}
            sandbox=""
            srcDoc={preview ? `<!doctype html><html><body style="margin:12px;background:#fff">${preview.html}</body></html>` : ""}
            className="h-80 w-full rounded-[0.5rem] border border-line bg-white"
          />
        </div>
      </div>
    </Modal>
  );
}
