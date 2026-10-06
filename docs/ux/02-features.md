# ZIMOS UX redesign, part 2: feature inventory

Written 2026-10-06 from the code. Frontend: `zimos-front` branch `ux-redesign` at `1fc9906`. Backend: `zimos-backen` branch `claude/gracious-cori-p3g4hr` at `4975669`, which is spec-gaps item 159. Every lane progress file (`docs/progress/lane-1…8.md`, `spec-gaps.md`, `redesign.md`, `review-fixes.md`) is ticked as done. This file therefore judges status from the code. It counts sandbox-only adapters, endpoints that have no screen, routes that are missing from the sidebar, and explicit "not built" decisions.

## How to read the tables

- **Route · file · module.** A route is a dashboard URL from `apps/merchant-dashboard/src/App.tsx`.
  - Dashboard files are relative to `apps/merchant-dashboard/src/pages/`.
  - `components/…` and `lib/…` are relative to `apps/merchant-dashboard/src/`.
  - `sf:` is `apps/storefront/src/` and `adm:` is `apps/platform-admin/src/pages/`.
  - The backend module comes after the `·` and lives under `src/modules/<module>`.
- **Status:**
  - **complete**: the merchant can finish the job end to end against a real provider, or no provider is needed.
  - **partial**: the screen works, but it runs only on a sandbox or test adapter, sits behind a flag that is off, or misses a piece the code or the docs say is missing.
  - **stub**: a placeholder, a dev-only tool, or a sandbox with no real path at all.
- **Nav:**
  - **yes**: the page has a sidebar entry in `lib/navigation.ts`.
  - **yes (in X)**: the feature is a tab or section of the sidebar page X.
  - **route-only**: the route exists in `App.tsx` but is reached only by a link, a button, ⌘K, a notification or a typed URL.
  - **no UI**: no screen at all.
  - **storefront**: the shopper sees it, not the merchant.
- **Ev.:**
  - **V**: verified in the code (the route, file, endpoint or adapter was read or grepped).
  - **I**: inferred from the progress docs or from names, without tracing it in the code.

### Navigation size (what the merchant sees)

- **Committed (`HEAD 1fc9906`):** 39 items in 9 groups. Seven groups have headings: Orders 5, Products 6, Customers 2, Marketing 6, Online store 4, Analytics 6, and Money & shipping 3. Two groups have no heading: Home 1, and a config block of 6 (Apps, Settings, Activity log, Services, Refer & earn, Contact support).
- **Working tree right now:** `lib/navigation.ts` has an uncommitted edit, made outside this research. It regroups the same 39 items into 10 groups:
  - Home 1
  - Orders 5
  - Products 5
  - Customers 2
  - Money 4
  - Online store 4
  - Marketing 4
  - Analytics 4
  - a new **More** group of 5 (Digital, Courses, Subscriptions, Shoppable images, Services)
  - config 5

  More starts collapsed through the existing `NAV_OPEN_BY_DEFAULT` rule (see the next point).
- **First-load sidebar (committed `components/DashboardLayout.tsx`, read in the code, not opened in a browser, V):**
  - `NAV_OPEN_BY_DEFAULT = {main, orders, products, customers, money}`. Every other group starts collapsed until the member toggles it, and the state is kept in localStorage.
  - A new member therefore sees 17 items (Home, Orders 5, Products 6, Customers 2, Money & shipping 3) plus 3 collapsed headings (Marketing, Online store, Analytics).
  - **Likely bug:** the unheaded `config` group is not in the open set, so it also starts collapsed. It has no heading to click, so Apps, Settings, Activity log, Services, Refer & earn and Contact support stay hidden unless one of them is the current page. Settings can still be reached from the account menu, and the other five through ⌘K.
- Sidebar labels quoted in the tables are the committed ones. The working-tree edit renames some of them ("Confirm orders", "Shipping", "Reports").
- **Analytics items hidden by role:** Reports, Live now, Store traffic, Sales sources, Profit and Ad spend are hidden for `editor`, `order_operator` and `confirmation_agent` (`lib/analyticsAccess.ts`). Every other item shows to every role. Those pages answer 403 themselves.
- **Around the sidebar:** a top bar (⌘K search, store link, notifications bell, account menu), a store switcher, and up to 8 pinned shortcuts.
- **Route coverage:** 71 routes inside the dashboard layout or the editor layout, plus 10 auth or onboarding routes and the catch-all. Thirty-two of the 71 layout routes are not in the sidebar (see the route section near the end).

---

## Account, onboarding and dashboard frame

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Sign up / sign in | Email+password or Google; 2-step code when enabled | `/register`, `/login`, `/auth/callback` · `RegisterPage.tsx`, `LoginPage.tsx`, `components/TwoFactorStep.tsx` · auth | complete | route-only | V |
| Password reset by email | Reset link to the sign-in email | `/forgot-password`, `/reset-password` · auth | complete (SMS reset is backend-only) | route-only | V |
| Email verification / email change confirm | Confirms the address or a changed sign-in email | `/verify-email`, `/account/email-change` · auth/emailChange | complete | route-only | V |
| Username + plan for Google sign-ups | Fills what Google sign-up skipped | `/choose-username`, `/choose-plan` · auth, billing | complete | route-only | V |
| Workspace picker / first store link | Pick or create a store; shows its public address | `/workspaces` · `WorkspacePickerPage.tsx` · workspaces | complete | route-only | V |
| Go-live dialog | Subscribes a draft store from anywhere | `components/GoLiveDialog.tsx`, `lib/goLive.ts` · billing | complete | route-only (global dialog) | V |
| Store switcher + All my stores | Switch stores; today's numbers per store; duplicate a store | `/stores` · `stores/StoresPage.tsx` · stores | complete | route-only (switcher, ⌘K) | V |
| Global search ⌘K | Find orders/customers/products/pages; quick commands | `components/CommandPalette.tsx` · dashboard/searchService | complete | yes (top bar) | V |
| Notifications bell | New order (sound), suspicious, export ready, integration failed… | `components/NotificationsBell.tsx` · notifications | complete | yes (top bar) | V |
| Sidebar shortcuts | Pin up to 8 pages per member | `components/SidebarShortcuts.tsx` · dashboard | complete | yes | V |
| Keyboard shortcuts / full-screen | Hotkeys and a help sheet | `components/KeyboardShortcuts.tsx` | complete | yes (account menu) | V |
| Dashboard as an app (PWA) | Install prompt, offline page | `components/InstallAppPrompt.tsx` | complete | yes (prompt) | V |
| Access banner | Draft / trial / suspended state across pages | `components/AccessBanner.tsx` · billing | complete | yes (banner) | I |
| Language AR/EN + light/dark theme | Interface language and theme | `components/LanguageSwitch.tsx`, `ThemeToggle.tsx` | complete | yes | V |
| Education links | A tutorial link per page, help centre, Telegram | `components/Education.tsx` · platformAdmin/educationLinks | complete | yes (headers, home) | I |
| Design-system lab | Glass material proposal | `/design-system` (dev only, `main.tsx`) · `design-system/DesignSystemApp.tsx` | stub (dev tool) | no UI (prod) | V |

