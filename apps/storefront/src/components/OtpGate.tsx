"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ApiError, protectionResendCheckoutOtp, protectionVerifyCheckoutOtp } from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { registerOtpPrompt, type OtpPromptRequest } from "@/lib/checkoutOtp";
import { useStore } from "@/lib/StoreContext";
import { btnGhost, btnPrimaryLg, input } from "./ui";

const COPY = {
  en: {
    title: "Confirm your phone number",
    sentWhatsapp: "We sent a code on WhatsApp to",
    sentSms: "We sent a code by SMS to",
    code: "Verification code",
    confirm: "Confirm and place order",
    confirming: "Checking…",
    resend: "Send the code again",
    resendIn: (s: number) => `Send again in ${s}s`,
    resent: "A new code is on its way.",
    change: "Change number",
    invalid: "That code is not right. Check it and try again.",
    expired: "That code has expired. Ask for a new one.",
    tooMany: "Too many wrong attempts. Ask for a new code.",
    wait: "Please wait a little before asking for another code.",
    generic: "We could not check the code. Try again.",
    cancelled: "The order was not placed: the phone number was not verified.",
  },
  ar: {
    title: "أكّد رقم موبايلك",
    sentWhatsapp: "بعتنالك كود على واتساب على",
    sentSms: "بعتنالك كود في رسالة على",
    code: "كود التحقق",
    confirm: "تأكيد وإتمام الطلب",
    confirming: "جارٍ التحقق…",
    resend: "ابعت الكود تاني",
    resendIn: (s: number) => `ابعت تاني بعد ${s} ث`,
    resent: "كود جديد في الطريق.",
    change: "تغيير الرقم",
    invalid: "الكود مش صحيح. راجعه وحاول تاني.",
    expired: "الكود انتهت صلاحيته. اطلب كود جديد.",
    tooMany: "محاولات غلط كتير. اطلب كود جديد.",
    wait: "استنى شوية قبل ما تطلب كود تاني.",
    generic: "مقدرناش نتحقق من الكود. حاول تاني.",
    cancelled: "الطلب ما اتسجلش: رقم الموبايل ما اتأكدش.",
  },
};

interface Pending extends OtpPromptRequest {
  resolve: (token: string | null) => void;
}

/**
 * The code-entry step of a checkout whose store verifies phones. Mounted once
 * in the store layout; lib/checkoutOtp calls it when a checkout answers
 * OTP_REQUIRED, from whichever form placed the order.
 */
export function OtpGate() {
  const { locale } = useStore();
  const t = locale === "ar" ? COPY.ar : COPY.en;
  const client = useMemo(() => createStorefrontApiClient(), []);
  const [pending, setPending] = useState<Pending | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    registerOtpPrompt(
      (request) =>
        new Promise<string | null>((resolve) => {
          setCode("");
          setError(null);
          setNotice(null);
          setSecondsLeft(request.challenge.resendAfterSeconds);
          setPending({ ...request, resolve });
        }),
      t.cancelled
    );
    return () => registerOtpPrompt(null);
  }, [t.cancelled]);

  useEffect(() => {
    if (!pending) return;
    inputRef.current?.focus();
    const id = window.setInterval(() => setSecondsLeft((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [pending]);

  if (!pending) return null;
  const { challenge } = pending;

  function close(token: string | null) {
    pending?.resolve(token);
    setPending(null);
  }

  function messageFor(err: unknown): string {
    const errorCode = err instanceof ApiError ? (err.code as string) : "";
    if (errorCode === "INVALID_CODE" || errorCode === "VALIDATION_ERROR") return t.invalid;
    if (errorCode === "EXPIRED") return t.expired;
    if (errorCode === "TOO_MANY_ATTEMPTS") return t.tooMany;
    if (errorCode === "OTP_RESEND_TOO_SOON" || errorCode === "OTP_RATE_LIMITED") return t.wait;
    return t.generic;
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!pending || code.length < challenge.codeLength) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      close(await protectionVerifyCheckoutOtp(client, pending.workspaceId, { phone: pending.phone, code }));
    } catch (err) {
      setError(messageFor(err));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!pending) return;
    setError(null);
    setNotice(null);
    try {
      await protectionResendCheckoutOtp(client, pending.workspaceId, pending.phone);
      setNotice(t.resent);
      setSecondsLeft(challenge.resendAfterSeconds);
    } catch (err) {
      setError(messageFor(err));
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-ink/50 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="otp-gate-title"
        className="w-full max-w-md rounded-t-2xl border border-line bg-paper-raised p-5 shadow-xl sm:rounded-2xl sm:p-6"
      >
        <h2 id="otp-gate-title" className="font-display text-lg font-bold text-ink">
          {t.title}
        </h2>
        <p className="mt-1 text-sm text-ink-soft">
          {challenge.channel === "sms" ? t.sentSms : t.sentWhatsapp}{" "}
          <bdi dir="ltr" className="font-medium text-ink">
            {challenge.phoneHint}
          </bdi>
        </p>

        <form onSubmit={submit} noValidate className="mt-4 space-y-4">
          <div>
            <label htmlFor="otp-gate-code" className="mb-1.5 block text-sm font-medium text-ink">
              {t.code}
            </label>
            <input
              id="otp-gate-code"
              ref={inputRef}
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

          <div aria-live="polite" className="empty:hidden">
            {error && <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm text-danger">{error}</p>}
            {!error && notice && <p className="text-sm text-ink-soft">{notice}</p>}
          </div>

          <button type="submit" disabled={busy || code.length < challenge.codeLength} className={btnPrimaryLg}>
            {busy ? t.confirming : t.confirm}
          </button>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={resend}
              disabled={secondsLeft > 0}
              className={`${btnGhost} disabled:cursor-default disabled:opacity-60`}
            >
              {secondsLeft > 0 ? t.resendIn(secondsLeft) : t.resend}
            </button>
            <button type="button" onClick={() => close(null)} className={btnGhost}>
              {t.change}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
