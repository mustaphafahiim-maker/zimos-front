import { useId, useMemo, useRef, useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import { ApiError } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Textarea } from "@/components/Textarea";
import { SaveBar } from "@/components/SaveBar";
import { SettingsGroup, SettingsRow } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { SettingsCard } from "./sections/SettingsCard";
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
    restoreHint: "Your own wording is dropped and the store follows the standard message.",
    restoreAction: "Use the default",
    saved: "WhatsApp message saved.",
    restored: "The default message is back.",
    sampleCustomer: "Mona Ali",
    sampleItems: "2 × Linen shirt (Blue, L)",
    sampleTotal: "EGP 850.00",
  },
  ar: {
    title: "رسالة التأكيد عبر واتساب",
    description:
      "الكلام اللي واتساب بيفتح بيه لما الموظف يدوس واتساب في قايمة التأكيد. الموظف بيبعتها من واتساب بتاعه.",
    placeholders: "ضيف بيان في الرسالة:",
    placeholder_store: "اسم المتجر",
    placeholder_orderNumber: "رقم الأوردر",
    placeholder_items: "المنتجات",
    placeholder_total: "الإجمالي",
    placeholder_customerName: "اسم العميل",
    message: "الرسالة",
    count: "{n} / {max} حرف",
    preview: "معاينة على أوردر تجريبي",
    usingDefault: "المتجر ماشي على الرسالة الأساسية.",
    readOnlyTitle: "للعرض بس",
    readOnly: "صاحب المتجر أو المدير بس اللي يقدروا يغيّروا الرسالة دي.",
    save: "احفظ الرسالة",
    saving: "بنحفظ…",
    restore: "ارجع للرسالة الأساسية",
    restoreHint: "كلامك هيتشال والمتجر هيمشي على الرسالة الأساسية.",
    restoreAction: "رجّع الأساسية",
    saved: "رسالة واتساب اتحفظت.",
    restored: "رجعنا للرسالة الأساسية.",
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
  useReportDirty(dirty && editable);
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
    <>
      {!editable && (
        <Alert>
          <p className="font-medium">{t.readOnlyTitle}</p>
          <p>{t.readOnly}</p>
        </Alert>
      )}

      <SettingsCard description={t.description}>
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
            className="rounded-[0.875rem] text-base sm:text-sm"
          />
          <p id={countId} className="text-xs text-ink-soft">
            {fmt(t.count, { n: draft.length, max: WHATSAPP_TEMPLATE_MAX })}
            {saved === null && <> · {t.usingDefault}</>}
          </p>
        </div>

        {editable && (
          <div className="mt-3">
            <p className="text-[13px] leading-5 text-ink-soft">{t.placeholders}</p>
            {/* One row that scrolls sideways on a phone, so five chips do not push the preview off the first screen. */}
            <div className="-mx-4 mt-1.5 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
              {WHATSAPP_PLACEHOLDERS.map((key) => (
                <Button
                  key={key}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="min-h-11 shrink-0 rounded-full sm:min-h-9"
                  onClick={() => insert(key)}
                  disabled={saving}
                >
                  {t[`placeholder_${key}`]}
                </Button>
              ))}
            </div>
          </div>
        )}
      </SettingsCard>

      <SettingsCard title={t.preview}>
        <p dir="auto" className="rounded-[0.875rem] bg-paper-sunken px-4 py-3 text-sm leading-6 whitespace-pre-line text-ink">
          {preview}
        </p>
      </SettingsCard>

      {editable && saved !== null && (
        <SettingsGroup>
          <SettingsRow
            label={t.restore}
            hint={t.restoreHint}
            control={
              <Button variant="outline" className="min-h-11" disabled={saving} onClick={() => void save(null)}>
                {t.restoreAction}
              </Button>
            }
          />
        </SettingsGroup>
      )}

      {error && <Alert variant="danger">{error}</Alert>}

      {editable && (
        <SaveBar
          dirty={dirty}
          saving={saving}
          disabled={draft.trim() === ""}
          saveLabel={t.save}
          savingLabel={t.saving}
          onSave={() => void save(draft)}
          onDiscard={() => {
            setDraft(current);
            setError(null);
          }}
        />
      )}
    </>
  );
}