## Home

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Quick actions | Awaiting-confirmation count, new order, shortcuts | `/` · `DashboardHomePage.tsx`, `home/QuickActions.tsx` | complete | yes | V |
| Setup guide | % done on real data (products, shipping, payment, domain, pixel) | `home/SetupGuideCard.tsx` · dashboard/setupGuideService | complete | yes (in Home) | V |
| KPI overview | Sales, orders, confirmation/delivery rate, net profit vs previous period, funnel, top sources/governorates/products, currency | `home/StoreOverview.tsx` · analytics (overview) | complete (no product/store filter: item 172) | yes (in Home) | V |
| Site analytics widget | Visits summary | `home/SiteAnalytics.tsx` · analytics | complete | yes (in Home) | V |
| Recent orders | Last 6 orders | `DashboardHomePage.tsx` · orders | complete | yes (in Home) | V |
| Fallback roll-up | Order counts for roles without analytics | `DashboardHomePage.tsx` (LegacyStatCard) | complete | yes (in Home) | V |
| Help cards | Help centre / Telegram / support | `components/Education.tsx` | complete | yes (in Home) | V |

## Orders

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Orders list | Stage tabs, search (incl. waybill), filters (tag, source, payment, governorate, courier, seen, risk, UTM, funnel, dates), sort | `/orders` · `orders/OrdersListPage.tsx`, `components/OrderListFilters.tsx` · orders | complete | yes | V |
| Saved views / columns / page size | Reusable filtered lists, reorderable columns | `components/useSavedOrderViews.ts`, `OrderColumnCell.tsx` · workspaces/savedViews | complete | yes (in Orders) | V |
| Bulk actions | Status, tags, archive, seen, ship, notify customer, select all matching | `components/OrderBulkBar.tsx`, `SelectAllMatching.tsx` · orders (`/orders/bulk`) | complete | yes (in Orders) | V |
| Bulk documents | Waybills A4×4 / 10×15, invoices PDF, today's manifest | `components/OrderDocuments.tsx`, `SelectionExtras.tsx` · orders/orderDocuments, waybill | complete (printed layouts never checked by eye) | yes (in Orders) | V |
| Tracking import | "Sync from file": CSV of waybills → shipments/stages | `components/OrderDocuments.tsx` · orders/trackingImport | complete | yes (in Orders) | V |
| Export | CSV / xlsx, courier layout presets, background file | `components/ExportOrders.tsx`; `/exports/:exportId` · `exports/ExportFilePage.tsx` · orders/orderExport*, exportFiles | complete | yes (in Orders); file page route-only (bell link) | V |
| Pipeline board | Kanban by stage, drag to move | `/orders/board` · `orders/OrderBoardPage.tsx` · orders | complete | route-only (Orders header) | V |
| Manual order | Staff checkout with server-side price preview | `/orders/new` · `orders/ManualOrderPage.tsx` · orders | complete | route-only (button, home, ⌘K) | V |
| Order page | ~23 cards: status changer, timeline, notes, tags, archive/test/seen, prev/next, customer tools, session & attribution, risk & origin | `/orders/:orderId` · `orders/OrderDetailPage.tsx` · orders, audit | complete | route-only | V |
| Edit items / refund by lines / fulfil | Re-price lines before shipping; refund quote; mark shipped | `components/EditItemsDialog.tsx`, `FulfillAndRefundLines.tsx` · orders | complete | route-only | V |
| Cancel / reopen | Reasons, refund + notify, un-cancel | `components/OrderActions.tsx` · orders | complete | route-only | V |
| Shipments card | Book courier, waybill, save draft, manual cancel, sync | `components/ShipmentsSection.tsx` · shipping | complete | route-only | V |
| Payments card | Record payment, two-step refunds, payment link, transfers confirm/reject, saved card charge | `components/PaymentsSection.tsx`, `ManualTransfersCard.tsx`, `SavedMethodsCard.tsx` · payments | complete (its saved-card charge is rated under Payments → Saved cards) | route-only | V |
| Invoice PDF | Per-order invoice | `components/OrderHeaderTools.tsx` · orders (`invoice.pdf`) | complete | route-only | V |
| Resend to webhook | Re-send an order (one or bulk) | `OrderDetailPage.tsx` · webhooks | complete | route-only | V |
| Send to supplier | Forward an order to a dropship supplier, follow its status | `components/OrderSupplierCard.tsx` · dropship | partial (sandbox supplier only) | route-only | V |
| Shipment batch | "Ship selected" progress, per-order result, retry failed | `/orders/shipment-batches/:batchId` · `orders/ShipmentBatchPage.tsx` · shipping/bulkShipRoutes | complete (no batch history list) | route-only | V |
| WhatsApp confirm button | Send the confirm template with buttons | `components/WhatsappConfirmButton.tsx` · orders, whatsapp | complete | route-only | V |
| Shopper uploads | Signed links to shopper photos on custom fields | `components/CustomizationList.tsx` · customerUploads | complete | route-only | I |

## Confirmation

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Confirmation queue | Claim & call, outcome (confirmed / rejected / unreachable / postponed), release, reclaim | `/confirmation-queue` · `confirmation/ConfirmationQueuePage.tsx` · cod | complete | yes | V |
| Assignment & counts | Assign tasks to agents, per-tab counts | same · cod (assignees, unassign, counts) | complete | yes (in queue) | V |
| Corrections | Fix address/phone during the call | same · cod (correction) | complete | yes (in queue) | I |
| Channels | Call or WhatsApp template per task | `confirmation/confirmationChannel.tsx` · cod, whatsapp | complete | yes (in queue) | V |
| Order-page confirmation panel | Confirm from the order itself | `orders/components/ConfirmationPanel.tsx` · cod | complete | route-only | V |
| WhatsApp quick-reply confirm | Customer taps Confirm/Cancel → order updated, task closed | none · whatsapp/quickReplyConfirmation | complete (no screen by design) | no UI | V |

## Shipping (and tax)

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Shipping prices | Governorate/region rates, weight tiers, free-shipping threshold | `/shipping` (tab rates) · `shipping/ShippingTaxPage.tsx`, `ShippingSettingsSection.tsx`, `WeightTiersSection.tsx` · shipping, geo | complete (city/area prices: items 163–164 not built) | yes | V |
| Shipping profiles | Shipping groups per product | `shipping/ShippingProfilesSection.tsx` · shipping/shippingProfiles | complete | yes (in Shipping) | V |
| Shipping options | Choices the shopper picks between | `shipping/ShippingOptionsSection.tsx` · shipping/shippingOptions | complete | yes (in Shipping) | V |
| Courier connections | Bosta, Mylerz, J&T (prod/sandbox) + sandbox courier | `shipping/CarrierConnectionsSection.tsx` · shipping/carriers | complete | yes (in Shipping) | V |
| Courier area mapping | Map store places to each courier's cities/zones | `shipping/CarrierAreas.tsx`, `CourierPlacePicker.tsx`, `BostaTierMapField.tsx` · shipping | complete | yes (in Shipping) | V |
| Booking settings | Auto-book on a stage, inspection, courier notes | `shipping/CarrierBookingSettings.tsx` · shipping | complete | yes (in Shipping) | V |
| Taxes | Tax rates | `/shipping` (tab taxes) · tax | complete | yes (in Shipping) | V |
| Courier status sync | Webhooks + polling, manual cancel prompt | `shipping/ManualCancelDialog.tsx` · shipping/carrierWebhookRoutes | complete | yes / route-only | V |

## Returns

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Returns list | Moderate requested → approved/rejected → received → refunded | `/returns` · `returns/ReturnsPage.tsx` · returns | complete | yes | V |
| Return from order page | Staff opens a return on an order | `orders/components/ReturnsSection.tsx` · returns, orders | complete | route-only | V |

Shoppers cannot ask for a return: the tracking-page request is item 186 and is not built (V). Only staff can create a return.

