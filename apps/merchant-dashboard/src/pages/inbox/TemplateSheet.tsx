import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Alert, Button, Input } from "@store-builder/ui";
import type { WhatsappTemplatePayload } from "@store-builder/api-client";
import { IconDelete, IconPlus } from "@/components/icons";
import { TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { TemplatePicker } from "@/components/WhatsappTemplates";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { ApiError, getErrorMessage } from "@/lib/errors";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { WINDOW_HOURS } from "./inboxScreen";

const STRINGS = {
  en: {
    newMessage: "New message",
    newMessageHint: "WhatsApp needs an approved template to start a new conversation.",
    sendTemplate: "Send template",
    sendTemplateHint: "The {n}-hour window is closed, so WhatsApp only takes an approved template until the customer replies.",
    templateName: "Template name",
    templateNameHint: "Exactly as approved in Meta, e.g. order_confirmation",
    invalidTemplateName: "Use lowercase letters, numbers and underscores only.",
    language: "Language code",
    languageHint: "e.g. ar, en_US",
    params: "Variables",
    paramsHint: "Fill the template's placeholders in order.",
    param: "Variable {n}",
    addParam: "Add variable",
    removeParam: "Remove variable {n}",
    sent: "Message sent.",
    phone: "Customer phone",
    phoneHint: "With country code, e.g. 201012345678",
    invalidPhone: "Enter a valid phone number with country code.",
    windowClosedToast: "The {n}-hour window closed — send a template instead.",
    notConnectedToast: "WhatsApp is disconnected. Reconnect it from Settings.",
    cancel: "Cancel",
    sending: "Sending…",
  },
  ar: {
    newMessage: "رسالة جديدة",
    newMessageHint: "واتساب محتاج قالب متوافق عليه عشان تبدأ محادثة جديدة.",
    sendTemplate: "ابعت قالب",
    sendTemplateHint: "فترة الـ {n} ساعة خلصت، فواتساب مش بيقبل غير قالب متوافق عليه لحد ما العميل يرد.",
    templateName: "اسم القالب",
    templateNameHint: "زي ما هو متوافق عليه في Meta، مثلًا order_confirmation",
    invalidTemplateName: "استخدم حروف إنجليزي صغيرة وأرقام و _ بس.",
    language: "كود اللغة",
    languageHint: "مثلًا ar أو en_US",
    params: "المتغيرات",
    paramsHint: "املى خانات القالب بالترتيب.",
    param: "متغير {n}",
    addParam: "ضيف متغير",
    removeParam: "شيل متغير {n}",
    sent: "الرسالة اتبعتت.",
    phone: "رقم العميل",
    phoneHint: "بكود الدولة، مثلًا 201012345678",
    invalidPhone: "اكتب رقم صحيح بكود الدولة.",
    windowClosedToast: "فترة الـ {n} ساعة خلصت — ابعت قالب بدلها.",
    notConnectedToast: "واتساب مفصول. اربطه تاني من الإعدادات.",
    cancel: "إلغاء",
    sending: "بنبعت…",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

/** The two refusals WhatsApp gives a send, in the merchant's words; anything else as the server said it. */
export function sendErrorText(err: unknown, t: Pick<Strings, "windowClosedToast" | "notConnectedToast">): string {
  if (err instanceof ApiError) {
    if (err.code === "WHATSAPP_WINDOW_CLOSED") return fmt(t.windowClosedToast, { n: WINDOW_HOURS });
    if (err.code === "WHATSAPP_NOT_CONNECTED") return t.notConnectedToast;
  }
  return getErrorMessage(err);
}

/** The same two sentences, for the composer of a conversation. */
export function useSendErrorText(): (err: unknown) => string {
  const t = useT(STRINGS);
  return (err) => sendErrorText(err, t);
}

/**
 * The template sender, in a sheet: «رسالة جديدة» from the list (it asks for
 * the number) and «ابعت قالب» from a conversation whose 24-hour window closed
 * (the number is the conversation's). What is sent is what the old form sent:
 * the approved name, the language and the variables in order.
 *
 * It is a `Modal`: a sheet from the bottom on a phone, centred from 640px, and
 * it asks before a half-typed message is thrown away by a stray tap.
 */
export function TemplateSheet({
  open,
  onClose,
  to,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  /** Fixed recipient; when left out the sheet asks for a phone number. */
  to?: string;
  onSent: (conversationId: string) => void;
}) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [language, setLanguage] = useState("ar");
  const [params, setParams] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  // Every opening starts clean: the last message is not offered again to another customer.
  useEffect(() => {
    if (!open) return;
    setPhone("");
    setName("");
    setLanguage("ar");
    setParams([]);
    setErrors({});
    setFormError(null);
    setSending(false);
  }, [open]);

  function focusField(field: string) {
    const control = formRef.current?.querySelector<HTMLElement>(`[name="${field}"]`);
    control?.focus();
    control?.scrollIntoView({ block: "center" });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (sending) return;
    const next: Record<string, string> = {};
    const recipient = to ?? phone.replace(/[\s+()-]/g, "");
    if (!to && !/^\d{8,15}$/.test(recipient)) next.phone = t.invalidPhone;
    if (!/^[a-z0-9_]+$/.test(name.trim())) next.name = t.invalidTemplateName;
    setErrors(next);
    setFormError(null);
    if (Object.keys(next).length) {
      // The first field that needs fixing, in the order they are on the sheet.
      focusField(next.phone ? "phone" : "name");
      return;
    }
    const template: WhatsappTemplatePayload = {
      name: name.trim(),
      language: language.trim() || "ar",
      params: params.map((p) => p.trim()),
    };
    setSending(true);
    try {
      const message = await apiClient.sendWhatsappMessage(workspaceId, { to: recipient, template });
      toast.success(t.sent);
      onSent(message.conversationId);
    } catch (err) {
      setFormError(sendErrorText(err, t));
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={to ? t.sendTemplate : t.newMessage}
      description={to ? fmt(t.sendTemplateHint, { n: WINDOW_HOURS }) : t.newMessageHint}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" onClick={onClose} disabled={sending}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="rounded-full px-5" disabled={sending || !name.trim() || (!to && !phone.trim())}>
            {sending ? t.sending : t.sendTemplate}
          </Button>
        </>
      }
    >
      <form id={formId} ref={formRef} onSubmit={submit} className="space-y-4" noValidate>
        {formError && <Alert variant="danger">{formError}</Alert>}
        {!to && (
          <TextField
            name="phone"
            label={t.phone}
            required
            dir="ltr"
            inputMode="tel"
            autoComplete="off"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            error={errors.phone}
            hint={t.phoneHint}
          />
        )}
        {/* A template synced from Meta fills the name, language and variable count. */}
        <TemplatePicker
          name={name}
          language={language}
          onPick={(tpl) => {
            setName(tpl.name);
            setLanguage(tpl.language);
            setParams((prev) => Array.from({ length: tpl.paramsCount }, (_, i) => prev[i] ?? ""));
          }}
        />
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <TextField
            name="name"
            label={t.templateName}
            required
            dir="ltr"
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            value={name}
            onChange={(e) => setName(e.target.value)}
            error={errors.name}
            hint={t.templateNameHint}
          />
          <TextField
            name="language"
            label={t.language}
            required
            dir="ltr"
            autoCapitalize="none"
            autoComplete="off"
            spellCheck={false}
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            hint={t.languageHint}
          />
        </div>
        <div className="space-y-2">
          <div>
            <p className="text-sm font-medium text-ink">{t.params}</p>
            <p className="text-xs text-ink-soft">{t.paramsHint}</p>
          </div>
          {params.map((p, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={p}
                dir="auto"
                aria-label={fmt(t.param, { n: i + 1 })}
                placeholder={fmt(t.param, { n: i + 1 })}
                onChange={(e) => setParams((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                className="h-11"
              />
              <Button
                type="button"
                variant="ghost"
                className="size-11 shrink-0 rounded-full p-0 text-ink-soft hover:text-danger"
                aria-label={fmt(t.removeParam, { n: i + 1 })}
                title={fmt(t.removeParam, { n: i + 1 })}
                onClick={() => setParams((prev) => prev.filter((_, j) => j !== i))}
              >
                <IconDelete className="size-[18px]" aria-hidden />
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" className="min-h-11 rounded-full px-4" onClick={() => setParams((prev) => [...prev, ""])}>
            <IconPlus className="size-4" weight="bold" aria-hidden /> {t.addParam}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
