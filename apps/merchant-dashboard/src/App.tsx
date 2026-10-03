import { lazy } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { LocaleProvider } from "@/i18n/LocaleContext";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import { ToastProvider } from "@/components/Toast";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { RequireWorkspace } from "@/routes/RequireWorkspace";
import { LazyRoute } from "@/routes/LazyRoute";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { AuthCallbackPage } from "@/pages/AuthCallbackPage";
import { ChooseUsernamePage } from "@/pages/ChooseUsernamePage";
import { ChoosePlanPage } from "@/pages/ChoosePlanPage";
import { GoLiveDialog } from "@/components/GoLiveDialog";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { VerifyEmailPage } from "@/pages/VerifyEmailPage";
import { WorkspacePickerPage } from "@/pages/WorkspacePickerPage";
import { DashboardLayout } from "@/components/DashboardLayout";
import { EditorLayout } from "@/components/EditorLayout";
import { DashboardHomePage } from "@/pages/DashboardHomePage";
import { CatalogProductsPage } from "@/pages/catalog/CatalogProductsPage";
import { CollectionsPage } from "@/pages/catalog/CollectionsPage";
import { ProductEditPage } from "@/pages/catalog/ProductEditPage";
import { OrdersListPage } from "@/pages/orders/OrdersListPage";
import { OrderDetailPage } from "@/pages/orders/OrderDetailPage";
import { ManualOrderPage } from "@/pages/orders/ManualOrderPage";
import { ConfirmationQueuePage } from "@/pages/confirmation/ConfirmationQueuePage";
import { ReturnsPage } from "@/pages/returns/ReturnsPage";
import { LostOrdersPage } from "@/pages/abandoned/LostOrdersPage";
import { FraudPage } from "@/pages/fraud/FraudPage";
import { ReviewsPage } from "@/pages/reviews/ReviewsPage";
import { ContactsPage } from "@/pages/customers/ContactsPage";
import { FormSubmissionsPage } from "@/pages/customers/FormSubmissionsPage";
import { StoresPage } from "@/pages/stores/StoresPage";
import { DigitalProductsPage } from "@/pages/digital/DigitalProductsPage";
import { AiStudioPage } from "@/pages/ai/AiStudioPage";
import { CustomerDetailPage } from "@/pages/customers/CustomerDetailPage";
import { DiscountsPage } from "@/pages/discounts/DiscountsPage";
import { OffersPage } from "@/pages/offers/OffersPage";
import { BundlesPage } from "@/pages/offers/BundlesPage";
import { OrderBumpsPage, UpsellsPage } from "@/pages/offers/OrderBumpsPage";
import { CrossSellPage } from "@/pages/offers/CrossSellPage";
import { ExitDownsellPage } from "@/pages/offers/ExitDownsellPage";
import { OrderRulesPage } from "@/pages/offers/OrderRulesPage";
import { NewsletterPage, ReferralLinksPage, SocialProofPage } from "@/pages/offers/EngagementPages";
import { ShippingTaxPage } from "@/pages/shipping/ShippingTaxPage";
import { PaymentsPage } from "@/pages/payments/PaymentsPage";
import { WebsitePage } from "@/pages/website/WebsitePage";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { SupportPage, SupportTicketPage } from "@/pages/support/SupportPage";