## Products / catalog

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Products list | Server search/filters (collection, SKU, type, stock), archived tab, list bulk edit, duplicate, preview | `/catalog` · `catalog/CatalogProductsPage.tsx`, `components/ProductListBulk.tsx`, `ProductBulkEditDialog.tsx` · catalog | complete | yes | V |
| Product editor | Details, rich description, images, video, variants + bulk editor, option display/swatches, track quantity | `/catalog/new`, `/catalog/:productId` · `catalog/ProductEditPage.tsx` + `components/*` · catalog | complete | route-only | V |
| Custom fields | Paid personalisation fields, shopper photos | `catalog/components/CustomFieldsSection.tsx` · catalog, customerUploads | complete | route-only | V |
| Product offers | Price offers on a product (used by bumps/upsells) | `catalog/components/OffersSection.tsx` · catalog | complete | route-only | V |
| Page settings + content | Inline form, sticky button, hidden, real countdown, landing page; features/testimonials/FAQs | `components/ProductPageSettingsSection.tsx`, `ProductCmsSection.tsx` · catalog/productPage | complete | route-only | V |
| Product SEO | Title, description, share image | `components/ProductSeoSection.tsx` · catalog | complete | route-only | V |
| Product A/B test | Split-test the product page | `components/ProductTestSection.tsx` · catalog/productTests | complete | route-only | V |
| AI on product | Generate description / product from photos | `components/AiDescriptionButton.tsx` · ai | partial (sandbox AI) | route-only | V |
| Import / export | CSV, xlsx, JSON, Shopify link; per-row error report | `components/ProductTransferDialog.tsx` · catalog/importExport | complete (no import history; other link sources not built: item 180) | yes (in Products) | V |
| Collections | Tree (drag), SEO, show in header / hidden | `/catalog/collections` · `catalog/CollectionsPage.tsx` · catalog | complete (smart collections not built: item 162) | route-only (Products link) | V |
| Reviews | Moderate, add by hand | `/reviews` · `reviews/ReviewsPage.tsx`, `AddReviewDialog.tsx` · reviews | complete | yes | V |
| Reviews import | Import reviews from another platform | `reviews/ImportReviewsDialog.tsx` · reviews/import | partial (sandbox importer returns sample reviews) | yes (in Reviews) | V |
| Catalog display settings | Store-wide product listing / pre-select variant | `settings/CatalogSettingsSection.tsx` · workspaces | complete | yes (in Settings) | V |
| Product feed | Fixed XML/CSV link per ad channel + Google Merchant checklist | `/offers/feed` · `offers/ProductFeedPage.tsx` · offers/productFeed | complete | route-only (Offers hub, Apps) | V |

## Offers / discounts

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Offers hub | Cards to every offer tool, with impressions / acceptances / revenue | `/offers` · `offers/OffersPage.tsx`, `OfferNumbers.tsx` · offers | complete | yes | V |
| Quantity bundles | Tier pricing, assigned products | `/offers/bundles` · `offers/BundlesPage.tsx`, `BundleEditorDialog.tsx` · bundles | complete | route-only | V |
| Order bumps per product | Up to 3 add-ons on a product's form | `/offers/order-bumps` · `offers/OrderBumpsPage.tsx` · offers/offerRules | complete | route-only | V |
| Store-wide bump | One bump on every checkout | `settings/OrderBumpSettingsSection.tsx` · checkout/orderBump | complete (lives in Settings, apart from Offers) | yes (in Settings) | V |
| Post-purchase upsells | One-tap add on the thank-you page | `/offers/upsells` · `offers/OrderBumpsPage.tsx` (UpsellsPage) · offers | complete | route-only | V |
| Cross-sell | Rules, else bought-together from real orders | `/offers/cross-sell` · `offers/CrossSellPage.tsx` · offers | complete (no discount on suggestions, by decision) | route-only | V |
| Exit popup | Real coupon on exit intent | `/offers/exit-popup` · `offers/ExitDownsellPage.tsx` · offers | complete | route-only | V |
| Minimum order / free-shipping bar | Minimum basket; progress to free shipping | `/offers/order-rules` · `offers/OrderRulesPage.tsx` · offers, discounts | complete | route-only | V |
| Social proof | "X from Y bought Z" from real confirmed orders | `/offers/social-proof` · `offers/EngagementPages.tsx` · offers/engagement | complete | route-only | V |
| Newsletter | Sign-up form with coupon → contact | `/offers/newsletter` · `offers/EngagementPages.tsx` · offers/engagement, contacts | complete | route-only | V |
| Referral links | `?ref=` links and their orders | `/offers/referrals` · `offers/EngagementPages.tsx` · offers (orders.attribution) | complete | route-only | V |
| Discounts | Codes, automatic discounts, bulk single-use codes, share link `?coupon=` | `/discounts` · `discounts/DiscountsPage.tsx`, `BulkCodesDialog.tsx`, `CouponLinkDialog.tsx` · discounts | complete | yes | V |

## Customers / contacts

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Contacts list | Leads + customers, tags, spend, last order, governorate, filters, CSV export, masked phones | `/customers` · `customers/ContactsPage.tsx`, `ContactsAllTab.tsx` · contacts, customers | complete | yes | V |
| Bulk tagging | Tag many contacts at once | `customers/ContactBulkTags.tsx` · contacts | complete | yes (in Customers) | V |
| Segments | Saved dynamic segments with live count | `/customers?tab=segments` · `customers/SegmentsTab.tsx` · contacts/segmentRules | complete | yes (tab) | V |
| Customer page | Orders, tags, forms, delivery rate, subscriptions, blacklist | `/customers/:customerId` · `customers/CustomerDetailPage.tsx`, `ContactInsights.tsx` · customers | partial (order history found by scanning ≤20 pages of store orders in the browser) | route-only | V |
| Network delivery score | Cross-store delivery rate, report spam | `customers/DeliveryRateBar.tsx`, `fraud/NetworkRate.tsx` · risk/networkStats | partial (FeatureFlag `customer_network_score` seeded off) | route-only / yes (in Orders) | V |
| Form submissions | Inbox of page-form entries | `/form-submissions` · `customers/FormSubmissionsPage.tsx` · contacts | complete | route-only (Customers link, ⌘K) | V |

## Abandoned / lost orders

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Lost orders list | Stats (recovered money), reason/review tabs, product/source/date filters | `/abandoned-carts` · `abandoned/LostOrdersPage.tsx` · checkoutSessions/lostOrderService | complete | yes ("Lost orders") | V |
| Recovery actions | WhatsApp recovery template, call, convert to order, review, delete | same · checkoutSessions | complete | yes (in Lost orders) | V |
| Bulk delete + export | CSV export, delete many | `abandoned/LostOrdersBulk.tsx` · checkoutSessions | complete | yes (in Lost orders) | V |
| Lost-after timing | When a checkout counts as lost | `abandoned/LostOrderTiming.tsx` · fraud (abandoned_after_minutes) | complete | yes (in Lost orders) | V |

## Fraud

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Protection rules | Per-rule action: item/IP/phone limits, strict phone, max items, high risk, delivery rate | `/fraud?tab=rules` · `fraud/ProtectionRulesTab.tsx` · fraud, risk | complete | yes | V |
| Suspicious orders | Flagged queue with reasons; Block & cancel | `fraud/FlaggedOrdersTab.tsx` · fraud | complete | yes (tab) | V |
| Blocklist | Phone/IP/email/device/name+address, scopes, CSV import | `fraud/BlockedEntriesTab.tsx` · fraud/blockedEntries | complete | yes (tab) | V |
| Statistics | Prevented by reason, money saved | `fraud/ProtectionStatsTab.tsx` · fraud | complete | yes (tab) | V |
| Risk score | Score, level, reasons on orders; risk tabs | `fraud/RiskBadge.tsx`, `OrderProtectionSection.tsx` · risk/riskService | complete | yes (in Orders) | V |
| Checkout OTP | WhatsApp/SMS code before COD order | Rules → Phone verification · risk/checkoutOtp, otp | complete | yes (tab) | V |
| Bot protection | Honeypot + signed time token | Rules → Visitors · risk/botProtection | complete | yes (tab) | V |
| Invisible challenge (Turnstile) | CAPTCHA on checkout | Rules toggle · risk/captcha | partial (sandbox verifier only) | yes (tab) | V |
| Country / VPN rules, visitor gate | Block countries, VPNs, IPs | Rules · risk/ipIntel, risk/visitorGate | partial (ipIntel sandbox only, so the rules stay silent in production) | yes (tab) | V |
| AI spam shield | AI check of moderate-risk orders | none · risk/aiOrderCheck | stub (FeatureFlag off + sandbox AI) | no UI | V |

