import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ApiError,
  TwoFactorRequiredError,
  isTwoFactorChallenge,
  securityVerifyTwoFactor,
  type AuthUser,
  type LoginPayload,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { hasPermission } from "@/lib/permissions";

interface AuthContextValue {
  user: AuthUser | null;
  /**
   * "unavailable": signed in, but the account couldn't be read when the page
   * loaded (rate limited, a server error, no network). The session is kept
   * and `retry` reads it again; only a 401 makes the user a guest.
   */
  status: "loading" | "authenticated" | "guest" | "unavailable";
  /** Throws TwoFactorRequiredError when the sign-in asks for a code (two-step, or a new device). */
  login: (payload: LoginPayload) => Promise<void>;
  /** The code (or a backup code) for that challenge. */
  verifyCode: (payload: { challengeToken: string; code: string }) => Promise<void>;
  logout: () => Promise<void>;
  /** Reads the account again after "unavailable". */
  retry: () => Promise<void>;
  /** Whether the signed-in account holds a platform permission key. */
  can: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");

  const loadUser = async () => {
    if (!apiClient.isAuthenticated()) {
      setStatus("guest");
      return;
    }
    try {
      const me = await apiClient.me();
      // platformAdmin is true for any platform role (creator, admin, agent);
      // what the account may open is its permission set, checked per route.
      if (!me.platformAdmin) {
        // Authenticated, but no platform role — treat as guest here.
        apiClient.clearSession();
        setUser(null);
        setStatus("guest");
        return;
      }
      setUser(me);
      setStatus("authenticated");
    } catch (err) {
      // Only the server refusing the session (401, from /auth/me or the
      // refresh behind it) signs out; a 429, a 5xx or no network keeps it.
      if (err instanceof ApiError && err.status === 401) {
        setUser(null);
        setStatus("guest");
        return;
      }
      setStatus("unavailable");
    }
  };

  const retry = useCallback(async () => {
    setStatus("loading");
    await loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      async login(payload) {
        const result = await apiClient.login(payload);
        // An account still to confirm its sign-up code (REQUIRE_SIGNUP_VERIFICATION)
        // does that in the merchant dashboard; nothing was signed in here.
        if ("verificationRequired" in result) {
          throw new ApiError("Confirm this account from the Zimos dashboard first, then sign in here.", 403);
        }
        // Two-step sign-in, or a browser new to the account: the login page asks for the code.
        if (isTwoFactorChallenge(result)) throw new TwoFactorRequiredError(result);
        if (!result.user.platformAdmin) {
          apiClient.clearSession();
          throw new ApiError("This account doesn't have platform admin access.", 403);
        }
        setUser(result.user);
        setStatus("authenticated");
      },
      async verifyCode(payload) {
        const { user: signedIn } = await securityVerifyTwoFactor(apiClient, payload);
        if (!signedIn.platformAdmin) {
          apiClient.clearSession();
          throw new ApiError("This account doesn't have platform admin access.", 403);
        }
        setUser(signedIn);
        setStatus("authenticated");
      },
      async logout() {
        // Signed out here even when the server can't be told: the client has
        // already dropped the tokens (ApiClient.logout).
        try {
          await apiClient.logout();
        } finally {
          setUser(null);
          setStatus("guest");
        }
      },
      retry,
      can: (permission) => hasPermission(user, permission),
    }),
    [user, status, retry]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export { ApiError };