// Analytics screens and the two editors are code-split: their charts, block
// library and preview plumbing load only when a merchant opens them, not
// with every dashboard page.
// The funnel list shares the funnel starters (and so the block library's
// element table) with the funnel editor, so it is split off with it.
const AppsPage = lazy(() => import("@/pages/apps/AppsPage").then((m) => ({ default: m.AppsPage })));
const InstallAppPage = lazy(() => import("@/pages/apps/InstallAppPage").then((m) => ({ default: m.InstallAppPage })));
const DropshipProviderPage = lazy(() =>
  import("@/pages/apps/DropshipProviderPage").then((m) => ({ default: m.DropshipProviderPage }))
);
const FunnelsPage = lazy(() => import("@/pages/funnels/FunnelsPage").then((m) => ({ default: m.FunnelsPage })));
const FunnelEditorPage = lazy(() =>
  import("@/pages/funnels/FunnelEditorPage").then((m) => ({ default: m.FunnelEditorPage }))
);
const WebsiteEditorPage = lazy(() =>
  import("@/pages/website/editor/WebsiteEditorPage").then((m) => ({ default: m.WebsiteEditorPage }))
);
const AnalyticsPage = lazy(() => import("@/pages/analytics/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage })));
const WebAnalyticsPage = lazy(() =>
  import("@/pages/analytics/WebAnalyticsPage").then((m) => ({ default: m.WebAnalyticsPage }))
);
const RealtimePage = lazy(() => import("@/pages/analytics/RealtimePage").then((m) => ({ default: m.RealtimePage })));
const FunnelAnalyticsPage = lazy(() =>
  import("@/pages/analytics/FunnelAnalyticsPage").then((m) => ({ default: m.FunnelAnalyticsPage }))
);
const AttributionPage = lazy(() =>
  import("@/pages/analytics/AttributionPage").then((m) => ({ default: m.AttributionPage }))
);
const SettlementsPage = lazy(() =>
  import("@/pages/settlements/SettlementsPage").then((m) => ({ default: m.SettlementsPage }))
);
const InboxPage = lazy(() => import("@/pages/inbox/InboxPage").then((m) => ({ default: m.InboxPage })));
const AutomationsPage = lazy(() =>
  import("@/pages/automations/AutomationsPage").then((m) => ({ default: m.AutomationsPage }))
);
const MarketingPage = lazy(() => import("@/pages/marketing/MarketingPage").then((m) => ({ default: m.MarketingPage })));
const ProfitPage = lazy(() => import("@/pages/profit/RealProfitPage").then((m) => ({ default: m.RealProfitPage })));
const ProfitCostsPage = lazy(() =>
  import("@/pages/profit/ProfitCostsPage").then((m) => ({ default: m.ProfitCostsPage }))
);
const AdsPage = lazy(() => import("@/pages/ads/AdsPage").then((m) => ({ default: m.AdsPage })));
const StoreDesignPage = lazy(() =>
  import("@/pages/storeDesign/StoreDesignPage").then((m) => ({ default: m.StoreDesignPage }))
);
const MediaLibraryPage = lazy(() =>
  import("@/pages/media/MediaLibraryPage").then((m) => ({ default: m.MediaLibraryPage }))
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
                  <Route path="/choose-username" element={<ChooseUsernamePage />} />
                  <Route path="/choose-plan" element={<ChoosePlanPage />} />
                  <Route path="/workspaces" element={<WorkspacePickerPage />} />

                  <Route element={<RequireWorkspace />}>
                    <Route element={<DashboardLayout />}>
                      <Route path="/" element={<DashboardHomePage />} />

                      <Route path="/orders" element={<OrdersListPage />} />
                      <Route path="/orders/new" element={<ManualOrderPage />} />
                      <Route path="/orders/:orderId" element={<OrderDetailPage />} />

                      <Route path="/confirmation-queue" element={<ConfirmationQueuePage />} />
                      <Route path="/fraud" element={<FraudPage />} />
                      <Route path="/returns" element={<ReturnsPage />} />
                      <Route path="/abandoned-carts" element={<LostOrdersPage />} />

                      <Route path="/catalog" element={<CatalogProductsPage />} />
                      <Route path="/catalog/collections" element={<CollectionsPage />} />
                      <Route path="/catalog/new" element={<ProductEditPage />} />
                      <Route path="/catalog/:productId" element={<ProductEditPage />} />

                      <Route path="/reviews" element={<ReviewsPage />} />
                      <Route path="/customers" element={<ContactsPage />} />
                      <Route path="/form-submissions" element={<FormSubmissionsPage />} />
                      <Route path="/stores" element={<StoresPage />} />
                      <Route path="/digital" element={<DigitalProductsPage />} />
                      <Route path="/ai" element={<AiStudioPage />} />
                      <Route path="/customers/:customerId" element={<CustomerDetailPage />} />
                      <Route path="/discounts" element={<DiscountsPage />} />
                      <Route path="/offers" element={<OffersPage />} />
                      <Route path="/offers/bundles" element={<BundlesPage />} />
                      <Route path="/offers/order-bumps" element={<OrderBumpsPage />} />
                      <Route path="/offers/cross-sell" element={<CrossSellPage />} />
                      <Route path="/offers/upsells" element={<UpsellsPage />} />
                      <Route path="/offers/exit-popup" element={<ExitDownsellPage />} />
                      <Route path="/offers/order-rules" element={<OrderRulesPage />} />
                      <Route path="/offers/social-proof" element={<SocialProofPage />} />
                      <Route path="/offers/newsletter" element={<NewsletterPage />} />
                      <Route path="/offers/referrals" element={<ReferralLinksPage />} />
                      <Route path="/shipping" element={<ShippingTaxPage />} />
                      <Route path="/payments" element={<PaymentsPage />} />
                      <Route path="/website" element={<WebsitePage />} />
                      <Route path="/funnels" element={<LazyRoute><FunnelsPage /></LazyRoute>} />
                      <Route path="/analytics" element={<LazyRoute><AnalyticsPage /></LazyRoute>} />
                      <Route path="/analytics/web" element={<LazyRoute><WebAnalyticsPage /></LazyRoute>} />
                      <Route path="/analytics/attribution" element={<LazyRoute><AttributionPage /></LazyRoute>} />
                      <Route path="/analytics/realtime" element={<LazyRoute><RealtimePage /></LazyRoute>} />
                      <Route
                        path="/analytics/funnels/:funnelId"
                        element={<LazyRoute><FunnelAnalyticsPage /></LazyRoute>}
                      />
                      <Route path="/settlements" element={<LazyRoute><SettlementsPage /></LazyRoute>} />
                      <Route path="/inbox" element={<LazyRoute><InboxPage /></LazyRoute>} />
                      <Route path="/automations" element={<LazyRoute><AutomationsPage /></LazyRoute>} />
                      <Route path="/marketing" element={<LazyRoute><MarketingPage /></LazyRoute>} />
                      <Route path="/profit" element={<LazyRoute><ProfitPage /></LazyRoute>} />
                      <Route path="/profit/costs" element={<LazyRoute><ProfitCostsPage /></LazyRoute>} />
                      <Route path="/ads" element={<LazyRoute><AdsPage /></LazyRoute>} />
                      <Route path="/media" element={<LazyRoute><MediaLibraryPage /></LazyRoute>} />
                      <Route path="/store-settings" element={<LazyRoute><StoreDesignPage /></LazyRoute>} />
                      <Route path="/store-settings/:tab" element={<LazyRoute><StoreDesignPage /></LazyRoute>} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/apps" element={<LazyRoute><AppsPage /></LazyRoute>} />
                      <Route path="/apps/dropship_sandbox" element={<LazyRoute><DropshipProviderPage /></LazyRoute>} />
                      <Route path="/install-app" element={<LazyRoute><InstallAppPage /></LazyRoute>} />
                      <Route path="/support" element={<SupportPage />} />
                      <Route path="/support/:ticketId" element={<SupportTicketPage />} />
                    </Route>

                    {/* Full-screen editors: their own bar instead of the sidebar,
                        still under the access banner (EditorLayout). */}
                    <Route element={<EditorLayout />}>
                      <Route path="/website/:websiteId/edit" element={<LazyRoute><WebsiteEditorPage /></LazyRoute>} />
                      <Route path="/funnels/:funnelId" element={<LazyRoute><FunnelEditorPage /></LazyRoute>} />
                    </Route>
                  </Route>
                </Route>
              </Routes>
              {/* A draft store's subscribe dialog, opened from anywhere (lib/goLive). */}
              <GoLiveDialog />
            </ToastProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </LocaleProvider>
    </BrowserRouter>
  );
}
