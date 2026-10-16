import { useEffect, useId, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { IconKey } from "@/components/icons";
import { Alert, Button } from "@store-builder/ui";
import { giftCardIssue, type GiftCardIssued } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate, formatMoney, majorToMinor } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { GiftCardArt } from "@/pages/offers/hub/GiftCardArt";
import { Modal } from "@/components/Modal";
import { Field, TextField } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { Textarea } from "@/components/Textarea";
import { CopyButton } from "@/components/CopyButton";
import { EMAIL_RE, GIFT_CARD_STRINGS, dateFieldToIso, tomorrowDateField } from "./giftCardStrings";

// What the preview says; the form keeps the shared gift-card strings.
const PREVIEW_STRINGS = {
  en: {
    title: "How the recipient gets it",
    hint: "The real code appears once, after you make the card.",
    yourStore: "Your store",
    messageLabel: "Your message",
    emailTo: "Emailed to {email}",
    notEmailed: "Not emailed: you hand over the code yourself.",
  },
  ar: {
    title: "هكذا ستصل إلى المستلم",
    hint: "يظهر الرمز الحقيقي مرة واحدة، بعد إنشاء البطاقة.",
    yourStore: "متجرك",
    messageLabel: "رسالتك",
    emailTo: "ستُرسل إلى {email}",
    notEmailed: "لن تُرسل بالبريد الإلكتروني: ستسلّم أنت الرمز إلى العميل.",
  },
} satisfies Messages;

/** Arabic digits typed into the value, as the Latin ones the parser reads. */
const latinDigits = (text: string) => text.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));

interface Draft {
  amount: string;
  expires: string;
  recipientName: string;
  recipientEmail: string;
  message: string;
  note: string;
  sendEmail: boolean;
}

const EMPTY: Draft = { amount: "", expires: "", recipientName: "", recipientEmail: "", message: "", note: "", sendEmail: true };

type Errors = Partial<Record<"amount" | "expires" | "recipientEmail", string>>;

/**
 * "Issue gift card" (POST /gift-cards): a value in the store's currency, an
 * optional end date, recipient and message, and whether to email the code.
 * The answer carries the code in full this once; `onIssued` hands it to
 * <IssuedCodeDialog>, which says to save it now.
 */
export function IssueGiftCardDialog({
  open,
  currency,
  onClose,
  onIssued,
}: {
  open: boolean;
  currency: string;
  onClose: () => void;
  onIssued: (issued: GiftCardIssued, emailedTo: string | null) => void;
}) {
  const t = useT(GIFT_CARD_STRINGS);
  const p = useT(PREVIEW_STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const errorMessage = useErrorMessage();
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const formId = useId();
  const sendHint = useId();

  useEffect(() => {
    if (open) {
      setDraft(EMPTY);
      setErrors({});
      setFailure(null);
    }
  }, [open]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }));
    if (key in errors) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const email = draft.recipientEmail.trim();

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const amount = majorToMinor(latinDigits(draft.amount));
    const expiresAt = dateFieldToIso(draft.expires);
    const found: Errors = {};
    if (!Number.isFinite(amount) || amount < 1) found.amount = t.amountError;
    if (draft.expires && (!expiresAt || new Date(expiresAt).getTime() <= Date.now())) found.expires = t.expiresError;
    if (email && !EMAIL_RE.test(email)) found.recipientEmail = t.emailError;
    setErrors(found);
    if (Object.keys(found).length > 0) {
      const first = (["amount", "expires", "recipientEmail"] as const).find((k) => found[k]);
      document.querySelector<HTMLElement>(`#${CSS.escape(formId)} [data-field="${first}"] input`)?.focus();
      return;
    }
    setSaving(true);
    setFailure(null);
    try {
      const issued = await giftCardIssue(apiClient, workspaceId, {
        amount,
        currency,
        expiresAt,
        recipientName: draft.recipientName.trim() || null,
        recipientEmail: email || null,
        message: draft.message.trim() || null,
        note: draft.note.trim() || null,
        sendEmail: Boolean(email) && draft.sendEmail,
      });
      onIssued(issued, email && draft.sendEmail ? email : null);
    } catch (err) {
      setFailure(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // The preview: what is typed so far, as the card. Nothing is sent until the form is.
  const previewAmount = majorToMinor(latinDigits(draft.amount));
  const previewExpiry = dateFieldToIso(draft.expires);
  const message = draft.message.trim();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.issueTitle}
      description={t.issueDescription}
      className="sm:max-w-[46rem] md:max-w-[52rem]"
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={saving} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="rounded-full px-5" disabled={saving}>
            {saving ? t.issuing : t.issueSubmit}
          </Button>
        </>
      }
    >
     <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_17.5rem] md:gap-6">
      {/* First on a phone, at the end side from md up. */}
      <aside aria-label={p.title} className="md:order-2">
        <div className="mx-auto max-w-[17.5rem] md:sticky md:top-0">
          <p className="mb-2 text-[13px] leading-5 font-semibold text-ink">{p.title}</p>
          <GiftCardArt
            store={currentWorkspace?.name ?? p.yourStore}
            amount={Number.isFinite(previewAmount) && previewAmount > 0 ? formatMoney(previewAmount, currency) : ""}
            expiry={previewExpiry ? fmt(t.validUntil, { date: formatDate(previewExpiry) }) : t.noExpiry}
            recipient={draft.recipientName.trim() || undefined}
          />
          {message && (
            <div className="zimos-offer-paper mt-3 rounded-[1rem] bg-paper-raised px-3.5 py-3 ring-1 ring-line">
              <p className="text-xs text-ink-soft">{p.messageLabel}</p>
              <p dir="auto" className="mt-0.5 text-sm leading-6 break-words whitespace-pre-line text-ink">
                {message}
              </p>
            </div>
          )}
          <p className="mt-3 text-xs leading-5 text-ink-soft">
            {email && draft.sendEmail ? (
              <>
                {fmt(p.emailTo, { email: "" })}
                <bdi dir="ltr">{email}</bdi>
                {". "}
              </>
            ) : (
              <>{p.notEmailed} </>
            )}
            {p.hint}
          </p>
        </div>
      </aside>
      <form id={formId} onSubmit={submit} noValidate className="min-w-0 space-y-4 md:order-1">
        <div data-field="amount">
          <MoneyInput
            label={t.amount}
            required
            currency={currency}
            value={draft.amount}
            onChange={(v) => set("amount", v)}
            error={errors.amount}
          />
        </div>
        <div data-field="expires">
          <Field label={t.expires} hint={t.expiresHint} error={errors.expires}>
            {(props) => (
              <input
                {...props}
                type="date"
                min={tomorrowDateField()}
                value={draft.expires}
                onChange={(e) => set("expires", e.target.value)}
                className="flex h-11 w-full max-w-[14rem] rounded-[var(--radius)] border border-line-strong bg-paper-raised px-3 text-sm text-ink focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none"
              />
            )}
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={t.recipientName}
            autoComplete="off"
            maxLength={200}
            value={draft.recipientName}
            onChange={(e) => set("recipientName", e.target.value)}
          />
          <div data-field="recipientEmail">
            <TextField
              label={t.recipientEmail}
              type="email"
              dir="ltr"
              autoComplete="off"
              maxLength={255}
              value={draft.recipientEmail}
              onChange={(e) => set("recipientEmail", e.target.value)}
              error={errors.recipientEmail}
            />
          </div>
        </div>
        <div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink has-[:disabled]:cursor-default has-[:disabled]:text-ink-soft">
            <input
              type="checkbox"
              className="size-5 shrink-0 cursor-pointer accent-primary disabled:cursor-default"
              checked={Boolean(email) && draft.sendEmail}
              disabled={!email}
              aria-describedby={email ? undefined : sendHint}
              onChange={(e) => set("sendEmail", e.target.checked)}
            />
            {t.sendEmail}
          </label>
          {!email && (
            <p id={sendHint} className="text-xs text-ink-soft">
              {t.sendEmailNeedsEmail}
            </p>
          )}
        </div>
        <Field label={t.message} hint={t.messageHint}>
          {(props) => (
            <Textarea {...props} rows={2} maxLength={500} value={draft.message} onChange={(e) => set("message", e.target.value)} />
          )}
        </Field>
        <Field label={t.note} hint={t.noteHint}>
          {(props) => <Textarea {...props} rows={2} maxLength={500} value={draft.note} onChange={(e) => set("note", e.target.value)} />}
        </Field>
        {failure && <Alert variant="danger">{failure}</Alert>}
      </form>
     </div>
    </Modal>
  );
}

