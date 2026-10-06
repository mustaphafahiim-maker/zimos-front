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
import { NotFoundPage } from "@/pages/NotFoundPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { AuthCallbackPage } from "@/pages/AuthCallbackPage";
import { ChooseUsernamePage } from "@/pages/ChooseUsernamePage";
import { ChoosePlanPage } from "@/pages/ChoosePlanPage";
import { GoLiveDialog } from "@/components/GoLiveDialog";
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage";
import { ResetPasswordPage } from "@/pages/ResetPasswordPage";
import { VerifyEmailPage } from "@/pages/VerifyEmailPage";
import { EmailChangeConfirmPage } from "@/pages/EmailChangeConfirmPage";
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
import { ShipmentBatchPage } from "@/pages/orders/ShipmentBatchPage";
import { ExportFilePage } from "@/pages/exports/ExportFilePage";
import { OrderBoardPage } from "@/pages/orders/OrderBoardPage";
import { ConfirmationQueuePage } from "@/pages/confirmation/ConfirmationQueuePage";
import { ReturnsPage } from "@/pages/returns/ReturnsPage";
import { LostOrdersPage } from "@/pages/abandoned/LostOrdersPage";
import { FraudPage } from "@/pages/fraud/FraudPage";
import { ReviewsPage } from "@/pages/reviews/ReviewsPage";
import { ContactsPage } from "@/pages/customers/ContactsPage";
import { ContactImportPage } from "@/pages/customers/ContactImportPage";
import { FormSubmissionsPage } from "@/pages/customers/FormSubmissionsPage";
import { StoresPage } from "@/pages/stores/StoresPage";
import { DigitalProductsPage } from "@/pages/digital/DigitalProductsPage";
import { AiStudioPage } from "@/pages/ai/AiStudioPage";
import { AffiliatesPage } from "@/pages/affiliates/AffiliatesPage";
import { ReferralProgramPage } from "@/pages/referrals/ReferralProgramPage";
import { SubscriptionsPage } from "@/pages/subscriptions/SubscriptionsPage";
import { ServicesPage } from "@/pages/services/ServicesPage";
import { ShoppableImagesPage } from "@/pages/shoppable/ShoppableImagesPage";
import { CoursesPage } from "@/pages/courses/CoursesPage";
import { CustomerDetailPage } from "@/pages/customers/CustomerDetailPage";
import { DiscountsPage } from "@/pages/discounts/DiscountsPage";
import { OffersPage } from "@/pages/offers/OffersPage";
import { BundlesPage } from "@/pages/offers/BundlesPage";
import { OrderBumpsPage, UpsellsPage } from "@/pages/offers/OrderBumpsPage";
import { CrossSellPage } from "@/pages/offers/CrossSellPage";
import { ExitDownsellPage } from "@/pages/offers/ExitDownsellPage";
import { OrderRulesPage } from "@/pages/offers/OrderRulesPage";
import { NewsletterPage, ReferralLinksPage, SocialProofPage } from "@/pages/offers/EngagementPages";
import { ProductFeedPage } from "@/pages/offers/ProductFeedPage";
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
const ActivityLogPage = lazy(() => import("@/pages/activity/ActivityLogPage").then((m) => ({ default: m.ActivityLogPage })));
const AppsPage = lazy(() => import("@/pages/apps/AppsPage").then((m) => ({ default: m.AppsPage })));
const GoogleSheetsPage = lazy(() => import("@/pages/apps/GoogleSheetsPage").then((m) => ({ default: m.GoogleSheetsPage })));
const InstallAppPage = lazy(() => import("@/pages/apps/InstallAppPage").then((m) => ({ default: m.InstallAppPage })));
const DropshipProviderPage = lazy(() =>
  import("@/pages/apps/DropshipProviderPage").then((m) => ({ default: m.DropshipProviderPage }))
);
const EmailMarketingPage = lazy(() => import("@/pages/apps/EmailMarketingPage").then((m) => ({ default: m.EmailMarketingPage })));
const AutomationGuidePage = lazy(() => import("@/pages/apps/AutomationGuidePage").then((m) => ({ default: m.AutomationGuidePage })));
const FunnelsPage = lazy(() => import("@/pages/funnels/FunnelsPage").then((m) => ({ default: m.FunnelsPage })));
const FunnelEditorPage = lazy(() =>
  import("@/pages/funnels/FunnelEditorPage").then((m) => ({ default: m.FunnelEditorPage }))
);
const WebsiteEditorPage = lazy(() =>
  import("@/pages/website/editor/WebsiteEditorPage").then((m) => ({ default: m.WebsiteEditorPage }))
);
const AnalyticsPage = lazy(() => import("@/pages/analytics/AnalyticsPage").then((m) => ({ default: m.AnalyticsPage })));
const ReportsPage = lazy(() =>
  import("@/pages/analytics/reports/ReportsPage").then((m) => ({ default: m.ReportsPage }))
);
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
const WaBotPage = lazy(() => import("@/pages/inbox/WaBotPage").then((m) => ({ default: m.WaBotPage })));
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
const StoreTextsPage = lazy(() => import("@/pages/website/StoreTextsPage").then((m) => ({ default: m.StoreTextsPage })));
// Marketing → Gift cards (handoff 189).
const GiftCardsPage = lazy(() => import("@/pages/giftCards/GiftCardsPage").then((m) => ({ default: m.GiftCardsPage })));
const GiftCardDetailPage = lazy(() => import("@/pages/giftCards/GiftCardDetailPage").then((m) => ({ default: m.GiftCardDetailPage })));
// Store → Blog (handoff 190).
const BlogPostsPage = lazy(() => import("@/pages/blog/BlogPostsPage").then((m) => ({ default: m.BlogPostsPage })));
const BlogPostEditorPage = lazy(() => import("@/pages/blog/BlogPostEditorPage").then((m) => ({ default: m.BlogPostEditorPage })));
const BlogCategoriesPage = lazy(() => import("@/pages/blog/BlogCategoriesPage").then((m) => ({ default: m.BlogCategoriesPage })));
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
                <Route path="/account/email-change" element={<EmailChangeConfirmPage />} />

                <Route element={<ProtectedRoute />}>
                  <Route path="/choose-username" element={<ChooseUsernamePage />} />
                  <Route path="/choose-plan" element={<ChoosePlanPage />} />
                  <Route path="/workspaces" element={<WorkspacePickerPage />} />

                  <Route element={<RequireWorkspace />}>
                    <Route element={<DashboardLayout />}>
                      <Route path="/" element={<DashboardHomePage />} />

                      <Route path="/orders" element={<OrdersListPage />} />
                      <Route path="/orders/new" element={<ManualOrderPage />} />
                      <Route path="/orders/board" element={<OrderBoardPage />} />
                      <Route path="/orders/shipment-batches/:batchId" element={<ShipmentBatchPage />} />
                      <Route path="/exports/:exportId" element={<ExportFilePage />} />
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
                      <Route path="/customers/import" element={<ContactImportPage />} />
                      <Route path="/form-submissions" element={<FormSubmissionsPage />} />
                      <Route path="/stores" element={<StoresPage />} />
                      <Route path="/digital" element={<DigitalProductsPage />} />
                      <Route path="/ai" element={<AiStudioPage />} />
                      <Route path="/affiliates" element={<AffiliatesPage />} />
                      <Route path="/referrals" element={<ReferralProgramPage />} />
                      <Route path="/subscriptions" element={<SubscriptionsPage />} />
                      <Route path="/services" element={<ServicesPage />} />
                      <Route path="/shoppable-images" element={<ShoppableImagesPage />} />
                      <Route path="/courses" element={<CoursesPage />} />
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
                      <Route path="/offers/feed" element={<ProductFeedPage />} />
                      <Route path="/shipping" element={<ShippingTaxPage />} />
                      <Route path="/payments" element={<PaymentsPage />} />
                      <Route path="/website" element={<WebsitePage />} />
                      <Route path="/website/texts" element={<LazyRoute><StoreTextsPage /></LazyRoute>} />
                      <Route path="/blog" element={<LazyRoute><BlogPostsPage /></LazyRoute>} />
                      <Route path="/blog/new" element={<LazyRoute><BlogPostEditorPage /></LazyRoute>} />
                      <Route path="/blog/categories" element={<LazyRoute><BlogCategoriesPage /></LazyRoute>} />
                      <Route path="/blog/:postId" element={<LazyRoute><BlogPostEditorPage /></LazyRoute>} />
                      <Route path="/funnels" element={<LazyRoute><FunnelsPage /></LazyRoute>} />
                      <Route path="/analytics" element={<LazyRoute><ReportsPage /></LazyRoute>} />
                      <Route path="/analytics/summary" element={<LazyRoute><AnalyticsPage /></LazyRoute>} />
                      <Route path="/analytics/web" element={<LazyRoute><WebAnalyticsPage /></LazyRoute>} />
                      <Route path="/analytics/attribution" element={<LazyRoute><AttributionPage /></LazyRoute>} />
                      <Route path="/analytics/realtime" element={<LazyRoute><RealtimePage /></LazyRoute>} />
                      <Route
                        path="/analytics/funnels/:funnelId"
                        element={<LazyRoute><FunnelAnalyticsPage /></LazyRoute>}
                      />
                      <Route path="/settlements" element={<LazyRoute><SettlementsPage /></LazyRoute>} />
                      <Route path="/inbox" element={<LazyRoute><InboxPage /></LazyRoute>} />
                      <Route path="/inbox/bot" element={<LazyRoute><WaBotPage /></LazyRoute>} />
                      <Route path="/automations" element={<LazyRoute><AutomationsPage /></LazyRoute>} />
                      <Route path="/marketing" element={<LazyRoute><MarketingPage /></LazyRoute>} />
                      <Route path="/gift-cards" element={<LazyRoute><GiftCardsPage /></LazyRoute>} />
                      <Route path="/gift-cards/:giftCardId" element={<LazyRoute><GiftCardDetailPage /></LazyRoute>} />
                      <Route path="/profit" element={<LazyRoute><ProfitPage /></LazyRoute>} />
                      <Route path="/profit/costs" element={<LazyRoute><ProfitCostsPage /></LazyRoute>} />
                      <Route path="/ads" element={<LazyRoute><AdsPage /></LazyRoute>} />
                      <Route path="/media" element={<LazyRoute><MediaLibraryPage /></LazyRoute>} />
                      <Route path="/store-settings" element={<LazyRoute><StoreDesignPage /></LazyRoute>} />
                      <Route path="/store-settings/:tab" element={<LazyRoute><StoreDesignPage /></LazyRoute>} />
                      <Route path="/settings" element={<SettingsPage />} />
                      <Route path="/apps" element={<LazyRoute><AppsPage /></LazyRoute>} />
                      <Route path="/activity" element={<LazyRoute><ActivityLogPage /></LazyRoute>} />
                      <Route path="/apps/google-sheets" element={<LazyRoute><GoogleSheetsPage /></LazyRoute>} />
                      <Route path="/apps/dropship_sandbox" element={<LazyRoute><DropshipProviderPage /></LazyRoute>} />
                      <Route path="/apps/dropshipping" element={<LazyRoute><DropshipProviderPage /></LazyRoute>} />
                      <Route path="/apps/email-marketing" element={<LazyRoute><EmailMarketingPage /></LazyRoute>} />
                      <Route path="/apps/zapier" element={<LazyRoute><AutomationGuidePage tool="zapier" /></LazyRoute>} />
                      <Route path="/apps/make" element={<LazyRoute><AutomationGuidePage tool="make" /></LazyRoute>} />
                      <Route path="/install-app" element={<LazyRoute><InstallAppPage /></LazyRoute>} />
                      <Route path="/support" element={<SupportPage />} />
                      <Route path="/support/:ticketId" element={<SupportTicketPage />} />
                      <Route path="*" element={<NotFoundPage />} />
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
