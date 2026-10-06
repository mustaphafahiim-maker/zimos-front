import { useEffect, useId, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { KeyRound } from "lucide-react";
import { Alert, Button } from "@store-builder/ui";
import { giftCardIssue, type GiftCardIssued } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoney, majorToMinor } from "@/lib/format";
import { fmt, useT } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { Field, TextField } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { Textarea } from "@/components/Textarea";
import { CopyButton } from "@/components/CopyButton";
import { EMAIL_RE, GIFT_CARD_STRINGS, dateFieldToIso, tomorrowDateField } from "./giftCardStrings";

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
  const workspaceId = useWorkspaceId();
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
    const amount = majorToMinor(draft.amount.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d))));
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.issueTitle}
      description={t.issueDescription}
      footer={
        <>
          <Button type="button" variant="outline" className="min-h-11" disabled={saving} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="min-h-11" disabled={saving}>
            {saving ? t.issuing : t.issueSubmit}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
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
            <Button type="button" className="min-h-11" onClick={onClose}>
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
          <KeyRound className="mt-0.5 size-4 shrink-0" aria-hidden />
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
