import { Suspense, lazy, type ComponentType, type ReactNode } from "react";
import { BrowserRouter, Navigate, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { LocaleProvider } from "@/i18n/LocaleContext";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { ToastProvider } from "@/components/Toast";
import { AdminLayout } from "@/components/AdminLayout";
// Sign-in is the cold entry point, so it stays in the main bundle.
import { LoginPage } from "@/pages/LoginPage";

/** `React.lazy` for named-export page modules. */
function page<K extends string>(load: () => Promise<Record<K, ComponentType>>, key: K) {
  return lazy(() => load().then((m) => ({ default: m[key] })));
}

const OverviewPage = page(() => import("@/pages/OverviewPage"), "OverviewPage");
const WorkspacesPage = page(() => import("@/pages/WorkspacesPage"), "WorkspacesPage");
const WorkspaceDetailPage = page(() => import("@/pages/WorkspaceDetailPage"), "WorkspaceDetailPage");
const SubscriptionsPage = page(() => import("@/pages/SubscriptionsPage"), "SubscriptionsPage");
const PlansPage = page(() => import("@/pages/PlansPage"), "PlansPage");
const TemplatesPage = page(() => import("@/pages/TemplatesPage"), "TemplatesPage");
const AuditLogPage = page(() => import("@/pages/AuditLogPage"), "AuditLogPage");
const SystemHealthPage = page(() => import("@/pages/SystemHealthPage"), "SystemHealthPage");
const UsersPage = page(() => import("@/pages/UsersPage"), "UsersPage");
const NotFoundPage = page(() => import("@/pages/NotFoundPage"), "NotFoundPage");

/** Keeps the admin shell visible while a page chunk loads. */
function Lazy({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center" role="status" aria-live="polite">
          <span className="size-8 animate-pulse rounded-full bg-primary-soft" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LocaleProvider>
        <AuthProvider>
          <ToastProvider>
            <Routes>
              <Route path="/login" element={<LoginPage />} />

              <Route element={<ProtectedRoute />}>
                <Route element={<AdminLayout />}>
                  <Route path="/" element={<Lazy><OverviewPage /></Lazy>} />
                  <Route path="/workspaces" element={<Lazy><WorkspacesPage /></Lazy>} />
                  <Route path="/workspaces/:id" element={<Lazy><WorkspaceDetailPage /></Lazy>} />
                  <Route path="/subscriptions" element={<Lazy><SubscriptionsPage /></Lazy>} />
                  <Route path="/plans" element={<Lazy><PlansPage /></Lazy>} />
                  <Route path="/templates" element={<Lazy><TemplatesPage /></Lazy>} />
                  <Route path="/users" element={<Lazy><UsersPage /></Lazy>} />
                  {/* Admin users are a filtered view of Users (platformAdmin = true). */}
                  <Route path="/admin-users" element={<Navigate to="/users?admins=1" replace />} />
                  <Route path="/audit-log" element={<Lazy><AuditLogPage /></Lazy>} />
                  <Route path="/system-health" element={<Lazy><SystemHealthPage /></Lazy>} />
                  <Route path="*" element={<Lazy><NotFoundPage /></Lazy>} />
                </Route>
              </Route>
            </Routes>
          </ToastProvider>
        </AuthProvider>
      </LocaleProvider>
    </BrowserRouter>
  );
}
