import { useEffect, useId, useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, cn } from "@store-builder/ui";
import {
  ApiError,
  apiErrorDetails,
  type AuthUser,
  type VerificationChallenge,
  type VerificationChannel,
  type VerificationSent,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useLocale, useT, fmt, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Enter the code we sent you",
    sentTo: "We sent a 6-digit code to {target}. It is valid for 10 minutes.",
    notSent: "Choose where to send your code.",
    notSentSession: "We'll send a 6-digit code to {target}.",
    digit: "Digit {n} of 6",
    codeLabel: "Verification code",
    confirm: "Confirm",
    confirming: "Confirming…",
    resend: "Send a new code",
    sendFirst: "Send the code",
    resendIn: "Send a new code in {seconds}s",
    sending: "Sending…",
    channel: "Send the code to",
    byEmail: "Email {target}",
    bySms: "SMS {target}",
    sent: "A new code is on its way to {target}.",
    wrong: "That code isn't right. {left} attempts left.",
    wrongLast: "That code isn't right. 1 attempt left.",
    expired: "This code has expired. Send a new one.",
    tooMany: "Too many wrong attempts. Send a new code.",
    noCode: "Send a new code to continue.",
    tooSoon: "Wait a moment before asking for another code.",
    limit: "Too many codes were requested. Try again later.",
    noChannel: "A code can't be sent this way. Use email.",
    sessionEnded: "This sign-up session has ended.",
    signInAgain: "Sign in again",
    generic: "Something went wrong. Try again.",
    spam: "Can't find it? Check your spam folder.",
  },
  ar: {
    title: "أدخل الرمز المرسل إليك",
    sentTo: "أرسلنا رمزًا من 6 أرقام إلى {target}. الرمز صالح لمدة 10 دقائق.",
    notSent: "اختر وسيلة إرسال الرمز.",
    notSentSession: "سنرسل رمزًا من 6 أرقام إلى {target}.",
    digit: "الرقم {n} من 6",
    codeLabel: "رمز التأكيد",
    confirm: "تأكيد",
    confirming: "جارٍ التأكيد…",
    resend: "إرسال رمز جديد",
    sendFirst: "إرسال الرمز",
    resendIn: "إرسال رمز جديد بعد {seconds} ثانية",
    sending: "جارٍ الإرسال…",
    channel: "أرسل الرمز إلى",
    byEmail: "البريد الإلكتروني {target}",
    bySms: "رسالة نصية إلى {target}",
    sent: "أرسلنا رمزًا جديدًا إلى {target}.",
    wrong: "الرمز غير صحيح. المحاولات المتبقية: {left}.",
    wrongLast: "الرمز غير صحيح. تبقّت محاولة واحدة.",
    expired: "انتهت صلاحية هذا الرمز. اطلب رمزًا جديدًا.",
    tooMany: "تجاوزت عدد المحاولات المسموح به. اطلب رمزًا جديدًا.",
    noCode: "اطلب رمزًا جديدًا للمتابعة.",
    tooSoon: "انتظر قليلًا قبل طلب رمز آخر.",
    limit: "طُلبت رموز كثيرة. حاول مرة أخرى لاحقًا.",
    noChannel: "لا يمكن إرسال الرمز بهذه الوسيلة. استخدم البريد الإلكتروني.",
    sessionEnded: "انتهت جلسة التسجيل هذه.",
    signInAgain: "سجّل الدخول من جديد",
    generic: "حدث خطأ ما. حاول مرة أخرى.",
    spam: "لم تجده؟ ابحث في مجلد الرسائل غير المرغوب فيها.",
  },
} satisfies Messages;

const LENGTH = 6;

/** An address or number inside a sentence, kept left to right in Arabic text (Unicode isolate). */
const ltr = (value: string) => `\u2066${value}\u2069`;

function secondsUntil(iso: string | null): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - Date.now()) / 1000));
}

/**
 * The sign-up code: six boxes that take a pasted code whole, move on as each
 * digit is typed and back on Backspace, and send themselves when full; a
 * 60-second wait before a new code; the choice of email or the phone's SMS
 * when the account has both. A right code signs the person in
 * (`onVerified`).
 *
 * `session`: an account already signed in confirming its email (the
 * dashboard's code dialog). The codes and their limits are the same; they go
 * through /auth/me/email instead of the challenge's token, nothing new is
 * signed in, and `onSent` hears of each code sent. `challenge` then only
 * describes where the code goes and whether one is on its way. An account
 * confirmed meanwhile (another tab) counts as verified, with no user.
 * `compact` leaves the title to the surrounding dialog.
 */
