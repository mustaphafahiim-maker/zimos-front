import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Alert, Button, Input, Label } from "@store-builder/ui";
import {
  ApiError,
  isApiErrorCode,
  isTwoFactorChallenge,
  whatsappLoginRequest,
  whatsappLoginVerify,
  type TwoFactorChallenge,
  type WhatsappLoginChallenge,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { AuthBackdrop } from "@/components/AuthBackdrop";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { errorMessageNow } from "@/lib/errorMessages";

/**
 * Sign-in with a code sent to the phone (frontend-handoff 262, changed by 269):
 * the third way in on the sign-in page, beside Google and the password.
 *
 * Two steps on the sign-in pages' own frame: the phone, then the 6-digit code.
 * The server answers the first step the same way whatever the number is — one
 * with no account, one that is not verified, too many codes, a delivery that
 * failed — and then sends nothing. So this screen never says "no account"; it
 * says where a code would have gone and what to do when none arrives.
 *
 * An account with a second step (an authenticator app, email codes) or a
 * browser new to it still passes that step after the code: the challenge is
 * handed up, and the sign-in page shows its usual second-step screen.
 */

const STRINGS = {
  en: {
    option: "Sign in with a WhatsApp code",
    title: "Sign in with a WhatsApp code",
    phoneBody: "Enter your phone number and we'll send you a code.",
    phone: "Phone number",
    phoneHint: "The number must be verified on your account",
    send: "Send code",
    sending: "Sending…",
    codeTitle: "Enter the code",
    sentTo: "We sent a code by WhatsApp or SMS to {sentTo}",
    code: "Code",
    notArrived: "No code? Check that this number is verified on your account, or sign in with your email and password.",
    verify: "Sign in",
    verifying: "Checking…",
    resend: "Resend",
    resendIn: "Resend in {seconds}s",
    resent: "We sent a new code.",
    changeNumber: "Use another number",
    back: "Back to sign in",
    wrongCode: "Wrong or expired code",
    tooManyTries: "Too many wrong codes. Ask for a new one.",
    failed: "Something went wrong. Please try again.",
  },
  ar: {
    option: "ادخل بكود واتساب",
    title: "ادخل بكود واتساب",
    phoneBody: "اكتب رقم موبايلك وهنبعتلك كود.",
    phone: "رقم الموبايل",
    phoneHint: "لازم يكون الرقم متأكد في حسابك",
    send: "ابعت الكود",
    sending: "بنبعت…",
    codeTitle: "اكتب الكود",
    sentTo: "بعتنا كود على واتساب أو رسالة لـ {sentTo}",
    code: "الكود",
    notArrived: "الكود موصلش؟ اتأكد إن الرقم ده متأكد في حسابك، أو ادخل بالإيميل والباسورد.",
    verify: "دخول",
    verifying: "بنتأكد…",
    resend: "ابعت تاني",
    resendIn: "ابعت تاني بعد {seconds} ث",
    resent: "بعتنا كود جديد.",
    changeNumber: "استخدم رقم تاني",
    back: "الرجوع لتسجيل الدخول",
    wrongCode: "الكود غلط أو انتهى",
    tooManyTries: "محاولات غلط كتير. اطلب كود جديد.",
    failed: "حصل خطأ. حاول تاني.",
  },
} satisfies Messages;

/** A new code can be asked for after this long. */
const RESEND_AFTER_SECONDS = 60;

/** The third option on the sign-in page, under «المتابعة بحساب جوجل». */
export function WhatsAppSignInButton({ onClick }: { onClick: () => void }) {
  const t = useT(STRINGS);
  return (
    <Button type="button" variant="outline" className="mt-3 w-full" onClick={onClick}>
      {t.option}
    </Button>
  );
}

/** A sentence with the masked number kept left to right inside it. */
function withNumber(template: string, sentTo: string): ReactNode {
  const [before, after] = template.split("{sentTo}");
  return (
    <>
      {before}
      <bdi dir="ltr" className="font-medium text-ink">
        {sentTo}
      </bdi>
      {after}
    </>
  );
}

export function WhatsAppSignIn({
  onSignedIn,
  onTwoFactor,
  onBack,
}: {
  /** The code was right and the session is kept. */
  onSignedIn: () => Promise<void> | void;
  /** The code was right, and the account still asks for its second step. */
  onTwoFactor: (challenge: TwoFactorChallenge) => void;
  onBack: () => void;
}) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const [phone, setPhone] = useState("");
  const [challenge, setChallenge] = useState<WhatsappLoginChallenge | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Five wrong codes end a code for good: only a new one can sign in.
  const [spent, setSpent] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = window.setTimeout(() => setWait((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  // After a wrong code or a new one, the caret goes back to the code field: the next thing to do is type.
  const [refocus, setRefocus] = useState(0);
  useEffect(() => {
    if (refocus > 0) document.getElementById("whatsapp-login-code")?.focus();
  }, [refocus]);

  const phoneReady = phone.replace(/\D/g, "").length >= 6;

  async function send(again: boolean) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const next = await whatsappLoginRequest(apiClient, { phone: phone.trim(), locale });
      setChallenge(next);
      setCode("");
      setSpent(false);
      setWait(RESEND_AFTER_SECONDS);
      if (again) {
        setNotice(t.resent);
        setRefocus((n) => n + 1);
      }
    } catch (err) {
      setError(err instanceof ApiError ? errorMessageNow(err) : t.failed);
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    if (!challenge) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await whatsappLoginVerify(apiClient, { challengeToken: challenge.challengeToken, code, locale });
      if (isTwoFactorChallenge(result)) onTwoFactor(result);
      else await onSignedIn();
    } catch (err) {
      if (isApiErrorCode(err, "TOO_MANY_ATTEMPTS")) {
        setSpent(true);
        setWait(0);
        setError(t.tooManyTries);
      } else if (isApiErrorCode(err, "INVALID_LOGIN_CODE") || (err instanceof ApiError && err.status === 422)) {
        setError(t.wrongCode);
        setRefocus((n) => n + 1);
      } else {
        setError(err instanceof ApiError ? errorMessageNow(err) : t.failed);
        setRefocus((n) => n + 1);
      }
      setCode("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-glass">
      <AuthBackdrop />
      <div className="auth-glass-stage">
        <div className="w-full max-w-sm">
          {challenge ? (
            <form onSubmit={verify} className="space-y-5">
              <div>
                <h2 className="font-display text-3xl font-medium text-ink">{t.codeTitle}</h2>
                <p className="mt-2 text-sm text-ink-soft">{withNumber(t.sentTo, challenge.sentTo)}</p>
              </div>
              {error && <Alert variant="danger">{error}</Alert>}
              {notice && !error && <Alert variant="success">{notice}</Alert>}
              <div className="space-y-2">
                <Label htmlFor="whatsapp-login-code">{t.code}</Label>
                <Input
                  id="whatsapp-login-code"
                  dir="ltr"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  autoFocus
                  maxLength={6}
                  disabled={spent}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  className="text-center font-mono text-lg tracking-[0.4em]"
                />
                <p className="text-xs text-ink-soft">{t.notArrived}</p>
              </div>
              <Button type="submit" className="w-full" disabled={busy || spent || code.length !== 6}>
                {busy && code.length === 6 ? t.verifying : t.verify}
              </Button>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm">
                {wait > 0 ? (
                  <span className="text-ink-soft">{fmt(t.resendIn, { seconds: wait })}</span>
                ) : (
                  <button type="button" disabled={busy} onClick={() => void send(true)} className="font-medium text-primary hover:underline disabled:opacity-50">
                    {t.resend}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setChallenge(null);
                    setCode("");
                    setError(null);
                    setNotice(null);
                    setSpent(false);
                    setWait(0);
                  }}
                  className="text-ink-soft hover:text-primary"
                >
                  {t.changeNumber}
                </button>
              </div>
              <button type="button" onClick={onBack} className="block w-full text-center text-sm text-ink-soft hover:text-primary">
                {t.back}
              </button>
            </form>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (phoneReady && !busy) void send(false);
              }}
              className="space-y-5"
            >
              <div>
                <h2 className="font-display text-3xl font-medium text-ink">{t.title}</h2>
                <p className="mt-2 text-sm text-ink-soft">{t.phoneBody}</p>
              </div>
              {error && <Alert variant="danger">{error}</Alert>}
              <div className="space-y-1.5">
                <Label htmlFor="whatsapp-login-phone">{t.phone}</Label>
                <Input
                  id="whatsapp-login-phone"
                  type="tel"
                  dir="ltr"
                  inputMode="tel"
                  autoComplete="tel"
                  autoFocus
                  required
                  maxLength={32}
                  aria-describedby="whatsapp-login-phone-hint"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="01012345678"
                />
                <p id="whatsapp-login-phone-hint" className="text-xs text-ink-soft">
                  {t.phoneHint}
                </p>
              </div>
              <Button type="submit" className="w-full" disabled={busy || !phoneReady}>
                {busy ? t.sending : t.send}
              </Button>
              <button type="button" onClick={onBack} className="block w-full text-center text-sm text-ink-soft hover:text-primary">
                {t.back}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
