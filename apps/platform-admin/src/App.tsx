import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { ToastProvider } from "@/components/Toast";
import { AdminLayout } from "@/components/AdminLayout";
import { LoginPage } from "@/pages/LoginPage";
import { OverviewPage } from "@/pages/OverviewPage";
import { WorkspacesPage } from "@/pages/WorkspacesPage";
import { WorkspaceDetailPage } from "@/pages/WorkspaceDetailPage";
import { SubscriptionsPage } from "@/pages/SubscriptionsPage";
import { PlansPage } from "@/pages/PlansPage";
import { TemplatesPage } from "@/pages/TemplatesPage";
import { SuppliersPage } from "@/pages/SuppliersPage";
import { AppsPage } from "@/pages/AppsPage";
import { ProvidersPage } from "@/pages/ProvidersPage";
import { FraudSignalsPage } from "@/pages/FraudSignalsPage";
import { BlocklistPage } from "@/pages/BlocklistPage";
import { TicketsPage } from "@/pages/TicketsPage";
import { TicketDetailPage } from "@/pages/TicketDetailPage";
import { AnnouncementsPage } from "@/pages/AnnouncementsPage";
import { FeatureFlagsPage } from "@/pages/FeatureFlagsPage";
import { AuditLogPage } from "@/pages/AuditLogPage";
import { SystemHealthPage } from "@/pages/SystemHealthPage";
import { AdminUsersPage } from "@/pages/AdminUsersPage";
import { NotFoundPage } from "@/pages/NotFoundPage";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AdminLayout />}>
                <Route path="/" element={<OverviewPage />} />
                <Route path="/workspaces" element={<WorkspacesPage />} />
                <Route path="/workspaces/:id" element={<WorkspaceDetailPage />} />
                <Route path="/subscriptions" element={<SubscriptionsPage />} />
                <Route path="/plans" element={<PlansPage />} />
                <Route path="/templates" element={<TemplatesPage />} />
                <Route path="/suppliers" element={<SuppliersPage />} />
                <Route path="/apps" element={<AppsPage />} />
                <Route path="/carriers" element={<ProvidersPage kind="carrier" />} />
                <Route path="/payment-gateways" element={<ProvidersPage kind="payment" />} />
                <Route path="/whatsapp-numbers" element={<ProvidersPage kind="whatsapp" />} />
                <Route path="/fraud-signals" element={<FraudSignalsPage />} />
                <Route path="/blocklist" element={<BlocklistPage />} />
                <Route path="/tickets" element={<TicketsPage />} />
                <Route path="/tickets/:id" element={<TicketDetailPage />} />
                <Route path="/announcements" element={<AnnouncementsPage />} />
                <Route path="/feature-flags" element={<FeatureFlagsPage />} />
                <Route path="/audit-log" element={<AuditLogPage />} />
                <Route path="/system-health" element={<SystemHealthPage />} />
                <Route path="/admin-users" element={<AdminUsersPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
