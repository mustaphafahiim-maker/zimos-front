import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Button, Input, Label, Alert } from "@store-builder/ui";
import { useAuth, ApiError } from "@/context/AuthContext";
import { apiBaseUrl, apiClient } from "@/lib/apiClient";
import { AuthBackdrop } from "@/components/AuthBackdrop";
import { VerifyCodePanel } from "@/components/VerifyCodePanel";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { TwoFactorRequiredError, type TwoFactorChallenge, type VerificationChallenge } from "@store-builder/api-client";
import { TwoFactorStep } from "@/components/TwoFactorStep";
import { TWO_FACTOR_ENABLED } from "@/lib/features";

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

const STRINGS = {
  en: {
    title: "Welcome back",
    subtitle: "Sign in to manage your store.",
    google: "Continue with Google",
    or: "or",
    identifier: "Email or username",
    identifierPlaceholder: "you@example.com",
    password: "Password",
    forgot: "Forgot password?",
    show: "Show password",
    hide: "Hide password",
    signIn: "Sign in",
    signingIn: "Signing in…",
    newHere: "New to Zimos?",
    create: "Create an account",
    wrong: "Incorrect email, username or password.",
    generic: "Something went wrong. Please try again.",
    linkMissing: "Can't find the confirmation email?",
    resend: "Send it again",
    resending: "Sending…",
    resent: "If an account uses this email, a new confirmation email is on its way.",
    resendFailed: "The email couldn't be sent. Try again.",
  },
  ar: {
    title: "مرحبًا بعودتك",
    subtitle: "سجّل الدخول لإدارة متجرك.",
    google: "المتابعة بحساب جوجل",
    or: "أو",
    identifier: "البريد الإلكتروني أو اسم المستخدم",
    identifierPlaceholder: "you@example.com",
    password: "كلمة المرور",
    forgot: "نسيت كلمة المرور؟",
    show: "إظهار كلمة المرور",
    hide: "إخفاء كلمة المرور",
    signIn: "تسجيل الدخول",
    signingIn: "جارٍ تسجيل الدخول…",
    newHere: "جديد على Zimos؟",
    create: "أنشئ حسابًا",
    wrong: "البريد الإلكتروني أو اسم المستخدم أو كلمة المرور غير صحيحة.",
    generic: "حدث خطأ ما. حاول مرة أخرى.",
    linkMissing: "لم تجد رسالة التأكيد؟",
    resend: "أعد إرسالها",
    resending: "جارٍ الإرسال…",
    resent: "إذا كان هناك حساب بهذا البريد الإلكتروني، فستصلك رسالة تأكيد جديدة خلال دقائق.",
    resendFailed: "تعذّر إرسال الرسالة. حاول مرة أخرى.",
  },
} satisfies Messages;

export function LoginPage() {
  const t = useT(STRINGS);
  const { login, refreshUser } = useAuth();
  const { locale } = useLocale();
  // An account that still has to confirm its sign-up code gets the code
  // screen here instead of being signed in.
  const [challenge, setChallenge] = useState<VerificationChallenge | null>(null);
  // An account with two-step sign-in, or a browser new to it, is asked for a
  // code before it is signed in (TWO_FACTOR_ENABLED).
  const [twoFactor, setTwoFactor] = useState<TwoFactorChallenge | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: Location })?.from?.pathname ?? "/";

  // The email or the username, as typed; the server tells them apart.
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Only an API from before soft confirmation refuses a `pending_verification`
  // account (ACCOUNT_INACTIVE); the confirmation link can then be sent again,
  // when what was typed is an email.
  const [needsVerification, setNeedsVerification] = useState(false);
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const typedEmail = identifier.includes("@") ? identifier.trim() : "";

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
      const pending = await login({ identifier: identifier.trim(), password, locale });
      if (pending) {
        setChallenge(pending);
        return;
      }
      navigate(from, { replace: true });
    } catch (err) {
      if (TWO_FACTOR_ENABLED && err instanceof TwoFactorRequiredError) {
        setTwoFactor(err.challenge);
        return;
      }
      if (err instanceof ApiError) {
        setError(err.status === 401 ? t.wrong : err.message);
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
      await apiClient.resendVerification(typedEmail);
      // Like the password-reset request: a resolved call only means "show the
      // notice"; it doesn't confirm the address exists. `resent` hides the
      // button for the rest of this page load, so it can't be spammed.
      setResent(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.resendFailed);
    } finally {
      setResending(false);
    }
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
          <p className="mt-2 text-sm text-ink-soft">{t.subtitle}</p>

          <div className="mt-8">
            <Button type="button" variant="outline" className="min-h-11 w-full" onClick={handleGoogleLogin}>
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
            {error && (
              <Alert variant="danger" role="alert">
                {error}
              </Alert>
            )}

            {needsVerification &&
              typedEmail &&
              (resent ? (
                <Alert variant="success">{t.resent}</Alert>
              ) : (
                <div className="text-sm text-ink-soft">
                  {t.linkMissing}{" "}
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="h-auto p-0 text-sm"
                    onClick={handleResendVerification}
                    disabled={resending}
                  >
                    {resending ? t.resending : t.resend}
                  </Button>
                </div>
              ))}

            <div className="space-y-1.5">
              <Label htmlFor="identifier">{t.identifier}</Label>
              <Input
                id="identifier"
                name="username"
                type="text"
                dir="ltr"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={t.identifierPlaceholder}
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
                  className="absolute inset-y-0 end-0 flex cursor-pointer items-center px-3 text-ink-soft transition-colors hover:text-ink"
                >
                  {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                </button>
              </div>
            </div>

            <Button type="submit" className="min-h-11 w-full" disabled={submitting}>
              {submitting ? t.signingIn : t.signIn}
            </Button>
          </form>

          <p className="mt-8 text-center text-sm text-ink-soft">
            {t.newHere}{" "}
            <Link to="/register" className="font-medium text-primary hover:underline">
              {t.create}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
