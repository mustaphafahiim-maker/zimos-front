import { useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Button, Input, Label, Alert } from "@store-builder/ui";
import { useAuth, ApiError } from "@/context/AuthContext";
import { apiBaseUrl, apiClient } from "@/lib/apiClient";
import { AuthBackdrop } from "@/components/AuthBackdrop";
import { VerifyCodePanel } from "@/components/VerifyCodePanel";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { TwoFactorRequiredError, type TwoFactorChallenge, type VerificationChallenge } from "@store-builder/api-client";
import { TwoFactorStep } from "@/components/TwoFactorStep";
import { errorMessageNow } from "@/lib/errorMessages";

const STRINGS = {
  en: {
    title: "Welcome back",
    subtitle: "Sign in to manage your store.",
    google: "Continue with Google",
    or: "or",
    email: "Email",
    password: "Password",
    forgot: "Forgot password?",
    show: "Show password",
    hide: "Hide password",
    signIn: "Sign in",
    signingIn: "Signing in…",
    newHere: "New to Zimos?",
    createAccount: "Create an account",
    wrongCredentials: "Incorrect email or password.",
    generic: "Something went wrong. Please try again.",
    resendFailed: "Couldn't send the email. Try again.",
    resentNotice: "If an account uses this email, a new verification email will arrive within minutes.",
    noVerificationEmail: "Can't find the verification email?",
    resend: "Resend the email",
    resending: "Sending…",
    expired: "Your session ended. Sign in again and you will be back where you were.",
  },
  ar: {
    title: "مرحبًا بعودتك",
    subtitle: "سجّل الدخول لإدارة متجرك.",
    google: "المتابعة بحساب جوجل",
    or: "أو",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    forgot: "نسيت كلمة المرور؟",
    show: "إظهار كلمة المرور",
    hide: "إخفاء كلمة المرور",
    signIn: "تسجيل الدخول",
    signingIn: "جارٍ تسجيل الدخول…",
    newHere: "جديد على زيموس؟",
    createAccount: "أنشئ حسابًا",
    wrongCredentials: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    generic: "حدث خطأ ما. حاول مرة أخرى.",
    resendFailed: "تعذّر إرسال الرسالة. حاول مرة أخرى.",
    resentNotice: "إذا كان هناك حساب مسجّل بهذا البريد الإلكتروني، ستصلك رسالة تأكيد جديدة خلال دقائق.",
    noVerificationEmail: "لم تجد رسالة التأكيد؟",
    resend: "إعادة إرسال الرسالة",
    resending: "جارٍ الإرسال…",
    expired: "الجلسة خلصت. ادخل تاني وهترجع لنفس المكان اللي كنت فيه.",
  },
} satisfies Messages;

/** Brand-coloured Google "G" — an inline SVG so we don't pull in an icon set. */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" className="shrink-0" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

export function LoginPage() {
  const { login, refreshUser, status } = useAuth();
  const { locale } = useLocale();
  const t = useT(STRINGS);
  // An account that still has to confirm its sign-up code gets the code
  // screen here instead of being signed in.
  const [challenge, setChallenge] = useState<VerificationChallenge | null>(null);
  // An account with two-step sign-in, from a browser that is not remembered.
  const [twoFactor, setTwoFactor] = useState<TwoFactorChallenge | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  // Where to go after signing in: the page that sent us here (router state), or
  // the one the session expired on (?next=, set by lib/apiClient). Same-site paths only.
  const params = new URLSearchParams(location.search);
  const next = params.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  const from = (location.state as { from?: Location })?.from?.pathname ?? safeNext ?? "/";
  const sessionExpired = params.get("expired") === "1";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
      const pending = await login({ email, password, locale });
      if (pending) {
        setChallenge(pending);
        return;
      }
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof TwoFactorRequiredError) {
        setTwoFactor(err.challenge);
      } else if (err instanceof ApiError) {
        setError(err.status === 401 ? t.wrongCredentials : errorMessageNow(err));
        // AuthContext.login() throws this exact code for a pending_verification
        // account — the only login error we offer a "resend link" affordance for.
        if (err.code === "ACCOUNT_INACTIVE") setNeedsVerification(true);
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
      // Mirrors the password-reset request: a resolved call just means "show the
      // notice", it doesn't confirm the address exists or is still unverified.
      // `resent` then hides the button for the rest of this page load, so the
      // link can't be spammed.
      setResent(true);
    } catch (err) {
      // Only a genuine server failure reaches here; surface it so they can retry.
      setError(
        err instanceof ApiError ? errorMessageNow(err) : t.resendFailed
      );
    } finally {
      setResending(false);
    }
  }

  // Someone already signed in has nothing to do here: back to where they were
  // going, or home. The code and two-step screens below finish on their own.
  if (status === "authenticated" && !challenge && !twoFactor) {
    return <Navigate to={from} replace />;
  }

  if (twoFactor) {
    return (
      <div className="auth-glass">
        <AuthBackdrop />
        <div className="auth-glass-stage">
          <div className="w-full max-w-sm">
            <TwoFactorStep
              challenge={twoFactor}
              onBack={() => {
                setTwoFactor(null);
                setPassword("");
              }}
              onVerified={async () => {
                await refreshUser();
                navigate(from, { replace: true });
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  if (challenge) {
    return (
      <div className="auth-glass">
        <AuthBackdrop />
        <div className="auth-glass-stage">
          <div className="w-full max-w-sm">
            <VerifyCodePanel
              challenge={challenge}
              onVerified={async () => {
                await refreshUser();
                navigate(from, { replace: true });
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-glass">
      <AuthBackdrop />
      <div className="auth-glass-stage">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-3xl font-medium text-ink">{t.title}</h2>
          <p className="mt-2 text-sm text-ink-soft">
            {t.subtitle}
          </p>

          <div className="mt-8">
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={handleGoogleLogin}
            >
              <GoogleIcon />
              {t.google}
            </Button>

            <div className="my-5 flex items-center gap-3 text-xs text-ink-soft">
              <span className="h-px flex-1 bg-line" />
              {t.or}
              <span className="h-px flex-1 bg-line" />
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {sessionExpired && !error && <Alert>{t.expired}</Alert>}
            {error && <Alert variant="danger">{error}</Alert>}

            {needsVerification &&
              (resent ? (
                <Alert variant="success">
                  {t.resentNotice}
                </Alert>
              ) : (
                <div className="text-sm text-ink-soft">
                  {t.noVerificationEmail}{" "}
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
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">{t.password}</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  {t.forgot}
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pe-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? t.hide : t.show}
                  aria-pressed={showPassword}
                  className="cursor-pointer absolute inset-y-0 end-0 flex items-center px-3 text-ink-soft transition-colors hover:text-ink"
                >
                  {showPassword ? (
                    <EyeOff className="size-4" aria-hidden />
                  ) : (
                    <Eye className="size-4" aria-hidden />
                  )}
                </button>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting ? t.signingIn : t.signIn}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-ink-soft">
            {t.newHere}{" "}
            <Link to="/register" className="font-medium text-primary hover:underline">
              {t.createAccount}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