export function VerifyCodePanel({
  challenge,
  onVerified,
  session = false,
  onSent,
  compact = false,
}: {
  challenge: VerificationChallenge;
  onVerified: (user: AuthUser | null) => void | Promise<void>;
  session?: boolean;
  onSent?: (sent: VerificationSent) => void;
  compact?: boolean;
}) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const groupId = useId();
  const statusId = `${groupId}-status`;
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  const [digits, setDigits] = useState<string[]>(() => Array(LENGTH).fill(""));
  const [channel, setChannel] = useState<VerificationChannel>(challenge.channel ?? "email");
  const [targets, setTargets] = useState(challenge.targets);
  const [codeSent, setCodeSent] = useState(challenge.codeSent);
  const [resendAt, setResendAt] = useState<string | null>(challenge.resendAvailableAt);
  const [wait, setWait] = useState(() => secondsUntil(challenge.resendAvailableAt));
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [expiredSession, setExpiredSession] = useState(false);
  const [busy, setBusy] = useState<"confirm" | "send" | null>(null);

  useEffect(() => {
    setWait(secondsUntil(resendAt));
    if (!resendAt) return;
    const timer = window.setInterval(() => {
      const left = secondsUntil(resendAt);
      setWait(left);
      if (left <= 0) window.clearInterval(timer);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendAt]);

  useEffect(() => {
    inputs.current[0]?.focus();
  }, []);

  const target = channel === "sms" ? targets.sms ?? "" : targets.email;

  function describe(err: unknown): string {
    if (!(err instanceof ApiError)) return t.generic;
    switch (err.code) {
      case "INVALID_CODE": {
        const left = apiErrorDetails<{ attemptsLeft?: number }>(err)?.attemptsLeft ?? 0;
        return left === 1 ? t.wrongLast : fmt(t.wrong, { left });
      }
      case "CODE_EXPIRED":
        return t.expired;
      case "TOO_MANY_ATTEMPTS":
        return t.tooMany;
      case "NO_ACTIVE_CODE":
        return t.noCode;
      case "RESEND_TOO_SOON":
        return t.tooSoon;
      case "VERIFICATION_LIMIT_REACHED":
        return t.limit;
      case "CHANNEL_NOT_AVAILABLE":
        return t.noChannel;
      default:
        return t.generic;
    }
  }

  async function confirm(code: string) {
    if (busy) return;
    setBusy("confirm");
    setError(null);
    setInfo(null);
    try {
      const result = session
        ? await apiClient.confirmAccountCode(code)
        : await apiClient.confirmVerificationCode(challenge.verificationToken, code);
      await onVerified(result.user);
    } catch (err) {
      if (session && err instanceof ApiError && err.code === "ALREADY_VERIFIED") {
        await onVerified(null);
      } else if (err instanceof ApiError && err.status === 401) {
        setExpiredSession(true);
      } else {
        setError(describe(err));
        setDigits(Array(LENGTH).fill(""));
        inputs.current[0]?.focus();
      }
    } finally {
      setBusy(null);
    }
  }

  async function send(next: VerificationChannel = channel) {
    setBusy("send");
    setError(null);
    setInfo(null);
    try {
      const sent = session
        ? await apiClient.sendAccountCode(locale)
        : await apiClient.sendVerificationCode(challenge.verificationToken, next, locale);
      onSent?.(sent);
      setTargets((current) => ({ ...current, [sent.channel]: sent.target }));
      setResendAt(sent.resendAvailableAt);
      setCodeSent(true);
      setInfo(fmt(t.sent, { target: ltr(sent.target) }));
      setDigits(Array(LENGTH).fill(""));
      inputs.current[0]?.focus();
    } catch (err) {
      if (session && err instanceof ApiError && err.code === "ALREADY_VERIFIED") await onVerified(null);
      else if (err instanceof ApiError && err.status === 401) setExpiredSession(true);
      else {
        const retry = apiErrorDetails<{ retryAfterSeconds?: number }>(err)?.retryAfterSeconds;
        if (err instanceof ApiError && err.code === "RESEND_TOO_SOON" && retry) {
          setResendAt(new Date(Date.now() + retry * 1000).toISOString());
        }
        setError(describe(err));
      }
    } finally {
      setBusy(null);
    }
  }

  function fill(from: number, text: string) {
    const clean = text.replace(/\D/g, "").slice(0, LENGTH - from);
    if (!clean) return;
    const next = [...digits];
    for (let i = 0; i < clean.length; i += 1) next[from + i] = clean[i];
    setDigits(next);
    const focusAt = Math.min(from + clean.length, LENGTH - 1);
    inputs.current[focusAt]?.focus();
    if (next.every((d) => d !== "")) void confirm(next.join(""));
  }

  function onKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();
      const next = [...digits];
      next[index - 1] = "";
      setDigits(next);
      inputs.current[index - 1]?.focus();
    } else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      // Boxes run left to right whatever the page direction: a code is read that way.
      event.preventDefault();
      const step = event.key === "ArrowLeft" ? -1 : 1;
      inputs.current[Math.max(0, Math.min(LENGTH - 1, index + step))]?.focus();
    }
  }

  function onPaste(index: number, event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    fill(index, event.clipboardData.getData("text"));
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (digits.every((d) => d !== "")) void confirm(digits.join(""));
  }

  if (expiredSession) {
    return (
      <div className="space-y-4">
        <Alert variant="danger">{t.sessionEnded}</Alert>
        <Button asChild className="min-h-11 w-full">
          <Link to="/login">{t.signInAgain}</Link>
        </Button>
      </div>
    );
  }

  const complete = digits.every((d) => d !== "");

  return (
    <form onSubmit={onSubmit} className="space-y-5" noValidate>
      <div>
        {!compact && <h2 className="font-display text-2xl font-medium text-ink">{t.title}</h2>}
        <p id={statusId} className={cn("text-sm text-ink-soft", !compact && "mt-2")} aria-live="polite">
          {codeSent
            ? fmt(t.sentTo, { target: ltr(target) })
            : session
              ? fmt(t.notSentSession, { target: ltr(target) })
              : t.notSent}
        </p>
      </div>

      {challenge.channels.length > 1 && (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">{t.channel}</legend>
          {challenge.channels.map((option) => (
            <label key={option} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-line px-3 text-sm text-ink has-[:checked]:border-primary">
              <input
                type="radio"
                name={`${groupId}-channel`}
                value={option}
                checked={channel === option}
                disabled={busy !== null}
                onChange={() => {
                  setChannel(option);
                  if (wait <= 0) void send(option);
                }}
                className="size-4 accent-[var(--color-primary)]"
              />
              <span dir="auto">
                {fmt(option === "sms" ? t.bySms : t.byEmail, { target: ltr(option === "sms" ? targets.sms ?? "" : targets.email) })}
              </span>
            </label>
          ))}
        </fieldset>
      )}

      <div role="group" aria-label={t.codeLabel} aria-describedby={statusId} dir="ltr" className="flex justify-between gap-2">
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              inputs.current[index] = el;
            }}
            value={digit}
            onChange={(e) => {
              const value = e.target.value;
              if (value.length > 1) fill(index, value);
              else {
                const next = [...digits];
                next[index] = value.replace(/\D/g, "");
                setDigits(next);
                if (next[index] && index < LENGTH - 1) inputs.current[index + 1]?.focus();
                if (next.every((d) => d !== "")) void confirm(next.join(""));
              }
            }}
            onKeyDown={(e) => onKeyDown(index, e)}
            onPaste={(e) => onPaste(index, e)}
            onFocus={(e) => e.target.select()}
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete={index === 0 ? "one-time-code" : "off"}
            maxLength={index === 0 ? LENGTH : 1}
            aria-label={fmt(t.digit, { n: index + 1 })}
            aria-invalid={error ? true : undefined}
            disabled={busy === "confirm"}
            className={cn(
              "h-14 w-full min-w-0 max-w-14 rounded-md border bg-paper-raised text-center font-mono text-2xl text-ink outline-none transition-colors focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-ring/50",
              error ? "border-danger" : "border-line"
            )}
          />
        ))}
      </div>

      {error && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
      {info && !error && <Alert variant="success">{info}</Alert>}

      <Button type="submit" className="min-h-11 w-full" disabled={!complete || busy !== null}>
        {busy === "confirm" ? t.confirming : t.confirm}
      </Button>

      <div className="flex flex-col items-center gap-1 text-center">
        <Button
          type="button"
          variant="link"
          className="min-h-11"
          disabled={wait > 0 || busy !== null}
          onClick={() => void send()}
        >
          {busy === "send" ? t.sending : wait > 0 ? fmt(t.resendIn, { seconds: wait }) : codeSent ? t.resend : t.sendFirst}
        </Button>
        {channel === "email" && <p className="text-xs text-ink-soft">{t.spam}</p>}
      </div>
    </form>
  );
}
