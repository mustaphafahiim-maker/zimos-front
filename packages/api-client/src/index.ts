export { ApiClient, ApiError } from "./client";
export type { ApiClientOptions } from "./client";
export { createLocalStorageTokenStorage, createMemoryTokenStorage, createBrowserSessionTokenStorage } from "./tokenStorage";
export type { TokenStorage, TokenPair } from "./tokenStorage";
export type * from "./types";
// Value exports: `export type *` above only carries the types, not these consts.
export {
  PAGE_ELEMENT_TYPES,
  ORDER_STAGES,
  ORDER_SORTS,
  CHECKOUT_SETTINGS_DEFAULTS,
  DEFAULT_CATALOG_SETTINGS,
  CUSTOM_FIELD_LIMITS,
  BOSTA_PACKAGE_TYPES,
  BOSTA_PARCEL_SIZES,
  MAX_WEIGHT_GRAMS,
  resolveCheckoutSettings,
  resolveFraudRules,
  isCityDistrictLevels,
  isAreaUnmatchedDetails,
} from "./types";
export { formatMoney, formatMoneyRange, parseMoney } from "./money";
export {
  apiErrorCode,
  apiErrorDetails,
  apiErrorRequestId,
  apiFieldProblems,
  carrierAddressNamesLevels,
  carrierAddressRejection,
  isApiErrorCode,
  isInvalidCursorError,
  manualCancelShipments,
  productInFunnelIds,
} from "./errors";
export type { ApiErrorCode, ApiFieldProblem, ConfirmationLockDetails } from "./errors";
// Funnels live in their own endpoint module (functions over the shared client).
export * from "./endpoints/funnels";
export * from "./endpoints/funnelRuntime";
// API keys and outbound webhooks (Settings → Developers).
export * from "./endpoints/developers";
export * from "./endpoints/webhookExtras";
export * from "./endpoints/apps";
export * from "./endpoints/security";
export * from "./endpoints/usage";
export * from "./endpoints/adminExtras";
// Store design and settings: purchase form builder, thank-you page (lane 5).
export * from "./endpoints/storeDesign";
// Catalog additions: product page settings, content, option display (lane 3).
export * from "./endpoints/catalog";
// Protection against fake orders: blocklist, rules, risk (Fraud protection page).
export * from "./endpoints/protection";
// Dashboard home overview, attribution, profit and ad spend.
export * from "./endpoints/insights";
// Analytics reports: sales, products, delivery, customers, insights, CSV export.
export * from "./endpoints/reports";
export * from "./endpoints/profit";
export * from "./endpoints/settlementStatements";
export * from "./endpoints/manualTransfers";
export * from "./endpoints/manualPayments";
export * from "./endpoints/paymentLedger";
export * from "./endpoints/paymentDisputes";
export * from "./endpoints/orderRefundOnce";
export * from "./endpoints/orderNumbers";
export * from "./endpoints/orderPriceOverride";
export * from "./endpoints/paymentRules";
export * from "./endpoints/currencies";
export * from "./endpoints/savedPaymentMethods";
export * from "./endpoints/live";
// Merchant notifications (the header bell and its preferences).
export * from "./endpoints/notifications";
// Orders: status changes, history, notes, tags, bulk actions (lane 1).
export * from "./endpoints/orders";
// Contacts, segments and form submissions (lane 8).
export * from "./endpoints/contacts";
// All my stores and duplicate store (lane 8).
export * from "./endpoints/stores";
// Global search, setup guide, sidebar shortcuts (lane 8).
export * from "./endpoints/dashboard";
// Digital products: file library, deliveries, licence codes, download grants (lane 8).
export * from "./endpoints/digital";
// AI module: generation jobs, usage, apply as draft (lane 8).
export * from "./endpoints/ai";
// Affiliates: marketers, commissions, payouts and the portal (lane 8).
export * from "./endpoints/affiliates";
// Customer subscriptions and installments (lane 8).
export * from "./endpoints/customerSubscriptions";
// Services marketplace: the providers directory and its admin (lane 8).
export * from "./endpoints/serviceListings";
// Shoppable images: pictures with product hotspots (lane 8).
export * from "./endpoints/shoppableImages";
// Courses: outline, students, and the student portal (lane 8).
export * from "./endpoints/courses";
// Tracking pixels (Marketing → Tracking tools).
export * from "./endpoints/trackingPixels";
// Automations as step sequences (the Automations page).
export * from "./endpoints/automations";
// Quantity bundles (lane 3).
export * from "./endpoints/bundles";
// The WhatsApp inbox: filters, assignment, customer panel, quick replies, live stream.
export * from "./endpoints/inbox";
// Offer rules: product order bumps, cross-sell, thank-you upsell, exit popup (lane 3).
export * from "./endpoints/offers";
// Order emails to customers (Settings → Order emails).
export * from "./endpoints/orderEmails";
// Coupons: bulk codes, minimum order, coupon preview (lane 3).
export * from "./endpoints/coupons";
// Lost orders: refused and unfinished checkouts, recovery (lane 2).
export * from "./endpoints/lostOrders";
// Excel beside CSV: the lost orders export and the courier tracking import (handoff 260).
export * from "./endpoints/sheetFiles";
// Social proof, newsletter sign-up, referral results (lane 3).
export * from "./endpoints/engagement";
// Product feed, Google Merchant checklist, offers summary (lane 3).
export * from "./endpoints/feeds";
// Product feeds per channel: each channel's switch, collections, stock rule and state (handoff 264).
export * from "./endpoints/feedChannels";
// The shopper's order tracking page: steps, courier, signed tracking link.
export * from "./endpoints/orderTracking";
// Funnel share codes, import, map draft and issues (lane 5).
export * from "./endpoints/funnelExtras";
// Default courier, automatic booking, inspection and courier notes (shipping/carrierBooking.js).
export * from "./endpoints/carrierBooking";
// Where each governorate/city is on a courier's own list (shipping/carrierRegionMap.js).
export * from "./endpoints/carrierRegions";
// "Ship selected" with a connected courier, as a queued batch (shipping/bulkShipping.js).
export * from "./endpoints/shipmentBatches";
// The orders list's risk tab counts (orders/orderService.orderPipeline).
export * from "./endpoints/orderRiskCounts";
// The orders list rows' extra fields: IP country, data quality, latest shipment.
export * from "./endpoints/orderListColumns";
// Many invoices in one PDF for the ticked orders (orders/orderInvoicesPdf.js).
export * from "./endpoints/orderSelection";
// "Confirm via WhatsApp" on the order page (orders/whatsappConfirm.js).
export * from "./endpoints/orderWhatsappConfirm";
// Editing the customer's details on an order (orders/orderService.updateOrderLimited).
export * from "./endpoints/orderContactEdit";
// Cancel with a refund, and "notify the customer" on cancel and refund (orders/orderCancelRefund.js).
export * from "./endpoints/orderCancelRefund";
// The storefront's display currencies (currencies/fxService.getForStorefront).
export * from "./endpoints/storefrontCurrencies";
// Files built in the background: the orders export (orders/exportFiles.js).
export * from "./endpoints/exportFiles";
// The merchant's own phone, confirmed by a code (auth verify-phone).
export * from "./endpoints/phoneVerification";
// Two-step sign-in by a WhatsApp code (auth/twoFactorWhatsapp.js).
export * from "./endpoints/twoFactorWhatsapp";
// Account settings: timezone, contact-form email, legal details (workspaces/accountSettings.js).
export * from "./endpoints/accountSettings";
// The signed-in person's name and picture (auth/profileRoutes.js).
export * from "./endpoints/profile";
// Changing the sign-in email, confirmed from the new address (auth/emailChange.js).
export * from "./endpoints/emailChange";
// Help center, Telegram and tutorial links (platformAdmin/educationLinks.js).
export * from "./endpoints/education";
// WhatsApp message templates synced from Meta (whatsapp/whatsappTemplates.js).
export * from "./endpoints/whatsappTemplates";
// Custom HTML blocks kept outside the page tree (customCode/htmlBlocks.js).
export * from "./endpoints/htmlBlocks";
// The thank-you page's download links (digital/digitalRoutes.js).
export * from "./endpoints/storefrontDownloads";
// Shipping groups: products with their own shipping prices (shipping/shippingProfiles.js).
export * from "./endpoints/shippingProfiles";
// Shipping options the shopper chooses between (shipping/shippingOptions.js).
export * from "./endpoints/shippingOptions";
// Push notifications on the person's devices (notifications/push).
export * from "./endpoints/push";
// Each teammate's saved list views (workspaces/savedViews.js).
export * from "./endpoints/savedViews";
// Lost orders in bulk (checkoutSessions/lostOrderBulk.js).
export * from "./endpoints/lostOrdersBulk";
// Support's view of a store under the merchant's grant (platformAdmin/supportViewRoutes.js).
export * from "./endpoints/adminSupportView";
// The couriers' areas map in the platform console (platformAdmin/carrierMapRoutes.js).
export * from "./endpoints/adminCarrierAreas";
// The store as an app for shoppers (storefront/storeApp.js).
export * from "./endpoints/storeApp";
// Shoppers following their order by push (notifications/push/orderPush.js).
export * from "./endpoints/orderPush";
// ZIMOS's referral program for merchants (referrals/merchantReferrals.js).
export * from "./endpoints/merchantReferrals";
// The customer service bot on WhatsApp (whatsapp/bot/botService.js).
export * from "./endpoints/waBot";
// What a product's custom fields add to its price (catalog/customFieldPricing.js).
export * from "./endpoints/customFieldPrice";
// Importing the merchant's own reviews from their Shopify store (reviews/import).
export * from "./endpoints/reviewImport";
// Translating the text of live pages and funnels (translations/contentTranslations.js).
export * from "./endpoints/contentTranslations";
// A page's or funnel step's own scripts (customCode/pageScripts.js).
export * from "./endpoints/pageScripts";
// A funnel copied as a new draft (the funnel wizard's "Your funnels").
export * from "./endpoints/funnelTemplates";
// The theme catalog: the store's view and the platform console's (themes/themesCatalog.js).
export * from "./endpoints/themes";
// A/B tests on a product page: staff CRUD and the shopper's variant (catalog/productTests.js).
export * from "./endpoints/productTests";
// The payment methods a funnel's checkout offers (payments/paymentRulesService.js).
export * from "./endpoints/funnelPayments";
// The order page's session details, customer history and last action (orders/orderSessionDetails.js).
export * from "./endpoints/orderSession";
// The shipping card's "Save as draft" (orders/shipmentDraft.js).
export * from "./endpoints/shipmentDraft";
// Each offer's impressions, acceptances and added revenue (offers/offerStats.js).
export * from "./endpoints/offerStats";
// A funnel's generic pages — contact, about, policies — off the map (funnels/genericPages.js).
export * from "./endpoints/funnelGenericPages";
// Large digital files, uploaded in parts straight to storage (digital/multipartUploads.js).
export * from "./endpoints/digitalMultipart";
// Switch to cash on delivery with the COD checks: a code, a deposit (payments/codSwitchChecks.js).
export * from "./endpoints/codSwitch";
// Unsubscribing from marketing emails (notifications/marketingUnsubscribe.js).
export * from "./endpoints/marketingUnsubscribe";
// Two-step sign-in recovery: backup codes, the platform reset (auth/twoFactorRecovery.js).
export * from "./endpoints/twoFactorRecovery";
// The opt-in step's sign-up (funnels/funnelOptIn.js).
export * from "./endpoints/funnelOptIn";
// The places a store prices shipping by, and the ones it does not deliver to (shipping/shippingPlaces.js).
export * from "./endpoints/shippingPlaces";
// The builder product list's sources: newest, featured, best selling (storefront/productSearch.js).
export * from "./endpoints/productListSources";
// A rejected transfer sent again from the tracking page (payments/transferResubmit.js).
export * from "./endpoints/transferResubmit";
// The order page's Supplier card and each supplier's forwarding settings (dropship/dropshipOrders.js).
export * from "./endpoints/dropshipOrders";
// A supplier's own shipping rates and minimum order: the two switches, and the storefront's minimum gap (handoff 263).
export * from "./endpoints/dropshipRules";
// Partner apps with OAuth: the developer's apps, the merchant's approval, the app's page, the console's list; app-made webhooks (handoff 265–267).
export * from "./endpoints/partnerApps";
// Transfer a store to another owner: the candidates and the transfer (handoff 252).
export * from "./endpoints/storeTransfer";
// Merchant sign-in with a code sent to the phone by WhatsApp or SMS (handoff 262, 269).
export * from "./endpoints/whatsappLogin";
// The store's address: check, change, the previous ones (workspaces/slugHistory.js).
export * from "./endpoints/storeAddress";
// Formatted product descriptions: the marks, parsed for each app to draw (catalog/richDescription.js).
export * from "./endpoints/richText";
// Courier export layouts: a courier's column titles mapped to the export's columns (orders/exportPresets.js).
export * from "./endpoints/orderExportPresets";
// Google Sheets: a Google account and the sheets orders, lost orders and leads are written to (modules/sheets).
export * from "./endpoints/googleSheets";
// Fonts: Google fonts and the store's uploaded ones, referenced as g:Name / c:id (modules/fonts).
export * from "./endpoints/storeFonts";
export * from "./endpoints/confirmationCallback";
export * from "./endpoints/storePlaces";
export * from "./endpoints/smartCollections";
export * from "./endpoints/funnelBulk";
// Store texts: the storefront's own labels reworded per language (storefront/storefrontTexts.js).
export * from "./endpoints/storefrontTexts";
// Store scripts: the merchant's own code by position and page type (customCode/storeScripts.js).
export * from "./endpoints/storeScripts";
// Home: filter the overview by product and by store (frontend-handoff 172).
export * from "./endpoints/homeFilters";
// Checkout photo field and optional billing address (checkout/checkoutForm.js, handoff 165).
export * from "./endpoints/checkoutUploads";
// Report orders to the ad platforms as Lead instead of Purchase, per store and funnel (handoff 167).
export * from "./endpoints/conversionEvent";
// Pinterest Conversions API on a pinterest pixel: ad account id, token, test events (handoff 168).
export * from "./endpoints/pinterestPixel";
// More ad platforms on a pixel: X, Taboola, Outbrain, Kwai, Reddit, Microsoft Ads; X event ids and keys, sandbox mode (handoffs 251, 255, 257).
export * from "./endpoints/adPlatformPixels";
// Ad accounts: connect an ads adapter, pick the accounts to follow, pause / resume a campaign and set its daily budget (handoff 261).
export * from "./endpoints/adAccounts";
// Google Ads conversions: purchase and lead conversion labels on an AW- pixel (handoff 169).
export * from "./endpoints/googleAdsLabels";
// Google Tag Manager: the ready-made container download and its dataLayer events (handoff 170).
export * from "./endpoints/gtmContainer";
// Webhook custom headers: per-endpoint headers, sealed and shown masked (webhooks/customHeaders.js).
export * from "./endpoints/webhookHeaders";
// MCP server for AI assistants: its URL, the funnel scopes and the tools a key opens (mcp/mcpServer.js).
export * from "./endpoints/mcp";
// Per-domain "redirect to the primary domain" switch (domains/domainSettings.js, item 177).
export * from "./endpoints/domainRedirect";
// Buy a domain: search, purchase, auto-renew and renew (domains/purchases.js, item 176).
export * from "./endpoints/domainPurchases";
// Domains: deployment rules, certificate / suspension states, owner details, DNS records, transfer code (handoff 341, 326, 385).
export * from "./endpoints/domainExtras";
// Sending domain on Brevo: availability, the new record purposes (handoff 395).
export * from "./endpoints/emailSendingDomainBrevo";
// GTM container: the store's own Google tags left out, named in a header (handoff 303).
export * from "./endpoints/gtmContainerSkipped";
// Sending domain: customer emails from the store's own domain once its DNS records verify (emailDomains/sendingDomain.js).
export * from "./endpoints/emailSendingDomain";
// Order email designer: blocks instead of the plain body, previewed and saved per template (notifications/emailBlocks.js).
export * from "./endpoints/orderEmailDesign";
// The checkout's place pickers: the store's own regions → cities → areas, and the quote by place (handoff 163/164).
export * from "./endpoints/storefrontPlaces";
// Live View on a world map: visitors, checkouts and orders of the last minutes by country and place (analytics/liveMap.js).
export * from "./endpoints/liveMap";
// Address suggestions at checkout: the shopper's search and pick, and the store's provider setting (handoff 184).
export * from "./endpoints/addressLookup";
// Shopper returns: the store's setting, photos and source on the staff lists, and the shopper's request (handoff 186).
export * from "./endpoints/shopperReturns";
// Email marketing: contacts who agreed to marketing to Mailchimp / Klaviyo lists (emailMarketing/emailMarketing.js, handoff 182).
export * from "./endpoints/emailMarketing";
// Express checkout (Apple Pay, Google Pay, PayPal), Stripe and PayPal: wallets on methods, PayPal as a method (handoff 183).
export * from "./endpoints/expressCheckout";
// Product links from AliExpress, Etsy, CJ and YouCan beside Shopify: sources, kinds, the page price (handoff 180).
export * from "./endpoints/productLinkImport";
// Import contacts from a CSV / Excel sheet: template, dry-run check and import (contacts/contactImport.js, handoff 187).
export * from "./endpoints/contactImport";
// Notes and follow-ups on customers, and the open follow-ups list (customerNotes/, handoff 209).
export * from "./endpoints/customerNotes";
// Customer timeline: everything that happened with one customer, in one feed (customerTimeline/, handoff 250).
export * from "./endpoints/customerTimeline";
// RFM customer scores: the nine groups, a group's customers, one customer's scores (rfm/, handoff 237).
export * from "./endpoints/rfm";
// Merge duplicate customers: possible duplicates and the merge (customers/customerMerge.js, handoff 248).
export * from "./endpoints/customerMerge";
// Customer privacy requests: the store's inbox, export / erase a customer, the shopper's own requests (privacyRequests/, handoff 235).
export * from "./endpoints/privacyRequests";
// Shopper accounts: sign in with a code, orders, saved addresses, reorder (shopperAccounts/, handoff 185).
export * from "./endpoints/shopperAccounts";
// Element display rules: between dates, by device, country or UTM source; the visitor context (pages/displayRules.js, handoff 191).
export * from "./endpoints/displayRules";
// Wishlist for signed-in shoppers and the merchant's most wished products (shopperAccounts/wishlist.js, handoff 188).
export * from "./endpoints/wishlist";
// Back-in-stock alerts: a shopper signs up on a sold-out variant; the merchant sees who waits (stockAlerts/, handoff 194).
export * from "./endpoints/stockAlerts";
// Gift cards: issue, list, adjust, reveal / resend, products sold as gift cards; the shopper's balance check and checkout field (handoff 189).
export * from "./endpoints/giftCards";
// Loyalty points: the programme's settings, a customer's points, the shopper's points and the checkout field (handoff 203).
export * from "./endpoints/loyalty";
// Store credit: balances, give / take, refund an order as credit, the shopper's credit and the checkout field (handoff 204).
export * from "./endpoints/storeCredit";
// Business customers: company, tax ID and the store's tax exemption; the shopper's own company details (handoff 228).
export * from "./endpoints/businessCustomers";
// Pay later on account: a customer's limit, terms and statement, the balances list, recording a payment, the checkout's refusals (handoff 229).
export * from "./endpoints/accountCredit";
// Gift card, points and store credit at checkout: the shopper token, the answer's extras, what an unpaid order holds (handoff 201, 203, 204).
export * from "./endpoints/checkoutTenders";
// Wholesale price lists: lists by customer tag (percent off or fixed prices with quantity tiers), the signed-in shopper's own prices (handoff 205).
export * from "./endpoints/priceLists";
// VIP tiers: the tiers and their perks, a customer's tier and what is left to the next, the shopper's level (handoff 218).
export * from "./endpoints/vipTiers";
// Invite a friend: the programme's settings and invites, the shopper's link, the landing check and the checkout field (handoff 222).
export * from "./endpoints/customerReferrals";
// Pre-orders: sold-out variants keep selling up to a limit, with a ship date (handoff 195).
export * from "./endpoints/preorders";
// Purchase limits per product: min / max per order and max per customer, and their refusals (handoff 198).
export * from "./endpoints/purchaseLimits";
// Estimated delivery dates: the settings, the shopper's window and where it rides (handoff 199).
export * from "./endpoints/deliveryEstimates";
// Store blog: posts as blocks, categories, the posts index and the home page's latest posts (modules/blog, handoff 190).
export * from "./endpoints/blog";
// Cookie consent: the store's banner (off / notice / ask first), who is asked, policy link and wording; the storefront's reader (handoff 196).
export * from "./endpoints/cookieConsent";
// Funnel template marketplace: browse, preview and use listed templates; submit, edit, resubmit and withdraw your own (marketplace/, handoff 192).
export * from "./endpoints/marketplaceTemplates";
// Store gates: password, coming soon with sign-ups, age check; the storefront's unlock and sign-up (handoff 197).
export * from "./endpoints/storeGate";
// URL redirects: the old address → new address list, CSV import, the storefront's lookup on a page it cannot find (handoff 232).
export * from "./endpoints/urlRedirects";
// Store locator: which stock locations show as branches, with phone, hours and map pin; the storefront's branches list (handoff 233).
export * from "./endpoints/storeLocator";
// Post-purchase survey: its questions, an order's answers, the report; the thank-you page's questions and answers (handoff 236).
export * from "./endpoints/postPurchaseSurvey";
// Sign in with Google for shopper accounts, its store setting, and verifying a shopper's email (handoff 217, 278, 279).
export * from "./endpoints/shopperGoogle";
// Free gifts with purchase, gift wrap and message, mix-and-match boxes: rules, settings, cart and order readers (handoffs 208, 214, 215).
export * from "./endpoints/giftsAndBoxes";
// Size charts: tables of sizes attached to products / collections, and the product page's chart (handoff 210).
export * from "./endpoints/sizeCharts";
// Product questions and answers: the shopper's question, the store's answer, the inbox (handoff 212).
export * from "./endpoints/productQuestions";
// Quote requests (B2B): the shopper's request and answer, the store's inbox and prices (handoff 219, 275).
export * from "./endpoints/quotes";
// Scheduled price changes: sales with a start and an end, their preview and per-variant result (handoff 227).
export * from "./endpoints/priceSchedules";
// Price history of a variant, and the storefront's lowest price of the last 30 days (handoff 234).
export * from "./endpoints/priceHistory";
// Product specifications: the store's keys, a product's values, storefront specs, filters and comparison (handoff 231).
export * from "./endpoints/productSpecs";
// Frequently bought together: the settings, exclusions and what a product is bought with (handoff 223).
export * from "./endpoints/boughtTogether";
// Storefront search: what shoppers searched and opened, synonyms, the search's id and click report (handoff 211).
export * from "./endpoints/searchInsights";
// Scheduled summary reports: the daily / weekly email, who gets it, its preview and a test send (handoff 202).
export * from "./endpoints/scheduledReports";
// Licence code pool alerts: when to warn that codes run low, and the orders waiting for codes (handoff 213).
export * from "./endpoints/digitalCodeAlerts";
// Multiple stock locations: locations, stock per location, receive / write off, transfers, where an order ships from (handoff 206).
export * from "./endpoints/stockLocations";
// Suppliers, purchase orders (order, receive, cost) and stock counts (handoff 207).
export * from "./endpoints/purchasing";
// Stock forecast: days of stock left, what to reorder, a draft purchase order from the suggestions (handoff 224).
export * from "./endpoints/stockForecast";
// Stock lots with expiry dates: receive, edit, write off, the expiry warning (handoff 230).
export * from "./endpoints/stockLots";
// Bulk stock and price update from a sheet: preview, apply once, the row problems (handoff 243, 295, 297).
export * from "./endpoints/catalogSheetUpdate";
// Picking and packing: pick list, packing slips, scan to pack (orders/pickList.js, packingSlips.js, scanToPack.js; handoff 226, 244, 249).
export * from "./endpoints/orderPacking";
// Shopper self-service on orders: the store's setting, cancel and change the address from the tracking / account page (handoff 220, 287).
export * from "./endpoints/orderSelfService";
// Delivery date and time slots: the weekly slots, the delivery schedule, moving an order, the checkout's days and slots (handoff 221).
export * from "./endpoints/deliverySlots";
// Holiday mode: pause orders or take them and ship later; the storefront's holiday and the checkout's 423 (handoff 216).
export * from "./endpoints/holidayMode";
// Click and collect: pickup places, the pickups queue (ready, hand over by code), the shopper's place choice and code (handoff 225).
export * from "./endpoints/clickAndCollect";
// Store reports: tax, stock value, slow stock, discount results, order times, sales by collection / option, returns, cart offers (storeReports/, handoff 238–242, 245–247, 256, 293).
export * from "./endpoints/storeReports";
// Cart offers: "add X for 20% off" rules, and the cart's offers and locked offers (cartOffers/, handoff 253).
export * from "./endpoints/cartOffers";
// Spin to win: the wheel's settings, preview and stats, the storefront's wheel and spin (spinWheel/, handoff 258).
export * from "./endpoints/spinWheel";
// Website publish history: the published versions of a site, and putting an older one live again (pages/pagesRoutes.js).
export * from "./endpoints/websiteRevisions";
// Team channels: the store's Telegram / Slack / Discord channels for alerts, their test message and recent messages (handoff 378).
export * from "./endpoints/teamChannels";
// "Create on WhatsApp": a ready-made automation's templates submitted to the store's WhatsApp account, and their review status (handoff 391).
export * from "./endpoints/automationWhatsappSubmit";
// The store's email suppression list: addresses that bounced or complained, and lifting one (handoff 386).
export * from "./endpoints/emailSuppressions";
// Order emails per language: the language tabs, a language's own version, removing it (handoff 383).
export * from "./endpoints/orderEmailLocales";
// "Notify me in this browser" for a sold-out variant: the back-in-stock sign-up by web push (handoff 392).
export * from "./endpoints/stockAlertPush";
// Platform console: suspend / unsuspend / delete an account, its notifications, and marketing-site traffic (handoff 337–339).
export * from "./endpoints/adminUserModeration";
export * from "./endpoints/adminNotifications";
export * from "./endpoints/siteTraffic";
// Checkout consent boxes, deposit decided at checkout, funnel refusals, the confirmation link (handoff 348–388).
export * from "./endpoints/checkoutHardening";
// The account's own sign-in details, its team invitations and store offers (handoff 330-332, 358, 379).
export * from "./endpoints/accountAccess";
// Split parcels, restock of an undelivered parcel, tracking provider; returns: exchanges, pickups, cancel (handoff 351-396).
export * from "./endpoints/parcels";
export * from "./endpoints/returnHandling";
// The store's ZIMOS subscription: plans, transfer proofs, prepaid balance; the console's side of them (handoff 333-336, 394, 397).
export * from "./endpoints/merchantBilling";
export * from "./endpoints/adminBilling";
// Trash for funnels, websites and pages; stock movement history; the starter template gallery; order conditions on funnel paths; sold-out products in listings; upload size limits (handoff 373, 389, 401, 376, 390, 400).
export * from "./endpoints/trash";
export * from "./endpoints/stockMovements";
export * from "./endpoints/starterTemplates";
export * from "./endpoints/funnelEdgeWhen";
export * from "./endpoints/soldOutListing";
export * from "./endpoints/uploadLimits";
