import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Spinner } from "@store-builder/ui";
import { useAuth } from "@/context/AuthContext";
import { apiClient } from "@/lib/apiClient";
import { BrandPanel } from "@/components/BrandPanel";

/**
 * Landing page for the Google OAuth flow. After Google approves, the backend
 * sets the httpOnly refresh cookie and redirects here with `?status=ok`, or
 * with `?error=...` on failure — no token ever travels in the URL. (A backend
 * with cookie mode off still sends `?accessToken=...&refreshToken=...`.) The
 * auth context then picks up the session and we go to the workspace picker.
 */
export function AuthCallbackPage() {
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
    <div className="flex min-h-screen">
      <BrandPanel />
      <div className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm text-center">
          {failed ? (
            <>
              <h2 className="font-display text-2xl font-medium text-ink">
                تعذّر تسجيل الدخول بجوجل
              </h2>
              <p className="mt-3 text-sm text-ink-soft">
                حدث خطأ أثناء تسجيل الدخول بحساب جوجل. من فضلك حاول مرة أخرى.
              </p>
              <Link
                to="/login"
                className="mt-6 inline-block text-sm font-medium text-primary hover:underline"
              >
                ← Back to sign in
              </Link>
            </>
          ) : (
            <div className="flex items-center justify-center gap-3 text-sm text-ink-soft">
              <Spinner className="size-5" />
              <span>جارٍ تسجيل الدخول…</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
