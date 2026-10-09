import { useEffect, useRef, useState } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  accountEmailCodeConfirm,
  accountEmailCodeSend,
  accountErrorCode,
  apiErrorDetails,
  type AccountCodeSent,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { closeEmailConfirm, openEmailConfirm, takeSignupEmailCode, useEmailConfirmState } from "@/lib/emailConfirm";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { CodeEntry, ltrText } from "./CodeEntry";

const STRINGS = {
  en: {
    title: "Confirm your email",
    sentTo: "We sent a 6-digit code to {target}. It's valid for 10 minutes.",
    yourEmail: "your email",
    held: "This needs a confirmed email. Enter the code and we'll finish what you were doing.",
    sending: "Sending the code…",
    code: "Code",
    confirm: "Confirm",
    confirming: "Checking…",
    resend: "Send a new code",
    resendWait: "You can ask for a new code in {s}s",
    sendCode: "Send me a code",
    close: "Close",
    wrong: "That code isn't right — {n} tries left",
    expired: "The code has expired — ask for a new one",
    tooMany: "Too many tries — ask for a new one",
    limit: "Too many codes requested — try again later",
    unavailable: "We can't send emails right now — try again shortly",
    tooSoon: "Wait a moment before asking for another code.",
    done: "Your email is confirmed",
  },
  ar: {
    title: "أكّد إيميلك",
    sentTo: "بعتنا كود من 6 أرقام لـ {target}. صالح 10 دقايق.",
    yourEmail: "إيميلك",
    held: "الخطوة دي محتاجة إيميل متأكد. اكتب الكود وهنكمّل اللي كنت بتعمله.",
    sending: "بنبعت الكود…",
    code: "الكود",
    confirm: "تأكيد",
    confirming: "بنتأكد…",
    resend: "ابعت كود جديد",
    resendWait: "تقدر تطلب كود جديد بعد {s} ثانية",
    sendCode: "ابعتلي كود",
    close: "إغلاق",
    wrong: "الكود مش صحيح — فاضل {n} محاولات",
    expired: "الكود انتهى — اطلب كود جديد",
    tooMany: "محاولات كتير — اطلب كود جديد",
    limit: "طلبت أكواد كتير — جرّب بعد شوية",
    unavailable: "مش قادرين نبعت إيميلات دلوقتي — جرّب كمان شوية",
    tooSoon: "استنى شوية قبل ما تطلب كود جديد.",
    done: "تم تأكيد إيميلك",
  },
} satisfies Messages;

/**
 * «أكّد إيميلك»: the 6-digit code that confirms the account's email, opened
 * from anywhere through lib/emailConfirm (the shell's banner, a sign-up that
 * already sent the code, a request refused with EMAIL_NOT_VERIFIED). The
 * session goes on: confirming hands out no new tokens.
 */
export function EmailConfirmDialog() {
  const state = useEmailConfirmState();
  const { status } = useAuth();

  // A sign-up that sent its code: the dialog opens on it at the first signed-in screen.
  useEffect(() => {
    if (status !== "authenticated") return;
    const sent = takeSignupEmailCode();
    if (sent) openEmailConfirm({ sent });
  }, [status]);

  if (!state.open || status !== "authenticated") return null;
  return <Dialog target={state.target} alreadySent={state.sent} holding={state.holding} />;
}

function Dialog({ target, alreadySent, holding }: { target: string | null; alreadySent: AccountCodeSent | null; holding: boolean }) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const { refreshUser } = useAuth();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [sent, setSent] = useState<AccountCodeSent | null>(alreadySent);
  // "send": a code is being asked for; "confirm": the typed one is being checked.
  const [busy, setBusy] = useState<"send" | "confirm" | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The first code could not be sent: the dialog offers to try again instead of a field with no code behind it.
  const [noCode, setNoCode] = useState(false);
  const asked = useRef(false);

  function describe(err: unknown): string {
    switch (accountErrorCode(err)) {
      case "INVALID_CODE":
        return fmt(t.wrong, { n: apiErrorDetails<{ attemptsLeft?: number }>(err)?.attemptsLeft ?? 0 });
      case "CODE_EXPIRED":
      case "NO_ACTIVE_CODE":
        return t.expired;
      case "TOO_MANY_ATTEMPTS":
        return t.tooMany;
      case "VERIFICATION_LIMIT_REACHED":
        return t.limit;
      case "EMAIL_UNAVAILABLE":
        return t.unavailable;
      case "RESEND_TOO_SOON":
        return t.tooSoon;
      default:
        return errorMessage(err);
    }
  }

  async function finish() {
    toast.success(t.done);
    await refreshUser().catch(() => undefined);
    closeEmailConfirm(true);
  }

  async function send(first: boolean) {
    setBusy("send");
    setError(null);
    try {
      const answer = await accountEmailCodeSend(apiClient, locale);
      setSent(answer);
      setNoCode(false);
    } catch (err) {
      // Confirmed meanwhile (another tab): nothing left to do here.
      if (accountErrorCode(err) === "ALREADY_VERIFIED") {
        await finish();
        return;
      }
      // A code sent a moment ago is still good: the field stays, with the wait the server gave.
      if (accountErrorCode(err) === "RESEND_TOO_SOON") {
        const seconds = apiErrorDetails<{ retryAfterSeconds?: number }>(err)?.retryAfterSeconds ?? 60;
        setSent((current) => ({ ...(current ?? { sent: true }), resendAvailableAt: new Date(Date.now() + seconds * 1000).toISOString() }));
        if (!first) setError(t.tooSoon);
      } else {
        setError(describe(err));
        if (first) setNoCode(true);
      }
    } finally {
      setBusy(null);
    }
  }

  // Opened without a code on its way: ask for one, once.
  useEffect(() => {
    if (alreadySent || asked.current) return;
    asked.current = true;
    void send(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function confirm(code: string) {
    setBusy("confirm");
    setError(null);
    try {
      await accountEmailCodeConfirm(apiClient, code);
      await finish();
    } catch (err) {
      if (accountErrorCode(err) === "ALREADY_VERIFIED") {
        await finish();
        return;
      }
      setError(describe(err));
      setBusy(null);
    }
  }

  const where = sent?.target ?? target;

  return (
    <Modal open onClose={busy === "confirm" ? () => undefined : () => closeEmailConfirm(false)} title={t.title} description={holding ? t.held : undefined}>
      {noCode ? (
        <div className="space-y-4">
          {error && <Alert variant="danger">{error}</Alert>}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => closeEmailConfirm(false)}>
              {t.close}
            </Button>
            <Button type="button" className="min-h-11" disabled={busy !== null} onClick={() => void send(true)}>
              {busy === "send" ? t.sending : t.sendCode}
            </Button>
          </div>
        </div>
      ) : !sent ? (
        <p role="status" className="py-6 text-center text-sm text-ink-soft">
          {t.sending}
        </p>
      ) : (
        <CodeEntry
          intro={fmt(t.sentTo, { target: where ? ltrText(where) : t.yourEmail })}
          label={t.code}
          confirmLabel={t.confirm}
          busyLabel={t.confirming}
          resendLabel={t.resend}
          resendWaitLabel={t.resendWait}
          resendAvailableAt={sent.resendAvailableAt}
          error={error}
          busy={busy !== null}
          onConfirm={(code) => void confirm(code)}
          onResend={() => void send(false)}
        />
      )}
    </Modal>
  );
}
