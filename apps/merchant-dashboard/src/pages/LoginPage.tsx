import { useEffect, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button, Alert } from "@store-builder/ui";
import { useAuth, ApiError } from "@/context/AuthContext";
import { apiBaseUrl, apiClient } from "@/lib/apiClient";
import { VerifyCodePanel } from "@/components/VerifyCodePanel";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { TwoFactorRequiredError, accountLoginPayload, type TwoFactorChallenge, type VerificationChallenge } from "@store-builder/api-client";
import { rememberAfterAuth } from "@/lib/emailConfirm";
import { TwoFactorStep } from "@/components/TwoFactorStep";
import { WhatsAppSignIn, WhatsAppSignInButton } from "@/components/WhatsAppSignIn";
import { errorMessageNow } from "@/lib/errorMessages";
import {
  AUTH_SUBMIT,
  AuthDivider,
  AuthField,
  AuthFooter,
  AuthHeading,
  AuthLink,
  AuthLinkButton,
  AuthPasswordField,
  AuthShell,
  GoogleMark,
} from "./AuthShell";

const STRINGS = {
  en: {
    title: "Sign in to your store",
    subtitle: "Enter your email or username and your password, or continue with Google.",
    google: "Continue with Google",
    or: "or",
    email: "Email or username",
    password: "Password",
    forgot: "Forgot password?",
    signIn: "Sign in",
    signingIn: "Signing in…",
    newHere: "New to ZIMOS?",
    createAccount: "Create an account",
    wrongCredentials: "Incorrect sign-in details",
    rateLimited: "Too many attempts from this network — wait 15 minutes and try again",
    accountSuspended: "This account is suspended. Contact support",
    accountDeleted: "This account was deleted",
    generic: "Something went wrong. Please try again.",
    resendFailed: "Couldn't send the email. Try again.",
    resentNotice: "If an account uses this email, a new verification email will arrive within minutes.",
    noVerificationEmail: "Can't find the verification email?",
    resend: "Resend the email",
    resending: "Sending…",
    expired: "Your session ended. Sign in again and you will be back where you were.",
  },
  ar: {
    title: "ادخل على متجرك",
    subtitle: "اكتب الإيميل أو اسم المستخدم وكلمة السر، أو كمّل بحساب جوجل.",
    google: "كمّل بحساب جوجل",
    or: "أو",
    email: "الإيميل أو اسم المستخدم",
    password: "كلمة السر",
    forgot: "نسيت كلمة السر؟",
    signIn: "ادخل",
    signingIn: "بندخّلك…",
    newHere: "جديد على ZIMOS؟",
    createAccount: "اعمل حساب",
    wrongCredentials: "بيانات الدخول غلط",
    rateLimited: "محاولات كتير من الشبكة دي — استنى ربع ساعة وجرّب تاني",
    accountSuspended: "الحساب ده موقوف. تواصل مع الدعم",
    accountDeleted: "الحساب ده اتمسح",
    generic: "حصلت مشكلة. جرّب تاني.",
    resendFailed: "معرفناش نبعت الإيميل. جرّب تاني.",
    resentNotice: "لو في حساب بالإيميل ده، هيوصلك إيميل تأكيد جديد خلال دقايق.",
    noVerificationEmail: "مش لاقي إيميل التأكيد؟",
    resend: "ابعت إيميل التأكيد تاني",
    resending: "بنبعت…",
    expired: "الجلسة خلصت. ادخل تاني وهترجع لنفس المكان اللي كنت فيه.",
  },
} satisfies Messages;

