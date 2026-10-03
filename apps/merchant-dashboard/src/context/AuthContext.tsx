import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ApiError,
  type AuthUser,
  type LoginPayload,
  type RegisterPayload,
  type VerificationChallenge,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";

interface AuthContextValue {
  user: AuthUser | null;
  status: "loading" | "authenticated" | "guest";
  /**
   * An account made through Google while a plan is required, still to choose
   * one: the dashboard asks for it before anything else (ChoosePlanPage).
   */
  needsPlan: boolean;
  /** Resolves with a challenge when the account must confirm a code first (nothing is signed in then). */
  login: (payload: LoginPayload) => Promise<VerificationChallenge | null>;
  /** Resolves with a challenge while sign-up codes are on. */
  register: (payload: RegisterPayload) => Promise<VerificationChallenge | null>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [needsPlan, setNeedsPlan] = useState(false);
  const [status, setStatus] = useState<AuthContextValue["status"]>("loading");

  const loadUser = async () => {
    if (!apiClient.isAuthenticated()) {
      setUser(null);
      setNeedsPlan(false);
      setStatus("guest");
      return;
    }
    try {
      const me = await apiClient.meDetails();
      setUser(me.user);
      setNeedsPlan(me.needsPlan);
      setStatus("authenticated");
    } catch {
      setUser(null);
      setNeedsPlan(false);
      setStatus("guest");
    }
  };

  useEffect(() => {
    loadUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      needsPlan,
      async login(payload) {
        const result = await apiClient.login(payload);
        // Sign-up codes on: an account not confirmed yet gets its code screen.
        if ("verificationRequired" in result) return result;
        // The backend hands out tokens to a `pending_verification` account, but
        // its `authenticate` middleware rejects those same tokens on every
        // protected endpoint (it requires `status === "active"`), and so does
        // `/auth/refresh`. If we entered the "authenticated" state here, the
        // first workspace fetch would 401 → the api-client would treat it as a
        // dead session, wipe the freshly-issued tokens and bounce back to
        // /login — an unexplained "logged straight back out" loop. Stop with a
        // clear message instead.
        if (result.user.status !== "active") {
          apiClient.clearSession();
          throw new ApiError(
            "Please verify your email address before signing in — check your inbox for the verification link.",
            403,
            "ACCOUNT_INACTIVE"
          );
        }
        await loadUser();
        return null;
      },
      async register(payload) {
        const result = await apiClient.register(payload);
        return "verificationRequired" in result ? result : null;
      },
      async logout() {
        await apiClient.logout();
        setUser(null);
        setNeedsPlan(false);
        setStatus("guest");
      },
      refreshUser: loadUser,
    }),
    [user, status, needsPlan]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export { ApiError };
