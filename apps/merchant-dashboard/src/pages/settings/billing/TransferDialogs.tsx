import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Input, cn } from "@store-builder/ui";
import {
  apiErrorCode,
  apiErrorDetails,
  billingInvoiceOpen,
  billingInvoiceProofSend,
  billingPayOnline,
  billingPaymentMethodsGet,
  billingWalletTopup,
  type BillingOpenInvoice,
  type BillingPaymentMethod,
  type BillingWallet,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatDate, formatMoney, majorToMinor } from "@/lib/format";
import { useLocale, useT, fmt } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { CopyButton } from "@/components/CopyButton";
import { Field } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { CardSkeleton } from "@/components/DataState";
import { useToast } from "@/components/Toast";
import { BILLING_STRINGS, type BillingText } from "./billingStrings";

const IMAGE_TYPES = "image/jpeg,image/png,image/webp";
const MAX_BYTES = 8 * 1024 * 1024;

/** The codes of sending a proof that get their own sentence (item 334); the rest fall to the shared catalogue. */
function proofOverrides(t: BillingText, err: unknown): Record<string, string> {
  const range = apiErrorDetails<{ min?: number; max?: number; currency?: string }>(err);
  return {
    INVALID_SENDER_PHONE: t.INVALID_SENDER_PHONE,
    NO_FILE: t.NO_FILE,
    UNSUPPORTED_MEDIA_TYPE: t.UNSUPPORTED_MEDIA_TYPE,
    FILE_TOO_LARGE: t.FILE_TOO_LARGE,
    PROOF_IMAGE_DUPLICATE: t.PROOF_IMAGE_DUPLICATE,
    PROOF_ALREADY_OPEN: t.PROOF_ALREADY_OPEN,
    TOO_MANY_OPEN_PROOFS: t.TOO_MANY_OPEN_PROOFS,
    TOO_MANY_OPEN_TOPUPS: t.TOO_MANY_OPEN_TOPUPS,
    RATE_LIMITED: t.PROOF_RATE_LIMITED,
    PAYMENT_METHOD_NOT_AVAILABLE: t.PAYMENT_METHOD_NOT_AVAILABLE,
    MANUAL_PRICING: t.MANUAL_PRICING,
    NOTHING_TO_PAY: t.NOTHING_TO_PAY,
    PLAN_IS_FREE: t.NOTHING_TO_PAY,
    CHARGE_NOT_PENDING: t.CHARGE_NOT_PENDING,
    MANUAL_PAYMENT_CURRENCY_UNSUPPORTED: t.MANUAL_PAYMENT_CURRENCY_UNSUPPORTED,
    WALLET_DISABLED: t.WALLET_DISABLED,
    NO_PAYMENT_METHOD: t.noWayToPay,
    ...(range && typeof range.min === "number" && typeof range.max === "number"
      ? {
          TOPUP_AMOUNT_OUT_OF_RANGE: fmt(t.TOPUP_AMOUNT_OUT_OF_RANGE, {
            min: formatMoney(range.min, range.currency ?? "EGP"),
            max: formatMoney(range.max, range.currency ?? "EGP"),
          }),
        }
      : {}),
  };
}

function SupportLink({ t }: { t: BillingText }) {
  return (
    <Button asChild variant="outline" className="min-h-11">
      <Link to="/support">{t.openTicket}</Link>
    </Button>
  );
}

