# Sweep — page by page (Phase 10)

Built by the sweep builders and typechecked; a sample was opened in the browser (see progress.md). Status is the builder's own.

| Route | File | Status | Left |
|---|---|---|---|
| /inventory and /inventory/:tab (hub) | pages/inventory/InventoryPage.tsx | done |  |
| /inventory/locations | pages/inventory/LocationsSection.tsx | done |  |
| /inventory/transfers | pages/inventory/TransfersTab.tsx (+ TransferSheet.tsx) | done |  |
| /inventory/purchase-orders | pages/inventory/PurchaseOrdersTab.tsx | done |  |
| /inventory/suppliers | pages/inventory/SuppliersTab.tsx | done |  |
| /inventory/stock-counts | pages/inventory/StockCountsTab.tsx | done | No Quick Look and no row menu: a row goes straight to the counting page. |
| /inventory/forecast | pages/inventory/forecast/StockForecastTab.tsx | done | No Quick Look: every figure is already on the row. The row has no context menu. |
| /inventory/lots | pages/inventory/lots/StockLotsTab.tsx | done | Status chips have no counts (see needsBackend). No Quick Look: the row carries everything. |
| /inventory/locations/:locationId | pages/inventory/LocationPage.tsx | done |  |
| /inventory/purchase-orders/new | pages/inventory/PurchaseOrderPage.tsx (+ PurchaseOrderEditor.tsx) | partial | The editor's fields and the product picker (two selects) are as they were; only the save bar, focus-on-error and the guard were added. In-app links away from a dirty form are not intercepted (the router has no blocker). |
| /inventory/purchase-orders/:poId | pages/inventory/PurchaseOrderPage.tsx | done |  |
| /inventory/stock-counts/:countId | pages/inventory/StockCountPage.tsx | done | «حدّث القايمة دي» replaces re-pressing the same filter to refresh which lines it holds. |
| /marketing | pages/marketing/MarketingPage.tsx | done | Not typechecked or opened in a browser (per the rules). The two GTM reference tables inside the accordion are still the old DataTable. The four accordions are closed by default, so the stale MarketingPage.test.tsx assert |
| /ads | pages/ads/AdsPage.tsx | done | Not typechecked or opened in a browser. The desktop campaigns sheet has 8–9 columns in a subgrid; it should fit at 1366 but needs a look. No sorting was added (there was none before). |
| /ads/accounts | pages/ads/AdAccountsPage.tsx | done | Not typechecked or opened in a browser. Loading still uses the default card skeleton rather than one in the connection card's exact shape. |
| /automations | pages/automations/AutomationsPage.tsx | done | Not typechecked or opened in a browser. In a new automation, switching the trigger to «طلب تقييم» leaves «كام يوم بعد التسليم» inside the folded conditions group (default 3 still applies); it opens by itself only when th |
| /ai | pages/ai/AiStudioPage.tsx | partial | Not typechecked or opened in a browser. The forms and result bodies inside each tool were restyled lightly (wells, pills, 44px colour input) but not re-laid-out; AiStudioP2's own Arabic strings were already dialect and o |
| /reviews | pages/reviews/ReviewsPage.tsx | partial | No reply sheet: the API has no store reply on a review. Quick Look offers call / WhatsApp to the reviewer instead. Undo is a true undo only between shown and hidden; from a waiting review the toast offers the other move  |
| /questions | pages/questions/QuestionsPage.tsx | done |  |
| /products/:productId | pages/questions/ProductQuestionsSection.tsx | done |  |
| /shoppable-images | pages/shoppable/ShoppableImagesPage.tsx | done |  |
| /blog | pages/blog/BlogPostsPage.tsx | done |  |
| /blog/new | pages/blog/BlogPostEditorPage.tsx | done |  |
| /blog/:postId | pages/blog/BlogPostEditorPage.tsx | done |  |
| /blog/categories | pages/blog/BlogCategoriesPage.tsx | done |  |
| /quotes | pages/quotes/QuotesPage.tsx (+ QuoteRow.tsx, QuoteQuickLook.tsx, quote | done |  |
| /quotes/:quoteId | pages/quotes/QuoteDetailPage.tsx (+ QuoteEditor.tsx) | done |  |
| /subscriptions | pages/subscriptions/SubscriptionsPage.tsx (+ SubscriptionsView.tsx, Su | done |  |
| /services | pages/services/ServicesPage.tsx | done |  |
| /courses | pages/courses/CoursesPage.tsx (+ CourseEditor.tsx, CourseOutline.tsx,  | done |  |
| /digital | pages/digital/DigitalProductsPage.tsx (+ DeliveriesView.tsx, FilesView | done |  |
| /profit | pages/profit/RealProfitPage.tsx | done |  |
| /profit/costs | pages/profit/ProfitCostsPage.tsx | done |  |
| /settlements | pages/settlements/SettlementsPage.tsx | done | The settlements list has no search: the API has no text or courier filter. The existing test (SettlementsPage.test.tsx) still compiles but asserts the old on-page table, so its two cases will fail until rewritten. |
| /analytics/reports | pages/analytics/storeReports/StoreReportPage.tsx | done |  |
| /analytics/reports/tax | pages/analytics/storeReports/TaxReport.tsx | done |  |
| /analytics/reports/order-times | pages/analytics/storeReports/OrderTimesReport.tsx | done | The heatmap component itself (OrderHeatmap.tsx) was left as it was; worth a look on a real phone for sideways scroll inside the card. |
| /analytics/reports/sales-by-collection | pages/analytics/storeReports/SalesByCollectionReport.tsx | done |  |
| /analytics/reports/sales-by-option | pages/analytics/storeReports/SalesByOptionReport.tsx | done |  |
| /analytics/reports/returns | pages/analytics/storeReports/ReturnsReport.tsx | done |  |
| /analytics/reports/inventory-value | pages/analytics/storeReports/InventoryValueReport.tsx | done |  |
| /analytics/reports/slow-stock | pages/analytics/storeReports/SlowStockReport.tsx | done |  |
| /analytics/reports/cart-offers | pages/analytics/storeReports/CartOffersReport.tsx | done |  |
| /analytics/survey | pages/survey/SurveyResultsPage.tsx | done | OrderSurveyAnswers.tsx (the order page's card) was left untouched — it was already on the system. |
| /inbox | pages/inbox/InboxPage.tsx (with ConversationList.tsx, Thread.tsx, Inbo | done | No known open work. Not typechecked or opened in a browser (per the rules); the keyboard-following of the phone conversation has never run on a real device. |
| /inbox/bot | pages/inbox/WaBotPage.tsx | done |  |
| /support | pages/support/SupportPage.tsx (with NewTicketSheet.tsx, TicketQuickLoo | done |  |
| /support/:ticketId | pages/support/SupportPage.tsx (SupportTicketPage) | done |  |
| /orders/board | pages/orders/OrderBoardPage.tsx | done |  |
| /orders/shipment-batches/:batchId | pages/orders/ShipmentBatchPage.tsx | done |  |
| /orders/pick-list | pages/orders/packing/PickListPage.tsx | done |  |
| /orders/:orderId/pack | pages/orders/packing/ScanToPackPage.tsx | done |  |
| /orders/delivery-schedule | pages/deliverySlots/DeliverySchedulePage.tsx | done |  |
| /orders/pickups | pages/pickup/PickupsPage.tsx | done | Search only filters the pickups already loaded (the API has no search), and says so when more pages exist. |
| /exports/:exportId | pages/exports/ExportFilePage.tsx | done |  |
| /shipping?tab=delivery and ?tab=pickup (sections hosted by the Shipping page) | pages/deliverySlots/DeliverySlotsSection.tsx + pages/pickup/StorePicku | partial | The fields under the switches are still label-above cards with the shared SaveBar, like the sibling DeliveryTimesSection. They were not rebuilt as SettingsRow groups because ShippingTaxPage hides the pickup section's hea |
| /orders/:orderId (blocks and dialogs these folders supply) | pages/deliverySlots/ChangeDeliverySlotDialog.tsx, OrderDeliveryTime.ts | done |  |
| /catalog/collections | pages/catalog/CollectionsPage.tsx | done |  |
| /catalog/bulk-update | pages/catalog/sheetUpdate/SheetUpdatePage.tsx | done | The three row tables (SheetRowTables.tsx) still use the shared DataTable's own phone cards, not ListRowCard; left as is because they are read-only rows with no action. |
| /catalog/specifications | pages/productSpecs/SpecKeysPage.tsx | done |  |
| /size-charts | pages/sizeCharts/SizeChartsPage.tsx | done |  |
| /size-charts/new | pages/sizeCharts/SizeChartEditorPage.tsx | done |  |
| /size-charts/:chartId | pages/sizeCharts/SizeChartEditorPage.tsx | done | In-app links away from a dirty form are not intercepted (the app has no route blockers); only reload / close asks. |
| /search-synonyms | pages/searchInsights/SearchSynonymsPage.tsx | done |  |
| /media | pages/media/MediaLibraryPage.tsx | done | No multi-select: there is no bulk delete endpoint. |
| /loyalty | pages/loyalty/LoyaltyProgramPage.tsx | done | No members list: the API has no endpoint that lists who holds points, so a link row to Customers stands in for it. |
| /loyalty/referrals | pages/customerReferrals/ReferAFriendPage.tsx | done | Status chips carry a count only for the status on screen; there is no search because the list endpoint takes none. |
| /loyalty/vip | pages/vipTiers/VipTiersPage.tsx | done | No members-per-tier list: the API has no endpoint for it, so a link row to Customers stands in. |
| /store-credit | pages/storeCredit/StoreCreditPage.tsx | done |  |
| /affiliates | pages/affiliates/AffiliatesPage.tsx | done | Commission status chips have no counts (the endpoint returns a filtered list capped at 200). |
| /customers/import | pages/customers/ContactImportPage.tsx | done | Step two shows the server's column match and how to fix it in the sheet; the merchant cannot remap a column because the API takes no mapping. |
| /form-submissions | pages/customers/FormSubmissionsPage.tsx | done |  |
| /offers/bundles | pages/offers/BundlesPage.tsx (+ BundleEditorDialog.tsx, MixAndMatchPar | done |  |
| /offers/order-bumps | pages/offers/OrderBumpsPage.tsx | done | The live preview shows the offer's price only for the offer already saved on the rule; a newly picked offer shows its headline without a price (OfferPicker keeps its list to itself). |
| /offers/upsells | pages/offers/OrderBumpsPage.tsx (UpsellsPage) | done |  |
| /offers/cross-sell | pages/offers/CrossSellPage.tsx | done | BoughtTogetherSettingsCard itself (pages/boughtTogether) is not mine and was not restyled. |
| /offers/exit-popup | pages/offers/ExitDownsellPage.tsx | done |  |
| /offers/order-rules | pages/offers/OrderRulesPage.tsx | done |  |
| /offers/free-gifts | pages/offers/FreeGiftsPage.tsx | done | Validation still reports the first problem in one message under the form (not per field). |
| /offers/cart-offers | pages/offers/CartOffersPage.tsx | done | Validation still reports the first problem in one message under the form (not per field). |
| /offers/spin-wheel | pages/offers/SpinWheelPage.tsx | partial | The settings switch sits inside the 'popup' Section (a card in a card) — worth a look in a screenshot; the two KPI tiles still come before the form on a phone. |
| /offers/social-proof | pages/offers/EngagementPages.tsx (SocialProofPage) | done |  |
| /offers/newsletter | pages/offers/EngagementPages.tsx (NewsletterPage) | done |  |
| /offers/referrals | pages/offers/EngagementPages.tsx (ReferralLinksPage) | done |  |
| /offers/feed | pages/offers/ProductFeedPage.tsx (+ FeedChannelCards.tsx) | done |  |
| /offers/price-lists | pages/priceLists/PriceListsPage.tsx | done | No Quick Look: a row goes straight to the list's page. |
| /offers/price-lists/new | pages/priceLists/PriceListEditorPage.tsx | partial | FixedPricesEditor.tsx (the fixed-price rows and its product picker) was left as it was. |
| /offers/price-lists/:priceListId | pages/priceLists/PriceListEditorPage.tsx | partial | FixedPricesEditor.tsx left as it was. |
| /offers/scheduled-sales | pages/priceSchedules/ScheduledSalesPage.tsx | done | Chips carry no counts (see needsBackend). No Quick Look: a row goes to the sale's page. |
| /offers/scheduled-sales/new | pages/priceSchedules/ScheduledSalePage.tsx (+ ScheduledSaleEditor.tsx) | partial | The editor keeps FilterTabs for target / discount mode and its bottom 'Schedule' submit button for a new sale; SalePreview.tsx untouched. |
| /offers/scheduled-sales/:scheduleId | pages/priceSchedules/ScheduledSalePage.tsx | partial | SaleDetails still uses DataTable + Section as before (already close to the system). |
| /login | pages/LoginPage.tsx | done |  |
| /register | pages/RegisterPage.tsx | done |  |
| /forgot-password | pages/ForgotPasswordPage.tsx | done |  |
| /reset-password | pages/ResetPasswordPage.tsx | done |  |
| /verify-email | pages/VerifyEmailPage.tsx | done |  |
| /choose-plan | pages/ChoosePlanPage.tsx | done | No plan is marked «recommended»: the API has no such flag (see needsBackend). |
| /choose-username | pages/ChooseUsernamePage.tsx | done |  |
| /auth/callback | pages/AuthCallbackPage.tsx | done |  |
| /account/email-change | pages/EmailChangeConfirmPage.tsx | done |  |
| * (404) | pages/NotFoundPage.tsx | done | It stays inside the dashboard shell rather than on the sign-in card: the route is only reachable signed in, under DashboardLayout. |
| /workspaces | pages/WorkspacePickerPage.tsx | done |  |
| /stores | pages/stores/StoresPage.tsx | done |  |
| /activity | pages/activity/ActivityLogPage.tsx | done | No search box: the audit-log API takes no text query. The Arabic action names are noun phrases from the existing dictionary («الأوردر · تغيير الحالة»), not conjugated sentences. |
| /referrals | pages/referrals/ReferralProgramPage.tsx | done |  |
| /website/texts | pages/website/StoreTextsPage.tsx | done | The header's back link is not intercepted when there are unsaved texts — the app has no route blockers; only reload / close asks. |
| /install-app | pages/apps/InstallAppPage.tsx | partial | It keeps its own title inside the consent card instead of the shared PageHeader — a header above would say the same thing twice. Say if you want it moved onto PageHeader with a back link to Apps. |

Totals: {"done":97,"partial":10}