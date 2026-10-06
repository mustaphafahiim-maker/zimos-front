import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Monitor, Send, Smartphone } from "lucide-react";
import { Alert, Button, Spinner, cn } from "@store-builder/ui";
import {
  apiFieldProblems,
  orderEmailDesignPreview,
  orderEmailDesignSave,
  orderEmailDesignSendTest,
  type EmailBlock,
  type OrderEmailDesignDraft,
  type OrderEmailDesignTemplate,
  type OrderEmailPreview,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { FilterTabs } from "@/components/FilterTabs";
import { useToast } from "@/components/Toast";
import { EmailBlockDesigner, TokenField } from "./EmailBlockDesigner";
import { blockProblems, fromBlock, hasProblems, seedFromBody, toBlock, type DraftBlock } from "./emailBlocks";

/**
 * One order email's editor (SPEC §14.5, handoff item 174), in two modes:
 * "Simple text" — the subject and plain body the store always had — and
 * "Designer" — the same subject over a stack of blocks (EmailBlockDesigner).
 * Both preview live with sample values (server-rendered, shown in a
 * sandboxed iframe) at phone or desktop width, send a test to the merchant,
 * and save. Saving in simple text sends `blocks: null`, back to the body.
 *
 * `layout="modal"` opens in the dashboard's Modal (Settings); `"inline"`
 * draws in place with a back button — for a list that already sits inside a
 * dialog (a funnel's settings), where a second dialog would stack under it.
 */

const STRINGS = {
  en: {
    modeLabel: "How this email is written",
    simple: "Simple text",
    designer: "Designer",
    simpleHint: "Your message as plain text under your store's logo.",
    designerHint: "Build the email from blocks: headings, text, buttons, images and the order table.",
    switchBackNote: "Saving in simple text replaces the design with this message.",
    subject: "Subject",
    body: "Message",
    insert: "Insert a detail:",
    restore: "Use the built-in text",
    paneLabel: "Edit or preview",
    paneEdit: "Edit",
    panePreview: "Preview",
    preview: "Preview with a sample order",
    previewFrame: "Email preview",
    widthLabel: "Preview width",
    phone: "Phone",
    desktop: "Computer",
    previewUpdating: "Updating the preview…",
    previewFailed: "The preview isn't available right now.",
    retry: "Try again",
    previewEmpty: "Add a block to see the email here.",
    skipped: "{n} unfinished block(s) aren't in the preview yet.",
    sendTest: "Send test",
    testSent: "Test sent to {to}.",
    testFailed: "The test could not be sent: {error}",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    back: "Back to the emails",
    subjectRequired: "Write a subject.",
    bodyRequired: "Write the message.",
    blocksRequired: "Add at least one block.",
    fixBlocks: "Some blocks need filling in — they're marked in red.",
  },
  ar: {
    modeLabel: "طريقة كتابة الإيميل",
    simple: "نص بسيط",
    designer: "مصمم",
    simpleHint: "رسالتك كنص عادي تحت لوجو متجرك.",
    designerHint: "ابني الإيميل من بلوكات: عناوين ونصوص وزراير وصور وجدول الطلب.",
    switchBackNote: "لو حفظت كنص بسيط، الرسالة دي هتحل محل التصميم.",
    subject: "العنوان",
    body: "نص الرسالة",
    insert: "ضيف بيان:",
    restore: "رجّع النص الأصلي",
    paneLabel: "تعديل أو معاينة",
    paneEdit: "تعديل",
    panePreview: "معاينة",
    preview: "معاينة على أوردر تجريبي",
    previewFrame: "معاينة الإيميل",
    widthLabel: "عرض المعاينة",
    phone: "موبايل",
    desktop: "كمبيوتر",
    previewUpdating: "بنحدّث المعاينة…",
    previewFailed: "المعاينة مش متاحة دلوقتي.",
    retry: "جرّب تاني",
    previewEmpty: "ضيف بلوك عشان تشوف الإيميل هنا.",
    skipped: "{n} بلوك لسه ناقصين ومش ظاهرين في المعاينة.",
    sendTest: "ابعت تجربة",
    testSent: "التجربة اتبعتت لـ {to}.",
    testFailed: "التجربة متبعتتش: {error}",
    save: "احفظ",
    saving: "بيحفظ…",
    cancel: "إلغاء",
    back: "رجوع للإيميلات",
    subjectRequired: "اكتب عنوان الإيميل.",
    bodyRequired: "اكتب نص الرسالة.",
    blocksRequired: "ضيف بلوك واحد على الأقل.",
    fixBlocks: "فيه بلوكات محتاجة تتكمّل — معلّمة بالأحمر.",
  },
} satisfies Messages;

type Mode = "simple" | "designer";

export interface OrderEmailEditorProps {
  template: OrderEmailDesignTemplate;
  tokens: string[];
  /** The dialog's or panel's title, e.g. “Edit “Order received””. */
  title: string;
  layout: "modal" | "inline";
  /** Shown above the form, e.g. which funnel the email is for. */
  note?: ReactNode;
  /** Replaces the "saving in simple text replaces the design" line (a funnel's version falls back to the store's design). */
  simpleNote?: string;
  /** Talks to the server for this email (the store's, or a funnel's / website's). */
  api?: EditorApi;
  onClose: () => void;
  onSaved: (template: OrderEmailDesignTemplate) => void;
}

/** The three calls the editor makes; the default ones edit the store's email. */
export interface EditorApi {
  save: (patch: { subject: string; body?: string; blocks: EmailBlock[] | null }) => Promise<OrderEmailDesignTemplate>;
  preview: (draft: OrderEmailDesignDraft) => Promise<OrderEmailPreview>;
  sendTest: (draft: OrderEmailDesignDraft) => Promise<{ ok: boolean; error: string | null; to: string }>;
}

/** A new button points at the link that email is about. */
const BUTTON_LINK: Partial<Record<OrderEmailDesignTemplate["key"], string>> = {
  abandoned_cart: "{{recovery_link}}",
  order_shipped: "{{tracking_url}}",
  subscription_started: "{{subscription_link}}",
};

export function OrderEmailEditor(props: OrderEmailEditorProps) {
  const { template, tokens, title, layout, note, simpleNote, onClose, onSaved } = props;
  const t = useT(STRINGS);
  const toast = useToast();
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const api = useMemo<EditorApi>(
    () =>
      props.api ?? {
        save: (patch) => orderEmailDesignSave(apiClient, workspaceId, template.key, patch),
        preview: (draft) => orderEmailDesignPreview(apiClient, workspaceId, template.key, draft),
        sendTest: (draft) => orderEmailDesignSendTest(apiClient, workspaceId, template.key, draft),
      },
    [props.api, workspaceId, template.key]
  );

  const [mode, setMode] = useState<Mode>(template.blocks?.length ? "designer" : "simple");
  const [subject, setSubject] = useState(template.subject);
  const [body, setBody] = useState(template.body);
  const [blocks, setBlocks] = useState<DraftBlock[]>(() => (template.blocks ?? []).map(fromBlock));
  const [openId, setOpenId] = useState<string | null>(null);
  const [reveal, setReveal] = useState(false);
  const [pane, setPane] = useState<"edit" | "preview">("edit");
  const [width, setWidth] = useState<"phone" | "desktop">("phone");
  const [preview, setPreview] = useState<OrderEmailPreview | null>(null);
  const [previewState, setPreviewState] = useState<"loading" | "ready" | "error" | "empty">("loading");
  const [previewTick, setPreviewTick] = useState(0);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [touched, setTouched] = useState<{ subject?: boolean; body?: boolean }>({});
  const formRef = useRef<HTMLDivElement>(null);

  // Blocks that can be rendered now; unfinished ones wait out of the preview.
  const ready = useMemo(() => blocks.filter((b) => !hasProblems(blockProblems(b))).map(toBlock), [blocks]);
  const skipped = blocks.length - ready.length;
  const readyKey = JSON.stringify(ready);

  // The preview follows the draft, a moment after the merchant stops typing.
  useEffect(() => {
    if (mode === "designer" && ready.length === 0) {
      setPreviewState("empty");
      return;
    }
    let stale = false;
    setPreviewState((s) => (s === "ready" ? "ready" : "loading"));
    const id = window.setTimeout(async () => {
      if (!stale) setPreviewState("loading");
      try {
        const draft: OrderEmailDesignDraft = mode === "designer" ? { subject, blocks: ready } : { subject, body, blocks: null };
        const result = await api.preview(draft);
        if (!stale) {
          setPreview(result);
          setPreviewState("ready");
        }
      } catch {
        // The preview is a convenience; saving reports real errors.
        if (!stale) setPreviewState("error");
      }
    }, 450);
    return () => {
      stale = true;
      window.clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, mode, subject, body, readyKey, previewTick]);

  function switchMode(next: Mode) {
    if (next === mode) return;
    // The first switch to the designer starts from what the plain body says.
    if (next === "designer" && blocks.length === 0) setBlocks(seedFromBody(body));
    setFormError(null);
    setReveal(false);
    setMode(next);
  }

  /** The draft as the server takes it, or null after saying what is missing. */
  function draft(): OrderEmailDesignDraft | null {
    setTouched({ subject: true, body: true });
    setFormError(null);
    if (!subject.trim()) {
      setPane("edit");
      return null;
    }
    if (mode === "simple") {
      if (!body.trim()) {
        setPane("edit");
        return null;
      }
      return { subject: subject.trim(), body: body.trim(), blocks: null };
    }
    if (blocks.length === 0) {
      setFormError(t.blocksRequired);
      setPane("edit");
      return null;
    }
    const firstBad = blocks.find((b) => hasProblems(blockProblems(b)));
    if (firstBad) {
      setReveal(true);
      setFormError(t.fixBlocks);
      setPane("edit");
      setOpenId(firstBad.id);
      window.requestAnimationFrame(() => document.getElementById(`email-block-${firstBad.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" }));
      return null;
    }
    return { subject: subject.trim(), blocks: blocks.map(toBlock) };
  }

  /** A 422 naming `blocks.N.…` opens block N. */
  function showServerError(err: unknown) {
    const field = apiFieldProblems(err).find((p) => /^blocks\.\d+/.test(p.field));
    if (field) {
      const index = Number(field.field.split(".")[1]);
      const block = blocks[index];
      if (block) {
        setOpenId(block.id);
        setPane("edit");
      }
    }
    setFormError(errorMessage(err));
    formRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  async function save() {
    const d = draft();
    if (!d) return;
    setSaving(true);
    try {
      const saved = await api.save({ subject: d.subject!, ...(d.body !== undefined ? { body: d.body } : {}), blocks: d.blocks ?? null });
      onSaved(saved);
    } catch (err) {
      showServerError(err);
      setSaving(false);
    }
  }

  async function sendTest() {
    const d = draft();
    if (!d) return;
    setTesting(true);
    try {
      const result = await api.sendTest(d);
      if (result.ok) toast.success(fmt(t.testSent, { to: result.to }));
      else toast.error(fmt(t.testFailed, { error: result.error ?? "" }));
    } catch (err) {
      showServerError(err);
    } finally {
      setTesting(false);
    }
  }

  const isDefault = subject === template.defaults.subject && body === template.defaults.body;
  const subjectError = touched.subject && !subject.trim() ? t.subjectRequired : undefined;
  const bodyError = touched.body && !body.trim() ? t.bodyRequired : undefined;

  const editPane = (
    <div ref={formRef} className={cn("min-w-0 scroll-mt-4 space-y-4", pane !== "edit" && "max-lg:hidden")}>
      {note}
      {formError && <Alert variant="danger">{formError}</Alert>}
      <div className="space-y-1.5">
        <FilterTabs
          label={t.modeLabel}
          value={mode}
          onChange={switchMode}
          tabs={[
            { value: "simple", label: t.simple },
            { value: "designer", label: t.designer },
          ]}
          className="[&>button]:min-h-10"
        />
        <p className="text-xs text-ink-soft">{mode === "designer" ? t.designerHint : t.simpleHint}</p>
      </div>

      <TokenField t={t} label={t.subject} value={subject} tokens={tokens} maxLength={200} error={subjectError} onChange={setSubject} />

      {mode === "simple" ? (
        <>
          <TokenField t={t} multiline label={t.body} value={body} tokens={tokens} maxLength={10000} error={bodyError} onChange={setBody} />
          {template.blocks?.length ? <p className="text-xs text-ink-soft">{simpleNote ?? t.switchBackNote}</p> : null}
          {!isDefault && (
            <button
              type="button"
              onClick={() => {
                setSubject(template.defaults.subject);
                setBody(template.defaults.body);
              }}
              className="min-h-11 cursor-pointer text-xs font-medium text-primary hover:underline sm:min-h-0"
            >
              {t.restore}
            </button>
          )}
        </>
      ) : (
        <EmailBlockDesigner
          blocks={blocks}
          onChange={setBlocks}
          tokens={tokens}
          openId={openId}
          onOpen={setOpenId}
          revealProblems={reveal}
          defaultButtonLink={BUTTON_LINK[template.key] ?? "{{order_link}}"}
        />
      )}
    </div>
  );

  const previewPane = (
    <div className={cn("min-w-0 space-y-2 lg:sticky lg:top-0 lg:self-start", pane !== "preview" && "max-lg:hidden")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">{t.preview}</p>
        <div role="group" aria-label={t.widthLabel} className="inline-flex gap-1 rounded-[0.5rem] border border-line bg-paper-raised p-1">
          {(
            [
              ["phone", t.phone, Smartphone],
              ["desktop", t.desktop, Monitor],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              aria-pressed={width === value}
              onClick={() => setWidth(value)}
              className={cn(
                "inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-[0.375rem] px-3 text-sm font-medium transition-colors sm:min-h-8",
                width === value ? "bg-primary-soft text-primary-dark dark:text-primary" : "text-ink-soft hover:text-ink"
              )}
            >
              <Icon className="size-4" aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>
      {preview && previewState !== "empty" && (
        <p className="truncate rounded-[var(--radius)] bg-paper-sunken px-2 py-1 text-xs text-ink" dir="auto">
          {preview.subject}
        </p>
      )}
      {mode === "designer" && skipped > 0 && previewState !== "empty" && <p className="text-xs text-ink-soft">{fmt(t.skipped, { n: skipped })}</p>}
      <div className="relative flex justify-center overflow-hidden rounded-[var(--radius-card)] bg-paper-sunken p-2">
        {previewState === "empty" ? (
          <p className="flex h-80 items-center px-4 text-center text-sm text-ink-soft">{t.previewEmpty}</p>
        ) : previewState === "error" && !preview ? (
          <div className="flex h-80 flex-col items-center justify-center gap-3 px-4 text-center">
            <p className="text-sm text-ink-soft">{t.previewFailed}</p>
            <Button type="button" size="sm" variant="outline" className="min-h-11 sm:min-h-8" onClick={() => setPreviewTick((n) => n + 1)}>
              {t.retry}
            </Button>
          </div>
        ) : (
          <>
            {/* sandbox with no allowances: the email's HTML can neither run scripts nor reach the dashboard. */}
            <iframe
              title={t.previewFrame}
              sandbox=""
              srcDoc={preview ? `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:12px;background:#fff">${preview.html}</body></html>` : ""}
              style={{ width: width === "phone" ? 375 : "100%" }}
              className="h-[60dvh] max-h-[40rem] min-h-80 max-w-full rounded-[var(--radius)] border border-line bg-white transition-[width] motion-reduce:transition-none"
            />
            {previewState === "loading" && (
              <p role="status" className="absolute inset-x-0 top-3 mx-auto flex w-fit items-center gap-2 rounded-full bg-paper-raised px-3 py-1 text-xs text-ink-soft shadow-[var(--shadow-card)]">
                <Spinner className="size-3.5" aria-hidden />
                {t.previewUpdating}
              </p>
            )}
            {previewState === "error" && preview && (
              <p role="status" className="absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-paper-raised px-3 py-1 text-xs text-danger shadow-[var(--shadow-card)]">
                {t.previewFailed}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );

  const content = (
    <div className="space-y-4">
      {/* On a phone the form and the preview take turns; from lg they sit side by side. */}
      <FilterTabs
        label={t.paneLabel}
        value={pane}
        onChange={setPane}
        tabs={[
          { value: "edit", label: t.paneEdit },
          { value: "preview", label: t.panePreview },
        ]}
        className="flex lg:hidden [&>button]:min-h-10 [&>button]:flex-1"
      />
      <div className="grid gap-6 lg:grid-cols-2">
        {editPane}
        {previewPane}
      </div>
    </div>
  );

  const actions = (
    <>
      <Button type="button" variant="ghost" className="min-h-11 sm:min-h-9" onClick={() => void sendTest()} disabled={testing || saving}>
        {testing ? <Spinner className="size-4" aria-hidden /> : <Send className="size-4 rtl:-scale-x-100" aria-hidden />}
        {t.sendTest}
      </Button>
      <Button type="button" variant="outline" className="min-h-11 sm:min-h-9" onClick={onClose} disabled={saving}>
        {t.cancel}
      </Button>
      <Button type="button" className="min-h-11 sm:min-h-9" onClick={() => void save()} disabled={saving}>
        {saving ? t.saving : t.save}
      </Button>
    </>
  );

  if (layout === "modal") {
    return (
      <Modal open onClose={onClose} title={title} className="max-w-6xl" footer={actions}>
        {content}
      </Modal>
    );
  }

  return (
    <section aria-label={title} className="space-y-4">
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" size="icon" className="size-11 sm:size-9" aria-label={t.back} title={t.back} onClick={onClose}>
          <ArrowLeft className="size-4 rtl:-scale-x-100" aria-hidden />
        </Button>
        <h3 className="min-w-0 truncate font-display text-base font-semibold text-ink">{title}</h3>
      </div>
      {content}
      <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-end gap-3 border-t border-line bg-paper-raised px-1 py-3">{actions}</div>
    </section>
  );
}