## Website / store design

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Websites + theme gallery | Pick a template/theme (47, tags), reset theme, preview with own products | `/website` · `website/WebsitePage.tsx`, `ThemeGallery.tsx`, `ThemeExtras.tsx` · pages, templates, themes | complete | yes | V |
| Website editor | Canvas drag/resize, block library, header/footer/announcement, layers, undo/redo, X-ray, duplicate, inline text | `/website/:websiteId/edit` · `website/editor/WebsiteEditorPage.tsx` · pages | complete | route-only (full-screen) | V |
| Element style & layout | Per-device overrides, full Style tab, entrance animations | `editor/ElementStylePanel.tsx`, `StyleExtrasFields.tsx`, `AnimationFields.tsx` · pages/elementStyle | complete | route-only | V |
| Fonts | Google Fonts + uploaded woff2, per element | `editor/FontSelect.tsx`, `StoreFontsSection.tsx` · fonts | complete | route-only | V |
| Named styles | Reusable element looks | editor · pages | partial (page-level only; site-wide list has no screen) | route-only | I |
| Saved sections | Linked reusable sections | `editor/SavedSections.tsx` · savedSections | complete | route-only | V |
| Data binding & repeater | Bind text/images to product/store/policy data | `editor/DataBinding.tsx` · pages | complete | route-only | V |
| Page settings | SEO, Scripts, Details (address, title); new page | `editor/PageSettingsDialog.tsx`, `NewPageDialog.tsx` · pages | complete | route-only | V |
| Custom HTML block | Positioned HTML stored outside the tree | `editor/HtmlBlockCodeField.tsx` · customCode/htmlBlocks | complete | route-only | V |
| Store look | Colours, fonts, store shell | `editor/StoreLookPanel.tsx` · pages, themes | complete | route-only | V |
| Checkout form builder | Fields, order, required, custom choices, layout | `/store-settings/checkout-form` · `storeDesign/CheckoutFormTab.tsx` · workspaces (checkout_settings) | complete (file field / billing address not built: item 165) | yes | V |
| Thank-you page | Message, content with variables | `storeDesign/ThankYouTab.tsx` | complete | yes (tab) | V |
| Store info & trust cards | Contact info, trust cards on product page | `storeDesign/StoreInfoTab.tsx` | complete | yes (tab) | V |
| Policies | Templates, variables, AI-apply | `storeDesign/PoliciesTab.tsx`, `ai/ApplyPoliciesButton.tsx` | complete | yes (tab) | V |
| Pages flags | Show in header/footer, active | `storeDesign/PagesTab.tsx` · pages | complete | yes (tab) | V |
| General | Favicon, social links, floating WhatsApp, country, store app (PWA) | `storeDesign/GeneralTab.tsx`, `StoreAppSection.tsx` · storefront/storeApp | complete | yes (tab) | V |
| Store SEO | Title template, verification, sitemap/robots | `storeDesign/SeoTab.tsx` · storefront | complete | yes (tab) | V |
| Custom code | 11 code slots (head, body, CSS, JS…) | `storeDesign/CustomCodeTab.tsx` · customCode | complete (page-type targeting not built: item 161) | yes (tab) | V |
| Domains | Connect, DNS check, certificate, primary, home funnel, root/www | `storeDesign/DomainsTab.tsx` · domains | partial (certificate provider is sandbox; buying a domain not built: item 176) | yes (tab) | V |
| Languages & translations | Store languages, translate content, Translate with AI | `storeDesign/LanguagesTab.tsx`, `ContentTranslationRows.tsx`, `AiTranslateButton.tsx` · translations | complete (AI fill on sandbox; editable storefront UI texts not built: item 160) | yes (tab) | V |
| Store live preview | Side preview while editing settings | `storeDesign/StoreLivePreview.tsx` | complete | yes (in Store settings) | V |
| Store profile | Name, logo, tagline, colours | `settings/SettingsPage.tsx` (WorkspaceProfileSection) · workspaces | complete | yes (in Settings) | V |

## Funnels

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Funnels list | Create via wizard / template gallery / AI, import by share code, duplicate, analytics link | `/funnels` · `funnels/FunnelsPage.tsx`, `FunnelWizard.tsx`, `FunnelTemplateGallery.tsx`, `AiFunnelOption.tsx` · funnels, funnels/funnelExtras | complete (bulk actions not built: item 166) | yes | V |
| Funnel map editor | Steps, links per button, pan/zoom, issues counter, server draft, revisions & rollback, publish/pause/resume | `/funnels/:funnelId` · `funnels/FunnelEditorPage.tsx`, `FlowLinkPoints.tsx`, `FunnelIssues.tsx`, `FunnelDraft.tsx` · funnels | complete | route-only (full-screen) | V |
| Step page editor | Website-editor tools inside a step | `funnels/FunnelStepPageEditor.tsx` · funnels, pages | complete | route-only | V |
| Split tests | Up to 5 versions, shares, pick winner | `funnels/SplitTestVersions.tsx`, `FunnelGrowthPanel.tsx` · funnels/splitTests | complete | route-only | V |
| Geo redirects | Send visitors by country to another funnel | `funnels/FunnelGrowthPanel.tsx` · funnels, risk/visitorGate | partial (visitor country from sandbox ipIntel) | route-only | V |
| Funnel settings | Currency, favicon, title, link, scripts, shipping group, payment methods | `funnels/FunnelSettingsMore.tsx` · funnels | complete | route-only | V |
| Generic pages | Contact/about/policies outside the map | `funnels/GenericPagesPanel.tsx` · funnels | complete | route-only | V |
| Funnel analytics | EPC, per-page CTR/CR/opt-ins | `/analytics/funnels/:funnelId` · `analytics/FunnelAnalyticsPage.tsx` · analytics | complete | route-only (Funnels list) | V |

## Marketing / pixels

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Tracking pixels | Many pixels per platform (Meta, TikTok, Snap, GA4, Google Ads, GTM, Clarity, Pinterest), scope store/funnel/product, CAPI token + test code | `/marketing` · `marketing/TrackingPixelsSection.tsx` · marketing (tracking-pixels) | complete (Pinterest CAPI, Ads conversion label, GTM container: items 168–170 not built) | yes (sidebar "Marketing", page title "Tracking tools") | V |
| Server-side events | CAPI for Meta/TikTok/Snap/GA4 with shared event_id | none · marketing/pixelProviders | complete | no UI (behaviour) | V |
| Purchase timing | Send Purchase on order / confirmed / delivered | `marketing/PurchaseTimingSection.tsx` | complete | yes (in Marketing) | V |
| Pixel event log + test event | See what was sent; send a test page view | `marketing/PixelEventLogSection.tsx` | complete | yes (in Marketing) | V |
| UTM link builder | Build tracked store links | `marketing/MarketingPage.tsx` | complete | yes (in Marketing) | V |
| Order attribution | First/last touch, visits, time to purchase on the order | `marketing/OrderAttributionSection.tsx`, `orders/components/OrderSessionDetails.tsx` · marketing/orderAttribution | complete | route-only (order page) | V |

