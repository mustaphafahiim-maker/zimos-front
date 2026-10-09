"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  ApiError,
  apiFieldProblems,
  isApiErrorCode,
  manualPaymentShopperGet,
  manualPaymentShopperSubmit,
  type ApiClient,
  type ManualPaymentShopperStatus,
  type ShopperPaymentStatus,
} from "@store-builder/api-client";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr/CheckCircle";
import { ClockIcon } from "@phosphor-icons/react/dist/ssr/Clock";
import { WarningCircleIcon } from "@phosphor-icons/react/dist/ssr/WarningCircle";
import { XCircleIcon } from "@phosphor-icons/react/dist/ssr/XCircle";
import { CheckIcon, CopyIcon } from "@/components/Icons";
import { StoreLink } from "@/components/StoreRoute";
import { btnGhost, btnPrimaryLg, btnSecondary, input } from "@/components/ui";
import { pickText } from "@/lib/i18n";
import { PHOTO_LIMIT_TEXT, photoTooLarge } from "@/lib/photoLimit";
import { useStore } from "@/lib/StoreContext";

/**
 * Paying to the store's own InstaPay account or wallet number (handoff 340):
 * the number to pay to at checkout, and the page where the shopper sends the
 * number they paid from and a screenshot afterwards. The store reviews it; a
 * rejected proof can be sent again.
 *
 * The strings live here rather than in lib/i18n.ts so the feature stays in its own files.
 */
const TEXT = {
  en: {
    payTo: (n: string) => `Pay to ${n}`,
    copy: "Copy",
    copied: "Copied",
    openLink: "Open the payment link",
    sendTitle: (amount: string, label: string) => `Send ${amount} via ${label}`,
    payer: "The number or InstaPay account you paid from",
    screenshot: "Transfer screenshot",
    choose: "Attach the screenshot",
    change: "Change the screenshot",
    send: "Send payment proof",
    sending: "Sending…",
    submitted: "We received your payment proof — the store will check it and confirm your order",
    approved: "Payment confirmed",
    rejected: (reason: string) => `The store rejected the payment proof: ${reason}`,
    rejectedNoReason: "The store rejected the payment proof",
    cancelled: "This order is cancelled",
    errPayer: "Enter the number or InstaPay account you paid from",
    errNoFile: "Attach the transfer screenshot",
    errType: "The screenshot must be JPEG, PNG or WebP",
    errTooLarge: "The screenshot is too large — try a smaller one",
    errAlready: "The payment proof was already sent",
    errRate: "Too many tries — try again in a minute",
    errLink: "This link isn't valid",
    errGeneric: "We couldn't send it. Check your connection and try again.",
    viewOrder: "View your order",
    backToStore: "Back to the store",
    checkAgain: "Check again",
  },
  ar: {
    payTo: (n: string) => `ادفع على ${n}`,
    copy: "نسخ",
    copied: "اتنسخ",
    openLink: "افتح لينك الدفع",
    sendTitle: (amount: string, label: string) => `حوّل ${amount} على ${label}`,
    payer: "الرقم أو حساب إنستا باي اللي حوّلت منه",
    screenshot: "صورة التحويل (سكرين شوت)",
    choose: "ارفع صورة التحويل",
    change: "غيّر الصورة",
    send: "ابعت إثبات الدفع",
    sending: "بنبعت…",
    submitted: "وصلنا إثبات الدفع — المتجر هيراجعه ويأكد طلبك",
    approved: "الدفع اتأكد",
    rejected: (reason: string) => `المتجر رفض إثبات الدفع: ${reason}`,
    rejectedNoReason: "المتجر رفض إثبات الدفع",
    cancelled: "الطلب ده اتلغى",
    errPayer: "اكتب الرقم أو حساب إنستا باي اللي حوّلت منه",
    errNoFile: "ارفع صورة التحويل",
    errType: "الصورة لازم تكون JPEG أو PNG أو WebP",
    errTooLarge: "الصورة كبيرة — جرّب صورة أصغر",
    errAlready: "إثبات الدفع اتبعت خلاص",
    errRate: "محاولات كتير — جرّب بعد دقيقة",
    errLink: "اللينك ده مش صالح",
    errGeneric: "معرفناش نبعته. اتأكد من النت وجرّب تاني.",
    viewOrder: "شوف طلبك",
    backToStore: "ارجع للمتجر",
    checkAgain: "حدّث الحالة",
  },
  fr: {
    payTo: (n: string) => `Payez au ${n}`,
    copy: "Copier",
    copied: "Copié",
    openLink: "Ouvrir le lien de paiement",
    sendTitle: (amount: string, label: string) => `Envoyez ${amount} via ${label}`,
    payer: "Le numéro ou le compte InstaPay depuis lequel vous avez payé",
    screenshot: "Capture d'écran du virement",
    choose: "Joindre la capture d'écran",
    change: "Changer la capture",
    send: "Envoyer la preuve de paiement",
    sending: "Envoi…",
    submitted: "Nous avons reçu votre preuve de paiement — la boutique va la vérifier et confirmer votre commande",
    approved: "Paiement confirmé",
    rejected: (reason: string) => `La boutique a refusé la preuve de paiement : ${reason}`,
    rejectedNoReason: "La boutique a refusé la preuve de paiement",
    cancelled: "Cette commande est annulée",
    errPayer: "Saisissez le numéro ou le compte InstaPay depuis lequel vous avez payé",
    errNoFile: "Joignez la capture d'écran du virement",
    errType: "La capture doit être au format JPEG, PNG ou WebP",
    errTooLarge: "La capture est trop lourde — essayez une image plus petite",
    errAlready: "La preuve de paiement a déjà été envoyée",
    errRate: "Trop de tentatives — réessayez dans une minute",
    errLink: "Ce lien n'est pas valide",
    errGeneric: "Envoi impossible. Vérifiez votre connexion et réessayez.",
    viewOrder: "Voir ma commande",
    backToStore: "Retour à la boutique",
    checkAgain: "Vérifier à nouveau",
  },
};

