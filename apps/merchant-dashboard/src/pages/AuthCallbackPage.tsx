import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Spinner } from "@store-builder/ui";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { useT } from "@/i18n/LocaleContext";
import { AuthBackLink, AuthShell } from "@/components/AuthShell";

const STRINGS = {
  en: {
    failedTitle: "Google sign-in didn't work",
    failedBody: "Something went wrong while signing in with Google. Please try again.",
    signingIn: "Signing you in…",
  },
  ar: {
    failedTitle: "تعذّر تسجيل الدخول باستخدام Google",
    failedBody: "حدث خطأ أثناء تسجيل الدخول بحساب Google. يُرجى المحاولة مرة أخرى.",
    signingIn: "جارٍ تسجيل الدخول…",
  },
};

/**
 * Landing page for the Google OAuth flow. After Google approves, the backend
 * redirects here with `?accessToken=...&refreshToken=...` on success or
 * `?error=...` on failure. We persist the tokens, let the auth context pick up
 * the session, then send the merchant to the workspace picker.
 */
export function AuthCallbackPage() {
  const t = useT(STRINGS);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshUser } = useAuth();

  const accessToken = searchParams.get("accessToken");
  const refreshToken = searchParams.get("refreshToken");
  const hasTokens = Boolean(accessToken && refreshToken);

  const [refreshFailed, setRefreshFailed] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    if (!accessToken || !refreshToken || handled.current) return;
    handled.current = true;

    apiClient.setTokens({ accessToken, refreshToken });
    refreshUser()
      .then(() => navigate("/workspaces", { replace: true }))
      .catch(() => setRefreshFailed(true));
  }, [accessToken, refreshToken, navigate, refreshUser]);

  const failed = !hasTokens || refreshFailed;

  return (
    <AuthShell>
      <div className="text-center">
        {failed ? (
          <>
            <h2 className="text-2xl font-semibold tracking-tight text-ink">{t.failedTitle}</h2>
            <p className="mt-3 text-sm text-ink-soft">{t.failedBody}</p>
            <AuthBackLink />
          </>
        ) : (
          <div className="flex items-center justify-center gap-3 text-sm text-ink-soft" role="status">
            <Spinner className="size-5 text-primary" />
            <span>{t.signingIn}</span>
          </div>
        )}
      </div>
    </AuthShell>
  );
}