## Inbox / WhatsApp / automations

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| WhatsApp connection | Cloud API number (sandbox number for tests) | `settings/WhatsappSection.tsx` · whatsapp | complete | yes (in Settings) | V |
| WhatsApp templates | Sync from Meta with status; pickers | `components/WhatsappTemplates.tsx` · whatsapp/whatsappTemplates | complete | yes (in Settings / Automations) | V |
| Confirmation message | WhatsApp confirmation text | `settings/WhatsAppMessageSection.tsx` | complete | yes (in Settings) | V |
| Inbox | Conversations, filters & counts, assignment, customer panel (orders, confirm/cancel/create order), quick replies, live SSE | `/inbox` · `inbox/InboxPage.tsx`, `InboxExtras.tsx`, `useInboxLive.ts` · whatsapp (inbox) | complete | yes ("WhatsApp inbox") | V |
| Suggested reply | AI draft reply in the composer | `inbox/SuggestReply.tsx` · ai | partial (sandbox AI) | yes (in Inbox) | V |
| Customer service bot | Bot settings, try-it box, guided ordering in chat | `/inbox/bot` · `inbox/WaBotPage.tsx` · whatsapp/bot | partial (sandbox AI provider) | route-only (Inbox link) | V |
| Automations | Ordered steps (wait, WhatsApp, SMS, email, webhook, tag, status, notify team), 19 triggers (order, checkout, lead, subscription, review), conditions (segments, product/funnel pickers) | `/automations` · `automations/AutomationsPage.tsx`, `RuleEditorDialog.tsx` · automations | complete | yes | V |
| Ready-made templates | 11 Arabic recipes (confirmation, shipped, review, cart recovery, payment failed…), one-click enable | `automations/AutomationsPage.tsx` · automations (templates) | complete (WhatsApp steps need Meta-approved templates) | yes (in Automations) | V |
| Run log | Every step of every run | `automations/AutomationsPage.tsx` · automations | complete | yes (in Automations) | V |
| Order emails | 6 templates, preview, test send, From/Reply-To | `settings/OrderEmailsSection.tsx`, `OrderEmailSender.tsx` · notifications (order-emails) | complete (sending domain, block designer, per-funnel sets: items 173–175 not built) | yes (in Settings) | V |
| Notification preferences | Per type: in-app, email, WhatsApp, push | `settings/NotificationPreferencesSection.tsx` · notifications | complete | yes (in Settings) | V |
| Device push | Push to this phone/computer | `settings/PushDeviceToggle.tsx` · notifications/push | partial (sandbox push provider only) | yes (in Settings) | V |

## Analytics

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Reports | Overview / Products / Delivery / Customers tabs, presets, comparison, insights, CSV, currency | `/analytics` · `analytics/reports/ReportsPage.tsx` · analytics/reportsService | complete | yes ("Overview & reports") | V |
| Legacy summary | Older analytics page (superseded) | `/analytics/summary` · `analytics/AnalyticsPage.tsx` · analytics | complete (duplicate of Reports) | route-only (Home link) | V |
| Store traffic | Visits, pages, devices, sources | `/analytics/web` · `analytics/WebAnalyticsPage.tsx` · analytics (web) | complete | yes | V |
| Live now | Realtime + SSE live view, funnel filter, full screen | `/analytics/realtime` · `analytics/RealtimePage.tsx`, `LiveView.tsx` · analytics/realtimeStream | complete (world map not built: item 171) | yes | V |
| Sales sources | Sales by UTM with delivered column, spend/ROAS | `/analytics/attribution` · `analytics/AttributionPage.tsx` · analytics | complete | yes | V |

## Profit

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Real profit (P&L) | Delivered revenue → net profit; actual/projected; by day/product/campaign; max CPA | `/profit` · `profit/RealProfitPage.tsx` · profit | complete | yes | V |
| Costs | Default and per-product economics (cost, fees, packaging…) | `/profit/costs` · `profit/ProfitCostsPage.tsx` · profit | complete | route-only (Profit link) | V |
| Ad spend | Campaign report, manual entries, CSV import | `/ads` · `ads/AdsPage.tsx` · profit (ad-spend, campaigns) | complete | yes ("Ad spend") | V |
| Ad spend auto-sync | Pull spend from ad platforms | none · profit/adapters (sandbox), job `ads.sync_spend` | stub (sandbox adapter; no OAuth; no "sync now" button) | no UI | V |

## Settlements

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| COD settlements | KPIs, settlements list, drafts, received | `/settlements` · `settlements/SettlementsPage.tsx` · settlements | complete | yes ("COD settlements") | V |
| Courier statement import | CSV/Excel statement → match waybills, discrepancies | `settlements/StatementTools.tsx` · settlements/settlementStatement* | complete | yes (in Settlements) | V |
| Held by couriers | Money still with couriers, by age | `settlements/SettlementsPage.tsx` · settlements (held) | complete | yes (in Settlements) | V |

## Payments

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Gateways | Paymob (cards, wallets, valU, Kiosk), Kashier, sandbox | `/payments` · `payments/PaymentsPage.tsx` · payments/gateways | complete | yes | V |
| Payment rules | Fee/discount per method, methods per funnel | `payments/PaymentRulesSettings.tsx` · payments/paymentRules | complete | yes (in Payments) | V |
| Manual transfers & deposits | InstaPay/wallet details, receipt upload, COD deposit | `payments/ManualTransferSettings.tsx` · payments/manualTransfer | complete (no "pending transfers" queue screen) | yes (in Payments) | V |
| Display currencies | Show prices in other currencies | `payments/CurrencySettings.tsx` · currencies | partial (sandbox FX rates, labelled as test) | yes (in Payments) | V |
| Saved cards | Save card, charge later, one-click upsell | `orders/components/SavedMethodsCard.tsx` · payments/savedMethods | partial (only the sandbox gateway tokenises) | route-only | V |
| Payment link | Fresh link for an unpaid/failed order | `orders/components/PaymentLinkButton.tsx` · payments/paymentRules | complete | route-only | V |

## Apps / developers

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Apps catalogue | 14 apps in 8 categories; install/uninstall; feature apps gate changes | `/apps` · `apps/AppsPage.tsx` · apps | complete (4 "coming soon": Taager, Shopify, WooCommerce, Mailchimp) | yes | V |
| Google Sheets | Orders / lost orders / leads written to sheets | `/apps/google-sheets` · `apps/GoogleSheetsPage.tsx` · sheets | partial (sandbox adapter, no real Google) | route-only (Apps → Open) | V |
| Dropship supplier | Connect, import product, forward orders, sync stock | `/apps/dropship_sandbox` · `apps/DropshipProviderPage.tsx`, `DropshipForwardSettings.tsx` · dropship | stub (only the "Test supplier" sandbox exists) | route-only | V |
| App install link | Third party asks for scopes; merchant approves | `/install-app` · `apps/InstallAppPage.tsx` · apps (external) | complete | route-only (external link) | V |
| API keys | Keys with per-resource access | `settings/DevelopersSection.tsx`, `ApiKeyAccessPicker.tsx` · apiKeys | complete | yes (in Settings) | V |
| Outbound webhooks | 20 topics, filters, delivery log, resend, test, rotate secret, auto-disable | `settings/DevelopersSection.tsx`, `WebhookExtras.tsx` · webhooks | complete | yes (in Settings) | V |

