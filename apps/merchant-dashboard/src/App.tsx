import { lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { LocaleProvider } from "@/i18n/LocaleContext";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import { ToastProvider } from "@/components/Toast";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { RequireWorkspace } from "@/routes/RequireWorkspace";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { AuthCallbackPage } from "@/pages/AuthCallbackPage";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { VerifyEmailPage } from "@/pages/VerifyEmailPage";
import { WorkspacePickerPage } from "@/pages/WorkspacePickerPage";
import { DashboardLayout } from "@/components/DashboardLayout";
import { DashboardHomePage } from "@/pages/DashboardHomePage";
import { CatalogProductsPage } from "@/pages/catalog/CatalogProductsPage";
import { CollectionsPage } from "@/pages/catalog/CollectionsPage";
import { ProductEditPage } from "@/pages/catalog/ProductEditPage";
import { OrdersListPage } from "@/pages/orders/OrdersListPage";
import { OrderDetailPage } from "@/pages/orders/OrderDetailPage";
import { ConfirmationQueuePage } from "@/pages/confirmation/ConfirmationQueuePage";
import { ReturnsPage } from "@/pages/returns/ReturnsPage";
import { ReviewsPage } from "@/pages/reviews/ReviewsPage";
import { CustomersPage } from "@/pages/customers/CustomersPage";
import { CustomerDetailPage } from "@/pages/customers/CustomerDetailPage";
import { DiscountsPage } from "@/pages/discounts/DiscountsPage";
import { ShippingTaxPage } from "@/pages/shipping/ShippingTaxPage";
import { WebsitePage } from "@/pages/website/WebsitePage";
import { WebsiteEditorPage } from "@/pages/website/editor/WebsiteEditorPage";
import { FunnelsPage } from "@/pages/funnels/FunnelsPage";
import { FunnelEditorPage } from "@/pages/funnels/FunnelEditorPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { LazyRoute } from "@/routes/LazyRoute";

// Code-split: each is a heavy screen a given merchant may never open.
const SettlementsPage = lazy(() =>
  import("@/pages/settlements/SettlementsPage").then((m) => ({ default: m.SettlementsPage }))
);
const AutomationsPage = lazy(() =>
  import("@/pages/automations/AutomationsPage").then((m) => ({ default: m.AutomationsPage }))
);
const InboxPage = lazy(() => import("@/pages/inbox/InboxPage").then((m) => ({ default: m.InboxPage })));
const AbandonedCheckoutsPage = lazy(() =>
  import("@/pages/checkouts/AbandonedCheckoutsPage").then((m) => ({
    default: m.AbandonedCheckoutsPage,
  }))
);
const MarketingPage = lazy(() =>
  import("@/pages/marketing/MarketingPage").then((m) => ({ default: m.MarketingPage }))
);
const FraudProtectionPage = lazy(() =>
  import("@/pages/fraud/FraudProtectionPage").then((m) => ({ default: m.FraudProtectionPage }))
);
const AnalyticsPage = lazy(() =>
  import("@/pages/analytics/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage }))
);
const ProfitPage = lazy(() =>
  import("@/pages/profit/ProfitPage").then((m) => ({ default: m.ProfitPage }))
);
const MediaLibraryPage = lazy(() =>
  import("@/pages/media/MediaLibraryPage").then((m) => ({ default: m.MediaLibraryPage }))
);
const CallCenterPage = lazy(() =>
  import("@/pages/callcenter/CallCenterPage").then((m) => ({ default: m.CallCenterPage }))
);

export default function App() {
  return (
    <BrowserRouter>
      <LocaleProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <ToastProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/auth/callback" element={<AuthCallbackPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="/verify-email" element={<VerifyEmailPage />} />

                <Route element={<ProtectedRoute />}>
                  <Route path="/workspaces" element={<WorkspacePickerPage />} />

                  <Route element={<RequireWorkspace />}>
                    <Route element={<DashboardLayout />}>
                      <Route path="/" element={<DashboardHomePage />} />

                      <Route path="/orders" element={<OrdersListPage />} />
                      <Route path="/orders/:orderId" element={<OrderDetailPage />} />

                      <Route path="/confirmation-queue" element={<ConfirmationQueuePage />} />
                      <Route
                        path="/call-center"
                        element={
                          <LazyRoute>
                            <CallCenterPage />
                          </LazyRoute>
                        }
                      />
                      <Route
                        path="/abandoned-checkouts"
                        element={
                          <LazyRoute>
                            <AbandonedCheckoutsPage />
                          </LazyRoute>
                        }
                      />
                      <Route path="/returns" element={<ReturnsPage />} />
                      <Route
                        path="/settlements"
                        element={
                          <LazyRoute>
                            <SettlementsPage />
                          </LazyRoute>
                        }
                      />

                      <Route path="/catalog" element={<CatalogProductsPage />} />
                      <Route path="/catalog/collections" element={<CollectionsPage />} />
                      <Route path="/catalog/new" element={<ProductEditPage />} />
                      <Route path="/catalog/:productId" element={<ProductEditPage />} />

                      <Route path="/reviews" element={<ReviewsPage />} />
                      <Route path="/customers" element={<CustomersPage />} />
                      <Route path="/customers/:customerId" element={<CustomerDetailPage />} />
                      <Route path="/discounts" element={<DiscountsPage />} />
                      <Route path="/shipping" element={<ShippingTaxPage />} />
                      <Route path="/website" element={<WebsitePage />} />
                      <Route path="/website/:websiteId/edit" element={<WebsiteEditorPage />} />
                      <Route
                        path="/inbox"
                        element={
                          <LazyRoute>
                            <InboxPage />
                          </LazyRoute>
                        }
                      />
                      <Route
                        path="/automations"
                        element={
                          <LazyRoute>
                            <AutomationsPage />
                          </LazyRoute>
                        }
                      />
                      <Route
                        path="/marketing"
                        element={
                          <LazyRoute>
                            <MarketingPage />
                          </LazyRoute>
                        }
                      />
                      <Route
                        path="/fraud"
                        element={
                          <LazyRoute>
                            <FraudProtectionPage />
                          </LazyRoute>
                        }
                      />
                      <Route
                        path="/analytics"
                        element={
                          <LazyRoute>
                            <AnalyticsPage />
                          </LazyRoute>
                        }
                      />
                      <Route
                        path="/profit"
                        element={
                          <LazyRoute>
                            <ProfitPage />
                          </LazyRoute>
                        }
                      />
                      <Route
                        path="/media"
                        element={
                          <LazyRoute>
                            <MediaLibraryPage />
                          </LazyRoute>
                        }
                      />
                      <Route path="/funnels" element={<FunnelsPage />} />
                      <Route path="/funnels/:funnelId" element={<FunnelEditorPage />} />
                      <Route path="/settings" element={<SettingsPage />} />
                    </Route>
                  </Route>
                </Route>
              </Routes>
            </ToastProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </LocaleProvider>
    </BrowserRouter>
  );
}
