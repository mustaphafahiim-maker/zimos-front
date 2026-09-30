import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Spinner } from "@store-builder/ui";

export function ProtectedRoute() {
  const { status, user } = useAuth();
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

  // An account made through Google picks a username before anything else.
  // `username === undefined` is an API from before usernames: let it through.
  if (user && user.username === null && location.pathname !== "/choose-username") {
    return <Navigate to="/choose-username" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