## Team / settings

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Settings page | 15 stacked sections, no tabs or anchors | `/settings` · `settings/SettingsPage.tsx` | complete | yes | V |
| Account | Name, picture | `settings/AccountSection.tsx`, `ProfileEditor.tsx` · auth/profile | complete | yes (in Settings) | V |
| Appearance | Dashboard theme | `settings/AppearanceSection.tsx` | complete | yes (in Settings) | V |
| Store address | Pickup/return address | `settings/StoreAddressSection.tsx` · workspaces | complete | yes (in Settings) | V |
| Account settings | Timezone, contact-form email, legal company/country, subdomain | `settings/AccountSettingsSection.tsx` · workspaces/accountSettings | complete | yes (in Settings) | V |
| Team | Members/admins, seat counter, invite by sections, roles, fulfilment role | `settings/SettingsPage.tsx` (TeamSection), `TeamInviteForm.tsx` · team, workspaces | complete | yes (in Settings) | V |
| Security | 2FA (app/email/WhatsApp), backup codes, devices, end sessions, phone verification, email change, support access grant | `settings/SecuritySection.tsx`, `BackupCodesPanel.tsx`, `PhoneVerification.tsx`, `EmailChange.tsx` · auth, supportAccess | complete | yes (in Settings) | V |
| Activity log | Who did what, filters by area/person/period | `/activity` · `activity/ActivityLogPage.tsx` · audit | complete | yes | V |

## Billing / plans

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Plan & billing | Plan, status, cycle, next charge, agent referral code | `settings/BillingSection.tsx` · billing | complete (owner/accountant only) | yes (in Settings) | V |
| Usage | This month's orders, messages, AI, storage vs limits | `settings/UsageBlock.tsx` · billing/planLimits | complete | yes (in Settings) | V |
| Subscribe / go live | Plan choice + Fawaterak payment | `/choose-plan`, `components/GoLiveDialog.tsx` · billing | complete | route-only | V |
| Refer & earn | ZIMOS referral link, sign-ups, earnings, payout requests | `/referrals` · `referrals/ReferralProgramPage.tsx` · referrals/merchantReferrals | complete | yes | V |

## AI

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| AI studio | 7 tools: product, page, translate, policies, page review, ad creatives, store builder; output always a draft | `/ai` · `ai/AiStudioPage.tsx`, `AiStudioP2.tsx` · ai | partial (only the sandbox provider is registered; "Test provider" badge) | yes | V |
| AI entry points elsewhere | Product form, funnel wizard, translate, policies, inbox reply, WA bot | various · ai | partial (sandbox) | yes / route-only | V |

## Affiliates

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Affiliates | Add marketer, link, % commission, orders, approve on delivered, payouts | `/affiliates` · `affiliates/AffiliatesPage.tsx`, `affiliateDialogs.tsx` · affiliates | complete | yes | V |
| Affiliate portal | Marketer signs in by phone OTP, sees links/orders/balance | `sf: app/store/[workspaceId]/affiliate`, `components/AffiliatePortal.tsx` · affiliates (portal) | complete | storefront | V |

## Digital

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Digital deliveries | File / link / licence codes per product, limits, expiry | `/digital` · `digital/DigitalProductsPage.tsx` · digital | complete | yes | V |
| File library | Private files, large files by presigned multipart | `digital/DigitalProductsPage.tsx` (Files tab) · digital, digital/multipartUploads | complete | yes (tab) | V |
| Order delivery card | Grants, renew/revoke, deliver now | `digital/OrderDigitalSection.tsx` · digital | complete | route-only | V |

## Courses

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Course editor | Chapters, lessons, drip, free preview, publish, students, manual enrolment | `/courses` · `courses/CoursesPage.tsx` · courses | complete (video is an external link; protected streaming not built) | yes | V |
| Student portal | Phone OTP, outline, lessons, progress | `sf: app/store/[workspaceId]/learn`, `components/LearnPortal.tsx` · courses (portal) | complete | storefront | V |

## Subscriptions

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Subscriptions & instalments | Plans per product, list, KPIs, trials, retries, cancel | `/subscriptions` · `subscriptions/SubscriptionsPage.tsx` · subscriptions | partial (renewals need saved cards, so only the sandbox gateway can run them) | yes | V |
| Subscriber portal | State, cancel, card update | `sf: app/store/[workspaceId]/subscriptions/[token]` · subscriptions (portal) | partial (same) | storefront | V |

## Services

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Services marketplace | Directory of providers by category; contact by WhatsApp/email | `/services` · `services/ServicesPage.tsx` · serviceListings | complete (directory only; no ratings/booking/payment by decision) | yes | V |

## Shoppable images

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Shoppable images | Picture with product hotspots; builder element | `/shoppable-images` · `shoppable/ShoppableImagesPage.tsx` · shoppableImages | complete | yes | V |
| Looks page | Public `/looks/<slug>` | `sf: app/store/[workspaceId]/looks/[slug]` · shoppableImages (store) | complete | storefront | V |

## Media

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Media library | Upload, list, delete images; storage limit | `/media` · `media/MediaLibraryPage.tsx` · media | complete | yes | V |

## Support

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Support tickets | Open, list, reply in a thread | `/support`, `/support/:ticketId` · `support/SupportPage.tsx` · support | complete | yes ("Contact support") | V |

## Platform admin (console, `apps/platform-admin`)

The console is in English only: no `useT`, no Arabic strings outside three components (V). Its sidebar has 28 items in 8 groups: Overview, then Merchants 5, Referrals 3, Marketplace 4, Operations 3, Risk 3, Support 4 and System 5.

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Overview | Platform metrics | `/` · `adm: OverviewPage.tsx` · platformAdmin | complete | yes | V |
| Workspaces | List, detail, subscription actions, support-access view | `/workspaces`, `/workspaces/:id` · `adm: WorkspacesPage.tsx`, `WorkspaceDetailPage.tsx` · platformAdmin, billing | complete | yes | V |
| Users | List, detail, 2FA reset | `/users`, `/users/:id` · `adm: UsersPage.tsx`, `UserDetailPage.tsx` · platformAdmin, auth | complete | yes | V |
| Subscriptions / Plans / Usage | Merchant plans, features & limits, monthly usage | `/subscriptions`, `/plans`, `/usage` · `adm: SubscriptionsPage.tsx`, `PlansPage.tsx`, `UsagePage.tsx` · billing | complete | yes | V |
| Agents & referral program | Sales agents, commissions, own referrals | `/agents`, `/agents/:id`, `/referral-program`, `/my-referrals` · referrals | complete | yes | V |
| Templates & themes | Template versions/publish; theme catalogue | `/templates`, `/themes` · `adm: TemplatesPage.tsx`, `ThemesPage.tsx` · templates, themes | complete | yes | V |
| Suppliers | Dropship adapters and stores using them | `/suppliers` · `adm: SuppliersPage.tsx` · dropship | stub (only the sandbox provider; rest "planned") | yes | V |
| Apps | Offer/hide, price, order of merchant apps | `/apps` · `adm: AppsPage.tsx` · apps | complete | yes | V |
| Carriers / gateways / WhatsApp numbers | Provider config; carrier city mapping | `/carriers`, `/carriers/:code/areas`, `/payment-gateways`, `/whatsapp-numbers` · `adm: ProvidersPage.tsx`, `CarrierAreasPage.tsx` · shipping, payments, whatsapp | complete | yes (areas route-only) | V |
| Risk | Fraud signals, global blocklist, delivery network aggregates | `/fraud-signals`, `/blocklist`, `/network-stats` · risk, fraud | complete | yes | V |
| Tickets / announcements / education / service listings | Support inbox, broadcast to merchants, help links, services directory | `/tickets`, `/announcements`, `/education`, `/service-listings` · support, platformAdmin, serviceListings | complete | yes | V |
| System | Feature flags, audit log, system health, queues (retry), admin users | `/feature-flags`, `/audit-log`, `/system-health`, `/queues`, `/admin-users` · platformAdmin | complete | yes | V |

