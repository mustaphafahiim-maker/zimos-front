import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Alert, Spinner } from "@store-builder/ui";
import { ApiError } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { AuthBackdrop } from "@/components/AuthBackdrop";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { errorMessageNow } from "@/lib/errorMessages";

const STRINGS = {
  en: {
    title: "Verify your email",
    verifying: "Verifying your email…",
    success: "Your email is verified. You can sign in now.",
    signIn: "Sign in",
    badLink: "This link isn't valid. It may be incomplete or copied wrongly.",
    expired: "This link isn't valid or has expired.",
    hint: "If the link is old or was already used, sign in and ask for a new verification email.",
    back: "← Back to sign in",
    failed: "Couldn't verify the email. Try again in a moment.",
  },
  ar: {
    title: "تأكيد البريد الإلكتروني",
    verifying: "بنأكد الإيميل…",
    success: "تم تأكيد بريدك الإلكتروني بنجاح. يمكنك تسجيل الدخول الآن.",
    signIn: "تسجيل الدخول",
    badLink: "الرابط غير صالح. قد يكون ناقصًا أو نُسخ بشكل خاطئ.",
    expired: "الرابط غير صالح أو انتهت صلاحيته.",
    hint: "إذا كان الرابط قديمًا أو استُخدم من قبل، سجّل الدخول واطلب رسالة تأكيد جديدة.",
    back: "← العودة لتسجيل الدخول",
    failed: "تعذّر تأكيد البريد الإلكتروني. حاول مرة أخرى بعد قليل.",
  },
} satisfies Messages;

/**
 * Landing page for the email-verification link the backend sends after
 * registration: `https://app.zimos.co/verify-email?token=<opaque-token>`.
 * We read `token` from the query string (same param name as /reset-password),
 * confirm it against the API once on mount, then show either a success state
 * or an invalid/expired state — both point back to /login, where an expired
 * link can be re-sent.
 */
type VerifyState = "verifying" | "success" | "error";

export function VerifyEmailPage() {
  const t = useT(STRINGS);
  const [searchParams] = useSearchParams();
  // The emailed link is /verify-email?token=xxx — the token rides in a query
  // param named exactly `token` (matches /reset-password).
  const token = searchParams.get("token");

  const [apiState, setApiState] = useState<VerifyState>("verifying");
  // `true` = failed with nothing to quote from the server (network, odd shape).
  const [apiErrorMessage, setApiErrorMessage] = useState<string | true | null>(null);
  // Guard against React's double-invoke in StrictMode firing verifyEmail twice
  // (same pattern as AuthCallbackPage).
  const handled = useRef(false);

  useEffect(() => {
    if (!token || handled.current) return;
    handled.current = true;

    apiClient
      .verifyEmail(token)
      .then(() => setApiState("success"))
      .catch((err) => {
        // A known/used/expired token comes back as an ApiError (assumed code
        // "INVALID_VERIFICATION_TOKEN") — show its message; fall back to a
        // generic line for anything else (network, unexpected shape).
        setApiState("error");
        setApiErrorMessage(
          err instanceof ApiError ? errorMessageNow(err) : true
        );
      });
  }, [token]);

  // A link with no token has nothing to verify — treat it as an error state
  // without touching the API (mirrors how AuthCallbackPage derives its failure).
  const state: VerifyState = token ? apiState : "error";
  const errorMessage = token ? (apiErrorMessage === true ? t.failed : apiErrorMessage) : t.badLink;

  return (
    <div className="auth-glass">
      <AuthBackdrop />
      <div className="auth-glass-stage">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-3xl font-medium text-ink">{t.title}</h2>

          {state === "verifying" ? (
            <div className="mt-8 flex items-center justify-center gap-3 text-sm text-ink-soft">
              <Spinner className="size-5" />
              <span>{t.verifying}</span>
            </div>
          ) : state === "success" ? (
            <>
              <Alert variant="success" className="mt-6">
                {t.success}
              </Alert>
              <Link
                to="/login"
                className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
              >
                {t.signIn}
              </Link>
            </>
          ) : (
            <>
              <Alert variant="danger" className="mt-6">
                {errorMessage ?? t.expired}
              </Alert>
              <p className="mt-4 text-sm text-ink-soft">
                {t.hint}
              </p>
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
