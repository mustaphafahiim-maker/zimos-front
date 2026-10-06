import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Button, Input, Label, Alert } from "@store-builder/ui";
import { ApiError } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { AuthBackdrop } from "@/components/AuthBackdrop";
import { MIN_PASSWORD_LENGTH, isPasswordStrong, unmetPasswordRules } from "@/lib/passwordRules";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { errorMessageNow } from "@/lib/errorMessages";

const STRINGS = {
  en: {
    title: "Set a new password",
    intro: "Choose a new password for your account.",
    badLink: "This link isn't valid. It may be incomplete or copied wrongly.",
    newLink: "Request a new link",
    done: "Your password was changed. Taking you to sign in…",
    signIn: "Sign in",
    password: "New password",
    passwordPlaceholder: "At least 8 characters",
    confirm: "Confirm password",
    show: "Show password",
    hide: "Hide password",
    passwordRules: "The password still misses some of the rules listed below it.",
    mismatch: "The password and its confirmation don't match.",
    save: "Save new password",
    saving: "Saving…",
    back: "← Back to sign in",
    failed: "Couldn't change the password. Try again.",
  },
  ar: {
    title: "تعيين كلمة مرور جديدة",
    intro: "اختار كلمة مرور جديدة لحسابك.",
    badLink: "الرابط غير صالح. قد يكون ناقصًا أو نُسخ بشكل خاطئ.",
    newLink: "اطلب رابطًا جديدًا",
    done: "اتغيرت كلمة السر. بنحوّلك لتسجيل الدخول…",
    signIn: "تسجيل الدخول",
    password: "كلمة المرور الجديدة",
    passwordPlaceholder: "8 أحرف على الأقل",
    confirm: "تأكيد كلمة المرور",
    show: "إظهار كلمة المرور",
    hide: "إخفاء كلمة المرور",
    passwordRules: "كلمة المرور لا تستوفي بعض الشروط المذكورة أسفلها.",
    mismatch: "كلمة المرور وتأكيدها غير متطابقين.",
    save: "حفظ كلمة المرور الجديدة",
    saving: "بنحفظ…",
    back: "← العودة لتسجيل الدخول",
    failed: "تعذّر تغيير كلمة المرور. حاول مرة أخرى.",
  },
} satisfies Messages;

export function ResetPasswordPage() {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // The emailed link is /reset-password?token=xxx — the token rides in a query
  // param named exactly `token`.
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const unmetRules = unmetPasswordRules(password);

  // On success, bounce to the login page after a short beat. The manual button
  // below covers the case where the timer is missed (tab backgrounded, etc.).
  useEffect(() => {
    if (!done) return;
    const timer = setTimeout(() => navigate("/login", { replace: true }), 2000);
    return () => clearTimeout(timer);
  }, [done, navigate]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setError(null);

    if (!isPasswordStrong(password)) {
      setError(t.passwordRules);
      return;
    }
    if (password !== confirm) {
      setError(t.mismatch);
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.resetPassword(token, password);
      setDone(true);
    } catch (err) {
      // Keep the form mounted so they can fix a typo or go request a fresh link.
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

          {!token ? (
            <>
              <Alert variant="danger" className="mt-6">
                {t.badLink}
              </Alert>
              <Link
                to="/forgot-password"
                className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
              >
                {t.newLink}
              </Link>
            </>
          ) : done ? (
            <>
              <Alert variant="success" className="mt-6">
                {t.done}
              </Alert>
              <Button
                type="button"
                className="mt-6 w-full"
                onClick={() => navigate("/login", { replace: true })}
              >
                {t.signIn}
              </Button>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm text-ink-soft">{t.intro}</p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-5">
                {error && <Alert variant="danger">{error}</Alert>}

                <div className="space-y-1.5">
                  <Label htmlFor="password">{t.password}</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      minLength={MIN_PASSWORD_LENGTH}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={t.passwordPlaceholder}
                      className="pe-10"
                      aria-describedby="password-rules"
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
                  {password.length > 0 && unmetRules.length > 0 && (
                    <ul id="password-rules" className="mt-1 space-y-1 text-xs text-ink-soft">
                      {unmetRules.map((rule) => (
                        <li key={rule.id} className="flex items-center gap-1.5">
                          <span aria-hidden>•</span>
                          {locale === "ar" ? rule.label : rule.labelEn}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirm">{t.confirm}</Label>
                  <div className="relative">
                    <Input
                      id="confirm"
                      type={showConfirm ? "text" : "password"}
                      autoComplete="new-password"
                      required
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      placeholder="••••••••"
                      className="pe-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      aria-label={showConfirm ? t.hide : t.show}
                      aria-pressed={showConfirm}
                      className="cursor-pointer absolute inset-y-0 end-0 flex items-center px-3 text-ink-soft transition-colors hover:text-ink"
                    >
                      {showConfirm ? (
                        <EyeOff className="size-4" aria-hidden />
                      ) : (
                        <Eye className="size-4" aria-hidden />
                      )}
                    </button>
                  </div>
                  {confirm.length > 0 && password !== confirm && (
                    <p className="mt-1 text-xs text-danger">{t.mismatch}</p>
                  )}
                </div>

                <Button type="submit" className="w-full" disabled={submitting}>
                  {submitting ? t.saving : t.save}
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