## Storefront shopper features (`apps/storefront`, `/store/[workspaceId]/…`)

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Store home & pages | Builder pages, themes, showcase/immersive sections | `sf: app/store/[workspaceId]/page.tsx`, `[...path]`, `components/page-renderer` · storefront, pages | complete | storefront | V |
| Catalogue | Listing, Arabic search, facets, sort, collections | `products/page.tsx`, `components/catalog/*` · storefront | complete | storefront | V |
| Product page | Gallery, video, options/swatches, bundles, bumps, custom fields + photo, real countdown, content, reviews + form, related, JSON-LD | `products/[idOrSlug]`, `components/product/*` · catalog, bundles, offers, reviews | complete | storefront | V |
| Cart | Drawer/page, cross-sell, cart bumps, free-shipping bar, coupon | `cart/page.tsx`, `components/CartDrawer.tsx`, `offers/CartBumps.tsx` · cart, offers | complete | storefront | V |
| Checkout | Merchant's form, shipping options/fee, COD/online/transfer/deposit, coupon/automatic discount, minimum order, bot guard, OTP | `checkout/page.tsx`, `components/checkout/*`, `OtpGate.tsx`, `BotGuard.tsx` · storefront, risk, payments | complete | storefront | V |
| Pay page | Online payment, retry link, switch to COD | `pay/[orderId]`, `components/payment/CodSwitch.tsx` · payments | complete | storefront | V |
| Thank-you & upsell | Confirmation, custom content, downloads, one-tap upsell | `orders/[orderId]`, `offer/[orderId]`, `ThankYouExtras.tsx` · orders, offers | complete | storefront | V |
| Order tracking | Phone+number or signed link; steps, courier, public notes, transfer re-upload | `track/page.tsx`, `TrackOrder*.tsx` · storefront | complete | storefront | V |
| Order updates push | Notify the shopper's phone of stage changes | `components/OrderUpdatesButton.tsx` · notifications/push | partial (sandbox push) | storefront | V |
| Recovery link | Refill cart and form from a lost order | `r/[token]` · checkoutSessions | complete | storefront | V |
| Funnel runtime | Steps, opt-in, COD form, upsells, split tests, geo redirect, policies, funnel currency | `f/[ref]/…`, `components/funnel/*` · funnels | complete | storefront | V |
| Policies | Policy pages with variables | `policies/[key]` · storefront | complete | storefront | V |
| Engagement | Exit popup, social proof, newsletter, floating WhatsApp, announcement bar | `components/offers/Engagement.tsx`, `FloatingWhatsapp.tsx`, `AnnouncementBar.tsx` · offers | complete | storefront | V |
| Language & currency | AR/EN/FR interface; display-currency switcher | `components/LanguageSwitch.tsx`, `CurrencySwitcher.tsx` · translations, currencies | partial (FX rates sandbox; other UI languages not offered) | storefront | V |
| Store as app | Manifest + install prompt | `manifest.webmanifest/route.ts`, `components/StoreAppInstall.tsx` · storefront/storeApp | complete | storefront | V |
| SEO files | sitemap.xml, robots.txt, server lang/dir | `sitemap.xml/route.ts`, `robots.txt/route.ts` · storefront | complete | storefront | V |
| Tracking & custom code | Pixels, analytics events, merchant code, page scripts | `TrackingPixels.tsx`, `StoreAnalytics.tsx`, `CustomCode.tsx`, `PageScripts.tsx` · marketing, analytics, customCode | complete | storefront | V |
| Downloads | Digital download page | `downloads/[token]` · digital (store) | complete | storefront | V |
| Unsubscribe | Marketing opt-out | `unsubscribe/page.tsx` · whatsapp/optOut | complete | storefront | V |
| Merchant preview | Preview token, payments-preview banner | `preview/[token]`, `preview/route.ts` · storefront | complete | storefront | V |
| Custom domains | Host → store via resolve-host | `sf: proxy.ts` · domains/domainSettings | complete (certificates sandbox) | storefront | V |

## Marketing site (`apps/marketing`)

| Feature | What it does for the user | Route · file · module | Status | Nav | Ev. |
|---|---|---|---|---|---|
| Public site | Home, pricing (plans from `/plans`), contact, privacy, terms, refund policy; AR/EN | `apps/marketing/src/app/[locale]/*` · billing (public plans) | complete | site nav | V |

---

## Backend-only: endpoints and modules with no frontend screen

None of the endpoints below is called by any app or by `packages/api-client`. This was checked by matching all 865 backend route definitions against the frontend sources, and every hit was confirmed by grep.

| Backend | What it is | Why it has no screen | Ev. |
|---|---|---|---|
| `inventory` · `GET /inventory/:variantId`, `POST …/adjust`, `POST …/restock` | Stock read, adjust, restock per variant | Stock is edited from the variant table, which goes through catalog bulk endpoints. No stock-movement history screen exists. | V |
| `invoices` · `GET /invoices` | List of customer invoices and credit notes | Only the per-order PDF and the bulk invoices PDF are used | V |
| `pages` · `GET /websites/:id/revisions`, `POST …/revisions/:rid/rollback` | Website version history and restore | Funnels have revisions in the UI; websites do not | V |
| `payments` · `POST /payments/:paymentId/capture` | Manual capture of an authorised payment | No UI | V |
| `profit` · `POST /profit/ads/sync` (+ hourly `ads.sync_spend`) | Pull ad spend now | Sandbox adapter only, no button | V |
| `settlements` · `GET /settlements/:id/statement-report` | The saved match report of an imported statement | Shown only once, at import time | V |
| `payments` · `GET /manual-transfers/pending` | Queue of transfers waiting for confirmation | Handled order by order (api-client `manualTransferListPending` unused) | V |
| `savedMethods` · `GET /saved-payment-methods/customers/:id` | A customer's saved cards | Not on the customer page | V |
| `ai` · `GET /ai/jobs` | AI request history | `aiListJobs` unused | V |
| `catalog` · import history (`catalog_imports`) | Past product imports and reports | `catalogListImports` unused | V |
| `shipping` · shipment batch list | History of "Ship selected" batches | `shipmentBatchList` unused; only single batch page | V |
| `orders` · `GET /orders/:id/status-history` | Raw stage history | Superseded by `/timeline` | V |
| `auth` · `POST /auth/password-reset/sms/request|confirm` | Password reset by SMS | Forgot-password uses email only | V |
| `quickstart` · `/workspaces/:id/quickstart`, `/shop/:ws/*` (EJS) | Legacy one-page server-rendered store and its setup form | Superseded by the storefront app | V |
| `billing` · `GET /admin/dashboard` (EJS) | Legacy server-rendered admin table | Superseded by the console | V |
| `marketing` · `/server-pixels/integration` | Legacy one-token-per-platform CAPI settings | Superseded by `tracking-pixels`; nothing reads it | V |
| `analytics` · `GET /analytics/pnl` | 307 alias to `/profit/pnl` | Alias | V |
| `publicApi` · `/api/public/v1/*` (41 operations, OpenAPI at `/public-docs`) | Merchant/partner REST API | External by design; dashboard only manages keys | V |
| Webhooks in: carriers, payments, WhatsApp, Fawaterak; `POST /billing/run-trial-check` | Inbound callbacks and cron | System endpoints | V |
| Dev-only: `/sandbox-pay`, `/dev/sandbox/shipments/:id/advance`, `/storage-sandbox` | Sandbox gateway page, courier advance, local presigned uploads | Not mounted in production | V |
| `whatsapp/quickReplyConfirmation` | Customer button reply confirms/cancels the order | Behaviour, no screen by design | V |
| `risk/aiOrderCheck`, `risk/networkStats` flags | `ai_spam_shield`, `customer_network_score` | Toggled only in console Feature flags | V |
| Site-wide named styles (`website.globalStyles.named`) | Shared element styles across pages | API validates it; no editor (lane 5 decision) | I |
| `whatsapp_campaigns*` tables (migration 218) | Removed broadcast campaigns | Feature removed 2026-10-03; tables kept | V |

