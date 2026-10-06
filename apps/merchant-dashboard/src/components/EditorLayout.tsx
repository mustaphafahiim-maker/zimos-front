import { Outlet, useLocation } from "react-router-dom";
import { AccessBanner } from "@/components/AccessBanner";
import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";

/**
 * The frame for the full-screen editors (website, funnel): no sidebar or
 * dashboard header — each editor draws its own bar with a way back — so the
 * canvas gets the whole window. Two things from DashboardLayout stay: the
 * subscription / suspension banner, above the editor, and the error boundary
 * that keeps a crashing page from taking the app down.
 */
export function EditorLayout() {
  const location = useLocation();
  return (
    <div className="glass-editor flex h-dvh flex-col bg-paper">
      <div className="shrink-0 px-3 pt-3 empty:hidden">
        <AccessBanner />
      </div>
      <div className="min-h-0 flex-1">
        <RouteErrorBoundary resetKey={location.pathname}>
          <Outlet />
        </RouteErrorBoundary>
      </div>
    </div>
  );
}
