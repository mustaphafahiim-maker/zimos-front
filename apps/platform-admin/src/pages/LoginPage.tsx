import { useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Button, Alert } from "@store-builder/ui";
import { TwoFactorRequiredError, type TwoFactorChallenge } from "@store-builder/api-client";
import { useAuth, ApiError } from "@/context/AuthContext";
import { AUTH_SUBMIT, AuthField, AuthFooter, AuthHeading, AuthPasswordField, AuthShell } from "@/components/AuthShell";
import { TwoFactorForm } from "@/components/TwoFactorForm";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { TWO_FACTOR_ENABLED } from "@/lib/features";
import { SHELL_STRINGS } from "@/lib/shellStrings";

const STRINGS = {
  en: {
    title: "Admin sign in",
    subtitle: "Restricted to Zimos team accounts.",
    email: "Email",
    password: "Password",
    signIn: "Sign in",
    signingIn: "Signing in…",
    wrong: "Incorrect email or password.",
    unreachable: "Can't reach the server. Check that the backend is running and try again.",
    // What the panel beside the form used to say.
    tagline: "A clear view across every store on the platform.",
    note: "Internal tooling for the Zimos team — not a merchant-facing surface.",
  },
  ar: {
    title: "تسجيل دخول الإدارة",
    subtitle: "متاح لحسابات فريق زيموس فقط.",
    email: "البريد الإلكتروني",
    password: "كلمة المرور",
    signIn: "تسجيل الدخول",
    signingIn: "جارٍ تسجيل الدخول…",
    wrong: "البريد الإلكتروني أو كلمة المرور غير صحيحة.",
    unreachable: "تعذّر الوصول إلى الخادم. تأكد من أن الخادم يعمل ثم حاول مرة أخرى.",
    tagline: "رؤية واضحة لكل متجر على المنصة.",
    note: "أدوات داخلية لفريق زيموس — ليست واجهة للتجار.",
  },
} satisfies Messages;

export function LoginPage() {
  const t = useT(STRINGS);
  const shell = useT(SHELL_STRINGS);
  const { login, verifyCode } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // A code is asked first: two-step sign-in, or a browser new to the account (TWO_FACTOR_ENABLED).
  const [challenge, setChallenge] = useState<TwoFactorChallenge | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login({ email, password });
      navigate(from, { replace: true });
    } catch (err) {
      if (TWO_FACTOR_ENABLED && err instanceof TwoFactorRequiredError) {
        setChallenge(err.challenge);
        return;
      }
      if (err instanceof ApiError) {
        setError(err.status === 401 ? t.wrong : err.message);
      } else {
        setError(t.unreachable);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      {/* Which console this is, where a sign-up card says which step it is. */}
      <AuthHeading title={t.title} step={shell.platformAdmin}>
        {t.subtitle}
      </AuthHeading>

      {challenge ? (
        <TwoFactorForm
          challenge={challenge}
          onVerify={async (code) => {
            await verifyCode({ challengeToken: challenge.challengeToken, code });
            navigate(from, { replace: true });
          }}
          onBack={() => {
            setChallenge(null);
            setPassword("");
          }}
        />
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          {error && (
            <Alert variant="danger" role="alert">
              {error}
            </Alert>
          )}

          <AuthField
            label={t.email}
            fieldId="email"
            type="email"
            dir="ltr"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@zimos.co"
          />

          <AuthPasswordField
            label={t.password}
            fieldId="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
          />

          <Button type="submit" className={AUTH_SUBMIT} disabled={submitting}>
            {submitting ? t.signingIn : t.signIn}
          </Button>
        </form>
      )}

      <AuthFooter>
        <p className="font-medium text-ink">{t.tagline}</p>
        <p className="mt-1 text-xs leading-5">{t.note}</p>
      </AuthFooter>
    </AuthShell>
  );
}
