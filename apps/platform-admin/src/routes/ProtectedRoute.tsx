import { useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Button, Spinner } from "@store-builder/ui";

export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper text-ink-soft">
        <Spinner className="size-6" />
      </div>
    );
  }

  if (status === "guest") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Signed in, but the account couldn't be read (429, a 5xx, offline): the
  // session stays, and the page offers to try again.
  if (status === "unavailable") return <AccountUnavailable />;

  return <Outlet />;
}

function AccountUnavailable() {
  const { retry } = useAuth();
  const [busy, setBusy] = useState(false);

  async function tryAgain() {
    setBusy(true);
    try {
      await retry();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper p-4">
      <div role="alert" className="w-full max-w-sm rounded-2xl border border-line bg-paper-raised p-6 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-ink">We couldn't load your account</h1>
        <p className="mt-2 text-sm text-ink-soft">
          You're still signed in. The connection to Zimos dropped or the server is busy. Try again in a moment.
        </p>
        <Button onClick={tryAgain} disabled={busy} className="mt-5 w-full">
          {busy ? <Spinner className="size-4" /> : null}
          Try again
        </Button>
      </div>
    </div>
  );
}
