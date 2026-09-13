import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Input, Label, Alert } from "@store-builder/ui";
import { useAuth, ApiError } from "@/context/AuthContext";
import { apiBaseUrl } from "@/lib/apiClient";
import { unmetPasswordRules } from "@/lib/passwordRules";
import { useT } from "@/i18n/LocaleContext";
import { AuthShell, AuthTitle, GoogleSignIn, PasswordInput, PasswordRuleList } from "@/components/AuthShell";

const STRINGS = {
  en: {
    title: "Create your account",
    subtitle: "Set up your store in a few minutes.",
    fullName: "Full name",
    namePlaceholder: "Ahmed Hassan",
    email: "Email",
    phone: "Phone (optional)",
    password: "Password",
    passwordPlaceholder: "At least 8 characters",
    confirm: "Confirm password",
    rulesUnmet: "Your password doesn't meet all the requirements listed below.",
    mismatch: "Passwords don't match.",
    submit: "Create account",
    submitting: "Creating account…",
    haveAccount: "Already have an account?",
    signIn: "Sign in",
    generic: "Something went wrong. Please try again.",
  },
  ar: {
    title: "أنشئ حسابك",
    subtitle: "جهّز متجرك خلال دقائق.",
    fullName: "الاسم الكامل",
    namePlaceholder: "أحمد حسن",
    email: "البريد الإلكتروني",
    phone: "رقم الهاتف (اختياري)",
    password: "كلمة المرور",
    passwordPlaceholder: "8 أحرف على الأقل",
    confirm: "تأكيد كلمة المرور",
    rulesUnmet: "كلمة المرور لا تستوفي كل الشروط الموضحة أدناه.",
    mismatch: "كلمتا المرور غير متطابقتين.",
    submit: "إنشاء الحساب",
    submitting: "جارٍ إنشاء الحساب…",
    haveAccount: "لديك حساب بالفعل؟",
    signIn: "تسجيل الدخول",
    generic: "حدث خطأ ما. حاول مرة أخرى.",
  },
};

export function RegisterPage() {
  const t = useT(STRINGS);
  const { register, login } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const unmetRules = unmetPasswordRules(password);

  function handleGoogleLogin() {
    window.location.href = `${apiBaseUrl}/auth/google`;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    // Client-side gate before the API call — the backend enforces the same
    // password rule, so blocking here just spares a round-trip.
    if (unmetRules.length > 0) {
      setError(t.rulesUnmet);
      return;
    }
    if (password !== confirm) {
      setError(t.mismatch);
      return;
    }

    setSubmitting(true);
    try {
      await register({ fullName, email, phone: phone || undefined, password });
      // Registration doesn't return tokens, so log in immediately with the same
      // credentials to get the merchant straight into the workspace picker.
      await login({ email, password });
      navigate("/workspaces", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t.generic);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      <AuthTitle title={t.title} subtitle={t.subtitle} />
      <GoogleSignIn onClick={handleGoogleLogin} />

      <form onSubmit={handleSubmit} className="space-y-5">
        {error && <Alert variant="danger">{error}</Alert>}

        <div className="space-y-1.5">
          <Label htmlFor="fullName">{t.fullName}</Label>
          <Input
            id="fullName"
            required
            autoComplete="name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t.namePlaceholder}
          />
        </div>

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
          <Label htmlFor="phone">{t.phone}</Label>
          <Input
            id="phone"
            type="tel"
            dir="ltr"
            autoComplete="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="01000000000"
            className="rtl:text-end"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">{t.password}</Label>
          <PasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            minLength={8}
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

      <p className="mt-8 text-center text-sm text-ink-soft">
        {t.haveAccount}{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">
          {t.signIn}
        </Link>
      </p>
    </AuthShell>
  );
}
