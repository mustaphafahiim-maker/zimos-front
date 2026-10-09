import { lazy } from "react";
import { BrowserRouter, Navigate, Routes, Route, useLocation } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { LocaleProvider } from "@/i18n/LocaleContext";
import { WorkspaceProvider } from "@/context/WorkspaceContext";
import { ToastProvider } from "@/components/Toast";
import { ProtectedRoute } from "@/routes/ProtectedRoute";
import { RequireWorkspace } from "@/routes/RequireWorkspace";
import { LazyRoute } from "@/routes/LazyRoute";
import { RouteCommitSignal } from "@/lib/viewTransition";
import { LoginPage } from "@/pages/LoginPage";
import { NotFoundPage } from "@/pages/NotFoundPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { AuthCallbackPage } from "@/pages/AuthCallbackPage";
import { ChooseUsernamePage } from "@/pages/ChooseUsernamePage";
import { ChoosePlanPage } from "@/pages/ChoosePlanPage";
import { GoLiveDialog } from "@/components/GoLiveDialog";
import { EmailConfirmDialog } from "@/components/account/EmailConfirmDialog";
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
import { FreeGiftsPage } from "@/pages/offers/FreeGiftsPage";
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
// Partner apps with OAuth (handoff 265): the developer's apps, the approval page, an installed app's own page.
const PartnerAppsPage = lazy(() => import("@/pages/partnerApps/PartnerAppsPage").then((m) => ({ default: m.PartnerAppsPage })));
const OAuthAuthorizePage = lazy(() => import("@/pages/partnerApps/OAuthAuthorizePage").then((m) => ({ default: m.OAuthAuthorizePage })));
const PartnerAppFramePage = lazy(() => import("@/pages/partnerApps/PartnerAppFramePage").then((m) => ({ default: m.PartnerAppFramePage })));
const FunnelsPage = lazy(() => import("@/pages/funnels/FunnelsPage").then((m) => ({ default: m.FunnelsPage })));
// Trash for funnels, websites and pages (handoff 373).
const TrashPage = lazy(() => import("@/pages/trash/TrashPage").then((m) => ({ default: m.TrashPage })));
const MarketplacePage = lazy(() => import("@/pages/funnels/marketplace/MarketplacePage").then((m) => ({ default: m.MarketplacePage })));
const FunnelEditorPage = lazy(() =>
  import("@/pages/funnels/FunnelEditorPage").then((m) => ({ default: m.FunnelEditorPage }))
);
const WebsiteEditorPage = lazy(() =>
  import("@/pages/website/editor/WebsiteEditorPage").then((m) => ({ default: m.WebsiteEditorPage }))
);
// Reports: one hub, seven tabs (sales, order journey, ads, products, customers, store, right now).
const ReportsHubPage = lazy(() =>
  import("@/pages/reports/ReportsHubPage").then((m) => ({ default: m.ReportsHubPage }))
);
const FunnelAnalyticsPage = lazy(() =>
  import("@/pages/analytics/FunnelAnalyticsPage").then((m) => ({ default: m.FunnelAnalyticsPage }))
);
// Reports → tax, stock value, slow stock, order times, sales by collection / option, returns, cart offers (handoff 238–242, 245–247, 256).
const StoreReportPage = lazy(() =>
  import("@/pages/analytics/storeReports/StoreReportPage").then((m) => ({ default: m.StoreReportPage }))
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
// Money → Ad accounts (handoff 261).
const AdAccountsPage = lazy(() => import("@/pages/ads/AdAccountsPage").then((m) => ({ default: m.AdAccountsPage })));
const StoreDesignPage = lazy(() =>
  import("@/pages/storeDesign/StoreDesignPage").then((m) => ({ default: m.StoreDesignPage }))
);
const DomainDnsRecordsPage = lazy(() => import("@/pages/storeDesign/DomainDnsRecordsPage").then((m) => ({ default: m.DomainDnsRecordsPage })));
const StoreTextsPage = lazy(() => import("@/pages/website/StoreTextsPage").then((m) => ({ default: m.StoreTextsPage })));
// Offers → Cart offers (handoff 253) and Spin to win (handoff 258).
const CartOffersPage = lazy(() => import("@/pages/offers/CartOffersPage").then((m) => ({ default: m.CartOffersPage })));
const SpinWheelPage = lazy(() => import("@/pages/offers/SpinWheelPage").then((m) => ({ default: m.SpinWheelPage })));
// Marketing → Gift cards (handoff 189).
const GiftCardsPage = lazy(() => import("@/pages/giftCards/GiftCardsPage").then((m) => ({ default: m.GiftCardsPage })));
const GiftCardDetailPage = lazy(() => import("@/pages/giftCards/GiftCardDetailPage").then((m) => ({ default: m.GiftCardDetailPage })));
const PaymentLedgerPage = lazy(() => import("@/pages/payments/ledger/PaymentLedgerPage").then((m) => ({ default: m.PaymentLedgerPage })));
const PayoutDetailPage = lazy(() => import("@/pages/payments/ledger/PayoutDetailPage").then((m) => ({ default: m.PayoutDetailPage })));
// Products → Inventory: locations and transfers (handoff 206), suppliers, purchase orders and stock counts (handoff 207).
const InventoryPage = lazy(() => import("@/pages/inventory/InventoryPage").then((m) => ({ default: m.InventoryPage })));
const InventoryLocationPage = lazy(() => import("@/pages/inventory/LocationPage").then((m) => ({ default: m.LocationPage })));
const PurchaseOrderPage = lazy(() => import("@/pages/inventory/PurchaseOrderPage").then((m) => ({ default: m.PurchaseOrderPage })));
const StockCountPage = lazy(() => import("@/pages/inventory/StockCountPage").then((m) => ({ default: m.StockCountPage })));
// Products → Bulk update from a sheet: stock and prices from a CSV / xlsx (handoff 243, 295, 297).
const SheetUpdatePage = lazy(() => import("@/pages/catalog/sheetUpdate/SheetUpdatePage").then((m) => ({ default: m.SheetUpdatePage })));
// Customers → Loyalty programme (handoff 203) and Store credit balances (handoff 204).
const LoyaltyProgramPage = lazy(() => import("@/pages/loyalty/LoyaltyProgramPage").then((m) => ({ default: m.LoyaltyProgramPage })));
const StoreCreditPage = lazy(() => import("@/pages/storeCredit/StoreCreditPage").then((m) => ({ default: m.StoreCreditPage })));
// Offers → Price lists (handoff 205); Customers → Loyalty & rewards → VIP tiers (218) and Refer a friend (222).
const PriceListsPage = lazy(() => import("@/pages/priceLists/PriceListsPage").then((m) => ({ default: m.PriceListsPage })));
const PriceListEditorPage = lazy(() => import("@/pages/priceLists/PriceListEditorPage").then((m) => ({ default: m.PriceListEditorPage })));
const VipTiersPage = lazy(() => import("@/pages/vipTiers/VipTiersPage").then((m) => ({ default: m.VipTiersPage })));
const ReferAFriendPage = lazy(() => import("@/pages/customerReferrals/ReferAFriendPage").then((m) => ({ default: m.ReferAFriendPage })));
// Products → Size charts (handoff 210).
const SizeChartsPage = lazy(() => import("@/pages/sizeCharts/SizeChartsPage").then((m) => ({ default: m.SizeChartsPage })));
const SizeChartEditorPage = lazy(() => import("@/pages/sizeCharts/SizeChartEditorPage").then((m) => ({ default: m.SizeChartEditorPage })));
// Products → Questions (handoff 212); the notification's /products/:id link lands on the product page.
// The account's team invitations (handoff 358); the invite email links here.
const InvitesPage = lazy(() => import("@/pages/invites/InvitesPage").then((m) => ({ default: m.InvitesPage })));
const QuestionsPage = lazy(() => import("@/pages/questions/QuestionsPage").then((m) => ({ default: m.QuestionsPage })));
const ProductLinkRedirect = lazy(() => import("@/pages/questions/ProductQuestionsSection").then((m) => ({ default: m.ProductLinkRedirect })));
// Orders → Quotes (handoff 219, 275); the new-request notification links to /quotes/:id.
const QuotesPage = lazy(() => import("@/pages/quotes/QuotesPage").then((m) => ({ default: m.QuotesPage })));
const QuoteDetailPage = lazy(() => import("@/pages/quotes/QuoteDetailPage").then((m) => ({ default: m.QuoteDetailPage })));
// Offers → Scheduled sales (handoff 227); /offers/scheduled-sales/new?product=<id> starts a sale on a product.
const ScheduledSalesPage = lazy(() => import("@/pages/priceSchedules/ScheduledSalesPage").then((m) => ({ default: m.ScheduledSalesPage })));
const ScheduledSalePage = lazy(() => import("@/pages/priceSchedules/ScheduledSalePage").then((m) => ({ default: m.ScheduledSalePage })));
// Products → Specifications: the store's list of specifications (handoff 231).
const SpecKeysPage = lazy(() => import("@/pages/productSpecs/SpecKeysPage").then((m) => ({ default: m.SpecKeysPage })));
// Analytics → Store search and Products → Search synonyms (handoff 211).
// Analytics → Survey results: the post-purchase survey's answers (handoff 236).
const SurveyResultsPage = lazy(() => import("@/pages/survey/SurveyResultsPage").then((m) => ({ default: m.SurveyResultsPage })));
const SearchSynonymsPage = lazy(() => import("@/pages/searchInsights/SearchSynonymsPage").then((m) => ({ default: m.SearchSynonymsPage })));
// Store → Blog (handoff 190).
const BlogPostsPage = lazy(() => import("@/pages/blog/BlogPostsPage").then((m) => ({ default: m.BlogPostsPage })));
const BlogPostEditorPage = lazy(() => import("@/pages/blog/BlogPostEditorPage").then((m) => ({ default: m.BlogPostEditorPage })));
const BlogCategoriesPage = lazy(() => import("@/pages/blog/BlogCategoriesPage").then((m) => ({ default: m.BlogCategoriesPage })));
const MediaLibraryPage = lazy(() =>
  import("@/pages/media/MediaLibraryPage").then((m) => ({ default: m.MediaLibraryPage }))
);
// Orders → Pick list (handoff 226) and an order's Scan to pack (handoff 249).
const PickListPage = lazy(() => import("@/pages/orders/packing/PickListPage").then((m) => ({ default: m.PickListPage })));
const ScanToPackPage = lazy(() => import("@/pages/orders/packing/ScanToPackPage").then((m) => ({ default: m.ScanToPackPage })));
// Orders → Delivery schedule (handoff 221) and Orders → Pickups (handoff 225).
const DeliverySchedulePage = lazy(() => import("@/pages/deliverySlots/DeliverySchedulePage").then((m) => ({ default: m.DeliverySchedulePage })));
const PickupsPage = lazy(() => import("@/pages/pickup/PickupsPage").then((m) => ({ default: m.PickupsPage })));

/**
 * An address that moved: goes to where its screen lives now, keeping the query
 * string (the range, a filter) so a bookmark or a pinned shortcut still opens
 * what it opened before. `hash` lands on a block of the new screen.
 */
function MovedTo({ to, hash }: { to: string; hash?: string }) {
  const location = useLocation();
  return <Navigate replace to={{ pathname: to, search: location.search, hash: hash ?? location.hash }} />;
}

export default function App() {
  return (
    <BrowserRouter>
      {/* Tells a running view transition that the next page is in the DOM (lib/viewTransition.ts). */}
      <RouteCommitSignal />
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
                {/* Where a partner app sends the merchant: it sends a guest to sign in and brings them back with the link whole. */}
                <Route path="/oauth/authorize" element={<LazyRoute><OAuthAuthorizePage /></LazyRoute>} />

                <Route element={<ProtectedRoute />}>
                  <Route path="/choose-username" element={<ChooseUsernamePage />} />
                  <Route path="/choose-plan" element={<ChoosePlanPage />} />
                  <Route path="/workspaces" element={<WorkspacePickerPage />} />
                  {/* Team invitations sent to this account (handoff 358): open to an account with no store yet. */}
                  <Route path="/invites" element={<LazyRoute><InvitesPage /></LazyRoute>} />

                  <Route element={<RequireWorkspace />}>
                    <Route element={<DashboardLayout />}>
                      <Route path="/" element={<DashboardHomePage />} />

                      <Route path="/orders" element={<OrdersListPage />} />
                      <Route path="/orders/new" element={<ManualOrderPage />} />
                      <Route path="/orders/board" element={<OrderBoardPage />} />
                      <Route path="/orders/shipment-batches/:batchId" element={<ShipmentBatchPage />} />
                      <Route path="/exports/:exportId" element={<ExportFilePage />} />
                      <Route path="/orders/:orderId" element={<OrderDetailPage />} />
                      <Route path="/orders/pick-list" element={<LazyRoute><PickListPage /></LazyRoute>} />
                      <Route path="/orders/:orderId/pack" element={<LazyRoute><ScanToPackPage /></LazyRoute>} />
                      <Route path="/orders/delivery-schedule" element={<LazyRoute><DeliverySchedulePage /></LazyRoute>} />
                      <Route path="/orders/pickups" element={<LazyRoute><PickupsPage /></LazyRoute>} />

                      <Route path="/confirmation-queue" element={<ConfirmationQueuePage />} />
                      <Route path="/fraud" element={<FraudPage />} />
                      <Route path="/returns" element={<ReturnsPage />} />
                      <Route path="/abandoned-carts" element={<LostOrdersPage />} />

                      <Route path="/catalog" element={<CatalogProductsPage />} />
                      <Route path="/catalog/collections" element={<CollectionsPage />} />
                      <Route path="/catalog/new" element={<ProductEditPage />} />
                      <Route path="/catalog/bulk-update" element={<LazyRoute><SheetUpdatePage /></LazyRoute>} />
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
                      <Route path="/offers/free-gifts" element={<FreeGiftsPage />} />
                      <Route path="/offers/cart-offers" element={<LazyRoute><CartOffersPage /></LazyRoute>} />
                      <Route path="/offers/spin-wheel" element={<LazyRoute><SpinWheelPage /></LazyRoute>} />
                      <Route path="/offers/social-proof" element={<SocialProofPage />} />
                      <Route path="/offers/newsletter" element={<NewsletterPage />} />
                      <Route path="/offers/referrals" element={<ReferralLinksPage />} />
                      <Route path="/offers/feed" element={<ProductFeedPage />} />
                      <Route path="/shipping" element={<ShippingTaxPage />} />
                      <Route path="/payments" element={<PaymentsPage />} />
                      <Route path="/payments/transactions" element={<LazyRoute><PaymentLedgerPage /></LazyRoute>} />
                      <Route path="/payments/payouts/:payoutId" element={<LazyRoute><PayoutDetailPage /></LazyRoute>} />
                      <Route path="/website" element={<WebsitePage />} />
                      <Route path="/website/texts" element={<LazyRoute><StoreTextsPage /></LazyRoute>} />
                      <Route path="/blog" element={<LazyRoute><BlogPostsPage /></LazyRoute>} />
                      <Route path="/blog/new" element={<LazyRoute><BlogPostEditorPage /></LazyRoute>} />
                      <Route path="/blog/categories" element={<LazyRoute><BlogCategoriesPage /></LazyRoute>} />
                      <Route path="/blog/:postId" element={<LazyRoute><BlogPostEditorPage /></LazyRoute>} />
                      <Route path="/funnels" element={<LazyRoute><FunnelsPage /></LazyRoute>} />
                      <Route path="/trash" element={<LazyRoute><TrashPage /></LazyRoute>} />
                      <Route path="/funnels/marketplace" element={<LazyRoute><MarketplacePage /></LazyRoute>} />
                      <Route path="/analytics" element={<LazyRoute><ReportsHubPage /></LazyRoute>} />
                      <Route path="/analytics/:tab/*" element={<LazyRoute><ReportsHubPage /></LazyRoute>} />
                      {/* The report screens the hub took over: their old addresses open the tab that holds them. */}
                      <Route path="/analytics/summary" element={<MovedTo to="/analytics" />} />
                      <Route path="/analytics/web" element={<MovedTo to="/analytics/store" />} />
                      <Route path="/analytics/attribution" element={<MovedTo to="/analytics/ads" />} />
                      <Route path="/analytics/realtime" element={<MovedTo to="/analytics/now" />} />
                      <Route path="/analytics/search" element={<MovedTo to="/analytics/store" hash="#search" />} />
                      <Route path="/analytics/reports/:report?" element={<LazyRoute><StoreReportPage /></LazyRoute>} />
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
                      <Route path="/inventory" element={<LazyRoute><InventoryPage /></LazyRoute>} />
                      <Route path="/inventory/:tab" element={<LazyRoute><InventoryPage /></LazyRoute>} />
                      <Route path="/inventory/locations/:locationId" element={<LazyRoute><InventoryLocationPage /></LazyRoute>} />
                      <Route path="/inventory/purchase-orders/new" element={<LazyRoute><PurchaseOrderPage /></LazyRoute>} />
                      <Route path="/inventory/purchase-orders/:poId" element={<LazyRoute><PurchaseOrderPage /></LazyRoute>} />
                      <Route path="/inventory/stock-counts/:countId" element={<LazyRoute><StockCountPage /></LazyRoute>} />
                      <Route path="/loyalty" element={<LazyRoute><LoyaltyProgramPage /></LazyRoute>} />
                      <Route path="/loyalty/vip" element={<LazyRoute><VipTiersPage /></LazyRoute>} />
                      <Route path="/loyalty/referrals" element={<LazyRoute><ReferAFriendPage /></LazyRoute>} />
                      <Route path="/offers/price-lists" element={<LazyRoute><PriceListsPage /></LazyRoute>} />
                      <Route path="/offers/price-lists/new" element={<LazyRoute><PriceListEditorPage /></LazyRoute>} />
                      <Route path="/offers/price-lists/:priceListId" element={<LazyRoute><PriceListEditorPage /></LazyRoute>} />
                      <Route path="/store-credit" element={<LazyRoute><StoreCreditPage /></LazyRoute>} />
                      <Route path="/size-charts" element={<LazyRoute><SizeChartsPage /></LazyRoute>} />
                      <Route path="/size-charts/new" element={<LazyRoute><SizeChartEditorPage /></LazyRoute>} />
                      <Route path="/size-charts/:chartId" element={<LazyRoute><SizeChartEditorPage /></LazyRoute>} />
                      <Route path="/questions" element={<LazyRoute><QuestionsPage /></LazyRoute>} />
                      <Route path="/products/:productId" element={<LazyRoute><ProductLinkRedirect /></LazyRoute>} />
                      <Route path="/quotes" element={<LazyRoute><QuotesPage /></LazyRoute>} />
                      <Route path="/quotes/:quoteId" element={<LazyRoute><QuoteDetailPage /></LazyRoute>} />
                      <Route path="/offers/scheduled-sales" element={<LazyRoute><ScheduledSalesPage /></LazyRoute>} />
                      <Route path="/offers/scheduled-sales/new" element={<LazyRoute><ScheduledSalePage /></LazyRoute>} />
                      <Route path="/offers/scheduled-sales/:scheduleId" element={<LazyRoute><ScheduledSalePage /></LazyRoute>} />
                      <Route path="/catalog/specifications" element={<LazyRoute><SpecKeysPage /></LazyRoute>} />
                      <Route path="/analytics/survey" element={<LazyRoute><SurveyResultsPage /></LazyRoute>} />
                      <Route path="/search-synonyms" element={<LazyRoute><SearchSynonymsPage /></LazyRoute>} />
                      <Route path="/profit" element={<LazyRoute><ProfitPage /></LazyRoute>} />
                      <Route path="/profit/costs" element={<LazyRoute><ProfitCostsPage /></LazyRoute>} />
                      <Route path="/ads" element={<LazyRoute><AdsPage /></LazyRoute>} />
                      <Route path="/ads/accounts" element={<LazyRoute><AdAccountsPage /></LazyRoute>} />
                      <Route path="/media" element={<LazyRoute><MediaLibraryPage /></LazyRoute>} />
                      <Route path="/store-settings" element={<LazyRoute><StoreDesignPage /></LazyRoute>} />
                      <Route path="/store-settings/:tab" element={<LazyRoute><StoreDesignPage /></LazyRoute>} />
                      <Route path="/domains/purchases/:purchaseId/dns" element={<LazyRoute><DomainDnsRecordsPage /></LazyRoute>} />
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
                      <Route path="/apps/partner/:installId" element={<LazyRoute><PartnerAppFramePage /></LazyRoute>} />
                      {/* Where the server's "couldn't reach Telegram" alert points (handoff 378). */}
                      <Route path="/settings/notifications" element={<Navigate replace to="/settings?tab=notifications#team-channels" />} />
                      <Route path="/settings/developers" element={<LazyRoute><PartnerAppsPage /></LazyRoute>} />
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
              {/* The code that confirms the account's email, opened from anywhere (lib/emailConfirm). */}
              <EmailConfirmDialog />
            </ToastProvider>
          </WorkspaceProvider>
        </AuthProvider>
      </LocaleProvider>
    </BrowserRouter>
  );
}
