import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { takeAfterAuth } from "@/lib/emailConfirm";
import { TwoFactorStep } from "@/components/TwoFactorStep";
import { AuthBusy, AuthHeading, AuthShell } from "./AuthShell";
import { GoogleCallbackError, googleCallbackChallenge } from "./auth/GoogleCallbackSteps";

const STRINGS = {
  en: {
    title: "Signing you in",
    signingIn: "One moment…",
  },
  ar: {
    title: "بندخّلك",
    signingIn: "لحظة واحدة…",
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

  // An account with two-step sign-in is not signed in yet: it finishes with its code (handoff 347).
  const [challenge] = useState(() => googleCallbackChallenge(searchParams));

  const [refreshFailed, setRefreshFailed] = useState(false);
  const handled = useRef(false);

  useEffect(() => {
    if (!hasTokens || handled.current) return;
    handled.current = true;

    if (accessToken && refreshToken) apiClient.setTokens({ accessToken, refreshToken });
    else apiClient.adoptCookieSession();
    refreshUser()
      .then(() => navigate(takeAfterAuth() ?? "/workspaces", { replace: true }))
      .catch(() => setRefreshFailed(true));
  }, [accessToken, refreshToken, hasTokens, navigate, refreshUser]);

  const failed = !hasTokens || refreshFailed;

  if (challenge && !hasTokens) {
    return (
      <AuthShell>
        <TwoFactorStep
          challenge={challenge}
          onBack={() => navigate("/login", { replace: true })}
          onVerified={async () => {
            await refreshUser();
            navigate(takeAfterAuth() ?? "/workspaces", { replace: true });
          }}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      {failed ? (
        <GoogleCallbackError code={searchParams.get("error")} />
      ) : (
        <>
          <AuthHeading title={t.title} center />
          <AuthBusy className="mt-4">{t.signingIn}</AuthBusy>
        </>
      )}
    </AuthShell>
  );
}
