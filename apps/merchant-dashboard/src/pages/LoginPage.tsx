import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button, Input, Label, Alert } from "@store-builder/ui";
import { useAuth, ApiError } from "@/context/AuthContext";
import { apiBaseUrl, apiClient } from "@/lib/apiClient";
import { useT } from "@/i18n/LocaleContext";
import { AuthShell, AuthTitle, GoogleSignIn, PasswordInput } from "@/components/AuthShell";

const STRINGS = {
  en: {
    title: "Welcome back",
    subtitle: "Sign in to manage your store.",
    email: "Email",
    password: "Password",
    forgot: "Forgot password?",
    submit: "Sign in",
    submitting: "Signing in…",
    noAccount: "Don't have an account?",
    create: "Create an account",
    invalid: "Incorrect email or password.",
    verifyFirst: "Please verify your email address before signing in. Check your inbox for the verification link.",
    generic: "Something went wrong. Please try again.",
    resendFailed: "We couldn't send the email. Please try again.",
    resent: "If an account exists for this email, we'll send a new verification link within a few minutes.",
    notReceived: "Didn't get the verification email?",
    resend: "Resend email",
    resending: "Sending…",
  },
  ar: {
    title: "مرحبًا بعودتك",
    subtitle: "سجّل الدخول لإدارة متجرك.",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    forgot: "نسيت كلمة المرور؟",
    submit: "تسجيل الدخول",
    submitting: "جارٍ تسجيل الدخول…",
    noAccount: "ليس لديك حساب؟",
    create: "إنشاء حساب",
    invalid: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    verifyFirst: "يُرجى تأكيد بريدك الإلكتروني قبل تسجيل الدخول. تحقّق من صندوق الوارد للعثور على رابط التأكيد.",
    generic: "حدث خطأ ما. حاول مرة أخرى.",
    resendFailed: "تعذّر إرسال الرسالة. حاول مرة أخرى.",
    resent: "إذا كان هناك حساب مسجّل بهذا البريد، فستصلك رسالة تأكيد جديدة خلال دقائق.",
    notReceived: "لم تصلك رسالة التأكيد؟",
    resend: "إعادة إرسال الرسالة",
    resending: "جارٍ الإرسال…",
  },
};

export function LoginPage() {
  const t = useT(STRINGS);
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location })?.from?.pathname ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Shown only after a `pending_verification` account tries to sign in — lets
  // them re-send the verification email straight from here.
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  function handleGoogleLogin() {
    window.location.href = `${apiBaseUrl}/auth/google`;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setNeedsVerification(false);
    setResent(false);
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        // AuthContext.login() throws this exact code for a pending_verification
        // account — the only login error we offer a "resend link" affordance for.
        if (err.code === "ACCOUNT_INACTIVE") {
          setError(t.verifyFirst);
          setNeedsVerification(true);
        } else {
          setError(err.status === 401 ? t.invalid : err.message);
        }
      } else {
        setError(t.generic);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResendVerification() {
    setResending(true);
    try {
      await apiClient.resendVerification(email);
      // A resolved call just means "show the notice"; `resent` then hides the
      // button for the rest of this page load so the link can't be spammed.
      setResent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.resendFailed);
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthShell>
      <AuthTitle title={t.title} subtitle={t.subtitle} />
      <GoogleSignIn onClick={handleGoogleLogin} />

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <Alert variant="danger">{error}</Alert>}

        {needsVerification &&
          (resent ? (
            <Alert variant="success">{t.resent}</Alert>
          ) : (
            <div className="text-sm text-ink-soft">
              {t.notReceived}{" "}
              <Button
                type="button"
                variant="link"
                size="sm"
                className="h-auto p-0 text-sm"
                onClick={handleResendVerification}
                disabled={resending || !email}
              >
                {resending ? t.resending : t.resend}
              </Button>
            </div>
          ))}

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

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{t.password}</Label>
            <Link to="/forgot-password" className="text-xs font-medium text-primary hover:underline">
              {t.forgot}
            </Link>
          </div>
          <PasswordInput id="password" value={password} onChange={setPassword} autoComplete="current-password" />
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? t.submitting : t.submit}
        </Button>
      </form>

      <p className="mt-8 text-center text-sm text-ink-soft">
        {t.noAccount}{" "}
        <Link to="/register" className="font-medium text-primary hover:underline">
          {t.create}
        </Link>
      </p>
    </AuthShell>
  );
}
