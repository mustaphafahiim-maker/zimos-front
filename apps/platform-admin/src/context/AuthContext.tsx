import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ApiError, type AuthUser, type LoginPayload } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { hasPermission } from "@/lib/permissions";

interface AuthContextValue {
  user: AuthUser | null;
  status: "loading" | "authenticated" | "guest";
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
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
    } catch {
      setUser(null);
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
      async login(payload) {
        const result = await apiClient.login(payload);
        if (!result.user.platformAdmin) {
          apiClient.clearSession();
          throw new ApiError("This account doesn't have platform admin access.", 403);
        }
        setUser(result.user);
        setStatus("authenticated");
      },
      async logout() {
        await apiClient.logout();
        setUser(null);
        setStatus("guest");
      },
      can: (permission) => hasPermission(user, permission),
    }),
    [user, status]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}

export { ApiError };