/**
 * The code of a card just issued, in full this once: «احفظ الكود ده دلوقتي —
 * مش هيظهر كامل تاني», a copy button, and the way to the card's page.
 */
export function IssuedCodeDialog({
  issued,
  emailedTo,
  onClose,
}: {
  issued: GiftCardIssued | null;
  emailedTo: string | null;
  onClose: () => void;
}) {
  const t = useT(GIFT_CARD_STRINGS);
  return (
    <Modal
      open={issued !== null}
      onClose={onClose}
      title={t.issuedTitle}
      description={issued ? fmt(t.issuedOf, { amount: formatMoney(issued.giftCard.initialAmount, issued.giftCard.currency) }) : undefined}
      footer={
        issued && (
          <>
            <Link
              to={`/gift-cards/${issued.giftCard.id}`}
              onClick={onClose}
              className="inline-flex min-h-11 items-center rounded-[var(--radius)] px-3 text-sm font-semibold text-primary hover:bg-primary-soft"
            >
              {t.openIssued}
            </Link>
            <Button type="button" className="rounded-full px-5" onClick={onClose}>
              {t.done}
            </Button>
          </>
        )
      }
    >
      {issued && <CodeBox code={issued.code} note={emailedTo ? fmt(t.emailedTo, { email: emailedTo }) : null} warn />}
    </Modal>
  );
}

/** A card's code, large and left-to-right, with a copy button; `warn` adds the save-it-now line. */
export function CodeBox({ code, note, warn }: { code: string; note?: string | null; warn?: boolean }) {
  const t = useT(GIFT_CARD_STRINGS);
  return (
    <div className="space-y-3">
      {warn && (
        <p className="flex items-start gap-2 rounded-[var(--radius)] bg-accent-soft px-3 py-2 text-sm font-medium text-accent-dark">
          <IconKey className="mt-0.5 size-4 shrink-0" aria-hidden />
          {t.saveCodeNow}
        </p>
      )}
      <div className="rounded-[var(--radius-card)] bg-paper-sunken px-4 py-3">
        <p className="text-xs text-ink-soft">{t.codeLabel}</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <bdi dir="ltr" className="font-mono text-lg font-semibold tracking-wider text-ink select-all sm:text-xl">
            {code}
          </bdi>
          <CopyButton value={code} label={t.copyCode} className="min-h-11 text-sm" />
        </div>
      </div>
      {note && <p className="text-sm text-ink-soft">{note}</p>}
    </div>
  );
}
