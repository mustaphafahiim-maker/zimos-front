/**
 * One prefetch loader per code-split page, keyed by the route prefix it
 * serves (lib/prefetch.ts). The import() strings are the same ones App.tsx
 * uses, so Vite serves one chunk for both. Imported once from main.tsx.
 */
import { registerPrefetch } from "@/lib/prefetch";

registerPrefetch("/activity", () => import("@/pages/activity/ActivityLogPage"));
registerPrefetch("/ads", () => import("@/pages/ads/AdsPage"));
registerPrefetch("/ads/accounts", () => import("@/pages/ads/AdAccountsPage"));
registerPrefetch("/analytics", () => import("@/pages/reports/ReportsHubPage"));
registerPrefetch("/analytics/survey", () => import("@/pages/survey/SurveyResultsPage"));
registerPrefetch("/apps", () => import("@/pages/apps/AppsPage"));
registerPrefetch("/apps/email-marketing", () => import("@/pages/apps/EmailMarketingPage"));
registerPrefetch("/apps/google-sheets", () => import("@/pages/apps/GoogleSheetsPage"));
registerPrefetch("/apps/make", () => import("@/pages/apps/AutomationGuidePage"));
registerPrefetch("/apps/partner", () => import("@/pages/partnerApps/PartnerAppFramePage"));
registerPrefetch("/apps/zapier", () => import("@/pages/apps/AutomationGuidePage"));
registerPrefetch("/blog", () => import("@/pages/blog/BlogPostEditorPage"));
registerPrefetch("/blog", () => import("@/pages/blog/BlogPostsPage"));
registerPrefetch("/blog/categories", () => import("@/pages/blog/BlogCategoriesPage"));
registerPrefetch("/blog/new", () => import("@/pages/blog/BlogPostEditorPage"));
registerPrefetch("/catalog/bulk-update", () => import("@/pages/catalog/sheetUpdate/SheetUpdatePage"));
registerPrefetch("/catalog/specifications", () => import("@/pages/productSpecs/SpecKeysPage"));
registerPrefetch("/funnels", () => import("@/pages/funnels/FunnelsPage"));
registerPrefetch("/funnels/marketplace", () => import("@/pages/funnels/marketplace/MarketplacePage"));
registerPrefetch("/gift-cards", () => import("@/pages/giftCards/GiftCardDetailPage"));
registerPrefetch("/gift-cards", () => import("@/pages/giftCards/GiftCardsPage"));
registerPrefetch("/inbox", () => import("@/pages/inbox/InboxPage"));
registerPrefetch("/inbox/bot", () => import("@/pages/inbox/WaBotPage"));
registerPrefetch("/install-app", () => import("@/pages/apps/InstallAppPage"));
registerPrefetch("/inventory", () => import("@/pages/inventory/InventoryPage"));
registerPrefetch("/inventory/locations", () => import("@/pages/inventory/LocationPage"));
registerPrefetch("/inventory/purchase-orders", () => import("@/pages/inventory/PurchaseOrderPage"));
registerPrefetch("/inventory/purchase-orders/new", () => import("@/pages/inventory/PurchaseOrderPage"));
registerPrefetch("/inventory/stock-counts", () => import("@/pages/inventory/StockCountPage"));
registerPrefetch("/loyalty", () => import("@/pages/loyalty/LoyaltyProgramPage"));
registerPrefetch("/loyalty/referrals", () => import("@/pages/customerReferrals/ReferAFriendPage"));
registerPrefetch("/loyalty/vip", () => import("@/pages/vipTiers/VipTiersPage"));
registerPrefetch("/marketing", () => import("@/pages/marketing/MarketingPage"));
registerPrefetch("/oauth/authorize", () => import("@/pages/partnerApps/OAuthAuthorizePage"));
registerPrefetch("/offers/cart-offers", () => import("@/pages/offers/CartOffersPage"));
registerPrefetch("/offers/price-lists", () => import("@/pages/priceLists/PriceListEditorPage"));
registerPrefetch("/offers/price-lists", () => import("@/pages/priceLists/PriceListsPage"));
registerPrefetch("/offers/price-lists/new", () => import("@/pages/priceLists/PriceListEditorPage"));
registerPrefetch("/offers/scheduled-sales", () => import("@/pages/priceSchedules/ScheduledSalePage"));
registerPrefetch("/offers/scheduled-sales", () => import("@/pages/priceSchedules/ScheduledSalesPage"));
registerPrefetch("/offers/scheduled-sales/new", () => import("@/pages/priceSchedules/ScheduledSalePage"));
registerPrefetch("/offers/spin-wheel", () => import("@/pages/offers/SpinWheelPage"));
registerPrefetch("/orders/delivery-schedule", () => import("@/pages/deliverySlots/DeliverySchedulePage"));
registerPrefetch("/orders/pack", () => import("@/pages/orders/packing/ScanToPackPage"));
registerPrefetch("/orders/pick-list", () => import("@/pages/orders/packing/PickListPage"));
registerPrefetch("/orders/pickups", () => import("@/pages/pickup/PickupsPage"));
registerPrefetch("/products", () => import("@/pages/questions/ProductQuestionsSection"));
registerPrefetch("/profit", () => import("@/pages/profit/RealProfitPage"));
registerPrefetch("/questions", () => import("@/pages/questions/QuestionsPage"));
registerPrefetch("/quotes", () => import("@/pages/quotes/QuoteDetailPage"));
registerPrefetch("/quotes", () => import("@/pages/quotes/QuotesPage"));
registerPrefetch("/search-synonyms", () => import("@/pages/searchInsights/SearchSynonymsPage"));
registerPrefetch("/settings/developers", () => import("@/pages/partnerApps/PartnerAppsPage"));
registerPrefetch("/size-charts", () => import("@/pages/sizeCharts/SizeChartEditorPage"));
registerPrefetch("/size-charts", () => import("@/pages/sizeCharts/SizeChartsPage"));
registerPrefetch("/size-charts/new", () => import("@/pages/sizeCharts/SizeChartEditorPage"));
registerPrefetch("/store-credit", () => import("@/pages/storeCredit/StoreCreditPage"));
registerPrefetch("/website/texts", () => import("@/pages/website/StoreTextsPage"));
