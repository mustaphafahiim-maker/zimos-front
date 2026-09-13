import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Alert, Spinner } from "@store-builder/ui";
import { ApiError } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { useT } from "@/i18n/LocaleContext";
import { AuthBackLink, AuthShell, AuthTitle } from "@/components/AuthShell";

const STRINGS = {
  en: {
    title: "Verify your email",
    verifying: "Verifying your email…",
    success: "Your email is verified. You can sign in now.",
    signIn: "Sign in",
    invalidLink: "This link is invalid. It may be incomplete or copied incorrectly.",
    invalidOrExpired: "This link is invalid or has expired.",
    expiredHelp: "If the link is old or was already used, sign in and request a new verification email.",
    failed: "We couldn't verify your email. Please try again shortly.",
  },
  ar: {
    title: "تأكيد البريد الإلكتروني",
    verifying: "جارٍ تأكيد بريدك الإلكتروني…",
    success: "تم تأكيد بريدك الإلكتروني بنجاح. يمكنك تسجيل الدخول الآن.",
    signIn: "تسجيل الدخول",
    invalidLink: "هذا الرابط غير صالح. ربما يكون ناقصًا أو نُسخ بشكل غير صحيح.",
    invalidOrExpired: "هذا الرابط غير صالح أو انتهت صلاحيته.",
    expiredHelp: "إذا كان الرابط قديمًا أو استُخدم من قبل، فسجّل الدخول واطلب رسالة تأكيد جديدة.",
    failed: "تعذّر تأكيد بريدك الإلكتروني. حاول مرة أخرى بعد قليل.",
  },
};

/**
 * Landing page for the email-verification link the backend sends after
 * registration: `/verify-email?token=<opaque-token>`. Confirms the token once
 * on mount, then shows either a success or an invalid/expired state.
 */
type VerifyState = "verifying" | "success" | "error";

export function VerifyEmailPage() {
  const t = useT(STRINGS);
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [apiState, setApiState] = useState<VerifyState>("verifying");
  const [apiErrorMessage, setApiErrorMessage] = useState<string | null>(null);
  // Guard against React's double-invoke in StrictMode firing verifyEmail twice.
  const handled = useRef(false);

  useEffect(() => {
    if (!token || handled.current) return;
    handled.current = true;

    apiClient
      .verifyEmail(token)
      .then(() => setApiState("success"))
      .catch((err) => {
        setApiState("error");
        // null -> localized generic message at render time.
        setApiErrorMessage(err instanceof ApiError ? err.message : null);
      });
  }, [token]);

  // A link with no token has nothing to verify — treat it as an error state.
  const state: VerifyState = token ? apiState : "error";
  const errorMessage = token ? (apiErrorMessage ?? (apiState === "error" ? t.failed : null)) : t.invalidLink;

  return (
    <AuthShell>
      <AuthTitle title={t.title} />

      {state === "verifying" ? (
        <div className="mt-8 flex items-center justify-center gap-3 text-sm text-ink-soft" role="status">
          <Spinner className="size-5 text-primary" />
          <span>{t.verifying}</span>
        </div>
      ) : state === "success" ? (
        <>
          <Alert variant="success" className="mt-6">
            {t.success}
          </Alert>
          <Link to="/login" className="mt-6 inline-block text-sm font-medium text-primary hover:underline">
            {t.signIn}
          </Link>
        </>
      ) : (
        <>
          <Alert variant="danger" className="mt-6">
            {errorMessage ?? t.invalidOrExpired}
          </Alert>
          <p className="mt-4 text-sm text-ink-soft">{t.expiredHelp}</p>
          <AuthBackLink />
        </>
      )}
    </AuthShell>
  );
}
