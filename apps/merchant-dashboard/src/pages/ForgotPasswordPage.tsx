import { useState, type FormEvent } from "react";
import { Button, Alert } from "@store-builder/ui";
import { IconEmailOpen } from "@/components/icons";
import { accountPasswordResetRequest } from "@store-builder/api-client";
import { ApiError } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { errorMessageNow } from "@/lib/errorMessages";
import { AUTH_SUBMIT, AuthField, AuthHeading, AuthLink, AuthShell } from "./AuthShell";

const STRINGS = {
  en: {
    title: "Forgot your password?",
    intro: "Enter your email and we'll send you a link to set a new one.",
    sentTitle: "Check your email",
    sent: "If this email is registered with us, a link to set a new password will arrive within minutes. The link is valid for 30 minutes and works once.",
    rateLimited: "Too many requests from this network — try again in a while",
    unavailable: "Password reset isn't available right now — try again shortly",
    email: "Email",
    send: "Send me the link",
    sending: "Sending…",
    back: "Back to sign in",
    failed: "Something unexpected went wrong. Try again in a moment.",
  },
  ar: {
    title: "نسيت كلمة السر؟",
    intro: "اكتب إيميلك وهنبعتلك لينك تعمل بيه كلمة سر جديدة.",
    sentTitle: "بص على إيميلك",
    sent: "إذا كان هذا البريد الإلكتروني مسجّلًا لدينا، سيصلك رابط لتعيين كلمة مرور جديدة خلال دقائق. الرابط صالح لمدة 30 دقيقة ولمرة واحدة.",
    rateLimited: "طلبات كتير من الشبكة دي — جرّب بعد شوية",
    unavailable: "إعادة تعيين كلمة المرور مش متاحة دلوقتي — جرّب كمان شوية",
    email: "الإيميل",
    send: "ابعتلي اللينك",
    sending: "بنبعت…",
    back: "ارجع لتسجيل الدخول",
    failed: "حصلت مشكلة مش متوقعة. جرّب تاني بعد شوية.",
  },
} satisfies Messages;

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
      // `locale`: the language of the email (handoff 331).
      await accountPasswordResetRequest(apiClient, email, locale);
      // The backend returns the same response whether or not the address is
      // registered, so any resolved call just means "show the notice".
      setSent(true);
    } catch (err) {
      // Only a genuine server-side failure lands here (the endpoint never
      // rejects a merely-unknown email) — surface it and let them retry.
      setError(
        err instanceof ApiError
          ? err.status === 429
            ? t.rateLimited
            : err.status === 503
              ? t.unavailable
              : errorMessageNow(err)
          : t.failed
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      {sent ? (
        <>
          <AuthHeading title={t.sentTitle} icon={<IconEmailOpen aria-hidden />} tone="success">
            {t.sent}
          </AuthHeading>
          <AuthLink to="/login" back className="mt-4">
            {t.back}
          </AuthLink>
        </>
      ) : (
        <>
          <AuthHeading title={t.title}>{t.intro}</AuthHeading>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && <Alert variant="danger">{error}</Alert>}

            <AuthField
              label={t.email}
              fieldId="email"
              name="email"
              type="email"
              inputMode="email"
              dir="ltr"
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint="send"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />

            <Button type="submit" className={AUTH_SUBMIT} disabled={submitting}>
              {submitting ? t.sending : t.send}
            </Button>
          </form>

          <AuthLink to="/login" back className="mt-4">
            {t.back}
          </AuthLink>
        </>
      )}
    </AuthShell>
  );
}
