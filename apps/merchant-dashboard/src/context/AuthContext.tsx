import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ApiError,
  type AuthUser,
  type LoginPayload,
  type RegisterPayload,
  type VerificationChallenge,
  TwoFactorRequiredError,
  isTwoFactorChallenge,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";

interface AuthContextValue {
  user: AuthUser | null;
  /** "unreachable": signed in, but the server gave no answer about the session for a minute (offline, rate-limited, down). */
  status: "loading" | "authenticated" | "guest" | "unreachable";
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

  // Only the newest loadUser may write state: a retry started while an older
  // loop is still waiting would otherwise race it, and the loser could evict a
  // merchant the winner had just signed back in.
  const generation = useRef(0);

  const loadUser = async () => {
    const gen = ++generation.current;
    const live = () => gen === generation.current;
    if (!apiClient.isAuthenticated()) {
      setUser(null);
      setNeedsPlan(false);
      setStatus("guest");
      return;
    }
    // A call that got no answer about the session (the rate limiter, a server
    // error, a phone that lost signal while the page loaded) leaves the session
    // in place. Wait and ask again rather than show the sign-in page to someone
    // who is signed in, for up to a minute — one window of the rate limiter.
    const waits = [1000, 2000, 4000, 8000, 15000];
    const deadline = Date.now() + 60_000;
    for (let attempt = 0; ; attempt++) {
      try {
        const me = await apiClient.meDetails();
        if (!live()) return;
        setUser(me.user);
        setNeedsPlan(me.needsPlan);
        setStatus("authenticated");
        return;
      } catch (err) {
        if (!live()) return;
        const noAnswer = !(err instanceof ApiError) || err.status === 408 || err.status === 429 || err.status >= 500;
        if (!noAnswer) break;
        if (!apiClient.isAuthenticated()) break;
        // The rate limiter rarely says how long is left (ApiError.retryAfter): wait a third of its window.
        const limited = err instanceof ApiError && err.status === 429;
        const asked = err instanceof ApiError && err.retryAfter ? Math.min(err.retryAfter, 60) * 1000 : 0;
        const wait = Math.min(limited ? asked || 20000 : waits[Math.min(attempt, waits.length - 1)], deadline - Date.now());
        if (wait <= 0) {
          // Still signed in, still no answer: say so instead of showing a sign-in form to someone who is signed in.
          setUser(null);
          setNeedsPlan(false);
          setStatus("unreachable");
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, wait));
        if (!live()) return;
      }
    }
    if (!live()) return;
    setUser(null);
    setNeedsPlan(false);
    setStatus("guest");
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
        // Two-step sign-in: the login page catches this and asks for the code.
        if (isTwoFactorChallenge(result)) throw new TwoFactorRequiredError(result);
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
