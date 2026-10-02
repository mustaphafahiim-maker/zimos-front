import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Button, Input, Label, Alert } from "@store-builder/ui";
import { ApiError } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { BrandPanel } from "@/components/BrandPanel";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { MIN_PASSWORD_LENGTH, isPasswordStrong, passwordRuleLabel, unmetPasswordRules } from "@/lib/passwordRules";

const STRINGS = {
  en: {
    title: "Set a new password",
    intro: "Choose a new password for your account. You'll be signed out everywhere else.",
    password: "New password",
    passwordPlaceholder: "At least 8 characters",
    confirm: "Confirm password",
    show: "Show password",
    hide: "Hide password",
    save: "Save new password",
    saving: "Saving…",
    rulesUnmet: "The password still misses some of the rules listed below it.",
    mismatch: "The two passwords don't match.",
    invalidLink: "This link isn't valid: it may be incomplete or copied wrongly.",
    expired: "This link has expired or was already used. Ask for a new one.",
    askAgain: "Ask for a new link",
    done: "Your password has been changed. Taking you to sign in…",
    signIn: "Sign in",
    back: "Back to sign in",
    generic: "The password couldn't be changed. Try again.",
  },
  ar: {
    title: "تعيين كلمة مرور جديدة",
    intro: "اختر كلمة مرور جديدة لحسابك. سيُسجَّل خروجك من كل الأجهزة الأخرى.",
    password: "كلمة المرور الجديدة",
    passwordPlaceholder: "8 أحرف على الأقل",
    confirm: "تأكيد كلمة المرور",
    show: "إظهار كلمة المرور",
    hide: "إخفاء كلمة المرور",
    save: "حفظ كلمة المرور الجديدة",
    saving: "جارٍ الحفظ…",
    rulesUnmet: "كلمة المرور لا تستوفي بعد بعض الشروط المذكورة أسفلها.",
    mismatch: "كلمتا المرور غير متطابقتين.",
    invalidLink: "هذا الرابط غير صالح: ربما يكون ناقصًا أو نُسخ بشكل خاطئ.",
    expired: "انتهت صلاحية هذا الرابط أو سبق استخدامه. اطلب رابطًا جديدًا.",
    askAgain: "طلب رابط جديد",
    done: "تم تغيير كلمة المرور. جارٍ نقلك إلى تسجيل الدخول…",
    signIn: "تسجيل الدخول",
    back: "العودة إلى تسجيل الدخول",
    generic: "تعذّر تغيير كلمة المرور. حاول مرة أخرى.",
  },
} satisfies Messages;

/**
 * The page the emailed link opens (/reset-password?token=…): a new password
 * (the same rules as sign-up), then sign in. Works for an account made with
 * Google, which sets its first password here. The server signs the account
 * out everywhere and counts its email as confirmed.
 */
export function ResetPasswordPage() {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // The emailed link is /reset-password?token=xxx.
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkDead, setLinkDead] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const unmetRules = unmetPasswordRules(password);

  // On success, on to sign in after a short beat; the button covers a missed timer.
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
      setError(t.rulesUnmet);
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
      // An expired or used link can't be retried: send them for a new one.
      if (err instanceof ApiError && err.code === "INVALID_RESET_TOKEN") setLinkDead(true);
      else setError(t.generic);
    } finally {
      setSubmitting(false);
    }
  }

  const askAgain = (
    <Link to="/forgot-password" className="mt-6 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">
      {t.askAgain}
    </Link>
  );

  return (
    <div className="flex min-h-screen">
      <BrandPanel />
      <div className="flex flex-1 items-start justify-center px-4 py-10 sm:items-center sm:px-6 sm:py-16">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-3xl font-medium text-ink">{t.title}</h2>

          {!token ? (
            <>
              <Alert variant="danger" className="mt-6" role="alert">
                {t.invalidLink}
              </Alert>
              {askAgain}
            </>
          ) : linkDead ? (
            <>
              <Alert variant="danger" className="mt-6" role="alert">
                {t.expired}
              </Alert>
              {askAgain}
            </>
          ) : done ? (
            <>
              <Alert variant="success" className="mt-6" role="status">
                {t.done}
              </Alert>
              <Button type="button" className="mt-6 min-h-11 w-full" onClick={() => navigate("/login", { replace: true })}>
                {t.signIn}
              </Button>
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
                      className="absolute inset-y-0 end-0 flex cursor-pointer items-center px-3 text-ink-soft transition-colors hover:text-ink"
                    >
                      {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                    </button>
                  </div>
                  {password.length > 0 && unmetRules.length > 0 && (
                    <ul id="password-rules" className="mt-1 space-y-1 text-xs text-ink-soft">
                      {unmetRules.map((rule) => (
                        <li key={rule.id} className="flex items-center gap-1.5">
                          <span aria-hidden>•</span>
                          {passwordRuleLabel(rule, locale)}
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
                      className="absolute inset-y-0 end-0 flex cursor-pointer items-center px-3 text-ink-soft transition-colors hover:text-ink"
                    >
                      {showConfirm ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
                    </button>
                  </div>
                  {confirm.length > 0 && password !== confirm && <p className="mt-1 text-xs text-danger">{t.mismatch}</p>}
                </div>

                <Button type="submit" className="min-h-11 w-full" disabled={submitting}>
                  {submitting ? t.saving : t.save}
                </Button>
              </form>

              <Link to="/login" className="mt-6 inline-flex min-h-11 items-center text-sm font-medium text-primary hover:underline">
                {t.back}
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
