"use client";

import { useEffect, useId, useState, type FormEvent } from "react";
import type { ShopperManualPayment, StorefrontManualMethod } from "@store-builder/api-client";
import { CheckIcon, CopyIcon } from "@/components/Icons";
import { btnPrimary, btnSecondary, card, input, label } from "@/components/ui";
import { useStore } from "@/lib/StoreContext";
import { getPaymentToken } from "@/lib/payments";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { PROOF_MAX_BYTES, PROOF_TYPES, validPayerNumber, type ProofDraft } from "@/lib/manualPayments";

const TEXT = {
  ar: {
    instapay: "إنستاباي",
    wallet: "محفظة إلكترونية",
    instapayHint: "حوّل المبلغ على إنستاباي وابعتلنا صورة التحويل.",
    walletHint: "حوّل المبلغ على المحفظة وابعتلنا صورة التحويل.",
    payTo: "حوّل على",
    copy: "نسخ",
    copied: "اتنسخ",
    openLink: "افتح رابط الدفع",
    payerNumber: "الرقم اللي حوّلت منه",
    payerHint: "رقم الموبايل أو حساب إنستاباي اللي دفعت منه.",
    screenshot: "صورة التحويل",
    screenshotHint: "JPG أو PNG أو WebP، لحد 15 ميجا.",
    laterHint: "لو لسه ما حوّلتش، تقدر تبعت الإثبات بعد ما تأكد الطلب.",
    send: "ابعت إثبات الدفع",
    sending: "جاري الإرسال…",
    badNumber: "اكتب رقم موبايل أو حساب إنستاباي صحيح.",
    badFile: "اختار صورة JPG أو PNG أو WebP أقل من 15 ميجا.",
    needFile: "اختار صورة التحويل.",
    failed: "ما قدرناش نبعت الإثبات. جرّب تاني.",
    statusTitle: "الدفع",
    awaiting_proof: "مستنيين صورة التحويل.",
    submitted: "استلمنا إثبات الدفع، وهيتراجع قريب.",
    approved: "تم تأكيد الدفع. شكرًا!",
    rejected: "إثبات الدفع اترفض.",
    reason: "السبب: {reason}",
    resend: "ابعت إثبات جديد",
    total: "المبلغ المطلوب: {amount}",
  },
  en: {
    instapay: "InstaPay",
    wallet: "Mobile wallet",
    instapayHint: "Transfer the amount by InstaPay and send us a screenshot.",
    walletHint: "Transfer the amount to the wallet and send us a screenshot.",
    payTo: "Pay to",
    copy: "Copy",
    copied: "Copied",
    openLink: "Open the payment link",
    payerNumber: "Number you paid from",
    payerHint: "The phone number or InstaPay account you paid from.",
    screenshot: "Payment screenshot",
    screenshotHint: "JPG, PNG or WebP, up to 15 MB.",
    laterHint: "Haven't paid yet? You can send the proof after placing the order.",
    send: "Send payment proof",
    sending: "Sending…",
    badNumber: "Enter a valid phone number or InstaPay account.",
    badFile: "Choose a JPG, PNG or WebP image under 15 MB.",
    needFile: "Choose the payment screenshot.",
    failed: "We couldn't send the proof. Please try again.",
    statusTitle: "Payment",
    awaiting_proof: "Waiting for your payment screenshot.",
    submitted: "We received your payment proof. It will be reviewed shortly.",
    approved: "Payment confirmed. Thank you!",
    rejected: "Your payment proof was rejected.",
    reason: "Reason: {reason}",
    resend: "Send a new proof",
    total: "Amount to pay: {amount}",
  },
};

export function useManualText() {
  const { locale } = useStore();
  return TEXT[locale as keyof typeof TEXT] ?? TEXT.ar;
}

/** The picker's title and hint for a manual method. */
export function manualCopy(m: Pick<StorefrontManualMethod, "kind" | "label">, text: ReturnType<typeof useManualText>) {
  return { title: m.label, hint: m.kind === "wallet" ? text.walletHint : text.instapayHint };
}

function CopyNumber({ value }: { value: string }) {
  const text = useManualText();
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt(text.copy, value);
    }
  }
  return (
    <button type="button" onClick={() => void copy()} className={`${btnSecondary} min-h-9 px-3 py-1.5`} aria-live="polite">
      {copied ? <CheckIcon className="size-4" /> : <CopyIcon className="size-4" />}
      {copied ? text.copied : text.copy}
    </button>
  );
}

/** Where to pay: the number (copyable), the link only when the merchant set one, the instructions. */
export function ManualMethodDetails({ method }: { method: Omit<StorefrontManualMethod, "id"> }) {
  const text = useManualText();
  return (
    <div className="space-y-3 rounded-xl border border-line bg-paper px-4 py-3">
      <div>
        <p className="text-xs text-ink-soft">
          {text.payTo} · {method.kind === "wallet" ? text.wallet : text.instapay}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <bdi dir="ltr" className="font-mono text-base font-semibold text-ink">
            {method.accountNumber}
          </bdi>
          <CopyNumber value={method.accountNumber} />
        </div>
      </div>
      {method.paymentLink && (
        <a href={method.paymentLink} target="_blank" rel="noopener noreferrer" className={`${btnSecondary} w-full sm:w-auto`}>
          {text.openLink}
        </a>
      )}
      {method.instructions && <p className="whitespace-pre-line text-sm text-ink-soft">{method.instructions}</p>}
    </div>
  );
}

