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
import { OrderPipelinePage } from "@/pages/orders/OrderPipelinePage";
import { AbandonedCheckoutsPage } from "@/pages/orders/AbandonedCheckoutsPage";
import { ConfirmationQueuePage } from "@/pages/confirmation/ConfirmationQueuePage";
import { CustomersPage } from "@/pages/customers/CustomersPage";
import { CustomerDetailPage } from "@/pages/customers/CustomerDetailPage";
import { DiscountsPage } from "@/pages/discounts/DiscountsPage";
import { ShippingTaxPage } from "@/pages/shipping/ShippingTaxPage";
import { WebsitePage } from "@/pages/website/WebsitePage";
import { WebsiteEditorPage } from "@/pages/website/editor/WebsiteEditorPage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { FunnelsPage } from "@/pages/funnels/FunnelsPage";
import { FunnelEditorPage } from "@/pages/funnels/FunnelEditorPage";
import { ExperimentsPage } from "@/pages/experiments/ExperimentsPage";
import { TemplatesPage } from "@/pages/templates/TemplatesPage";
import { OffersPage } from "@/pages/offers/OffersPage";
import { MarketingPage } from "@/pages/marketing/MarketingPage";
import { AutomationsPage } from "@/pages/automations/AutomationsPage";
import { FraudProtectionPage } from "@/pages/fraud/FraudProtectionPage";
import { AnalyticsPage } from "@/pages/analytics/AnalyticsPage";
import { InventoryPage } from "@/pages/inventory/InventoryPage";
import { PaymentsPage } from "@/pages/payments/PaymentsPage";
import { AppsPage } from "@/pages/apps/AppsPage";
import { AdsPage } from "@/pages/ads/AdsPage";
import { CampaignDetailPage } from "@/pages/ads/CampaignDetailPage";
import { ProfitPage } from "@/pages/profit/ProfitPage";
import { CallCenterPage } from "@/pages/callcenter/CallCenterPage";
import { AgentsPage } from "@/pages/callcenter/AgentsPage";
import { CallLogsPage } from "@/pages/callcenter/CallLogsPage";
import { CallCenterSettingsPage } from "@/pages/callcenter/CallCenterSettingsPage";
import { InboxPage } from "@/pages/inbox/InboxPage";
import { WaBotPage } from "@/pages/inbox/WaBotPage";
import { SettlementsPage } from "@/pages/settlements/SettlementsPage";
import { ReturnsPage } from "@/pages/returns/ReturnsPage";
import { ReviewsPage } from "@/pages/reviews/ReviewsPage";
import { AffiliatesPage } from "@/pages/affiliates/AffiliatesPage";
import { SuppliersPage } from "@/pages/suppliers/SuppliersPage";
import { StoresPage } from "@/pages/stores/StoresPage";

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
                    <Route path="/stores" element={<StoresPage />} />

                    {/* Phase 2: COD operations */}
                    <Route path="/call-center" element={<CallCenterPage />} />
                    <Route path="/call-center/agents" element={<AgentsPage />} />
                    <Route path="/call-center/logs" element={<CallLogsPage />} />
                    <Route path="/call-center/settings" element={<CallCenterSettingsPage />} />
                    <Route path="/inbox" element={<InboxPage />} />
                    <Route path="/inbox/bot" element={<WaBotPage />} />
                    <Route path="/returns" element={<ReturnsPage />} />
                    <Route path="/reviews" element={<ReviewsPage />} />

                    {/* Phase 2: money */}
                    <Route path="/profit" element={<ProfitPage />} />
                    <Route path="/settlements" element={<SettlementsPage />} />

                    {/* Phase 2: growth */}
                    <Route path="/ads" element={<AdsPage />} />
                    <Route path="/ads/:campaignId" element={<CampaignDetailPage />} />
                    <Route path="/affiliates" element={<AffiliatesPage />} />
                    <Route path="/suppliers" element={<SuppliersPage />} />

                    {/* Sell */}
                    <Route path="/orders" element={<OrdersListPage />} />
                    <Route path="/orders/pipeline" element={<OrderPipelinePage />} />
                    <Route path="/orders/:orderId" element={<OrderDetailPage />} />
                    <Route path="/confirmation-queue" element={<ConfirmationQueuePage />} />
                    <Route path="/abandoned-checkouts" element={<AbandonedCheckoutsPage />} />
                    <Route path="/fraud" element={<FraudProtectionPage />} />

                    {/* Catalog */}
                    <Route path="/catalog" element={<CatalogProductsPage />} />
                    <Route path="/catalog/collections" element={<CollectionsPage />} />
                    <Route path="/catalog/new" element={<ProductEditPage />} />
                    <Route path="/catalog/:productId" element={<ProductEditPage />} />
                    <Route path="/inventory" element={<InventoryPage />} />
                    <Route path="/customers" element={<CustomersPage />} />
                    <Route path="/customers/:customerId" element={<CustomerDetailPage />} />

                    {/* Grow */}
                    <Route path="/funnels" element={<FunnelsPage />} />
                    <Route path="/funnels/:funnelId" element={<FunnelEditorPage />} />
                    <Route path="/offers" element={<OffersPage />} />
                    <Route path="/experiments" element={<ExperimentsPage />} />
                    <Route path="/discounts" element={<DiscountsPage />} />
                    <Route path="/marketing" element={<MarketingPage />} />
                    <Route path="/automations" element={<AutomationsPage />} />

                    {/* Storefront */}
                    <Route path="/website" element={<WebsitePage />} />
                    <Route path="/website/:websiteId/edit" element={<WebsiteEditorPage />} />
                    <Route path="/templates" element={<TemplatesPage />} />
                    <Route path="/shipping" element={<ShippingTaxPage />} />
                    <Route path="/payments" element={<PaymentsPage />} />

                    {/* Insights */}
                    <Route path="/analytics" element={<AnalyticsPage />} />
                    <Route path="/apps" element={<AppsPage />} />
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
