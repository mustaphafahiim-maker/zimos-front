import { useState, type FormEvent } from "react";
import { Button, Input, Label, Alert } from "@store-builder/ui";
import { ApiError } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { useT } from "@/i18n/LocaleContext";
import { AuthBackLink, AuthShell, AuthTitle } from "@/components/AuthShell";

const STRINGS = {
  en: {
    title: "Reset your password",
    intro: "Enter your email and we'll send you a link to set a new password.",
    sent: "If this email is registered, you'll receive a reset link within a few minutes.",
    email: "Email",
    submit: "Send reset link",
    submitting: "Sending…",
    generic: "Something unexpected happened. Please try again shortly.",
  },
  ar: {
    title: "إعادة تعيين كلمة المرور",
    intro: "أدخل بريدك الإلكتروني وسنرسل لك رابطًا لتعيين كلمة مرور جديدة.",
    sent: "إذا كان هذا البريد مسجّلًا لدينا، فسيصلك رابط إعادة التعيين خلال دقائق.",
    email: "البريد الإلكتروني",
    submit: "إرسال رابط إعادة التعيين",
    submitting: "جارٍ الإرسال…",
    generic: "حدث خطأ غير متوقع. حاول مرة أخرى بعد قليل.",
  },
};

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
      setError(err instanceof ApiError ? err.message : t.generic);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <AuthTitle title={t.title} subtitle={sent ? undefined : t.intro} />

      {sent ? (
        <>
          <Alert variant="success" className="mt-6">
            {t.sent}
          </Alert>
          <AuthBackLink />
        </>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && <Alert variant="danger">{error}</Alert>}

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
                className="rtl:text-end"
              />
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? t.submitting : t.submit}
            </Button>
          </form>

          <AuthBackLink />
        </>
      )}
    </AuthShell>
  );
}
