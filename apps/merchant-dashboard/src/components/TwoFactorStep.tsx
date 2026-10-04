import { useState, type FormEvent } from "react";
import { Alert, Button, Input, Label } from "@store-builder/ui";
import { ApiError, securityVerifyTwoFactor, type TwoFactorChallenge } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

/**
 * The second step of a sign-in: the code from the email or the authenticator
 * app. Shown by the login page when the server answers with a challenge.
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
  },
  ar: {
    title: "خطوة كمان",
    emailBody: "بعتنا كود من ٦ أرقام على {email}. اكتبه عشان تكمل الدخول.",
    appBody: "اكتب الكود من ٦ أرقام اللي في تطبيق المصادقة.",
    whatsappBody: "بعتنا كود من ٦ أرقام على واتساب لرقم {phone}. اكتبه عشان تكمل الدخول.",
    smsBody: "بعتنا كود من ٦ أرقام برسالة لرقم {phone}. اكتبه عشان تكمل الدخول.",
    code: "الكود",
    remember: "افتكر الجهاز ده لمدة ٦٠ يوم",
    verify: "دخول",
    verifying: "جارٍ التحقق…",
    wrong: "الكود غلط أو انتهت صلاحيته.",
    tooMany: "محاولات غلط كتير. ارجع وسجّل دخول تاني عشان يوصلك كود جديد.",
    failed: "حصل خطأ. حاول تاني.",
    back: "الرجوع لتسجيل الدخول",
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
  const [code, setCode] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await securityVerifyTwoFactor(apiClient, { challengeToken: challenge.challengeToken, code: code.trim(), rememberDevice: remember });
      await onVerified();
    } catch (err) {
      if (err instanceof ApiError) setError(err.status === 429 ? t.tooMany : err.status === 401 || err.status === 422 ? t.wrong : err.message);
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
          {challenge.channel === "email"
            ? fmt(t.emailBody, { email: challenge.sentTo ?? "" })
            : challenge.channel === "whatsapp" || challenge.channel === "sms"
              ? fmt(challenge.channel === "whatsapp" ? t.whatsappBody : t.smsBody, { phone: challenge.sentTo ?? "" })
              : t.appBody}
        </p>
      </div>
      {error && <Alert variant="danger">{error}</Alert>}
      <div className="space-y-2">
        <Label htmlFor="two-factor-code">{t.code}</Label>
        <Input
          id="two-factor-code"
          dir="ltr"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          className="text-center font-mono text-lg tracking-[0.4em]"
        />
      </div>
      <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
        {t.remember}
      </label>
      <Button type="submit" className="w-full" disabled={busy || code.length !== 6}>
        {busy ? t.verifying : t.verify}
      </Button>
      <button type="button" onClick={onBack} className="block w-full text-center text-sm text-ink-soft hover:text-primary">
        {t.back}
      </button>
    </form>
  );
}
