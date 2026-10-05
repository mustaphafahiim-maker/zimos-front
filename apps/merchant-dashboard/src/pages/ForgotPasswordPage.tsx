import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button, Input, Label, Alert } from "@store-builder/ui";
import { ApiError } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { AuthBackdrop } from "@/components/AuthBackdrop";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Reset your password",
    intro: "Enter your account's email and we'll send you a link to set a new password.",
    email: "Email",
    send: "Send reset link",
    sending: "Sending…",
    sent: "If an account uses this email, a link to set a new password is on its way. It's valid for 30 minutes and works once.",
    spam: "Can't find it? Check your spam folder.",
    back: "Back to sign in",
    tooMany: "Too many requests from here. Try again in an hour.",
    unavailable: "Password reset isn't available right now. Try again later.",
    generic: "Something went wrong. Try again.",
  },
  ar: {
    title: "إعادة تعيين كلمة المرور",
    intro: "أدخل البريد الإلكتروني لحسابك وسنرسل إليك رابطًا لتعيين كلمة مرور جديدة.",
    email: "البريد الإلكتروني",
    send: "إرسال رابط إعادة التعيين",
    sending: "جارٍ الإرسال…",
    sent: "إذا كان هناك حساب بهذا البريد الإلكتروني، فسيصلك رابط لتعيين كلمة مرور جديدة. الرابط صالح لمدة 30 دقيقة ولمرة واحدة فقط.",
    spam: "لم تجده؟ ابحث في مجلد الرسائل غير المرغوب فيها.",
    back: "العودة إلى تسجيل الدخول",
    tooMany: "طلبات كثيرة من هذا الجهاز. حاول مرة أخرى بعد ساعة.",
    unavailable: "إعادة تعيين كلمة المرور غير متاحة الآن. حاول مرة أخرى لاحقًا.",
    generic: "حدث خطأ ما. حاول مرة أخرى.",
  },
} satisfies Messages;

/**
 * "Forgot password": the email gets a link to set a new password. The server
 * answers the same whether or not the address has an account, so a success
 * only means "show the notice" — the page never says whether it exists.
 */
export function ForgotPasswordPage() {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiClient.requestPasswordReset(email.trim(), locale);
      setSent(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 429) setError(t.tooMany);
      else if (err instanceof ApiError && err.code === "PASSWORD_RESET_UNAVAILABLE") setError(t.unavailable);
      else setError(t.generic);
    } finally {
      setSubmitting(false);
    }
  }

  const back = (
    <Link to="/login" className="mt-6 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">
      {t.back}
    </Link>
  );

  return (
    <div className="auth-glass">
      <AuthBackdrop />
      <div className="auth-glass-stage">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-3xl font-medium text-ink">{t.title}</h2>

          {sent ? (
            <>
              <Alert variant="success" className="mt-6" role="status">
                {t.sent}
              </Alert>
              <p className="mt-3 text-xs text-ink-soft">{t.spam}</p>
              {back}
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-ink-soft">{t.intro}</p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                {error && (
                  <Alert variant="danger" role="alert">
                    {error}
                  </Alert>
                )}

                <div className="space-y-1.5">
                  <Label htmlFor="email">{t.email}</Label>
                  <Input
                    id="email"
                    type="email"
                    dir="ltr"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>

                <Button type="submit" className="min-h-11 w-full" disabled={submitting}>
                  {submitting ? t.sending : t.send}
                </Button>
              </form>

              {back}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
