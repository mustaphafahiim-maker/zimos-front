"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ApiError,
  apiErrorDetails,
  codSwitchToCod,
  type ApiClient,
  type CodSwitchDeposit,
  type ManualTransferStoreMethod,
  type ShopperPaymentStatus,
} from "@store-builder/api-client";
import { TransferDetails, transferProblem, useTransferCopy, type TransferState } from "@/components/checkout/TransferDetails";
import { btnGhost, btnPrimary, btnSecondary, input } from "@/components/ui";
import { pickText } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";
import { getVisitorId } from "@/lib/visitorId";

/**
 * "Pay cash on delivery instead" on the pay page, with the checks a COD order
 * meets at checkout (backend: payments/codSwitchChecks.js): the deposit by
 * transfer the store asks for, shown once the shopper picks cash on delivery,
 * and the code by phone the store may ask for, entered right here.
 */

const TEXT = {
  en: {
    confirm: "Confirm cash on delivery",
    sentWhatsapp: "We sent a code on WhatsApp to",
    sentSms: "We sent a code by SMS to",
    code: "Verification code",
    check: "Confirm",
    checking: "Checking…",
    resend: "Send the code again",
    resendIn: (s: number) => `Send again in ${s}s`,
    resent: "A new code is on its way.",
    invalid: "That code is not right. Check it and try again.",
    expired: "That code has expired. Ask for a new one.",
    tooMany: "Too many wrong attempts. Ask for a new code.",
  },
  ar: {
    confirm: "تأكيد الدفع عند الاستلام",
    sentWhatsapp: "بعتنالك كود على واتساب على",
    sentSms: "بعتنالك كود في رسالة على",
    code: "كود التحقق",
    check: "تأكيد",
    checking: "جارٍ التحقق…",
    resend: "ابعت الكود تاني",
    resendIn: (s: number) => `ابعت تاني بعد ${s} ث`,
    resent: "كود جديد في الطريق.",
    invalid: "الكود مش صحيح. راجعه وحاول تاني.",
    expired: "الكود انتهت صلاحيته. اطلب كود جديد.",
    tooMany: "محاولات غلط كتير. اطلب كود جديد.",
  },
  fr: {
    confirm: "Confirmer le paiement à la livraison",
    sentWhatsapp: "Nous avons envoyé un code sur WhatsApp au",
    sentSms: "Nous avons envoyé un code par SMS au",
    code: "Code de vérification",
    check: "Confirmer",
    checking: "Vérification…",
    resend: "Renvoyer le code",
    resendIn: (s: number) => `Renvoyer dans ${s} s`,
    resent: "Un nouveau code est en route.",
    invalid: "Ce code n'est pas bon. Vérifiez-le et réessayez.",
    expired: "Ce code a expiré. Demandez-en un nouveau.",
    tooMany: "Trop d'essais erronés. Demandez un nouveau code.",
  },
};

interface Challenge {
  channel: "whatsapp" | "sms";
  codeLength: number;
  resendAfterSeconds: number;
  phoneHint: string;
}

function challengeOf(err: unknown): Challenge | null {
  if (!(err instanceof ApiError) || (err.code as string) !== "OTP_REQUIRED") return null;
  const d = apiErrorDetails<Partial<Challenge>>(err) ?? {};
  return {
    channel: d.channel === "sms" ? "sms" : "whatsapp",
    codeLength: typeof d.codeLength === "number" ? d.codeLength : 4,
    resendAfterSeconds: typeof d.resendAfterSeconds === "number" ? d.resendAfterSeconds : 60,
    phoneHint: typeof d.phoneHint === "string" ? d.phoneHint : "",
  };
}

