import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Button, Input, Label, Alert } from "@store-builder/ui";
import { ApiError } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { AuthBackdrop } from "@/components/AuthBackdrop";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { errorMessageNow } from "@/lib/errorMessages";

const STRINGS = {
  en: {
    title: "Reset your password",
    intro: "Enter your email and we'll send you a link to set a new password.",
    sent: "If this email is registered with us, a link to set a new password will arrive within minutes.",
    email: "Email",
    send: "Send reset link",
    sending: "Sending…",
    back: "← Back to sign in",
    failed: "Something unexpected went wrong. Try again in a moment.",
  },
  ar: {
    title: "إعادة تعيين كلمة المرور",
    intro: "اكتب بريدك الإلكتروني وسنرسل لك رابطًا لتعيين كلمة مرور جديدة.",
    sent: "إذا كان هذا البريد الإلكتروني مسجّلًا لدينا، سيصلك رابط لتعيين كلمة مرور جديدة خلال دقائق.",
    email: "البريد الإلكتروني",
    send: "إرسال رابط إعادة التعيين",
    sending: "بنبعت…",
    back: "← العودة لتسجيل الدخول",
    failed: "حدث خطأ غير متوقع. حاول مرة أخرى بعد قليل.",
  },
} satisfies Messages;

export function ForgotPasswordPage() {
  const t = useT(STRINGS);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiClient.requestPasswordReset(email);
      // The backend returns the same response whether or not the address is
      // registered, so any resolved call just means "show the notice".
      setSent(true);
    } catch (err) {
      // Only a genuine server-side failure lands here (the endpoint never
      // rejects a merely-unknown email) — surface it and let them retry.
      setError(
        err instanceof ApiError ? errorMessageNow(err) : t.failed
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-glass">
      <AuthBackdrop />
      <div className="auth-glass-stage">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-3xl font-medium text-ink">{t.title}</h2>

          {sent ? (
            <>
              <Alert variant="success" className="mt-6">
                {t.sent}
              </Alert>
              <Link
                to="/login"
                className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
              >
                {t.back}
              </Link>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-ink-soft">
                {t.intro}
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                {error && <Alert variant="danger">{error}</Alert>}

                <div className="space-y-1.5">
                  <Label htmlFor="email">{t.email}</Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                  />
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? t.sending : t.send}
                </Button>
              </form>

              <Link
                to="/login"
                className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
              >
                {t.back}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