/** The two proof fields; the parent decides when to send. */
export function ProofFields({
  value,
  onChange,
  errors,
  idPrefix,
}: {
  value: ProofDraft;
  onChange: (next: ProofDraft) => void;
  errors?: { payerNumber?: string; file?: string };
  idPrefix: string;
}) {
  const text = useManualText();
  return (
    <div className="space-y-3">
      <div>
        <label htmlFor={`${idPrefix}-payer`} className={label}>
          {text.payerNumber}
        </label>
        <input
          id={`${idPrefix}-payer`}
          dir="ltr"
          inputMode="tel"
          autoComplete="off"
          maxLength={60}
          className={input}
          value={value.payerNumber}
          onChange={(e) => onChange({ ...value, payerNumber: e.target.value })}
          aria-invalid={errors?.payerNumber ? true : undefined}
          aria-describedby={`${idPrefix}-payer-hint`}
        />
        <p id={`${idPrefix}-payer-hint`} className={`mt-1 text-xs ${errors?.payerNumber ? "text-danger" : "text-ink-soft"}`}>
          {errors?.payerNumber ?? text.payerHint}
        </p>
      </div>
      <div>
        <label htmlFor={`${idPrefix}-shot`} className={label}>
          {text.screenshot}
        </label>
        <input
          id={`${idPrefix}-shot`}
          type="file"
          accept={PROOF_TYPES.join(",")}
          className="block w-full text-sm text-ink file:me-3 file:rounded-lg file:border file:border-line file:bg-paper-raised file:px-3 file:py-2 file:text-sm"
          onChange={(e) => onChange({ ...value, file: e.target.files?.[0] ?? null })}
          aria-invalid={errors?.file ? true : undefined}
          aria-describedby={`${idPrefix}-shot-hint`}
        />
        <p id={`${idPrefix}-shot-hint`} className={`mt-1 text-xs ${errors?.file ? "text-danger" : "text-ink-soft"}`}>
          {errors?.file ?? text.screenshotHint}
        </p>
      </div>
    </div>
  );
}

/** Checks a filled-in proof; an empty one is fine at checkout (sent later). */
export function proofErrors(draft: ProofDraft, text: ReturnType<typeof useManualText>, { required }: { required: boolean }) {
  const errors: { payerNumber?: string; file?: string } = {};
  const empty = !draft.payerNumber.trim() && !draft.file;
  if (empty && !required) return errors;
  if (!validPayerNumber(draft.payerNumber)) errors.payerNumber = text.badNumber;
  if (!draft.file) errors.file = text.needFile;
  else if (!PROOF_TYPES.includes(draft.file.type) || draft.file.size > PROOF_MAX_BYTES) errors.file = text.badFile;
  return errors;
}

/**
 * The thank-you page's payment block for an order paid by a manual method:
 * where to pay, the proof's status (with the reason when rejected) and the
 * form while a proof may be sent. Renders nothing for any other order.
 */
export function ManualPaymentStatus({ workspaceId, orderId }: { workspaceId: string; orderId: string }) {
  const { money } = useStore();
  const [client] = useState(() => createStorefrontApiClient());
  const text = useManualText();
  const id = useId();
  const [payment, setPayment] = useState<ShopperManualPayment | null>(null);
  const [draft, setDraft] = useState<ProofDraft>({ payerNumber: "", file: null });
  const [errors, setErrors] = useState<{ payerNumber?: string; file?: string }>({});
  const [sending, setSending] = useState(false);
  const [failed, setFailed] = useState(false);
  const token = typeof window === "undefined" ? null : getPaymentToken(workspaceId, orderId);

  useEffect(() => {
    if (!token) return;
    let live = true;
    client
      .getShopperManualPayment(workspaceId, orderId, token)
      .then((p) => live && setPayment(p))
      .catch(() => {
        /* not a manual order, or not this browser's */
      });
    return () => {
      live = false;
    };
  }, [client, workspaceId, orderId, token]);

  if (!payment || !token) return null;

  async function send(e: FormEvent) {
    e.preventDefault();
    const found = proofErrors(draft, text, { required: true });
    setErrors(found);
    if (found.payerNumber || found.file || !draft.file || !token) return;
    setSending(true);
    setFailed(false);
    try {
      setPayment(await client.submitManualPaymentProof(workspaceId, orderId, token, { payerNumber: draft.payerNumber, file: draft.file }));
    } catch {
      setFailed(true);
    } finally {
      setSending(false);
    }
  }

  const tone =
    payment.status === "approved" ? "text-success" : payment.status === "rejected" ? "text-danger" : "text-ink";

  return (
    <section className={`${card} mt-6 space-y-4 p-5`} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-base font-semibold text-ink">
        {text.statusTitle}
      </h2>
      <p role="status" className={`text-sm font-medium ${tone}`}>
        {text[payment.status]}
      </p>
      {payment.status === "rejected" && payment.rejectionReason && (
        <p className="text-sm text-ink-soft">{text.reason.replace("{reason}", payment.rejectionReason)}</p>
      )}
      {payment.canSubmit && (
        <>
          <p className="text-sm text-ink">{text.total.replace("{amount}", money(payment.totalAmount, payment.currency))}</p>
          <ManualMethodDetails method={payment.method} />
          <form onSubmit={send} className="space-y-3" noValidate>
            <ProofFields value={draft} onChange={setDraft} errors={errors} idPrefix={id} />
            {failed && (
              <p role="alert" className="text-sm text-danger">
                {text.failed}
              </p>
            )}
            <button type="submit" className={btnPrimary} disabled={sending}>
              {sending ? text.sending : payment.status === "rejected" ? text.resend : text.send}
            </button>
          </form>
        </>
      )}
    </section>
  );
}
