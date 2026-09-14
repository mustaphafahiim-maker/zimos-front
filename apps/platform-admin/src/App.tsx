import { Suspense, lazy, type ComponentType, type ReactNode } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
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
const SuppliersPage = page(() => import("@/pages/SuppliersPage"), "SuppliersPage");
const AppsPage = page(() => import("@/pages/AppsPage"), "AppsPage");
// ProvidersPage takes a `kind` prop, so it is lazy-loaded without the helper.
const ProvidersPage = lazy(() => import("@/pages/ProvidersPage").then((m) => ({ default: m.ProvidersPage })));
const FraudSignalsPage = page(() => import("@/pages/FraudSignalsPage"), "FraudSignalsPage");
const BlocklistPage = page(() => import("@/pages/BlocklistPage"), "BlocklistPage");
const TicketsPage = page(() => import("@/pages/TicketsPage"), "TicketsPage");
const TicketDetailPage = page(() => import("@/pages/TicketDetailPage"), "TicketDetailPage");
const AnnouncementsPage = page(() => import("@/pages/AnnouncementsPage"), "AnnouncementsPage");
const FeatureFlagsPage = page(() => import("@/pages/FeatureFlagsPage"), "FeatureFlagsPage");
const AuditLogPage = page(() => import("@/pages/AuditLogPage"), "AuditLogPage");
const SystemHealthPage = page(() => import("@/pages/SystemHealthPage"), "SystemHealthPage");
const AdminUsersPage = page(() => import("@/pages/AdminUsersPage"), "AdminUsersPage");
const NotFoundPage = page(() => import("@/pages/NotFoundPage"), "NotFoundPage");
const UsersPage = page(() => import("@/pages/UsersPage"), "UsersPage");
const SettingsPage = page(() => import("@/pages/SettingsPage"), "SettingsPage");
const FinancePage = page(() => import("@/pages/FinancePage"), "FinancePage");
const ContentPage = page(() => import("@/pages/ContentPage"), "ContentPage");
const ModerationPage = page(() => import("@/pages/ModerationPage"), "ModerationPage");
const JobsPage = page(() => import("@/pages/JobsPage"), "JobsPage");
const BackupsPage = page(() => import("@/pages/BackupsPage"), "BackupsPage");

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
                <Route path="/suppliers" element={<Lazy><SuppliersPage /></Lazy>} />
                <Route path="/apps" element={<Lazy><AppsPage /></Lazy>} />
                <Route path="/carriers" element={<Lazy><ProvidersPage kind="carrier" /></Lazy>} />
                <Route path="/payment-gateways" element={<Lazy><ProvidersPage kind="payment" /></Lazy>} />
                <Route path="/whatsapp-numbers" element={<Lazy><ProvidersPage kind="whatsapp" /></Lazy>} />
                <Route path="/fraud-signals" element={<Lazy><FraudSignalsPage /></Lazy>} />
                <Route path="/blocklist" element={<Lazy><BlocklistPage /></Lazy>} />
                <Route path="/tickets" element={<Lazy><TicketsPage /></Lazy>} />
                <Route path="/tickets/:id" element={<Lazy><TicketDetailPage /></Lazy>} />
                <Route path="/announcements" element={<Lazy><AnnouncementsPage /></Lazy>} />
                <Route path="/feature-flags" element={<Lazy><FeatureFlagsPage /></Lazy>} />
                <Route path="/audit-log" element={<Lazy><AuditLogPage /></Lazy>} />
                <Route path="/system-health" element={<Lazy><SystemHealthPage /></Lazy>} />
                <Route path="/admin-users" element={<Lazy><AdminUsersPage /></Lazy>} />
                <Route path="/users" element={<Lazy><UsersPage /></Lazy>} />
                <Route path="/settings" element={<Lazy><SettingsPage /></Lazy>} />
                <Route path="/finance" element={<Lazy><FinancePage /></Lazy>} />
                <Route path="/content" element={<Lazy><ContentPage /></Lazy>} />
                <Route path="/moderation" element={<Lazy><ModerationPage /></Lazy>} />
                <Route path="/jobs" element={<Lazy><JobsPage /></Lazy>} />
                <Route path="/backups" element={<Lazy><BackupsPage /></Lazy>} />
                <Route path="*" element={<Lazy><NotFoundPage /></Lazy>} />
              </Route>
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
