import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button, Spinner } from "@store-builder/ui";
import { IconOffline } from "@/components/icons";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    stillTrying: "Taking longer than usual — still trying to reach ZIMOS…",
    unreachableTitle: "We can't reach ZIMOS right now",
    unreachable: "You're still signed in. Check your connection and try again in a moment.",
    retry: "Try again",
    retrying: "Trying…",
    signOut: "Sign out instead",
  },
  ar: {
    stillTrying: "بياخد وقت أطول من العادي، لسه بنحاول نوصل لزيموس…",
    unreachableTitle: "مش قادرين نوصل لزيموس دلوقتي",
    unreachable: "إنت لسه مسجّل دخولك. اتأكد من النت وجرّب تاني بعد شوية.",
    retry: "جرّب تاني",
    retrying: "بنجرّب…",
    signOut: "سجّل خروج بدل كده",
  },
} satisfies Messages;

/** After this long on the first spinner, say that the wait is the connection, not the app. */
const SLOW_AFTER_MS = 6000;

export function ProtectedRoute() {
  const { status, user, needsPlan, refreshUser, logout } = useAuth();
  const location = useLocation();
  const t = useT(STRINGS);
  const [slow, setSlow] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (status !== "loading") return;
    const timer = window.setTimeout(() => setSlow(true), SLOW_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [status]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-paper text-ink-soft" role="status" aria-live="polite">
        <Spinner className="size-6" />
        {slow && <p className="max-w-xs text-center text-sm">{t.stillTrying}</p>}
      </div>
    );
  }

  // The session is alive but the server did not answer for a minute: not a sign-in problem, so no sign-in form.
  if (status === "unreachable") {
    const retry = async () => {
      setRetrying(true);
      try {
        await refreshUser();
      } finally {
        setRetrying(false);
      }
    };
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper p-6">
        <div role="alert" className="flex w-full max-w-md flex-col items-center rounded-[var(--radius-card)] bg-paper-raised px-6 py-10 text-center shadow-[var(--shadow-card)] ring-1 ring-line">
          <span className="flex size-12 items-center justify-center rounded-full bg-paper-sunken text-ink-soft">
            <IconOffline className="size-6" aria-hidden />
          </span>
          <h1 className="mt-4 text-lg font-semibold text-ink">{t.unreachableTitle}</h1>
          <p className="mt-1 text-sm text-ink-soft">{t.unreachable}</p>
          <Button className="mt-6 min-h-11" disabled={retrying} onClick={() => void retry()}>
            {retrying && <Spinner className="size-4" />}
            {retrying ? t.retrying : t.retry}
          </Button>
          <Button variant="ghost" className="mt-2 min-h-11 text-ink-soft" disabled={retrying} onClick={() => void logout()}>
            {t.signOut}
          </Button>
        </div>
      </div>
    );
  }

  if (status === "guest") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // An account made through Google picks a username before anything else.
  // `username === undefined` is an API from before usernames: let it through.
  if (user && user.username === null && location.pathname !== "/choose-username") {
    return <Navigate to="/choose-username" replace state={{ from: location }} />;
  }

  // Then, while the server requires a plan at sign-up, one made through Google
  // chooses its plan (needsPlan from /auth/me).
  if (user && user.username !== null && needsPlan && location.pathname !== "/choose-plan") {
    return <Navigate to="/choose-plan" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