export function LoginPage() {
  const { login, refreshUser, status } = useAuth();
  const { locale } = useLocale();
  const t = useT(STRINGS);
  // An account that still has to confirm its sign-up code gets the code
  // screen here instead of being signed in.
  const [challenge, setChallenge] = useState<VerificationChallenge | null>(null);
  // An account with two-step sign-in, from a browser that is not remembered.
  const [twoFactor, setTwoFactor] = useState<TwoFactorChallenge | null>(null);
  // The third way in: a code sent to the phone (WhatsAppSignIn, handoff 262).
  const [byPhoneCode, setByPhoneCode] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  // Where to go after signing in: the page that sent us here (router state), or
  // the one the session expired on (?next=, set by lib/apiClient). Same-site paths only.
  const params = new URLSearchParams(location.search);
  const next = params.get("next");
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  const from = (location.state as { from?: Location })?.from?.pathname ?? safeNext ?? "/";
  const sessionExpired = params.get("expired") === "1";
  // Came for an invitation: kept, so a sign-up from here lands on it too (handoff 358).
  useEffect(() => rememberAfterAuth(from), [from]);

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
      // The field takes the email or the username: sent as `identifier` (handoff 330).
      const pending = await login(accountLoginPayload(email, password, locale));
      if (pending) {
        setChallenge(pending);
        return;
      }
      navigate(from, { replace: true });
    } catch (err) {
      if (err instanceof TwoFactorRequiredError) {
        setTwoFactor(err.challenge);
      } else if (err instanceof ApiError) {
        setError(
          err.code === "ACCOUNT_SUSPENDED"
            ? t.accountSuspended
            : err.code === "ACCOUNT_DELETED"
              ? t.accountDeleted
              : err.status === 401
                ? t.wrongCredentials
                : err.status === 429
                  ? t.rateLimited // Per-IP limit (handoff 331): the form keeps what was typed.
                  : errorMessageNow(err)
        );
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
        err instanceof ApiError ? (err.status === 429 ? t.rateLimited : errorMessageNow(err)) : t.resendFailed
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
      <AuthShell>
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
      </AuthShell>
    );
  }

  if (challenge) {
    return (
      <AuthShell>
        <VerifyCodePanel
          challenge={challenge}
          onVerified={async () => {
            await refreshUser();
            navigate(from, { replace: true });
          }}
        />
      </AuthShell>
    );
  }

  if (byPhoneCode) {
    return (
      <WhatsAppSignIn
        onBack={() => setByPhoneCode(false)}
        onTwoFactor={setTwoFactor}
        onSignedIn={async () => {
          await refreshUser();
          navigate(from, { replace: true });
        }}
      />
    );
  }

  return (
    <AuthShell>
      <AuthHeading title={t.title}>{t.subtitle}</AuthHeading>

      <div className="mt-6">
        <Button type="button" variant="outline" className="min-h-12 w-full text-base" onClick={handleGoogleLogin}>
          <GoogleMark />
          {t.google}
        </Button>
        <WhatsAppSignInButton onClick={() => setByPhoneCode(true)} />
        <AuthDivider>{t.or}</AuthDivider>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {sessionExpired && !error && <Alert>{t.expired}</Alert>}
        {error && <Alert variant="danger">{error}</Alert>}

        {/* The email can only be sent again to an address: not offered for a username. */}
        {needsVerification &&
          email.includes("@") &&
          (resent ? (
            <Alert variant="success">{t.resentNotice}</Alert>
          ) : (
            <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-ink-soft">
              {t.noVerificationEmail}
              <AuthLinkButton onClick={handleResendVerification} disabled={resending || !email}>
                {resending ? t.resending : t.resend}
              </AuthLinkButton>
            </p>
          ))}

        <AuthField
          label={t.email}
          fieldId="email"
          name="username"
          type="text"
          dir="ltr"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />

        <AuthPasswordField
          label={t.password}
          fieldId="password"
          name="password"
          autoComplete="current-password"
          enterKeyHint="go"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          labelEnd={
            <AuthLink to="/forgot-password" className="-my-2.5 text-[13px]">
              {t.forgot}
            </AuthLink>
          }
        />

        <Button type="submit" className={AUTH_SUBMIT} disabled={submitting}>
          {submitting ? t.signingIn : t.signIn}
        </Button>
      </form>

      <AuthFooter>
        {t.newHere}
        <AuthLink to="/register">{t.createAccount}</AuthLink>
      </AuthFooter>
    </AuthShell>
  );
}