export function CodSwitch({
  client,
  workspaceId,
  orderId,
  token,
  previewToken,
  deposit,
  disabled,
  label,
  busyLabel,
  onBusy,
  onDone,
  errorText,
}: {
  client: ApiClient;
  workspaceId: string;
  orderId: string;
  token: string;
  previewToken?: string;
  deposit: CodSwitchDeposit | null;
  disabled: boolean;
  label: string;
  busyLabel: string;
  onBusy: (busy: boolean) => void;
  onDone: (status: ShopperPaymentStatus) => void;
  errorText: (err: unknown) => string;
}) {
  const { locale, money } = useStore();
  const t = pickText(TEXT, locale);
  const transferCopy = useTransferCopy();
  const [open, setOpen] = useState(false);
  const [transfer, setTransfer] = useState<{ method: ManualTransferStoreMethod; state: TransferState } | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [code, setCode] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const codeInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!challenge) return;
    codeInput.current?.focus();
    const id = window.setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [challenge]);

  function codeMessage(err: unknown): string | null {
    const errorCode = err instanceof ApiError ? (err.code as string) : "";
    if (errorCode === "INVALID_CODE") return t.invalid;
    if (errorCode === "EXPIRED") return t.expired;
    if (errorCode === "TOO_MANY_ATTEMPTS") return t.tooMany;
    return null;
  }

  async function send(otpCode?: string) {
    if (deposit && transfer) {
      const problem = transferProblem(transfer.method, transfer.state, transferCopy);
      if (problem) return setError(problem);
    }
    setBusy(true);
    onBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await codSwitchToCod(
        client,
        workspaceId,
        orderId,
        token,
        { ...(deposit && transfer ? { transfer: transfer.state.details } : {}), ...(otpCode ? { otpCode } : {}) },
        { previewToken, visitorId: getVisitorId(workspaceId) }
      );
      onDone(next);
    } catch (err) {
      const asked = challengeOf(err);
      if (asked) {
        // Asked again without a code: that was the "send again".
        if (challenge && !otpCode) setNotice(t.resent);
        setChallenge(asked);
        setSecondsLeft(asked.resendAfterSeconds);
        setCode("");
      } else {
        setError(codeMessage(err) ?? errorText(err));
      }
    } finally {
      setBusy(false);
      onBusy(false);
    }
  }

  function start() {
    // The deposit form first; the switch is sent from its own button.
    if (deposit && !open) return setOpen(true);
    void send();
  }

  function submitCode(e: FormEvent) {
    e.preventDefault();
    if (challenge && code.length >= challenge.codeLength) void send(code);
  }

  return (
    <div>
      {deposit && open && (
        <TransferDetails
          client={client}
          workspaceId={workspaceId}
          methods={deposit.methods}
          amountLabel={money(deposit.amount, deposit.currency)}
          deposit={deposit.amountType}
          idPrefix="cod-switch"
          onChange={(method, state) => setTransfer({ method, state })}
        />
      )}

      {challenge ? (
        <form onSubmit={submitCode} noValidate className="mt-4 space-y-3 rounded-xl border border-line p-4">
          <p className="text-sm text-ink-soft">
            {challenge.channel === "sms" ? t.sentSms : t.sentWhatsapp}{" "}
            <bdi dir="ltr" className="font-medium text-ink">
              {challenge.phoneHint}
            </bdi>
          </p>
          <div>
            <label htmlFor="cod-switch-code" className="mb-1.5 block text-sm font-medium text-ink">
              {t.code}
            </label>
            <input
              id="cod-switch-code"
              ref={codeInput}
              dir="ltr"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={challenge.codeLength}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, challenge.codeLength))}
              aria-invalid={error ? true : undefined}
              className={`${input} text-center text-2xl tracking-[0.5em]`}
            />
          </div>
          <button type="submit" disabled={busy || code.length < challenge.codeLength} aria-busy={busy} className={`${btnPrimary} min-h-12 w-full`}>
            {busy ? t.checking : t.check}
          </button>
          <button
            type="button"
            onClick={() => void send()}
            disabled={busy || secondsLeft > 0}
            className={`${btnGhost} min-h-12 w-full disabled:cursor-default disabled:opacity-60`}
          >
            {secondsLeft > 0 ? t.resendIn(secondsLeft) : t.resend}
          </button>
        </form>
      ) : (
        <button
          type="button"
          disabled={disabled || busy}
          aria-busy={busy}
          onClick={start}
          className={`${deposit && open ? btnPrimary : btnSecondary} min-h-12 w-full ${deposit && open ? "mt-4" : ""}`}
        >
          {busy ? busyLabel : deposit && open ? t.confirm : label}
        </button>
      )}

      <div aria-live="polite" className="empty:hidden">
        {error && (
          <p role="alert" className="mt-3 rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
            {error}
          </p>
        )}
        {!error && notice && (
          <p role="status" className="mt-3 text-sm text-ink-soft">
            {notice}
          </p>
        )}
      </div>
    </div>
  );
}
