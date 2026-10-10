import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Alert, Button, Input, Label } from "@store-builder/ui";
import { ApiError, securityVerifyTwoFactor, type TwoFactorChallenge } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useErrorMessage } from "@/lib/errorMessages";

/**
 * The second step of a sign-in: the code from the email, the phone or the
 * authenticator app. Shown by the login page when the server answers with a
 * challenge.
 */

const STRINGS = {
  en: {
    title: "One more step",
    emailBody: "We sent a 6-digit code to {email}. Enter it to finish signing in.",
    appBody: "Enter the 6-digit code from your authenticator app.",
    whatsappBody: "We sent a 6-digit code to {phone} on WhatsApp. Enter it to finish signing in.",
    smsBody: "We sent a 6-digit code to {phone} by SMS. Enter it to finish signing in.",
    code: "Code",
    remember: "Remember this device for 60 days",
    verify: "Sign in",
    verifying: "Checking…",
    wrong: "That code is not correct or has expired.",
    tooMany: "Too many wrong codes. Go back and sign in again to get a new one.",
    failed: "Something went wrong. Please try again.",
    back: "Back to sign in",
    // Backup codes (backend auth/twoFactorRecovery.js).
    useBackup: "Can't get the code? Use a backup code",
    useCode: "Use the sign-in code instead",
    backupCode: "Backup code",
    backupHint: "One of the codes you saved, like ABCD-EFGH. Each works once.",
    codeNotSent: "We already sent several codes, so no new one was sent. Use a backup code, or wait a few minutes and sign in again.",
    // A browser new to the account (backend auth/newDeviceSignIn.js).
    newDevice: "You are signing in from a device we don't know yet.",
    newDeviceWait: "We already sent several codes, so no new one was sent. Wait a few minutes and sign in again.",
    // Too many wrong codes over all the account's sign-ins.
    locked: "Too many wrong codes were entered for this account. Wait a while and try again, or reset your password",
    forgot: "Forgot your password?",
  },
  ar: {
    title: "خطوة إضافية",
    emailBody: "أرسلنا رمزًا من ٦ أرقام إلى {email}. أدخله لإكمال تسجيل الدخول.",
    appBody: "أدخل الرمز المكوّن من ٦ أرقام من تطبيق المصادقة.",
    whatsappBody: "أرسلنا رمزًا من ٦ أرقام عبر واتساب إلى الرقم {phone}. أدخله لإكمال تسجيل الدخول.",
    smsBody: "أرسلنا رمزًا من ٦ أرقام في رسالة نصية إلى الرقم {phone}. أدخله لإكمال تسجيل الدخول.",
    code: "الرمز",
    remember: "تذكّر هذا الجهاز لمدة ٦٠ يومًا",
    verify: "تسجيل الدخول",
    verifying: "جارٍ التحقق…",
    wrong: "الرمز غير صحيح أو انتهت صلاحيته.",
    tooMany: "محاولات خاطئة كثيرة. عُد وسجّل الدخول مرة أخرى ليصلك رمز جديد.",
    failed: "حدث خطأ ما. حاول مرة أخرى.",
    back: "العودة إلى تسجيل الدخول",
    useBackup: "لم يصلك الرمز؟ استخدم رمزًا احتياطيًا",
    useCode: "استخدم رمز تسجيل الدخول بدلًا من ذلك",
    backupCode: "رمز احتياطي",
    backupHint: "أحد الرموز التي حفظتها، مثل ABCD-EFGH. يعمل كل رمز مرة واحدة.",
    codeNotSent: "أرسلنا عدة رموز من قبل، لذلك لم نرسل رمزًا جديدًا. استخدم رمزًا احتياطيًا، أو انتظر بضع دقائق ثم سجّل الدخول مرة أخرى.",
    newDevice: "أنت تسجّل الدخول من جهاز لا نعرفه بعد.",
    newDeviceWait: "أرسلنا عدة رموز من قبل، لذلك لم نرسل رمزًا جديدًا. انتظر بضع دقائق ثم سجّل الدخول مرة أخرى.",
    locked: "أُدخلت رموز خاطئة كثيرة لهذا الحساب. انتظر قليلًا ثم حاول مرة أخرى، أو أعد تعيين كلمة المرور",
    forgot: "نسيت كلمة المرور؟",
  },
} satisfies Messages;