/** One radio per method, in the console's order. */
function MethodChoice({
  methods,
  value,
  onChange,
  disabled,
}: {
  methods: BillingPaymentMethod[];
  value: string;
  onChange: (code: string) => void;
  disabled?: boolean;
}) {
  const t = useT(BILLING_STRINGS);
  const { locale } = useLocale();
  const name = useId();
  if (methods.length < 2) return null;
  return (
    <fieldset disabled={disabled}>
      <legend className="mb-2 text-sm font-medium text-ink">{t.methodLabel}</legend>
      <div className="flex flex-wrap gap-2">
        {methods.map((m) => (
          <label
            key={m.code}
            className={cn(
              "flex min-h-11 cursor-pointer items-center gap-2 rounded-[10px] border px-3 py-2 text-sm",
              value === m.code ? "border-primary bg-primary-soft text-ink" : "border-line text-ink-soft"
            )}
          >
            <input type="radio" name={name} value={m.code} checked={value === m.code} onChange={() => onChange(m.code)} />
            {m.label[locale] || m.label.en}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Where to send the money: the number with a copy button, the payment link and the platform's note. */
function TransferTarget({ method, amount }: { method: BillingPaymentMethod; amount: string | null }) {
  const t = useT(BILLING_STRINGS);
  const { locale } = useLocale();
  const note = method.note?.[locale] ?? method.note?.en ?? method.note?.ar ?? null;
  return (
    <div className="space-y-2 rounded-[10px] border border-line bg-paper px-4 py-3">
      {amount && (
        <p className="text-sm font-medium text-ink">{fmt(t.transferVia, { amount, method: method.label[locale] || method.label.en })}</p>
      )}
      {method.accountNumber && (
        <div>
          <p className="text-xs text-ink-soft">{t.sendTo}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2">
            <span className="font-mono text-base font-semibold text-ink" dir="ltr">
              {method.accountNumber}
            </span>
            <CopyButton value={method.accountNumber} label={t.copy} />
          </div>
        </div>
      )}
      {method.paymentLink && (
        <a
          href={method.paymentLink}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-2 hover:underline"
        >
          {t.openPaymentLink}
        </a>
      )}
      {note && <p className="text-sm text-ink-soft">{note}</p>}
    </div>
  );
}

/** The sender's number and the screenshot: what every transfer proof carries. */
function ProofFields({
  phone,
  onPhone,
  file,
  onFile,
  disabled,
  phoneError,
  fileError,
}: {
  phone: string;
  onPhone: (v: string) => void;
  file: File | null;
  onFile: (f: File | null) => void;
  disabled: boolean;
  phoneError?: string;
  fileError?: string;
}) {
  const t = useT(BILLING_STRINGS);
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <>
      <Field label={t.senderPhone} hint={t.senderPhoneHint} error={phoneError} required>
        {({ id, ...aria }) => (
          <Input
            id={id}
            {...aria}
            type="tel"
            inputMode="tel"
            dir="ltr"
            autoComplete="tel"
            value={phone}
            disabled={disabled}
            onChange={(e) => onPhone(e.target.value)}
            className="max-w-64 text-start"
          />
        )}
      </Field>
      <Field label={t.screenshot} hint={t.screenshotHint} error={fileError} required>
        {({ id, ...aria }) => (
          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={input}
              id={id}
              {...aria}
              type="file"
              accept={IMAGE_TYPES}
              className="sr-only"
              disabled={disabled}
              onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            />
            {preview && <img src={preview} alt="" className="size-16 rounded-[10px] border border-line object-cover" />}
            <Button type="button" variant="outline" className="min-h-11" disabled={disabled} onClick={() => input.current?.click()}>
              {file ? t.changeFile : t.chooseFile}
            </Button>
            {file && (
              <span className="min-w-0 truncate text-xs text-ink-soft" dir="ltr">
                {file.name}
              </span>
            )}
          </div>
        )}
      </Field>
    </>
  );
}

/** What can be told before the server is asked: an empty number, no picture, a wrong type, too large. */
function localProblems(t: BillingText, phone: string, file: File | null): { phone?: string; file?: string } {
  const out: { phone?: string; file?: string } = {};
  if (phone.replace(/\D/g, "").length < 10) out.phone = t.INVALID_SENDER_PHONE;
  if (!file) out.file = t.NO_FILE;
  else if (!IMAGE_TYPES.split(",").includes(file.type)) out.file = t.UNSUPPORTED_MEDIA_TYPE;
  else if (file.size > MAX_BYTES) out.file = t.FILE_TOO_LARGE;
  return out;
}

/**
 * «ادفع»: what is due and the ways to pay it, from POST /billing/invoices/open
 * (it writes nothing). A gateway opens its payment page; a manual method shows
 * the number to send to and takes the transfer's screenshot.
 */
export function PayDialog({ open, onClose, onSent }: { open: boolean; onClose: () => void; onSent: () => void }) {
  const t = useT(BILLING_STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [answer, setAnswer] = useState<BillingOpenInvoice | null>(null);
  const [loadError, setLoadError] = useState<{ code: string | undefined; text: string } | null>(null);
  const [amountDue, setAmountDue] = useState(0);
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<{ phone?: string; file?: string }>({});

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setAnswer(null);
    setLoadError(null);
    setError(null);
    setProblems({});
    setFile(null);
    billingInvoiceOpen(apiClient, workspaceId)
      .then((next) => {
        if (cancelled) return;
        setAnswer(next);
        setAmountDue(next.invoice.amountDue);
        setCode(next.methods[0]?.code ?? "");
      })
      .catch((err) => {
        if (!cancelled) setLoadError({ code: apiErrorCode(err), text: errorMessage(err, proofOverrides(t, err)) });
      });
    return () => {
      cancelled = true;
    };
    // The words of an error are fixed when it happens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workspaceId]);

  const method = answer?.methods.find((m) => m.code === code) ?? null;
  const currency = answer?.invoice.currency ?? "EGP";

  async function reloadMethods() {
    try {
      const next = await billingPaymentMethodsGet(apiClient, workspaceId);
      setAnswer((prev) => (prev ? { ...prev, methods: next.methods } : prev));
      setCode((prev) => (next.methods.some((m) => m.code === prev) ? prev : (next.methods[0]?.code ?? "")));
    } catch {
      // The list stays as it was; the error above already says what happened.
    }
  }

  async function payOnline() {
    if (!method) return;
    setBusy(true);
    setError(null);
    try {
      const { payment } = await billingPayOnline(apiClient, workspaceId, locale, method.code);
      if (!payment.checkoutUrl) throw new Error(t.PAYMENT_METHOD_NOT_AVAILABLE);
      window.location.assign(payment.checkoutUrl);
    } catch (err) {
      setError(errorMessage(err, proofOverrides(t, err)));
      if (apiErrorCode(err) === "PAYMENT_METHOD_NOT_AVAILABLE") void reloadMethods();
      setBusy(false);
    }
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!answer || !method) return;
    const local = localProblems(t, phone, file);
    setProblems(local);
    if (local.phone || local.file || !file) return;
    setBusy(true);
    setError(null);
    try {
      await billingInvoiceProofSend(apiClient, workspaceId, answer.invoice.id, {
        methodCode: method.code,
        senderPhone: phone.trim(),
        file,
        expectedAmount: amountDue,
      });
      toast.success(t.proofSent);
      onSent();
    } catch (err) {
      const errCode = apiErrorCode(err);
      if (errCode === "CHARGE_AMOUNT_CHANGED") {
        const changed = apiErrorDetails<{ amountDue?: number; currency?: string }>(err);
        if (typeof changed?.amountDue === "number") {
          setAmountDue(changed.amountDue);
          setError(fmt(t.CHARGE_AMOUNT_CHANGED, { amount: formatMoney(changed.amountDue, changed.currency ?? currency) }));
        } else setError(errorMessage(err));
      } else if (errCode === "INVALID_SENDER_PHONE") setProblems({ phone: t.INVALID_SENDER_PHONE });
      else if (errCode === "NO_FILE" || errCode === "UNSUPPORTED_MEDIA_TYPE" || errCode === "FILE_TOO_LARGE" || errCode === "PROOF_IMAGE_DUPLICATE")
        setProblems({ file: proofOverrides(t, err)[errCode] });
      else {
        setError(errorMessage(err, proofOverrides(t, err)));
        if (errCode === "PAYMENT_METHOD_NOT_AVAILABLE") void reloadMethods();
      }
    } finally {
      setBusy(false);
    }
  }

  const formId = useId();
  const noWay = loadError?.code === "NO_PAYMENT_METHOD" || (answer !== null && answer.methods.length === 0);
  const needsSupport = noWay || loadError?.code === "MANUAL_PRICING";

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={t.payTitle}
      footer={
        answer && method && !noWay ? (
          <>
            <Button variant="outline" onClick={onClose} disabled={busy} className="min-h-11">
              {t.cancel}
            </Button>
            {method.kind === "gateway" ? (
              <Button onClick={() => void payOnline()} disabled={busy} className="min-h-11">
                {busy ? t.opening : t.payOnline}
              </Button>
            ) : (
              <Button type="submit" form={formId} disabled={busy} className="min-h-11">
                {busy ? t.sending : t.sendProof}
              </Button>
            )}
          </>
        ) : (
          <Button variant="outline" onClick={onClose} className="min-h-11">
            {t.close}
          </Button>
        )
      }
    >
      {!answer && !loadError && <CardSkeleton lines={4} />}
      {(loadError || (answer && noWay)) && (
        <div className="space-y-3">
          <Alert variant={needsSupport ? "default" : "danger"}>{noWay ? t.noWayToPay : loadError?.text}</Alert>
          {needsSupport && <SupportLink t={t} />}
        </div>
      )}
      {answer && !noWay && (
        <form id={formId} onSubmit={send} className="space-y-4" noValidate>
          <dl className="grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-ink-soft">{t.amountDue}</dt>
              <dd className="tabular mt-0.5 text-xl font-semibold text-ink" data-testid="pay-amount-due">
                {formatMoney(amountDue, currency)}
              </dd>
              {answer.invoice.discountAmount > 0 && (
                <dd className="text-xs text-ink-soft">
                  {fmt(t.discountLine, {
                    gross: formatMoney(answer.invoice.grossAmount, currency),
                    discount: formatMoney(answer.invoice.discountAmount, currency),
                  })}
                </dd>
              )}
            </div>
            <div>
              <dt className="text-xs text-ink-soft">{t.period}</dt>
              <dd className="mt-0.5 text-sm font-medium text-ink">
                {formatDate(answer.invoice.periodStart)} – {formatDate(answer.invoice.periodEnd)}
              </dd>
            </div>
          </dl>
          <MethodChoice methods={answer.methods} value={code} onChange={setCode} disabled={busy} />
          {method?.kind === "manual" && (
            <>
              <TransferTarget method={method} amount={formatMoney(amountDue, currency)} />
              <ProofFields
                phone={phone}
                onPhone={(v) => {
                  setPhone(v);
                  setProblems((p) => ({ ...p, phone: undefined }));
                }}
                file={file}
                onFile={(v) => {
                  setFile(v);
                  setProblems((p) => ({ ...p, file: undefined }));
                }}
                disabled={busy}
                phoneError={problems.phone}
                fileError={problems.file}
              />
            </>
          )}
          {error && <Alert variant="danger">{error}</Alert>}
        </form>
      )}
    </Modal>
  );
}

/**
 * «اشحن رصيدك»: the amount sent, where it was sent and the screenshot. The
 * balance grows once the console approves the proof, by what really arrived.
 */
export function TopupDialog({
  open,
  wallet,
  onClose,
  onSent,
}: {
  open: boolean;
  wallet: BillingWallet;
  onClose: () => void;
  onSent: () => void;
}) {
  const t = useT(BILLING_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [methods, setMethods] = useState<BillingPaymentMethod[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [amount, setAmount] = useState("");
  const [phone, setPhone] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problems, setProblems] = useState<{ amount?: string; phone?: string; file?: string }>({});
  const formId = useId();
  const { minTopup, maxTopup } = wallet.limits;
  const range = { min: formatMoney(minTopup, wallet.currency), max: formatMoney(maxTopup, wallet.currency) };

  async function loadMethods() {
    setLoadError(null);
    try {
      const next = await billingPaymentMethodsGet(apiClient, workspaceId);
      const manual = next.methods.filter((m) => m.kind === "manual");
      setMethods(manual);
      setCode((prev) => (manual.some((m) => m.code === prev) ? prev : (manual[0]?.code ?? "")));
    } catch (err) {
      setLoadError(errorMessage(err));
    }
  }

  useEffect(() => {
    if (!open) return;
    setMethods(null);
    setError(null);
    setProblems({});
    setFile(null);
    void loadMethods();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, workspaceId]);

  const method = methods?.find((m) => m.code === code) ?? null;

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!method) return;
    const minor = majorToMinor(amount);
    const local: typeof problems = localProblems(t, phone, file);
    if (!Number.isFinite(minor) || minor < minTopup || minor > maxTopup) local.amount = fmt(t.TOPUP_AMOUNT_OUT_OF_RANGE, range);
    setProblems(local);
    if (local.amount || local.phone || local.file || !file) return;
    setBusy(true);
    setError(null);
    try {
      await billingWalletTopup(apiClient, workspaceId, { requestedAmount: minor, methodCode: method.code, senderPhone: phone.trim(), file });
      toast.success(t.topupSent);
      onSent();
    } catch (err) {
      const errCode = apiErrorCode(err);
      const words = proofOverrides(t, err);
      if (errCode === "TOPUP_AMOUNT_OUT_OF_RANGE") setProblems({ amount: words.TOPUP_AMOUNT_OUT_OF_RANGE ?? fmt(t.TOPUP_AMOUNT_OUT_OF_RANGE, range) });
      else if (errCode === "INVALID_SENDER_PHONE") setProblems({ phone: t.INVALID_SENDER_PHONE });
      else if (errCode === "NO_FILE" || errCode === "UNSUPPORTED_MEDIA_TYPE" || errCode === "FILE_TOO_LARGE" || errCode === "PROOF_IMAGE_DUPLICATE")
        setProblems({ file: words[errCode] });
      else {
        setError(errorMessage(err, words));
        if (errCode === "PAYMENT_METHOD_NOT_AVAILABLE") void loadMethods();
      }
    } finally {
      setBusy(false);
    }
  }

  const none = methods !== null && methods.length === 0;

  return (
    <Modal
      open={open}
      onClose={() => !busy && onClose()}
      title={t.topUpTitle}
      footer={
        method ? (
          <>
            <Button variant="outline" onClick={onClose} disabled={busy} className="min-h-11">
              {t.cancel}
            </Button>
            <Button type="submit" form={formId} disabled={busy} className="min-h-11">
              {busy ? t.sending : t.sendTopup}
            </Button>
          </>
        ) : (
          <Button variant="outline" onClick={onClose} className="min-h-11">
            {t.close}
          </Button>
        )
      }
    >
      {!methods && !loadError && <CardSkeleton lines={4} />}
      {loadError && <Alert variant="danger">{loadError}</Alert>}
      {none && (
        <div className="space-y-3">
          <Alert>{t.noTransferMethod}</Alert>
          <SupportLink t={t} />
        </div>
      )}
      {methods && method && (
        <form id={formId} onSubmit={send} className="space-y-4" noValidate>
          <MethodChoice methods={methods} value={code} onChange={setCode} disabled={busy} />
          <TransferTarget method={method} amount={null} />
          <MoneyInput
            label={t.amountSent}
            value={amount}
            onChange={setAmount}
            currency={wallet.currency}
            hint={fmt(t.amountRange, range)}
            error={problems.amount}
            disabled={busy}
            required
            className="max-w-64"
          />
          <ProofFields
            phone={phone}
            onPhone={(v) => {
              setPhone(v);
              setProblems((p) => ({ ...p, phone: undefined }));
            }}
            file={file}
            onFile={(v) => {
              setFile(v);
              setProblems((p) => ({ ...p, file: undefined }));
            }}
            disabled={busy}
            phoneError={problems.phone}
            fileError={problems.file}
          />
          {error && <Alert variant="danger">{error}</Alert>}
        </form>
      )}
    </Modal>
  );
}
