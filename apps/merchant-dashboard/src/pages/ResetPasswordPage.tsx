import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, Alert } from "@store-builder/ui";
import { IconLinkOff, IconSuccess } from "@/components/icons";
import { ApiError, useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { MIN_PASSWORD_LENGTH, isPasswordStrong, unmetPasswordRules } from "@/lib/passwordRules";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { errorMessageNow } from "@/lib/errorMessages";
import { AUTH_SUBMIT, AuthHeading, AuthLink, AuthPasswordField, AuthRules, AuthShell } from "./AuthShell";

const STRINGS = {
  en: {
    title: "Set a new password",
    intro: "Choose a new password for your account.",
    badLinkTitle: "This link doesn't work",
    badLink: "It may be incomplete or copied wrongly. Ask for a new one.",
    newLink: "Send me a new link",
    doneTitle: "Password changed",
    done: "Your password is changed and you've been signed out on every device. Sign in with the new password.",
    usedLink: "This link has expired or was already used — ask for a new one",
    askNewLink: "Ask for a new link",
    signIn: "Sign in",
    password: "New password",
    confirm: "New password again",
    passwordRules: "The password still misses the rules listed under it.",
    mismatch: "The two passwords are not the same. Type them again.",
    save: "Save the new password",
    saving: "Saving…",
    back: "Back to sign in",
    failed: "Couldn't change the password. Try again.",
  },
  ar: {
    title: "اعمل كلمة سر جديدة",
    intro: "اختار كلمة سر جديدة لحسابك.",
    badLinkTitle: "اللينك ده مش شغّال",
    badLink: "ممكن يكون ناقص أو اتنسخ غلط. اطلب لينك جديد.",
    newLink: "ابعتلي لينك جديد",
    doneTitle: "كلمة السر اتغيّرت",
    done: "اتغيرت كلمة المرور، وخرجنا من حسابك على كل الأجهزة. سجّل دخولك بكلمة المرور الجديدة.",
    usedLink: "الرابط ده انتهى أو اتستخدم قبل كده — اطلب رابط جديد",
    askNewLink: "اطلب رابط جديد",
    signIn: "ادخل",
    password: "كلمة السر الجديدة",
    confirm: "كلمة السر الجديدة تاني",
    passwordRules: "كلمة السر لسه ناقصها الشروط اللي مكتوبة تحتها.",
    mismatch: "كلمتين السر مش زي بعض. اكتبهم تاني.",
    save: "احفظ كلمة السر الجديدة",
    saving: "بنحفظ…",
    back: "ارجع لتسجيل الدخول",
    failed: "معرفناش نغيّر كلمة السر. جرّب تاني.",
  },
} satisfies Messages;

type FieldName = "password" | "confirm";

/** The first invalid field: on screen and under the cursor. */
function focusField(field: FieldName) {
  window.setTimeout(() => {
    const input = document.getElementById(field);
    input?.scrollIntoView({ block: "center" });
    input?.focus({ preventScroll: true });
  }, 0);
}

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
  const [error, setError] = useState<string | null>(null);
  // What is wrong with a field, said under that field.
  const [fieldError, setFieldError] = useState<{ field: FieldName; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  // The link is dead (used, replaced or expired): said with the way to a new one.
  const [usedLink, setUsedLink] = useState(false);
  const { refreshUser } = useAuth();

  const unmetRules = unmetPasswordRules(password);

  // On success, bounce to the login page after a short beat. The manual button
  // below covers the case where the timer is missed (tab backgrounded, etc.).
  useEffect(() => {
    if (!done) return;
    // Long enough to read that every device was signed out.
    const timer = setTimeout(() => navigate("/login", { replace: true }), 8000);
    return () => clearTimeout(timer);
  }, [done, navigate]);

  function failField(field: FieldName, message: string) {
    setFieldError({ field, message });
    focusField(field);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!token) return;
    setError(null);
    setUsedLink(false);
    setFieldError(null);

    if (!isPasswordStrong(password)) {
      failField("password", t.passwordRules);
      return;
    }
    if (password !== confirm) {
      failField("confirm", t.mismatch);
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.resetPassword(token, password);
      // Every session ended with the reset, this browser's too: nothing stale is kept.
      apiClient.clearSession();
      void refreshUser();
      setDone(true);
    } catch (err) {
      // Keep the form mounted so they can fix a typo or go request a fresh link.
      if (err instanceof ApiError && (err.code as string | undefined) === "INVALID_RESET_TOKEN") setUsedLink(true);
      else setError(err instanceof ApiError ? errorMessageNow(err) : t.failed);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell>
      {!token ? (
        <>
          <AuthHeading title={t.badLinkTitle} icon={<IconLinkOff aria-hidden />} tone="danger">
            {t.badLink}
          </AuthHeading>
          <Button asChild className={`mt-6 ${AUTH_SUBMIT}`}>
            <Link to="/forgot-password">{t.newLink}</Link>
          </Button>
          <AuthLink to="/login" back className="mt-4">
            {t.back}
          </AuthLink>
        </>
      ) : done ? (
        <>
          <AuthHeading title={t.doneTitle} icon={<IconSuccess aria-hidden />} tone="success">
            <span role="status">{t.done}</span>
          </AuthHeading>
          <Button type="button" className={`mt-6 ${AUTH_SUBMIT}`} onClick={() => navigate("/login", { replace: true })}>
            {t.signIn}
          </Button>
        </>
      ) : (
        <>
          <AuthHeading title={t.title}>{t.intro}</AuthHeading>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && <Alert variant="danger">{error}</Alert>}
            {usedLink && (
              <Alert variant="danger">
                <span className="block">{t.usedLink}</span>
                <AuthLink to="/forgot-password">{t.askNewLink}</AuthLink>
              </Alert>
            )}

            <AuthPasswordField
              label={t.password}
              fieldId="password"
              name="new-password"
              autoComplete="new-password"
              enterKeyHint="next"
              required
              minLength={MIN_PASSWORD_LENGTH}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (fieldError?.field === "password") setFieldError(null);
              }}
              aria-describedby={unmetRules.length > 0 ? "password-rules" : undefined}
              error={fieldError?.field === "password" ? fieldError.message : undefined}
            >
              {/* What is still missing, from the first look at the field. */}
              <AuthRules id="password-rules" rules={unmetRules.map((rule) => (locale === "ar" ? rule.label : rule.labelEn))} />
            </AuthPasswordField>

            <AuthPasswordField
              label={t.confirm}
              fieldId="confirm"
              name="confirm-password"
              autoComplete="new-password"
              enterKeyHint="done"
              required
              value={confirm}
              onChange={(e) => {
                setConfirm(e.target.value);
                if (fieldError?.field === "confirm") setFieldError(null);
              }}
              error={
                fieldError?.field === "confirm"
                  ? fieldError.message
                  : confirm.length > 0 && password !== confirm
                    ? t.mismatch
                    : undefined
              }
            />

            <Button type="submit" className={AUTH_SUBMIT} disabled={submitting}>
              {submitting ? t.saving : t.save}
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
