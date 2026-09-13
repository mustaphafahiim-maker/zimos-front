import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button, Label, Alert } from "@store-builder/ui";
import { ApiError } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { MIN_PASSWORD_LENGTH, isPasswordStrong, unmetPasswordRules } from "@/lib/passwordRules";
import { useT } from "@/i18n/LocaleContext";
import { AuthBackLink, AuthShell, AuthTitle, PasswordInput, PasswordRuleList } from "@/components/AuthShell";

const STRINGS = {
  en: {
    title: "Set a new password",
    intro: "Choose a new password for your account.",
    invalidLink: "This link is invalid. It may be incomplete or copied incorrectly.",
    requestNew: "Request a new link",
    success: "Your password has been changed. Taking you to sign in…",
    signIn: "Sign in",
    newPassword: "New password",
    passwordPlaceholder: "At least 8 characters",
    confirm: "Confirm password",
    rulesUnmet: "Your password doesn't meet all the requirements listed below.",
    mismatch: "Passwords don't match.",
    submit: "Save new password",
    submitting: "Saving…",
    failed: "We couldn't change your password. Please try again.",
  },
  ar: {
    title: "تعيين كلمة مرور جديدة",
    intro: "اختر كلمة مرور جديدة لحسابك.",
    invalidLink: "هذا الرابط غير صالح. ربما يكون ناقصًا أو نُسخ بشكل غير صحيح.",
    requestNew: "اطلب رابطًا جديدًا",
    success: "تم تغيير كلمة المرور بنجاح. جارٍ تحويلك إلى تسجيل الدخول…",
    signIn: "تسجيل الدخول",
    newPassword: "كلمة المرور الجديدة",
    passwordPlaceholder: "8 أحرف على الأقل",
    confirm: "تأكيد كلمة المرور",
    rulesUnmet: "كلمة المرور لا تستوفي كل الشروط الموضحة أدناه.",
    mismatch: "كلمتا المرور غير متطابقتين.",
    submit: "حفظ كلمة المرور الجديدة",
    submitting: "جارٍ الحفظ…",
    failed: "تعذّر تغيير كلمة المرور. حاول مرة أخرى.",
  },
};

export function ResetPasswordPage() {
  const t = useT(STRINGS);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  // The emailed link is /reset-password?token=xxx.
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
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
      // Keep the form mounted so they can fix a typo or go request a fresh link.
      setError(err instanceof ApiError ? err.message : t.failed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <AuthTitle title={t.title} subtitle={token && !done ? t.intro : undefined} />

      {!token ? (
        <>
          <Alert variant="danger" className="mt-6">
            {t.invalidLink}
          </Alert>
          <AuthBackLink to="/forgot-password" label={t.requestNew} />
        </>
      ) : done ? (
        <>
          <Alert variant="success" className="mt-6">
            {t.success}
          </Alert>
          <Button type="button" className="mt-6 w-full" onClick={() => navigate("/login", { replace: true })}>
            {t.signIn}
          </Button>
        </>
      ) : (
        <>
          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {error && <Alert variant="danger">{error}</Alert>}

            <div className="space-y-1.5">
              <Label htmlFor="password">{t.newPassword}</Label>
              <PasswordInput
                id="password"
                value={password}
                onChange={setPassword}
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LENGTH}
                placeholder={t.passwordPlaceholder}
                describedBy="password-rules"
              />
              {password.length > 0 && unmetRules.length > 0 && <PasswordRuleList id="password-rules" rules={unmetRules} />}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="confirm">{t.confirm}</Label>
              <PasswordInput id="confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" />
              {confirm.length > 0 && password !== confirm && <p className="mt-1 text-xs text-danger">{t.mismatch}</p>}
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