export function TwoFactorStep({
  challenge,
  onVerified,
  onBack,
}: {
  challenge: TwoFactorChallenge;
  onVerified: () => Promise<void> | void;
  onBack: () => void;
}) {
  const t = useT(STRINGS);
  const errorMessage = useErrorMessage();
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(true);
  // Too many codes were sent lately: none went out this time, only a backup code can finish (twoFactorRecovery.js).
  const codeNotSent = challenge.codeNotSent === true;
  // A new-device code is for an account without two-step sign-in: it has no backup codes.
  const newDevice = challenge.newDevice === true;
  const [backup, setBackup] = useState(codeNotSent && !newDevice);
  const ready = backup ? code.replace(/[^A-Z0-9]/g, "").length === 8 : code.length === 6;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 429 TWO_FACTOR_LOCKED: every code is refused for a while, the right one too. No countdown: the API gives none.
  const [locked, setLocked] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (locked) return;
    setBusy(true);
    setError(null);
    try {
      await securityVerifyTwoFactor(apiClient, { challengeToken: challenge.challengeToken, code: code.trim(), rememberDevice: remember });
      await onVerified();
    } catch (err) {
      if (err instanceof ApiError && (err.code as string | undefined) === "TWO_FACTOR_LOCKED") setLocked(true);
      else if (err instanceof ApiError) setError(err.status === 429 ? t.tooMany : err.status === 401 || err.status === 422 ? t.wrong : errorMessage(err));
      else setError(t.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <h2 className="font-display text-3xl font-medium text-ink">{t.title}</h2>
        <p className="mt-2 text-sm text-ink-soft">
          {newDevice && <span className="mb-1 block font-medium text-ink">{t.newDevice}</span>}
          {codeNotSent
            ? newDevice
              ? t.newDeviceWait
              : t.codeNotSent
            : challenge.channel === "email"
              ? fmt(t.emailBody, { email: challenge.sentTo ?? "" })
              : challenge.channel === "whatsapp" || challenge.channel === "sms"
                ? fmt(challenge.channel === "whatsapp" ? t.whatsappBody : t.smsBody, { phone: challenge.sentTo ?? "" })
                : t.appBody}
        </p>
      </div>
      {error && !locked && (
        <Alert variant="danger" role="alert">
          {error}
        </Alert>
      )}
      {locked && (
        <Alert variant="danger" role="alert">
          <span className="block">{t.locked}</span>
          <Link to="/forgot-password" className="mt-1 inline-flex min-h-11 items-center font-medium underline underline-offset-4">
            {t.forgot}
          </Link>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="two-factor-code">{backup ? t.backupCode : t.code}</Label>
        {backup ? (
          <Input
            key="backup"
            id="two-factor-code"
            dir="ltr"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            autoFocus
            disabled={locked}
            maxLength={9}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""))}
            className="text-center font-mono text-lg tracking-[0.3em]"
          />
        ) : (
          <Input
            key="code"
            id="two-factor-code"
            dir="ltr"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            disabled={locked}
            maxLength={6}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            className="text-center font-mono text-lg tracking-[0.4em]"
          />
        )}
        {backup && <p className="text-xs text-ink-soft">{t.backupHint}</p>}
        {!newDevice && (
          <button
            type="button"
            onClick={() => {
              setBackup(!backup);
              setCode("");
              setError(null);
            }}
            className="text-xs font-medium text-primary hover:underline"
          >
            {backup ? t.useCode : t.useBackup}
          </button>
        )}
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        {t.remember}
      </label>
      <Button type="submit" className="w-full" disabled={busy || !ready || locked}>
        {busy ? t.verifying : t.verify}
      </Button>
      <button type="button" onClick={onBack} className="block w-full text-center text-sm text-ink-soft hover:text-primary">
        {t.back}
      </button>
    </form>
  );
}
