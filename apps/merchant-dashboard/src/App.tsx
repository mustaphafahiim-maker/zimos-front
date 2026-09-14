import { Suspense, lazy, type ComponentType, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { LocaleProvider } from "@/i18n/LocaleContext";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import { ToastProvider } from "@/components/Toast";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { RequireWorkspace } from "@/routes/RequireWorkspace";
import { DashboardLayout } from "@/components/DashboardLayout";
import { BrandLoader } from "@/components/BrandLoader";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { NotFoundPage } from "@/pages/NotFoundPage";
// The sign-in screen is the most common cold entry point, so it ships in the
// main bundle. Every other page is split into its own chunk and loaded on
// first visit.
import { LoginPage } from "@/pages/LoginPage";

/**
 * `React.lazy` for modules that use named exports. `key` must be the page's
 * export name; the module may export other helpers alongside it.
 */
function page<K extends string>(load: () => Promise<Record<K, ComponentType>>, key: K) {
  return lazy(() => load().then((m) => ({ default: m[key] })));
}

// Auth & onboarding
const RegisterPage = page(() => import("@/pages/RegisterPage"), "RegisterPage");
const AuthCallbackPage = page(() => import("@/pages/AuthCallbackPage"), "AuthCallbackPage");
const ForgotPasswordPage = page(() => import("@/pages/ForgotPasswordPage"), "ForgotPasswordPage");
const ResetPasswordPage = page(() => import("@/pages/ResetPasswordPage"), "ResetPasswordPage");
const VerifyEmailPage = page(() => import("@/pages/VerifyEmailPage"), "VerifyEmailPage");
const WorkspacePickerPage = page(() => import("@/pages/WorkspacePickerPage"), "WorkspacePickerPage");
const OnboardingWizardPage = page(() => import("@/pages/onboarding/OnboardingWizardPage"), "OnboardingWizardPage");

// Home
const DashboardHomePage = page(() => import("@/pages/DashboardHomePage"), "DashboardHomePage");
const StoresPage = page(() => import("@/pages/stores/StoresPage"), "StoresPage");

// Sell & COD operations
const OrdersListPage = page(() => import("@/pages/orders/OrdersListPage"), "OrdersListPage");
const NewOrderPage = page(() => import("@/pages/orders/NewOrderPage"), "NewOrderPage");
const OrderDetailPage = page(() => import("@/pages/orders/OrderDetailPage"), "OrderDetailPage");
const OrderPipelinePage = page(() => import("@/pages/orders/OrderPipelinePage"), "OrderPipelinePage");
const AbandonedCheckoutsPage = page(() => import("@/pages/orders/AbandonedCheckoutsPage"), "AbandonedCheckoutsPage");
const ConfirmationQueuePage = page(() => import("@/pages/confirmation/ConfirmationQueuePage"), "ConfirmationQueuePage");
const CallCenterPage = page(() => import("@/pages/callcenter/CallCenterPage"), "CallCenterPage");
const AgentsPage = page(() => import("@/pages/callcenter/AgentsPage"), "AgentsPage");
const CallLogsPage = page(() => import("@/pages/callcenter/CallLogsPage"), "CallLogsPage");
const CallCenterSettingsPage = page(() => import("@/pages/callcenter/CallCenterSettingsPage"), "CallCenterSettingsPage");
const InboxPage = page(() => import("@/pages/inbox/InboxPage"), "InboxPage");
const WaBotPage = page(() => import("@/pages/inbox/WaBotPage"), "WaBotPage");
const ReturnsPage = page(() => import("@/pages/returns/ReturnsPage"), "ReturnsPage");
const FraudProtectionPage = page(() => import("@/pages/fraud/FraudProtectionPage"), "FraudProtectionPage");

// Money
const ProfitPage = page(() => import("@/pages/profit/ProfitPage"), "ProfitPage");
const SettlementsPage = page(() => import("@/pages/settlements/SettlementsPage"), "SettlementsPage");
const PaymentsPage = page(() => import("@/pages/payments/PaymentsPage"), "PaymentsPage");

// Catalog
const CatalogProductsPage = page(() => import("@/pages/catalog/CatalogProductsPage"), "CatalogProductsPage");
const CollectionsPage = page(() => import("@/pages/catalog/CollectionsPage"), "CollectionsPage");
const ProductEditPage = page(() => import("@/pages/catalog/ProductEditPage"), "ProductEditPage");
const InventoryPage = page(() => import("@/pages/inventory/InventoryPage"), "InventoryPage");
const SuppliersPage = page(() => import("@/pages/suppliers/SuppliersPage"), "SuppliersPage");
const CustomersPage = page(() => import("@/pages/customers/CustomersPage"), "CustomersPage");
const CustomerDetailPage = page(() => import("@/pages/customers/CustomerDetailPage"), "CustomerDetailPage");
const ReviewsPage = page(() => import("@/pages/reviews/ReviewsPage"), "ReviewsPage");

// Grow
const AdsPage = page(() => import("@/pages/ads/AdsPage"), "AdsPage");
const CampaignDetailPage = page(() => import("@/pages/ads/CampaignDetailPage"), "CampaignDetailPage");
const FunnelsPage = page(() => import("@/pages/funnels/FunnelsPage"), "FunnelsPage");
const FunnelEditorPage = page(() => import("@/pages/funnels/FunnelEditorPage"), "FunnelEditorPage");
const OffersPage = page(() => import("@/pages/offers/OffersPage"), "OffersPage");
const ExperimentsPage = page(() => import("@/pages/experiments/ExperimentsPage"), "ExperimentsPage");
const DiscountsPage = page(() => import("@/pages/discounts/DiscountsPage"), "DiscountsPage");
const MarketingPage = page(() => import("@/pages/marketing/MarketingPage"), "MarketingPage");
const AutomationsPage = page(() => import("@/pages/automations/AutomationsPage"), "AutomationsPage");
const AffiliatesPage = page(() => import("@/pages/affiliates/AffiliatesPage"), "AffiliatesPage");

// Storefront
const WebsitePage = page(() => import("@/pages/website/WebsitePage"), "WebsitePage");
const WebsiteEditorPage = page(() => import("@/pages/website/editor/WebsiteEditorPage"), "WebsiteEditorPage");
const LandingGeneratorPage = page(() => import("@/pages/generator/LandingGeneratorPage"), "LandingGeneratorPage");
const TemplatesPage = page(() => import("@/pages/templates/TemplatesPage"), "TemplatesPage");
const ShippingTaxPage = page(() => import("@/pages/shipping/ShippingTaxPage"), "ShippingTaxPage");

// Insights
const AnalyticsPage = page(() => import("@/pages/analytics/AnalyticsPage"), "AnalyticsPage");
const AppsPage = page(() => import("@/pages/apps/AppsPage"), "AppsPage");
const SettingsPage = page(() => import("@/pages/settings/SettingsPage"), "SettingsPage");

/** Full-screen loader for pages rendered outside the dashboard shell. */
function Screen({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={<BrandLoader />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

/**
 * In-shell loader: keeps the sidebar and top bar visible while a page chunk
 * loads. The error boundary sits inside the shell so a crashing page (or a
 * stale lazy chunk after a deploy) never takes down the navigation.
 */
function InShell({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={<BrandLoader className="min-h-[60vh] bg-transparent" />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <LocaleProvider>
        <AuthProvider>
          <WorkspaceProvider>
            <ToastProvider>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<Screen><RegisterPage /></Screen>} />
                <Route path="/auth/callback" element={<Screen><AuthCallbackPage /></Screen>} />
                <Route path="/forgot-password" element={<Screen><ForgotPasswordPage /></Screen>} />
                <Route path="/reset-password" element={<Screen><ResetPasswordPage /></Screen>} />
                <Route path="/verify-email" element={<Screen><VerifyEmailPage /></Screen>} />

                <Route element={<ProtectedRoute />}>
                  <Route path="/workspaces" element={<Screen><WorkspacePickerPage /></Screen>} />
                  <Route path="/onboarding" element={<Screen><OnboardingWizardPage /></Screen>} />

                  <Route element={<RequireWorkspace />}>
                    <Route element={<DashboardLayout />}>
                      <Route path="/" element={<InShell><DashboardHomePage /></InShell>} />
                      <Route path="/stores" element={<InShell><StoresPage /></InShell>} />

                      {/* Sell & COD operations */}
                      <Route path="/orders" element={<InShell><OrdersListPage /></InShell>} />
                      <Route path="/orders/new" element={<InShell><NewOrderPage /></InShell>} />
                      <Route path="/orders/pipeline" element={<InShell><OrderPipelinePage /></InShell>} />
                      <Route path="/orders/:orderId" element={<InShell><OrderDetailPage /></InShell>} />
                      <Route path="/confirmation-queue" element={<InShell><ConfirmationQueuePage /></InShell>} />
                      <Route path="/call-center" element={<InShell><CallCenterPage /></InShell>} />
                      <Route path="/call-center/agents" element={<InShell><AgentsPage /></InShell>} />
                      <Route path="/call-center/logs" element={<InShell><CallLogsPage /></InShell>} />
                      <Route path="/call-center/settings" element={<InShell><CallCenterSettingsPage /></InShell>} />
                      <Route path="/inbox" element={<InShell><InboxPage /></InShell>} />
                      <Route path="/inbox/bot" element={<InShell><WaBotPage /></InShell>} />
                      <Route path="/abandoned-checkouts" element={<InShell><AbandonedCheckoutsPage /></InShell>} />
                      <Route path="/returns" element={<InShell><ReturnsPage /></InShell>} />
                      <Route path="/fraud" element={<InShell><FraudProtectionPage /></InShell>} />

                      {/* Money */}
                      <Route path="/profit" element={<InShell><ProfitPage /></InShell>} />
                      <Route path="/settlements" element={<InShell><SettlementsPage /></InShell>} />
                      <Route path="/payments" element={<InShell><PaymentsPage /></InShell>} />

                      {/* Catalog */}
                      <Route path="/catalog" element={<InShell><CatalogProductsPage /></InShell>} />
                      <Route path="/catalog/collections" element={<InShell><CollectionsPage /></InShell>} />
                      <Route path="/catalog/new" element={<InShell><ProductEditPage /></InShell>} />
                      <Route path="/catalog/:productId" element={<InShell><ProductEditPage /></InShell>} />
                      <Route path="/inventory" element={<InShell><InventoryPage /></InShell>} />
                      <Route path="/suppliers" element={<InShell><SuppliersPage /></InShell>} />
                      <Route path="/customers" element={<InShell><CustomersPage /></InShell>} />
                      <Route path="/customers/:customerId" element={<InShell><CustomerDetailPage /></InShell>} />
                      <Route path="/reviews" element={<InShell><ReviewsPage /></InShell>} />

                      {/* Grow */}
                      <Route path="/ads" element={<InShell><AdsPage /></InShell>} />
                      <Route path="/ads/:campaignId" element={<InShell><CampaignDetailPage /></InShell>} />
                      <Route path="/funnels" element={<InShell><FunnelsPage /></InShell>} />
                      <Route path="/funnels/:funnelId" element={<InShell><FunnelEditorPage /></InShell>} />
                      <Route path="/offers" element={<InShell><OffersPage /></InShell>} />
                      <Route path="/experiments" element={<InShell><ExperimentsPage /></InShell>} />
                      <Route path="/discounts" element={<InShell><DiscountsPage /></InShell>} />
                      <Route path="/marketing" element={<InShell><MarketingPage /></InShell>} />
                      <Route path="/automations" element={<InShell><AutomationsPage /></InShell>} />
                      <Route path="/affiliates" element={<InShell><AffiliatesPage /></InShell>} />

                      {/* Storefront */}
                      <Route path="/website" element={<InShell><WebsitePage /></InShell>} />
                      <Route path="/website/:websiteId/edit" element={<InShell><WebsiteEditorPage /></InShell>} />
                      <Route path="/templates" element={<InShell><TemplatesPage /></InShell>} />
                      <Route path="/generator" element={<InShell><LandingGeneratorPage /></InShell>} />
                      <Route path="/shipping" element={<InShell><ShippingTaxPage /></InShell>} />

                      {/* Insights */}
                      <Route path="/analytics" element={<InShell><AnalyticsPage /></InShell>} />
                      <Route path="/apps" element={<InShell><AppsPage /></InShell>} />
                      <Route path="/settings" element={<InShell><SettingsPage /></InShell>} />

                      <Route path="*" element={<NotFoundPage inShell />} />
                    </Route>
                  </Route>
                </Route>

                <Route path="*" element={<NotFoundPage />} />
              </Routes>
            </ToastProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </LocaleProvider>
    </BrowserRouter>
  );
}
