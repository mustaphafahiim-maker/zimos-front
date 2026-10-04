import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Spinner } from "@store-builder/ui";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { AuthBackdrop } from "@/components/AuthBackdrop";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    failedTitle: "Couldn't sign in with Google",
    failedBody: "Something went wrong while signing in with your Google account. Please try again.",
    back: "← Back to sign in",
    signingIn: "Signing in…",
  },
  ar: {
    failedTitle: "تعذّر تسجيل الدخول بجوجل",
    failedBody: "حدث خطأ أثناء تسجيل الدخول بحساب جوجل. من فضلك حاول مرة أخرى.",
    back: "← العودة لتسجيل الدخول",
    signingIn: "جارٍ تسجيل الدخول…",
  },
} satisfies Messages;

/**
 * Landing page for the Google OAuth flow. After Google approves, the backend
 * sets the httpOnly refresh cookie and redirects here with `?status=ok`, or
 * with `?error=...` on failure — no token ever travels in the URL. (A backend
 * with cookie mode off still sends `?accessToken=...&refreshToken=...`.) The
 * auth context then picks up the session and we go to the workspace picker.
 */
export function AuthCallbackPage() {
  const t = useT(STRINGS);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const accessToken = searchParams.get("accessToken");
  const refreshToken = searchParams.get("refreshToken");
  // No tokens means the backend sent `?error=...` (or the page was opened
  // directly) — either way the sign-in didn't go through.
  const cookieSession = searchParams.get("status") === "ok";
  const hasTokens = Boolean(accessToken && refreshToken) || cookieSession;

  const [refreshFailed, setRefreshFailed] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    if (!hasTokens || handled.current) return;
    handled.current = true;

    if (accessToken && refreshToken) apiClient.setTokens({ accessToken, refreshToken });
    else apiClient.adoptCookieSession();
    refreshUser()
      .then(() => navigate("/workspaces", { replace: true }))
      .catch(() => setRefreshFailed(true));
  }, [accessToken, refreshToken, hasTokens, navigate, refreshUser]);

  const failed = !hasTokens || refreshFailed;

  return (
    <div className="auth-glass">
      <AuthBackdrop />
      <div className="auth-glass-stage">
        <div className="w-full max-w-sm text-center">
          {failed ? (
            <>
              <h2 className="font-display text-2xl font-medium text-ink">
                {t.failedTitle}
              </h2>
              <p className="mt-3 text-sm text-ink-soft">
                {t.failedBody}
              </p>
              <Link
                to="/login"
                className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
              >
                {t.back}
              </Link>
            </>
          ) : (
            <div className="flex items-center justify-center gap-3 text-sm text-ink-soft">
              <Spinner className="size-5" />
              <span>{t.signingIn}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