export function useStoreMethodText() {
  const { locale } = useStore();
  return pickText(TEXT, locale);
}

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

/** The number to pay to with its copy button, the store's instructions, and its payment link when it has one. */
export function StoreMethodDetails({
  method,
  className = "",
}: {
  method: { accountNumber: string; paymentLink: string | null; instructions: string | null };
  className?: string;
}) {
  const x = useStoreMethodText();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(method.accountNumber);
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard blocked — the number is on screen to select by hand */
    }
  }

  return (
    <div data-slot="store-method" className={`space-y-3 rounded-xl border border-line bg-paper-raised p-4 ${className}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <bdi dir="ltr" className="min-w-0 select-all text-lg font-semibold tabular-nums wrap-anywhere text-ink">
          {method.accountNumber}
        </bdi>
        <button
          type="button"
          onClick={() => void copy()}
          className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-medium text-ink hover:border-primary hover:text-primary"
        >
          {copied ? <CheckIcon className="text-success" /> : <CopyIcon />}
          <span aria-live="polite">{copied ? x.copied : x.copy}</span>
        </button>
      </div>
      {method.instructions && (
        <p dir="auto" className="whitespace-pre-line text-sm text-ink-soft">
          {method.instructions}
        </p>
      )}
      {method.paymentLink && (
        <a href={method.paymentLink} target="_blank" rel="noopener noreferrer" className={`${btnSecondary} w-full`}>
          {x.openLink}
        </a>
      )}
    </div>
  );
}

/**
 * An order's manual payment, for the payment page: asked once the page knows
 * the order is paid by transfer. `pending` while that answer is on its way;
 * `payment` null for an order paid another way (a receipt transfer answers 404).
 */
export function useManualPayment(client: ApiClient, workspaceId: string, orderId: string, token: string | null | undefined, status: ShopperPaymentStatus | null) {
  const isTransfer = (status?.paymentMethod as string | undefined) === "bank_transfer";
  const [payment, setPayment] = useState<ManualPaymentShopperStatus | null>(null);
  const [asked, setAsked] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setPayment(await manualPaymentShopperGet(client, workspaceId, orderId, token));
    } catch {
      /* not paid this way, or the link is gone: the page keeps what it showed */
    } finally {
      setAsked(true);
    }
  }, [client, workspaceId, orderId, token]);

  useEffect(() => {
    if (isTransfer && token) void load();
  }, [isTransfer, token, load]);

  return { payment, pending: isTransfer && Boolean(token) && !asked, setPayment, reload: load };
}

/** The shopper's words for a refused proof. */
function proofError(err: unknown, x: ReturnType<typeof useStoreMethodText>): string {
  if (apiFieldProblems(err).some((p) => p.field === "payerNumber")) return x.errPayer;
  if (isApiErrorCode(err, "NO_FILE")) return x.errNoFile;
  if (isApiErrorCode(err, "UNSUPPORTED_MEDIA_TYPE") || isApiErrorCode(err, "IMAGE_UNREADABLE")) return x.errType;
  if (isApiErrorCode(err, "FILE_TOO_LARGE") || isApiErrorCode(err, "IMAGE_TOO_LARGE")) return x.errTooLarge;
  if (isApiErrorCode(err, "PROOF_ALREADY_SUBMITTED")) return x.errAlready;
  if (isApiErrorCode(err, "ORDER_CANCELLED")) return x.cancelled;
  if (isApiErrorCode(err, "RATE_LIMITED") || (err instanceof ApiError && err.status === 429)) return x.errRate;
  if (err instanceof ApiError && err.status === 404) return x.errLink;
  if (err instanceof ApiError && err.status === 413) return x.errTooLarge;
  return x.errGeneric;
}

const TONE = {
  ok: "bg-success-soft text-success",
  wait: "bg-primary-soft text-primary",
  bad: "bg-danger-soft text-danger",
  quiet: "bg-paper text-ink-soft",
};

/**
 * The proof page of an order paid to the store's InstaPay or wallet number:
 * what to send and where, then the number paid from and the screenshot. After
 * it is sent: waiting for the store; approved; or rejected with the store's
 * reason and the form again.
 */
export function ManualPaymentProof({
  client,
  workspaceId,
  orderId,
  token,
  payment,
  onChange,
  onReload,
}: {
  client: ApiClient;
  workspaceId: string;
  orderId: string;
  token: string;
  payment: ManualPaymentShopperStatus;
  onChange: (next: ManualPaymentShopperStatus) => void;
  onReload: () => Promise<void>;
}) {
  const x = useStoreMethodText();
  const { money, locale } = useStore();
  const fileInput = useRef<HTMLInputElement>(null);
  const [payer, setPayer] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview]
  );

  function pick(picked: File | undefined) {
    if (!picked) return;
    setError(null);
    if (!ACCEPTED.includes(picked.type) && !/\.(jpe?g|png|webp)$/i.test(picked.name)) {
      setError(x.errType);
      return;
    }
    // Refused before it is sent: the server takes proofs up to 5 MB (handoff 400).
    if (photoTooLarge(picked)) {
      setError(pickText(PHOTO_LIMIT_TEXT, locale).tooLarge);
      return;
    }
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!payer.trim()) {
      setError(x.errPayer);
      document.getElementById("manual-payer")?.focus();
      return;
    }
    if (!file) {
      setError(x.errNoFile);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onChange(await manualPaymentShopperSubmit(client, workspaceId, orderId, token, { payerNumber: payer.trim(), file }));
      setFile(null);
      setPreview(null);
    } catch (err) {
      setError(proofError(err, x));
      // Already sent (another tab, a double tap that got through): show where it stands now.
      if (isApiErrorCode(err, "PROOF_ALREADY_SUBMITTED") || isApiErrorCode(err, "ORDER_CANCELLED")) await onReload();
    } finally {
      setBusy(false);
    }
  }

  async function recheck() {
    if (checking) return;
    setChecking(true);
    await onReload();
    setChecking(false);
  }

  const thankYou = `/orders/${orderId}?number=${encodeURIComponent(payment.orderNumber)}`;
  const head = (tone: keyof typeof TONE, icon: ReactNode, title: string) => (
    <div role="status" className="flex flex-col items-center text-center">
      <span className={`flex h-14 w-14 items-center justify-center rounded-full ${TONE[tone]}`}>{icon}</span>
      <h2 dir="auto" className="mt-3 text-lg font-semibold text-ink">
        {title}
      </h2>
    </div>
  );

  if (payment.status === "approved") {
    return (
      <div data-manual-payment="approved" className="space-y-5">
        {head("ok", <CheckCircleIcon size={34} weight="fill" aria-hidden />, x.approved)}
        <StoreLink href={thankYou} className={btnPrimaryLg}>
          {x.viewOrder}
        </StoreLink>
      </div>
    );
  }

  if (payment.status === "submitted") {
    return (
      <div data-manual-payment="submitted" className="space-y-5">
        {head("wait", <ClockIcon size={30} aria-hidden />, x.submitted)}
        <div className="grid gap-2">
          <StoreLink href={thankYou} className={btnPrimaryLg}>
            {x.viewOrder}
          </StoreLink>
          <button type="button" onClick={() => void recheck()} disabled={checking} aria-busy={checking} className={`${btnGhost} min-h-12 w-full`}>
            {x.checkAgain}
          </button>
        </div>
      </div>
    );
  }

  if (!payment.canSubmit) {
    return (
      <div data-manual-payment="cancelled" className="space-y-5">
        {head("quiet", <XCircleIcon size={32} aria-hidden />, x.cancelled)}
        <StoreLink href="/" className={`${btnSecondary} min-h-12 w-full`}>
          {x.backToStore}
        </StoreLink>
      </div>
    );
  }

  return (
    <div data-manual-payment={payment.status} className="space-y-5">
      {payment.status === "rejected" && (
        <p role="alert" dir="auto" className="flex items-start gap-2 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
          <WarningCircleIcon size={20} aria-hidden className="mt-0.5 shrink-0" />
          {payment.rejectionReason ? x.rejected(payment.rejectionReason) : x.rejectedNoReason}
        </p>
      )}
      <h2 dir="auto" className="text-lg font-semibold text-ink">
        {x.sendTitle(money(payment.totalAmount, payment.currency), payment.method.label)}
      </h2>
      <StoreMethodDetails method={payment.method} />

      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label htmlFor="manual-payer" className="mb-1.5 block text-sm font-medium text-ink">
            {x.payer}
          </label>
          <input
            id="manual-payer"
            className={input}
            dir="ltr"
            inputMode="text"
            autoComplete="off"
            maxLength={80}
            value={payer}
            disabled={busy}
            onChange={(e) => {
              setPayer(e.target.value);
              setError(null);
            }}
          />
        </div>
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink">{x.screenshot}</p>
          <input
            ref={fileInput}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            aria-label={x.screenshot}
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
          <div className="flex flex-wrap items-center gap-3">
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="size-16 rounded-lg border border-line object-cover" />
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() => fileInput.current?.click()}
              className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-line px-4 text-sm font-medium text-ink hover:border-primary"
            >
              {preview ? x.change : x.choose}
            </button>
          </div>
          <p className="mt-1.5 text-xs text-ink-soft">{pickText(PHOTO_LIMIT_TEXT, locale).hint}</p>
        </div>
        {error && (
          <p role="alert" className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy} aria-busy={busy} className={btnPrimaryLg}>
          {busy ? x.sending : x.send}
        </button>
      </form>
    </div>
  );
}