## Frontend routes not in the sidebar

There are 32 routes inside the layouts (`App.tsx`) and none of them is in `lib/navigation.ts`. The dev-only `/design-system` is listed as well. The 10 auth and onboarding routes are left out of this count.

| Route | How a merchant reaches it | Breadcrumb group? |
|---|---|---|
| `/orders/new` | Orders button, home quick action, ⌘K, keyboard shortcut | Orders (prefix) |
| `/orders/board` | Orders header link | Orders |
| `/orders/:orderId` | Any order row | Orders |
| `/orders/shipment-batches/:batchId` | After "Ship selected" | Orders |
| `/exports/:exportId` | `export.ready` notification | none |
| `/catalog/new`, `/catalog/:productId` | Products list, ⌘K | Products |
| `/catalog/collections` | Link on Products page | Products |
| `/customers/:customerId` | Contacts row, order page | Customers |
| `/form-submissions` | Link on Customers page, ⌘K | none |
| `/stores` | Store switcher "All my stores", ⌘K | none |
| `/offers/bundles`, `/order-bumps`, `/cross-sell`, `/upsells`, `/exit-popup`, `/order-rules`, `/social-proof`, `/newsletter`, `/referrals`, `/feed` (10) | Cards on the Offers hub (feed also from Apps) | Offers |
| `/analytics/summary` | Link on Home | Analytics (Reports) |
| `/analytics/funnels/:funnelId` | Funnels list | Analytics |
| `/inbox/bot` | Link in Inbox | Inbox |
| `/profit/costs` | Link on Profit | Profit |
| `/store-settings/:tab` | Tabs of Store settings | Store settings |
| `/apps/google-sheets`, `/apps/dropship_sandbox` | Apps → Open; order supplier card | Apps |
| `/install-app` | External install link only | none |
| `/support/:ticketId` | Support list, go-live dialog | Support |
| `/website/:websiteId/edit`, `/funnels/:funnelId` | Website / Funnels lists (full-screen editor layout) | own editor bar |
| `/design-system` | Typed URL, development builds only | none |

## Sandbox-only integrations (drive most "partial" ratings)

| Integration | Real adapter? | Where the merchant meets it |
|---|---|---|
| AI provider (`ai/providers`) | No: sandbox, sandboxP2, sandboxSupport | AI studio, product AI, translate, inbox reply, WA bot, AI spam shield |
| Saved cards / tokenisation (`payments/gateways`) | No: only `sandbox.js` tokenises; Paymob and Kashier do not | Saved cards, subscriptions, instalments, one-click upsell |
| FX rates (`currencies/adapters`) | No | Display currencies, report currency switch |
| SSL certificates (`domains/certificates`) | No | Domains tab |
| Dropship (`dropship/providers`) | No | Apps → Test supplier, order supplier card, console Suppliers |
| Google Sheets (`sheets/adapters`) | No | Apps → Google Sheets |
| Ad-spend sync (`profit/adapters`) | No | Ad spend (auto-sync) |
| Reviews import (`reviews/import`) | No | Reviews → Import |
| CAPTCHA (`risk/captcha`) | No (Turnstile widget written, no verifier) | Fraud → Visitors |
| IP intelligence (`risk/ipIntel`) | No | Fraud country/VPN rules, funnel geo redirects |
| Push (`notifications/push`) | No | Device push, shopper order updates |
| Real adapters present | Paymob, Kashier; Bosta, Mylerz, J&T; WhatsApp Cloud API; Meta/TikTok/Snap/GA4 CAPI; Brevo email; Twilio SMS; Fawaterak billing | none |

## Dead code and leftovers (Verified)

- `pages/profit/ProfitPage.tsx` is orphaned: `/profit` renders `RealProfitPage`.
- `pages/settings/CheckoutSettingsSection.tsx` is orphaned. Lane 5 replaced it with Store settings → Checkout form.
- `MarketingPage.test.tsx` and `AutomationsPage.test.tsx` describe screens that have since been replaced.
- Unused api-client methods: `listCustomers`, `blockPhone`, `listAutomations`/`create`/`update`/`delete`, `getShippingQuote`, `switchOrderToCod`, `refundOrder`, `themeActivate`, `pushDevices`, `dropshipPushOrder` and others. Newer `endpoints/*` replaced them.

## Not built (queued, spec-gaps items 160–192; Verified as unchecked there and absent in code)

| Area | Items not built |
|---|---|
| Storefront | Editable storefront texts (160), shopper accounts (185), shopper returns (186), wishlist (188), gift cards (189), blog (190), address autocomplete (184), express wallets/Stripe/PayPal (183) |
| Website / funnels | Targeted scripts (161), element display rules (191), funnel bulk actions (166), template marketplace (192) |
| Catalog / shipping | Smart collections (162), city/area places & prices (163–164), checkout file field / billing address (165) |
| Tracking / analytics | Lead instead of Purchase (167), Pinterest CAPI (168), Google Ads conversion label (169), GTM container (170), live world map (171), home filter by product/store (172) |
| Email / domains / dev | Sending domain (173), email designer (174), per-funnel emails (175), buy domain (176), redirect to primary per domain (177), webhook headers/topics (178), MCP server (179) |
| Integrations | Importers (180), Shopify/Woo push (181), Mailchimp/Klaviyo (182), contacts CSV import (187) |
| Forbidden (SPEC §21) | Cloaking, evergreen timers, fake counters/stock/reviews, AI-written reviews, call centre, QR WhatsApp, broadcast campaigns |

## Counts

| Measure | Count |
|---|---|
| Feature rows (all apps) | 238 |
| Complete / partial / stub | 211 / 22 / 5 |
| Rows in the merchant dashboard only (without console, storefront, marketing site) | 204, of which 20 partial and 4 stub |
| Nav: own sidebar entry / section inside a sidebar page / route-only / no UI / storefront | 79 / 58 / 70 / 5 / 25 (+1 marketing site) |
| Evidence: Verified / Inferred | 233 / 5 |
| Backend-only rows (endpoints or modules with no screen) | 24 |
| Dashboard layout routes / in sidebar / not in sidebar | 71 / 39 / 32 (+ dev-only `/design-system`) |
| Sidebar size (committed) | 39 items, 9 groups (7 headed + 2 unheaded); plus top bar, store switcher, up to 8 pinned shortcuts |
| Sidebar on first load (committed defaults) | 17 items open + 3 collapsed headings; the 6 config items are hidden (likely bug) |
| Sidebar size (uncommitted working tree) | 39 items, 10 groups (8 headed incl. "More" + 2 unheaded) |
| Console sidebar | 28 items, 8 groups |
| Store settings tabs / Settings sections / Offers sub-screens / Fraud tabs / Shipping tabs | 10 / 15 / 10 / 4 / 4 |
| Sandbox-only integrations | 11 (AI, tokenisation, FX, SSL, dropship, Sheets, ad-spend sync, review import, CAPTCHA, IP intel, push) |
| Not built (spec-gaps 160–192, open) | 33 items |
