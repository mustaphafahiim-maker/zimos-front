import { useId, useMemo, useRef, useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import { ApiError } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import {
  DEFAULT_WHATSAPP_TEMPLATE,
  WHATSAPP_PLACEHOLDERS,
  WHATSAPP_TEMPLATE_MAX,
  fillWhatsAppTemplate,
  type WhatsAppPlaceholder,
} from "@/lib/whatsapp";

/**
 * Role keys that can change the message: PATCH /workspaces/:id needs
 * website.edit, and this key orders.manage on top — only the owner and a
 * workspace manager hold both (SYSTEM_ROLES in the backend). Anyone else sees
 * it read-only; a 403 on save turns the card read-only too.
 */
const EDITOR_ROLES: ReadonlySet<string> = new Set(["owner", "workspace_manager"]);

const STRINGS = {
  en: {
    title: "WhatsApp confirmation message",
    description:
      "The message WhatsApp opens with when an agent taps WhatsApp in the confirmation queue. The agent still sends it from their own WhatsApp.",
    placeholders: "Insert a detail:",
    placeholder_store: "Store name",
    placeholder_orderNumber: "Order number",
    placeholder_items: "Items",
    placeholder_total: "Total",
    placeholder_customerName: "Customer name",
    message: "Message",
    count: "{n} / {max} characters",
    preview: "Preview with a sample order",
    usingDefault: "This store uses the default message.",
    readOnlyTitle: "View only",
    readOnly: "Only the store owner or a workspace manager can change this message.",
    save: "Save message",
    saving: "Saving…",
    restore: "Use the default message",
    saved: "WhatsApp message saved.",
    restored: "The default message is back.",
    sampleCustomer: "Mona Ali",
    sampleItems: "2 × Linen shirt (Blue, L)",
    sampleTotal: "EGP 850.00",
  },
  ar: {
    title: "رسالة التأكيد عبر واتساب",
    description:
      "النص الذي يُفتح به واتساب عندما يضغط الموظف زر واتساب في قائمة التأكيد. يرسلها الموظف من حسابه على واتساب.",
    placeholders: "أدرج بيانًا:",
    placeholder_store: "اسم المتجر",
    placeholder_orderNumber: "رقم الطلب",
    placeholder_items: "المنتجات",
    placeholder_total: "الإجمالي",
    placeholder_customerName: "اسم العميل",
    message: "الرسالة",
    count: "{n} / {max} حرفًا",
    preview: "معاينة على طلب تجريبي",
    usingDefault: "يستخدم هذا المتجر الرسالة الافتراضية.",
    readOnlyTitle: "عرض فقط",
    readOnly: "يمكن لمالك المتجر أو مدير مساحة العمل فقط تغيير هذه الرسالة.",
    save: "حفظ الرسالة",
    saving: "جارٍ الحفظ…",
    restore: "استخدام الرسالة الافتراضية",
    saved: "تم حفظ رسالة واتساب.",
    restored: "عادت الرسالة الافتراضية.",
    sampleCustomer: "منى علي",
    sampleItems: "2 × قميص كتان (أزرق، L)",
    sampleTotal: "‏850٫00 ج.م.‏",
  },
} satisfies Messages;

export function WhatsAppMessageSection() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { currentWorkspace, applySavedWorkspace } = useWorkspace();
  const textareaId = useId();
  const countId = useId();
  const textarea = useRef<HTMLTextAreaElement>(null);

  const stored = currentWorkspace?.settings?.confirmation_whatsapp_template ?? null;
  const [saved, setSaved] = useState<string | null>(stored);
  const [draft, setDraft] = useState<string>(stored ?? DEFAULT_WHATSAPP_TEMPLATE);
  const [forbidden, setForbidden] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const editable = EDITOR_ROLES.has(currentWorkspace?.role ?? "") && !forbidden;
  const current = saved ?? DEFAULT_WHATSAPP_TEMPLATE;
  const dirty = draft.trim() !== current.trim();
  const preview = useMemo(
    () =>
      fillWhatsAppTemplate(draft, {
        store: currentWorkspace?.name ?? "",
        orderNumber: "ORD-1042",
        items: t.sampleItems,
        total: t.sampleTotal,
        customerName: t.sampleCustomer,
      }),
    [draft, currentWorkspace?.name, t]
  );

  function insert(key: WhatsAppPlaceholder) {
    const el = textarea.current;
    const token = `{${key}}`;
    if (!el) {
      setDraft((prev) => prev + token);
      return;
    }
    const start = el.selectionStart ?? draft.length;
    const end = el.selectionEnd ?? draft.length;
    const next = draft.slice(0, start) + token + draft.slice(end);
    if (next.length > WHATSAPP_TEMPLATE_MAX) return;
    setDraft(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + token.length, start + token.length);
    });
  }

  async function save(template: string | null) {
    setSaving(true);
    setError(null);
    try {
      // The default is stored as "nothing", so a later change to it reaches this store too.
      const value = template === null || template.trim() === DEFAULT_WHATSAPP_TEMPLATE.trim() ? null : template.trim();
      const workspace = await apiClient.updateWorkspace(workspaceId, {
        settings: { confirmation_whatsapp_template: value },
      });
      const next = workspace.settings?.confirmation_whatsapp_template ?? null;
      setSaved(next);
      setDraft(next ?? DEFAULT_WHATSAPP_TEMPLATE);
      applySavedWorkspace(workspace);
      toast.success(template === null ? t.restored : t.saved);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
        setDraft(current);
      } else {
        setError(errorMessage(err));
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5">
      <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t.description}</p>

      <div className="mt-4 space-y-4">
        {!editable && (
          <Alert>
            <p className="font-medium">{t.readOnlyTitle}</p>
            <p>{t.readOnly}</p>
          </Alert>
        )}

        {editable && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-ink-soft">{t.placeholders}</span>
            {WHATSAPP_PLACEHOLDERS.map((key) => (
              <Button
                key={key}
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11"
                onClick={() => insert(key)}
                disabled={saving}
              >
                {t[`placeholder_${key}`]}
              </Button>
            ))}
          </div>
        )}

        <div className="space-y-1.5">
          <label htmlFor={textareaId} className="text-sm font-medium text-ink">
            {t.message}
          </label>
          <Textarea
            ref={textarea}
            id={textareaId}
            dir="auto"
            rows={6}
            value={draft}
            maxLength={WHATSAPP_TEMPLATE_MAX}
            readOnly={!editable}
            aria-describedby={countId}
            onChange={(e) => setDraft(e.target.value)}
          />
          <p id={countId} className="text-xs text-ink-soft">
            {fmt(t.count, { n: draft.length, max: WHATSAPP_TEMPLATE_MAX })}
            {saved === null && <> · {t.usingDefault}</>}
          </p>
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-medium text-ink">{t.preview}</p>
          <p dir="auto" className="whitespace-pre-line rounded-[0.5rem] bg-paper px-4 py-3 text-sm text-ink">
            {preview}
          </p>
        </div>

        {error && <Alert variant="danger">{error}</Alert>}

        {editable && (
          <div className="flex flex-wrap justify-end gap-2">
            {saved !== null && (
              <Button variant="outline" className="min-h-11" disabled={saving} onClick={() => void save(null)}>
                {t.restore}
              </Button>
            )}
            <Button
              className="min-h-11"
              disabled={saving || !dirty || draft.trim() === ""}
              onClick={() => void save(draft)}
            >
              {saving ? t.saving : t.save}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
