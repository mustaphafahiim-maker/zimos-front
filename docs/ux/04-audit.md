# ZIMOS UX redesign, part 4: heuristic audit of the current UI

## Method

**What was audited.** The merchant dashboard as it stands on branch
`ux-redesign` at commit `dc297fb` ("Calm family tokens and a phone-first
shell"). That commit landed while this audit was running. It made Arabic the
default language, reordered the side menu, added the phone tab bar and retired
the glass blur, so every changed file was read again after it landed. The
storefront checkout and the platform-admin console were also checked, more
briefly. One caveat: `pages/DashboardHomePage.tsx` was being rewritten in the
working tree (uncommitted) while this audit was written. Rows that cite it
(U-04, U-25, U-26, U-27, U-28) refer to the committed version and should be
checked again against the new home page.

**For whom.** The audit takes the view of an Arabic-speaking Egyptian
cash-on-delivery merchant working mostly on a phone (RTL, 390 px). It also
considers that merchant's confirmation agents and, for the checkout, Arabic
shoppers.

**How.** Each heuristic was checked by reading the code. Nothing was run. The
files read:

- The shell: `DashboardLayout`, `MobileTabBar`, `lib/navigation.ts`,
  `CommandPalette`, `KeyboardShortcuts`, `SidebarShortcuts` and `NotificationsBell`.
- The main merchant screens: home (`DashboardHomePage`, `pages/home/*`), the
  orders list, order page and manual order, the confirmation queue, catalog
  (list and product form), auth/onboarding (login, register, choose plan,
  store picker), `SettingsPage` and store settings, shipping, and profit/analytics.
- The shared building blocks: `DataState`, `EmptyState`, `DataTable`, `Field`,
  `Modal`, `ConfirmDialog`, `Toast`, `FilterTabs`, `Select`, `StatusBadge`,
  `lib/errors.ts`, `lib/errorMessages.ts`, `lib/format.ts`, `index.css` and the
  shared `packages/ui` primitives.

Repository-wide grep sweeps then counted how widespread each pattern is:

- physical `ml-/mr-/pl-/pr-/left-/right-/text-left/text-right` classes, and
  `←`/`→` glyphs
- hard-coded English
- callers of the English-only `getErrorMessage`
- `ConfirmDialog` calls with no translated labels
- `StatusBadge` calls with no translated `text`
- `Modal` calls with no footer
- `tel:` links
- unsaved-change guards (`beforeunload`/`useBlocker`)
- `EmptyState` and `DataState` use
- fixed-width tables.

**Limits.**

- The audit did not open a browser, use a device, measure contrast or watch real users.
- The backend is not in this repository. Two facts in the code establish that
  server error text is English: the header comment of `lib/errorMessages.ts`
  (lines 17–19) calls it "the server's English text", and the API client sends
  no `Accept-Language`. Findings that show server text are therefore marked
  Verified.

**Severity** follows Nielsen's scale:

| Score | Meaning |
|---|---|
| 4 | Catastrophe: fix before release |
| 3 | Major: high priority |
| 2 | Minor: low priority |
| 1 | Cosmetic: fix if time allows |

**Basis:**

- **Verified** means the condition is visible in the code at the cited lines.
- **Inferred** means the condition depends on runtime layout, data or
  behaviour that code reading cannot confirm.

**Path prefixes** used below:

| Prefix | Expands to |
|---|---|
| `md/` | `apps/merchant-dashboard/src/` |
| `sf/` | `apps/storefront/src/` |
| `pa/` | `apps/platform-admin/src/` |
| `ui/` | `packages/ui/src/components/` |
| `api/` | `packages/api-client/src/` |

**Already fixed by S1, so left out:**

- The English default language. Before S1 this was the one catastrophe (4): an
  Arabic merchant met an English sign-up.
- The cost of the glass blur on low-end phones.
- Monospace upper-case group headings in the sidebar.
- The two different Arabic words for orders inside the side menu itself.

**Totals.** 68 issues: no 4, 21 rated 3, 37 rated 2, 10 rated 1. Of these, 62
are Verified and 6 Inferred.

## Ranked issues

| ID | Sev | Heuristic | Location | Problem | Recommendation | Basis |
|---|---|---|---|---|---|---|
| U-01 | 3 | H9 | `md/lib/errors.ts:11-25`; `md/components/ConfirmDialog.tsx:42`; `md/pages/settings/SettingsPage.tsx:271,301,467,476`; `md/pages/shipping/ShippingTaxPage.tsx:366,376,801,1005,1245,1368` (28 files in all) | `getErrorMessage` is English-only. Its fallbacks ("Something went wrong…", "Can't reach the server…") are hard-coded English, and otherwise it returns the server's English sentence. It backs `ConfirmDialog`, which ~50 destructive and confirming dialogs use, as well as the settings, shipping, payments, website and media pages. Arabic merchants get English errors exactly when something fails. | Delete `getErrorMessage` from UI code. Route every caller (start with `ConfirmDialog`) through `useErrorMessage()`, which already maps 100+ codes into both languages. Add a lint rule banning the import in `pages/` and `components/`. | Verified |
| U-02 | 3 | H9 | `md/pages/LoginPage.tsx:129,153`; `md/pages/RegisterPage.tsx:209`; `md/pages/ForgotPasswordPage.tsx:52`; `md/pages/ResetPasswordPage.tsx:100`; `md/pages/VerifyEmailPage.tsx:71`; `md/components/TwoFactorStep.tsx:91`; `md/lib/errorMessages.ts:286,317,319`; `md/lib/errors.ts:33-53` | Server text is shown word for word. This happens in every sign-in/sign-up error except "wrong password", for any error code `errorMessages.ts` does not know, and in all field-level 422 messages (`getFieldErrors`, 43 call sites, e.g. Joi's `"name" is required`). `errors.ts:37` adds a hard-coded English SKU message. No `Accept-Language` is sent (`api/client.ts`), so the server cannot localise. | Map auth error codes in `useErrorMessage`. For an unknown code, show the translated generic sentence plus a support reference, not the server sentence. Map field errors by `field` and `type` to translated text (e.g. required, too long, invalid phone). Send the dashboard locale as `Accept-Language` so the backend can localise later. | Verified |
| U-03 | 3 | H9 | `sf/lib/placeOrder.ts:142-143`; `sf/app/store/[workspaceId]/checkout/page.tsx:271` | At checkout, any error other than the three known codes shows the server's raw message to the shopper. That includes stock, coupon and rate-limit errors. Arabic shoppers can get English text at the moment of purchase. | Give the storefront its own code→sentence map (stock gone, coupon invalid or expired, too many attempts, store closed) in `i18n.ts`, with a translated generic fallback. Never show `err.message`. | Verified |
| U-04 | 3 | H2 | `md/components/StatusBadge.tsx:79`; `md/lib/format.ts:96,107,110-130`; `md/pages/DashboardHomePage.tsx:299` (HEAD); `md/pages/settlements/SettlementsPage.tsx:518,590,651`; `md/pages/confirmation/ConfirmationQueuePage.tsx:612` | `StatusBadge` falls back to `humanize()`, which produces English ("Pending", "Partially paid"). The home page's recent orders, settlements and statements render that fallback. `formatAddress` says "No shipping address" and `variantLabel` says "Variant 1a2b…" in English. The confirmation agent sees the English address fallback. | Make `text` required on `StatusBadge`, or have it resolve labels through `useOrderLabels`. Move `humanize`, `formatAddress` and `variantLabel` behind `useT` with Arabic copy. | Verified |
| U-05 | 3 | H2 | `md/components/ConfirmDialog.tsx:25-27`; `md/pages/settlements/SettlementsPage.tsx:688,708`; `md/pages/funnels/FunnelsPage.tsx:489`; `md/pages/media/MediaLibraryPage.tsx:256`; `md/pages/website/editor/WebsiteEditorPage.tsx` (4 dialogs); `md/pages/storeDesign/DomainsTab.tsx`; `md/pages/orders/components/ManualTransfersCard.tsx`, `SavedMethodsCard.tsx` | `ConfirmDialog` defaults its button labels to English "Confirm", "Cancel" and "Working…". Seventeen dialogs in 12 files leave out `cancelLabel`, and 13 leave out `busyLabel`. Destructive dialogs ("Delete settlement", "Delete image", "Delete funnel") therefore show an English Cancel button beside an Arabic delete button. An Arabic-only reader cannot tell which button is the safe one. | Take the defaults from `useT` inside `ConfirmDialog`, with Arabic "إلغاء", "تأكيد" and "جارٍ التنفيذ…". Then remove the per-caller copies. | Verified |
| U-06 | 3 | H7 | `md/components/DataTable.tsx:39`; `md/pages/catalog/CatalogProductsPage.tsx:130-136,381`; `md/pages/abandoned/LostOrdersPage.tsx:650`; `md/pages/settings/SettingsPage.tsx:507,581`; `md/pages/shipping/ShippingTaxPage.tsx:497,696`; `md/components/MobileTabBar.tsx:77` | On a phone, nearly every list is a desktop table that scrolls sideways. `DataTable` defaults to a 768 px minimum width (17 pages), and 38 more tables fix a width of 560–820 px. Only the orders list has a phone card layout. The new tab bar makes Products one of four primary phone tabs, yet that tab opens an 820 px, 8-column table with up to 4 action buttons per row. The default view is "list" even on a phone. | Give `DataTable` a built-in phone rendering: below `md`, rows become cards with a primary line, a secondary line and a status. Pages declare which columns are primary. Default the catalog to grid or cards under `md`. Start with Products, Lost orders, Customers and Settlements. | Verified |
| U-07 | 3 | H7 | `md/pages/orders/OrdersListPage.tsx:677-717` vs `724-759`; `md/pages/catalog/CatalogProductsPage.tsx:443-489` (comment at 178) | Bulk actions cannot be reached on a phone. Order cards have no checkbox, because selection exists only in the `md+` table. The same goes for "ship with a courier", "change status", tags and archive. The product grid also has no selection. Merchants who ship from a phone must open orders one by one. | Add a selection mode on phone cards (long-press, or a "Select" toggle in the header) and a sticky bottom action bar placed above the tab bar. Reuse `OrderBulkBar`. | Verified |
| U-08 | 3 | H7 | `md/pages/orders/components/OrderSummary.tsx:249`; `md/pages/orders/OrdersListPage.tsx:691-698` | On the order page and the orders list, the customer's phone is plain text, with no `tel:` link anywhere in `pages/orders`. On the list card the number sits inside the card's link, so tapping it opens the order. Calling the customer is the core COD job, and only the confirmation queue (`ConfirmationQueuePage.tsx:603`) and Lost orders offer a tap-to-call. | Make the phone (and the alternate phone) a `tel:` link with a call button and a WhatsApp button on the order page's customer card. Add a call icon button on each phone order card that stops the card link from firing. | Verified |
| U-09 | 3 | H2 | `md/pages/orders/OrdersListPage.tsx:65,107,486-495,520-522` | The order date filter and its Today / Last 7 / Last 30 shortcuts work in UTC (`toISOString().slice(0,10)`). The page itself warns that "Cairo is 2–3 hours ahead". Orders placed between 00:00 and 03:00 Cairo time therefore count as yesterday's, and during those hours "Today" picks the wrong date. Daily counts will not match what the merchant and the courier see. | Compute the shortcut dates in the store's time zone, and send `from`/`to` as local-day bounds, or a `tz` the API applies. Then remove the UTC warning text, which a merchant should never need to read. | Verified |
| U-10 | 3 | H8 | `md/pages/orders/OrderDetailPage.tsx:87-153`; `md/pages/orders/components/OrderSummary.tsx:243-255` | The order page is a single column of about 15 sections under two separate action areas (the header has the status changer and arrows; a second row has 6 buttons). On a phone, the customer's name, phone and address sit below the badges, the actions, the confirmation panel and the item list. Nothing stays visible while scrolling. | Put a phone-first summary at the top: customer, phone with call and WhatsApp, governorate, total to collect, stage, and the one next action. Move fraud, attribution, session, supplier and webhook details into collapsible secondary sections. Merge the two action areas into one primary action plus a "More" menu. | Verified |
| U-11 | 3 | H8 | `md/pages/orders/OrdersListPage.tsx:271-309,418-529,590-597`; `md/pages/orders/components/OrdersHeaderTools.tsx:16-21`; `md/pages/orders/components/OrderDocuments.tsx:192-200` | Before the first order card a phone must show, in order: 6 header buttons (Refresh, Board, Manifest, Sync, Export, Create order); search with a 2-line hint; two date inputs, 3 shortcuts and a UTC note; the filter bar; sort; the risk filter; and 11 stage tabs. This is likely 1.5–2 screens of controls before any data. | On a phone keep only search, stage tabs and one "Filters" sheet that holds dates, sort, risk and the extra filters, with a count of the filters in use. Move Refresh, Board, Manifest, Sync and Export into an overflow menu, and make Create order a floating or header primary button. | Inferred |
| U-12 | 3 | H4 | `md/lib/navigation.ts:173,214`; `md/components/DashboardLayout.tsx:251`; `md/pages/settings/SettingsPage.tsx:195-218`; `md/pages/storeDesign/StoreDesignPage.tsx:23`; `md/pages/storeDesign/GeneralTab.tsx:24-27` | Store configuration is split between "Settings", "Store settings" and the account menu's "Settings". The split has no rule a merchant can follow: store name, logo and colours are in Settings, while the favicon and country are in Store settings → General. Settings also mixes personal items (account, language, notifications) with store items (address, emails, billing, team, developers) in 15 sections on one long page with no section navigation. | Use two clearly named places: "حسابي" (personal) and "إعدادات المتجر" (store). Store settings should be one hub with grouped tabs (identity, checkout, policies, domains, team, billing, integrations) and anchor navigation. Merge the store profile into its identity tab. | Verified |
| U-13 | 3 | H4 | `md/pages/home/SetupGuideCard.tsx:61`; `md/pages/storeDesign/StoreDesignPage.tsx:23,88` | The setup guide's "Connect your own domain" step links to `/settings`, which has no domain section. Domains live at `/store-settings/domains`, so a new merchant following the guide hits a dead end. | Point the step to `/store-settings/domains`. Add a check that every `STEP_LINK` resolves to a route that renders the matching feature. | Verified |
| U-14 | 3 | H3 | `md/components/Modal.tsx:15-22,29,31-44`; `md/components/KeyboardShortcuts.tsx:164`; compare `pa/components/Modal.tsx:47-54` | `Modal` has four problems. A tap on the dimmed backdrop closes it and throws away what was typed. Phone users tap outside fields to hide the keyboard, so long forms such as status change, edit items, bulk ship, export and variants are easy to lose. It has no close (X) button (68 of 89 usages pass no footer). It does not trap focus, does not focus the first field on open, and does not return focus on close. It is named with `aria-label` instead of being labelled by its heading. The platform-admin modal does have an X. | Base `Modal` on the Base UI `Dialog` already in `@store-builder/ui`. Add a translated, logically positioned close button. Make the backdrop close only when the form is clean, and otherwise ask "Discard changes?". Keep Escape. | Verified |
| U-15 | 3 | H5 | `md/pages/catalog/ProductEditPage.tsx:102-139`; `md/pages/storeDesign/StoreDesignPage.tsx:63-88`; `md/pages/storeDesign/useSettingsEditor.ts:37`; `md/pages/settings/SettingsPage.tsx:195-218` | Only the funnel and website editors guard unsaved changes (`beforeunload`/blocker). The product page has about 13 sections, each saved separately. Store-settings tabs keep a `dirty` flag, but switching tabs unmounts the draft without warning. Settings has 15 separate forms. Leaving through the menu, the tab bar, a single-key shortcut (U-54) or the browser back button silently drops the edits. | Add a shared `useUnsavedChanges(dirty)` hook (router blocker plus `beforeunload`) and use it in every form that tracks `dirty`. On the product page, show one sticky "You have unsaved changes · Save" bar. | Verified |
| U-16 | 3 | H9 | `md/lib/apiClient.ts:10-15`; `md/pages/LoginPage.tsx:95`; `md/lib/errorMessages.ts:31` | When the session expires the app does a hard `window.location.href = "/login"`. No message is shown, so the translated "Your session has ended" copy is never used. Unsaved input is lost. Because no `state.from` is set, the merchant lands on Home after signing in, not on the order they were handling. | Keep the user on the page and show a translated sign-in dialog, or at least redirect with `?next=` and show the "session ended" message on the login screen. Keep in-progress form drafts locally. | Verified |
| U-17 | 3 | H9 | `md/pages/catalog/components/ProductDetailsForm.tsx:216-221,473`; `md/components/Field.tsx:27-29`; `md/pages/ChoosePlanPage.tsx:113-117,148` | Validation errors are drawn but not brought into view. On a phone, tapping "Create product" at the bottom of the form sets errors on the name and description at the top and nothing moves, so it looks as if nothing happened. `Field` does not link the error or hint to the input with `aria-describedby`. Choose Plan shows its error above the plans while the button is below. The storefront checkout already does this right: it focuses the first invalid field (`sf/.../checkout/page.tsx:191,269`). | Copy the checkout pattern into the dashboard: a summary line next to the submit button ("3 fields need attention"), then focus and scroll to the first invalid field. Have `Field` pass `aria-describedby` for the hint and error ids. | Verified |
| U-18 | 3 | H1 | `sf/app/store/[workspaceId]/checkout/page.tsx:375-416,437,445,456`; `sf/lib/i18n.ts:353,357,360` | At checkout the discount code is accepted without any check ("will be applied when your order is confirmed"). The total is labelled "Estimated total" and "final amounts are confirmed on the call". The shopper does not know whether the code works or what they will pay in cash. An invalid code only fails when the order is placed (and see U-03). | Add a public check-code endpoint, or price the cart server-side with the code. Show the discount line and the exact amount to pay on delivery. Keep "estimated" only for the parts that really are (for example a courier quote). | Verified |
| U-19 | 3 | H2 | `md/pages/shipping/ShippingTaxPage.tsx:43-44,416-470`; `md/pages/shipping/ShippingSettingsSection.tsx:25`; `md/pages/shipping/ShippingProfilesSection.tsx:29`; `md/pages/shipping/WeightTiersSection.tsx:30` | The "Shipping prices" tab stacks four pricing mechanisms that overlap: governorate prices, shipping groups, weight tiers, and zones with rates. Nothing explains which one wins. The page description mentions only "zones and their rates". An Egyptian COD merchant thinks "price per governorate". | Lead with governorate prices as the main model. Move groups, weight tiers and legacy zones under "Advanced", each with a line saying when it applies and an order-of-precedence note. Rename the page to match the nav ("Shipping"). | Verified |
| U-20 | 3 | H4 | `md/pages/home/StoreOverview.tsx:51,165`; `md/pages/profit/RealProfitPage.tsx:25,34` | There are two "Net profit" numbers. The home tile means "delivered orders after product cost and refunds". Its link opens `/profit` ("Real profit"), where net profit also takes off both shipping legs, fees and ads. The same label shows different amounts one tap apart, which erodes trust in every money figure. | Use one definition and one source (the P&L). If the home page keeps a lighter number, give it a different name ("Gross profit" or "ربح المنتجات"), with the same definition on both screens. | Verified |
| U-21 | 3 | H3 | `md/lib/useTeammateLocale.ts:19-27`; `md/i18n/LocaleContext.tsx:41-49` | The language only goes from browser to server. On a new phone or browser the local default (now "ar") is pushed to the profile and overwrites a teammate's saved choice. A teammate who chose English starts getting Arabic push, email and WhatsApp alerts, and the dashboard never adopts the saved profile language. | When no local choice exists, read `profileLocaleOf(user)` after login and apply it. Only push to the server when the user actually changes the switch. | Verified |
| U-22 | 2 | H8 | `md/lib/navigation.ts:120-220` | The side menu (and the phone "More" drawer) has 39 entries in 10 groups, including 6 analytics-type pages (Reports, Live now, Store traffic, Sales sources, Profit, Ad spend). Pinned shortcuts are added above them. For a daily COD merchant most entries are noise. | Cut the default menu to the daily jobs (about 12 entries) and move the rest to "More" or the command palette. Combine the analytics pages into one Reports page with tabs. Use role-based defaults. | Verified |
| U-23 | 2 | H4 | `md/lib/navigation.ts:253,256,262,294,297,303`; `md/pages/confirmation/ConfirmationQueuePage.tsx:55,155`; `md/pages/abandoned/LostOrdersPage.tsx:60,142`; `md/pages/shipping/ShippingTaxPage.tsx:43,161`; `md/components/MobileTabBar.tsx:23` | After the S1 renaming, the breadcrumb and the page H1 disagree on the same screen. Menu "تأكيد الأوردرات" (tab bar "التأكيد") opens a page titled "قائمة التأكيد". "الأوردرات المفقودة" opens "الطلبات المفقودة". "Shipping"/"الشحن" opens "Shipping & Tax"/"الشحن والضرائب". | Make each page title read its label from `NAV_LABELS`, or update the page titles. Add a check that each routed page's H1 key equals its nav key. | Verified |
| U-24 | 2 | H4 | `md/pages/DashboardHomePage.tsx:77,96` (HEAD); `md/pages/home/QuickActions.tsx:22`; `md/pages/home/StoreOverview.tsx:93`; `md/components/CommandPalette.tsx:44`; `md/components/KeyboardShortcuts.tsx:43,46`; `md/pages/orders/components/OrderActions.tsx:96` | S1 chose "أوردر" for orders, but the menu and the orders pages now say "الأوردرات" while home, quick actions, the command palette, shortcuts and order toasts still say "الطلبات" / "طلب جديد". The order-cancel flow mixes both words in one dialog. | Do one pass over every Arabic string with the chosen term. Add a glossary to `docs/ux/06-design-system.md` and a grep check in review. | Verified |
| U-25 | 2 | H4 | `md/pages/orders/orderLabels.ts:24,89`; `md/pages/confirmation/ConfirmationQueuePage.tsx:58,158`; `md/pages/DashboardHomePage.tsx:33,72,147` (HEAD); `md/components/MobileTabBar.tsx:50` | One state has three names: the `pending_confirmation` stage is "New/جديد" in orders, "Pending/بالانتظار" in the queue and "Awaiting confirmation/بانتظار التأكيد" on home. The "waiting" count also differs: the tab bar badge counts `pending` only, while home counts `pending + inProgress`. | Name it once ("بانتظار التأكيد"). Pick one count rule for "waiting for a call" and share it in a single helper. | Verified |
| U-26 | 2 | H8 | `md/pages/home/QuickActions.tsx:36-45,62`; `md/pages/home/StoreOverview.tsx:162-180,274` (HEAD) | On a phone, home shows 8 shortcut tiles (4 rows in 2 columns), then 17 KPI tiles (9 rows), then funnel, offers, sources, governorates, devices, products and funnel panels. The answers a merchant opens the app for (what needs me now, today's sales, cash to collect) are below the fold. | Lead with 3–4 "needs you now" items (calls waiting, follow-ups, failed deliveries, unpaid COD). Fold the KPI grid into a short "today vs yesterday" strip and move the rest to Reports. (A rewrite is in progress in the working tree.) | Inferred |
| U-27 | 2 | H4 | `md/pages/home/StoreOverview.tsx:175`; `md/App.tsx:155,219` | The home KPI tile "Lost orders" links to `/abandoned`. No such route exists (the real one is `/abandoned-carts`), so it opens the 404 page. | Fix the link and derive KPI links from `NAV_ITEMS` instead of string literals. | Verified |
| U-28 | 2 | H3 | `md/pages/DashboardHomePage.tsx:199-204,252` (HEAD); `md/pages/home/SetupGuideCard.tsx:87-97,107` | The setup guide only renders inside the analytics branch of home. Roles without analytics never see it, and it disappears whenever the summary request fails. Hiding it with the 24 px "×" is permanent, stored per store in `localStorage`, and nothing brings it back. | Render the guide independently of analytics for owners and managers. Replace "×" with "Hide for now", and add a "Setup guide" entry in Settings or Help to reopen it. | Verified |
| U-29 | 2 | H4 | `md/pages/catalog/components/ProductDetailsForm.tsx:193-198`; `md/pages/home/SetupGuideCard.tsx:19,40` | The guide promises "a name, a price and a photo are enough to start", but creating a product also requires a description. The first-product flow contradicts the coaching that leads into it. | Make the description optional at creation, or default it to the name. Otherwise update the guide copy. | Verified |
| U-30 | 2 | H2 | `md/pages/confirmation/ConfirmationQueuePage.tsx:76,176,742,917` | "Claim & call / استلام واتصال" only claims the task and does not start a call. The agent then has to find and tap the number separately. | Have the button claim and then open `tel:` (on touch devices), or rename it "استلام" and put a large Call button beside it once the task is claimed. | Verified |
| U-31 | 2 | H7 | `md/pages/confirmation/ConfirmationQueuePage.tsx:765-767,773,862-907` | The outcome flow is slow for the most common cases. "Postponed" cannot carry a callback time (the payload has only outcome, channel and notes), although "call me tomorrow at 5" is routine. After saving, the agent must scroll to the next card and claim it again, because there is no "next order". Each outcome takes two taps: select, then Save. | Add a quick callback picker for Postponed (in 1 hour, tonight, tomorrow, or a custom time). Add "Save and next", which claims the next pending task. Allow one-tap outcomes when no reason is needed. | Verified |
| U-32 | 2 | H1 | `md/pages/confirmation/ConfirmationQueuePage.tsx:776-783,852-860` | The 15-minute claim expires silently. When it does, the outcome form is swapped for "Claim again", and there is no warning a few minutes before. | Show a countdown and warn at 2 minutes with "Extend". Keep the form visible after expiry and claim again automatically on Save when the task is still free. | Verified |
| U-33 | 2 | H9 | `md/components/CommandPalette.tsx:34,129-133,247,312-317` | Command palette (⌘K) search failures look like "Nothing matches '…'", so a network error reads as an empty result. On touch there is no visible close: the `close` string exists but is unused, and the footer advertises an "Esc" key phones do not have. | Show a translated "Search failed, retry" state. Add a close button (Cancel on phones). Hide the keyboard hints on coarse pointers. | Verified |
| U-34 | 2 | H7 | `md/components/CommandPalette.tsx:143-144,156` | Palette page and action matching is a plain `toLowerCase().includes()` with no Arabic normalisation. Typing "اعدادات" does not find "الإعدادات", and ة/ه, ى/ي and أ/إ/ا are not folded. | Normalise both sides (strip diacritics and tatweel, fold alef, ya and ta-marbuta), as the orders search already does on the server. | Verified |
| U-35 | 2 | H6 | `md/pages/orders/OrdersListPage.tsx:57,99`; `api/types.ts:1657-1661` | Order search only matches a phone when 10 or more digits are typed. Merchants have to recall the full number instead of typing the last digits they see on a waybill or a WhatsApp chat. | Support a suffix match from 4 digits up, and say so in the hint. | Verified |
| U-36 | 2 | H5 | `md/components/DashboardLayout.tsx:444,461`; `md/components/NotificationsBell.tsx:163`; `md/components/SidebarShortcuts.tsx:98`; `md/pages/home/SetupGuideCard.tsx:107`; `md/pages/catalog/CatalogProductsPage.tsx:314,325`; `md/components/CommandPalette.tsx:236`; `md/pages/orders/OrdersListPage.tsx:727,755` | Shell and list touch targets are below 44 px: drawer close 24 px, hamburger and bell 36 px, pin 22 px, guide "×" 24 px, list/grid toggle 28 px, search trigger 36 px, row checkboxes 16 px. This invites mis-taps on phones and breaks `UI_RULES.md` §8. | Give every icon button a minimum of `size-11` (with the icon kept at 18–20 px), and wrap checkboxes in 44 px labels. | Verified |
| U-37 | 2 | H5 | `ui/button.tsx:29,31`; `ui/input.tsx:11`; `md/index.css:536-549`; `md/components/FilterTabs.tsx:47`; `md/components/Select.tsx:10` | The base control heights are 32–40 px: Button default 36, `sm` 32; Input 36; Select 40; FilterTabs about 36. CSS lifts them only inside `<main>` (to 40 px, or 36 for groups), and pages patch `min-h-11` one at a time. | Set 44 px on coarse pointers in the shared primitives (`@media (pointer: coarse)`), and drop the ad-hoc `min-h-11`. | Verified |
| U-38 | 2 | H4 | `md/components/PageHeader.tsx:28`; `md/pages/courses/CoursesPage.tsx:304`; `md/pages/funnels/FunnelEditorPage.tsx:563`; `md/pages/funnels/FunnelStepPageEditor.tsx:309`; `md/pages/ForgotPasswordPage.tsx:27`; `md/pages/ResetPasswordPage.tsx:47`; `md/pages/VerifyEmailPage.tsx:29`; `md/pages/AuthCallbackPage.tsx:19` | Back links use a hard-coded "←". In RTL that arrow points forward, which is wrong on every detail page header (order, product) and on the auth screens. Otherwise RTL discipline is good: the only physical class in the dashboard is decorative (`BrandPanel.tsx:60`). | Use an arrow or chevron icon that flips in RTL inside `PageHeader`, as the storefront back-to-cart link does (`sf/app/store/[workspaceId]/checkout/page.tsx:284`), and remove the glyph from strings. | Verified |
| U-39 | 2 | H2 | `md/pages/website/editor/NewPageDialog.tsx:12-18,99-140`; `md/components/ThemeToggle.tsx:108`; `md/components/DashboardLayout.tsx:405`; `md/lib/format.ts:96,107`; `md/lib/errors.ts:37` | Some UI text is not translated. The "New page" dialog in the website editor is entirely English (title, labels, hints, page types, buttons). The theme toggle labels, the tab title "— Dashboard" and two formatter fallbacks are also English. | Move them into `useT` with Arabic copy. Add a lint rule for JSX string literals and `title`/`label`/`placeholder` literals. | Verified |
| U-40 | 2 | H4 | `md/components/DataState.tsx:17`; `md/components/StoreAddressField.tsx:25-26`; `md/components/MobileTabBar.tsx:26`; `md/lib/navigation.ts:353-354` vs `md/pages/DashboardHomePage.tsx:72` (HEAD) | The Arabic voice switches between formal MSA ("ليست لديك صلاحية لعرض هذا") and Egyptian colloquial ("ده العنوان اللي عملاءك هيفتحوه", "مستنيين مكالمة", "الفلوس"), sometimes on the same screen. | Choose one register (a light Egyptian tone fits the persona). Write it into the design-system doc and revise the strings in one pass. | Verified |
| U-41 | 2 | H4 | `md/lib/format.ts:15,43,71,78`; `md/components/MobileTabBar.tsx:132`; `md/pages/home/QuickActions.tsx:77`; `md/components/CommandPalette.tsx:187` | `Intl` with `ar-EG` renders money, dates and percentages in Arabic-Indic digits (٣٤٥), while counts injected with `String()`/`fmt`, order numbers and phones stay Latin (345). One screen can mix both digit systems. | Choose one system per locale (Latin digits via `numberingSystem: "latn"` is common in Egyptian commerce apps) and route every number through one formatter. | Inferred |
| U-42 | 2 | H2 | `md/lib/navigation.ts:256,297`; `md/pages/home/StoreOverview.tsx:39,100`; `md/pages/abandoned/LostOrdersPage.tsx:60,142` | In a COD business "lost orders / الأوردرات المفقودة" sounds like parcels the courier lost, but the page lists abandoned or refused checkouts. Home also uses a third variant, "طلبات ضائعة". | Rename to what the merchant sees, e.g. "سلات متروكة" or "طلبات لم تكتمل", with a one-line description on the page, and use one term everywhere. | Verified |
| U-43 | 2 | H10 | `md/components/DataState.tsx:76-80`; `md/pages/catalog/CatalogProductsPage.tsx:47,340-346`; `md/pages/orders/OrdersListPage.tsx:81,340-346` | `DataState` shows an empty list as a grey sentence ("No products yet. Create your first one.") with no button, icon or help. The richer `EmptyState`, which has an action slot, is used on 37 of the 103 pages that use `DataState`. | Let `DataState` take an `emptyAction` (or render `EmptyState`) and give the key lists a primary action and a "learn how" link (Products → Add product, Orders → Share store link). | Verified |
| U-44 | 2 | H5 | `md/lib/navigation.ts:160,163,190-193`; `md/components/DataState.tsx:17,64` | Only analytics, profit and ads entries are hidden by role. Every other page appears in the menu and then refuses with a generic "Ask an owner to update your role" that does not name the missing permission. Custom roles hit dead ends. | Hide entries the role cannot open, using the permission map the backend already enforces. Make the refusal name the permission and the owner. | Verified |
| U-45 | 2 | H1 | `md/components/Toast.tsx:33,50-64` | Toasts disappear after 4 s (success) or 7 s (error). Two-sentence Arabic errors may vanish before they are read. Success and error differ only in colour, with no icon. There is no visible close; a tap anywhere dismisses. | Keep error toasts until dismissed, or show the error inline instead. Add a status icon and a close button. | Verified |
| U-46 | 2 | H10 | `md/pages/home/StoreOverview.tsx:434,446-457`; `md/pages/home/QuickActions.tsx:76`; `md/pages/catalog/CatalogProductsPage.tsx:426,474` | Definitions live in `title` tooltips, which touch devices never show. Examples: "Confirmed ÷ COD orders", what "no weight" means, the waiting count. On KPI tiles the hint is hidden whenever a delta is shown. | Show definitions in an info popover that opens on tap, or as a visible caption, and keep the hint line under the delta. | Verified |
| U-47 | 2 | H10 | `md/pages/settings/WhatsappSection.tsx:27-33,86-120` | WhatsApp Cloud API setup expects merchants to work in the Meta developer console (System users, permanent token scopes, App Secret, webhook verify token and subscriptions), much of it in English product terms. Most COD merchants cannot finish this alone. | Provide a guided connect flow (Embedded Signup when available). Otherwise use step-by-step screenshots, a "test connection" check after each step, and an offer of assisted setup through support. | Verified |
| U-48 | 2 | H2 | `md/lib/storeAddress.ts:41-47`; `md/pages/WorkspacePickerPage.tsx:126,178` | When a store is created, its address is suggested from the store name with non-Latin characters stripped, so an Arabic name such as "متجر نور" suggests nothing. Create stays disabled until the merchant invents a Latin address. | Transliterate Arabic names (or suggest "store-1234" plus the names of the merchant's other stores) and explain why the address is Latin. | Verified |
| U-49 | 2 | H3 | `md/pages/ChoosePlanPage.tsx:103-153` | The Choose Plan step, which Google sign-ups must pass, has no way out: no sign out and no back. The next step (store picker) does offer "Sign out" (`WorkspacePickerPage.tsx:22,193`). | Add "Sign out" and "Use another account" links. | Verified |
| U-50 | 2 | H5 | `md/pages/orders/components/StatusChanger.tsx:43,48,75`; `md/pages/orders/components/OrderActions.tsx:31-38,74-81` | There are two ways to cancel an order with different safeguards. "Cancel order" asks for a reason, offers a refund and notification, and labels its dismiss button "Keep order". "Change status → Cancelled" does neither, and its dismiss button is also labelled "Cancel / إلغاء". | Remove "Cancelled" from the status changer and send it to the cancel flow. Label every dialog dismiss button "رجوع" or "Keep" wherever a destructive "إلغاء" is nearby. | Verified |
| U-51 | 2 | H7 | `md/pages/orders/ManualOrderPage.tsx:156,436-441` | When creating a phone order, the product picker is a native `<select>` filled with the first 200 active products, with no search. Larger catalogues cannot reach the rest. | Use a searchable combobox (by name, code or SKU) over the paged product search. | Verified |
| U-52 | 2 | H3 | `md/components/DashboardLayout.tsx:270-338,413-451` | The phone drawer and the store switcher are hand-built overlays. The drawer neither moves nor traps focus, nor returns it to "More" or the hamburger, so Tab reaches the page behind. The store switcher has no Escape or arrow-key support. | Rebuild both on the shared Base UI `Sheet` and `Menu`, which handle focus and keys, keeping the logical `start` placement. | Verified |
| U-53 | 2 | H9 | `md/components/DashboardLayout.tsx:304-306`; `md/context/WorkspaceContext.tsx:97-100`; `md/lib/errorMessages.ts:38` | Switching stores keeps the current URL. On a record page (`/orders/:id`, `/catalog/:id`) the other store then fails with "We couldn't find that. It may have been deleted.", which falsely suggests data loss. | When switching stores from a record page, go to that section's list. Or detect the foreign id and say "This order belongs to another store". | Inferred |
| U-54 | 2 | H5 | `md/components/KeyboardShortcuts.tsx:61-64,85-113` | Single-key shortcuts (N new order, P add product, F full screen) fire with no modifier key whenever focus is not in a field, for example after clicking a card. Combined with U-15, a stray key leaves a half-edited product without warning. | Require a modifier (Alt or Shift), or ignore shortcuts on pages with a dirty form. Let users turn single-key shortcuts off. | Verified |
| U-55 | 2 | H8 | `md/components/InstallAppPrompt.tsx:114`; `md/components/MobileTabBar.tsx:65` | The "Install on your phone" card (`fixed bottom-3 z-40`) sits in the same place and layer as the new tab bar (`fixed bottom-0 z-40`), so it is likely to cover the tab bar until dismissed. | Raise the prompt above the tab bar (`bottom: calc(4rem + safe-area)`), or show it as a one-time banner at the top of Home. | Inferred |
| U-56 | 2 | H2 | `pa/` (33 pages, no `useT`); `pa/pages/MyReferralsPage.tsx`; `pa/lib/permissions.ts:83`; `pa/components/Modal.tsx:50` | The platform-admin console is English-only, including the screens referral agents use (my codes, commissions). Agents are part of the Egyptian sales network. | Localise at least the agent-facing pages and the shared components (Modal, DataState, errors) with the dashboard's `useT` pattern. | Verified |
| U-57 | 2 | H7 | `sf/app/store/[workspaceId]/checkout/page.tsx:348-477` | On a phone the "Place order" button comes after the order summary, the discount box, the order bump card(s) and the cross-sell bumps. The total and the call to action are never visible together while the form is being filled in. | Add a sticky bottom bar on phones (total to pay on delivery, then Place order) that scrolls to errors. | Inferred |
| U-58 | 2 | H3 | `md/pages/LoginPage.tsx:208-318`; `md/pages/RegisterPage.tsx`; `md/pages/settings/AppearanceSection.tsx` (only place that renders `LanguageSwitch`) | Language can only be changed in Settings → Appearance, after sign-in. Login, sign-up, verification and plan screens have no switch, so an English-speaking teammate or agent is stuck in Arabic until they get through sign-up. | Put the compact `LanguageSwitch` in the auth layout (`AuthBackdrop`) and on the store picker. | Verified |
| U-59 | 1 | H1 | `md/components/DataState.tsx:47-56`; `md/pages/DashboardHomePage.tsx:180-183` (HEAD); `md/pages/home/StoreOverview.tsx:254` | Loading is a centred spinner in 30vh of empty space; only 2 files use skeletons. Home shows two spinners one after the other (summary, then overview), so the layout jumps twice. | Add shape-matching skeletons to `DataState`. Load home in one pass. | Verified |
| U-60 | 1 | H2 | `md/components/DashboardLayout.tsx:35,473-482`; `md/components/KeyboardShortcuts.tsx:21` | "Full screen", with a maximise icon, only hides the side menu. It does not enter browser full screen. | Rename it "Hide menu / إخفاء القائمة" and use a panel-collapse icon. | Verified |
| U-61 | 1 | H4 | `md/pages/discounts/CouponLinkDialog.tsx:42,59`; `md/pages/referrals/ReferralProgramPage.tsx:36,80`; `md/lib/errorMessages.ts:35`; `md/pages/orders/components/SelectionExtras.tsx:19,30` | Help copy points to screen names that no longer exist: "Store design → Checkout form" (now Store settings → Purchase form); "Settings → Billing" in one place and "Settings → Plan and referral code" in another; "Settings → Webhooks" (they live under Developers). | Replace written paths with links built from the nav registry, so the names cannot drift. | Verified |
| U-62 | 1 | H4 | `sf/components/checkout/OrderFormFields.tsx:161-162,175` | The full-name input is always `required`, even when the merchant's form marks it optional and the label says "(optional)". Screen readers announce it as required. | Use `required={f.required}`, as the other fields do. | Verified |
| U-63 | 1 | H4 | `ui/dialog.tsx:68,75`; `ui/sheet.tsx:66,73`; `ui/alert.tsx:78`; `ui/dropdown-menu.tsx:166,207`; `ui/select.tsx:129`; `ui/button.tsx:29-32` | The shared primitives still place things physically (`right-*`, `pr-/pl-` icon padding) and use an English sr-only "Close". All dashboard dialogs set `showCloseButton={false}` today, so this is latent, but the next feature that uses defaults will regress RTL. | Switch to `end-*` and `pe-/ps-` and take the close label as a prop with no English default. | Verified |
| U-64 | 1 | H4 | `md/pages/LoginPage.tsx:262-270` vs `md/pages/RegisterPage.tsx:397-400` | The login email field has no `dir="ltr"` (sign-up has it), so in RTL the address and the "you@example.com" placeholder align and jump oddly while typing. | Add `dir="ltr"` with `text-start rtl:text-end` to every email, URL and phone input. | Verified |
| U-65 | 1 | H2 | `md/components/CommandPalette.tsx:28,148`; `md/pages/profit/RealProfitPage.tsx:36-37,63` | Some labels promise something else or use jargon. The palette's "Create a discount" opens the discounts list, not a create form. "Max affordable CPA" is ad-buyer jargon. | Deep-link the command to the create dialog. Rename the metric "أقصى تكلفة إعلان للأوردر" / "Most you can pay per order in ads". | Verified |
| U-66 | 1 | H7 | `md/components/DataTable.tsx:73-76` | `onRowClick` puts a click handler on `<tr>` with no keyboard focus or role. No caller uses it today, so this is latent. | Render the first cell as a link, or give the row `tabIndex` and Enter handling, before anyone adopts it. | Verified |
| U-67 | 1 | H6 | `md/pages/storeDesign/GeneralTab.tsx:26-27` | The favicon field asks the merchant to "paste a link from your media library" instead of picking or uploading an image. | Reuse the media picker or uploader used for the logo. | Verified |
| U-68 | 1 | H8 | `md/pages/RegisterPage.tsx:31-37,126`; `md/pages/WorkspacePickerPage.tsx:24-29` | Sign-up runs a plan step, then 6 account fields (including username and confirm password, beside a show-password toggle), then a code, then store name and address before the first screen. | Drop confirm-password (the toggle covers it). Defer the username and plan to after the first product. Prefill the store name from the full name. | Verified |

## Summary by heuristic

| Heuristic | Issues | IDs |
|---|---|---|
| H1 Visibility of system status | 4 | U-18, U-32, U-45, U-59 |
| H2 Match between system and the real world | 11 | U-04, U-05, U-09, U-19, U-30, U-39, U-42, U-48, U-56, U-60, U-65 |
| H3 User control and freedom | 6 | U-14, U-21, U-28, U-49, U-52, U-58 |
| H4 Consistency and standards | 15 | U-12, U-13, U-20, U-23, U-24, U-25, U-27, U-29, U-38, U-40, U-41, U-61, U-62, U-63, U-64 |
| H5 Error prevention | 6 | U-15, U-36, U-37, U-44, U-50, U-54 |
| H6 Recognition rather than recall | 2 | U-35, U-67 |
| H7 Flexibility and efficiency of use | 8 | U-06, U-07, U-08, U-31, U-34, U-51, U-57, U-66 |
| H8 Aesthetic and minimalist design | 6 | U-10, U-11, U-22, U-26, U-55, U-68 |
| H9 Help users recognise, diagnose and recover from errors | 7 | U-01, U-02, U-03, U-16, U-17, U-33, U-53 |
| H10 Help and documentation | 3 | U-43, U-46, U-47 |

**H1 Visibility of system status.**

- *Good:* list counts, stage tabs with counts, `aria-live` loading,
  "Saving…/Creating…" button states, the waiting-call badge on the tab bar.
- *Weak:* status the merchant needs but cannot see. Whether a discount
  applies, how long a claim lasts, errors that vanish in toasts, and spinners
  instead of the shape of the page.

**H2 Match between system and the real world.** This is where the Arabic
persona is hurt most.

- English still leaks through status fallbacks, dialog defaults, the website
  editor's New page dialog and the admin console.
- System concepts leak into the merchant's world: UTC days, four shipping
  price models, "Lost orders", a "Claim & call" button that does not call.
- S1 fixed the biggest one, the English default.

**H3 User control and freedom.**

- *Good:* confirmation outcomes can be corrected, "Keep order" is clear,
  store-settings tabs have Discard, and bulk results are reported.
- *Weak:* modals that close on a stray tap and lose data, a setup guide that
  cannot be brought back, a plan step with no exit, a language choice that is
  overwritten, and hand-built overlays without focus handling.

**H4 Consistency and standards.** This has the most findings, but they are
cheap to fix.

- *Good:* logical CSS discipline is excellent (no physical direction class in
  product code), and the shared `PageHeader`, `DataState`, `FilterTabs` and
  `StatusBadge` give pages a common frame.
- *Weak:* naming drifts. أوردر vs طلب, one state with three names, two "Net
  profit" figures, nav vs H1 titles, MSA vs colloquial, two digit systems,
  stale screen paths in help text.
- A glossary in `06-design-system.md` and labels read from `NAV_LABELS` would
  remove most of them.

**H5 Error prevention.**

- *Good:* destructive actions go through `ConfirmDialog`, bulk actions explain
  their effect, the date range is checked, and there is no double-submit.
- *Weak:* missing unsaved-change guards, single-key shortcuts, two cancel
  paths, small touch targets on phones, and menu entries a role cannot open.

**H6 Recognition rather than recall.** Mostly good. The ⌘K palette, pinned
shortcuts, saved order views and the setup checklist all show options instead
of making the merchant remember them. The gaps are full-number phone search and
pasting media URLs.

**H7 Flexibility and efficiency of use.**

- *Strong for desktop power users:* ⌘K, G-then-letter shortcuts, column
  chooser, saved views, bulk actions, board view, export presets.
- *Weak for the phone majority:* desktop tables, no bulk selection on cards, no
  tap-to-call on orders, a 200-item product picker, and a confirmation flow
  without "next" or callback times.
- The S1 tab bar is the right start; the lists behind it now need phone
  layouts.

**H8 Aesthetic and minimalist design.**

- The S1 calm surfaces help.
- The density problem is structural: 39 menu entries, 17 home KPIs, a long
  stack of controls before the first order, a 15-section order page, and
  signup friction.
- The fix is progressive disclosure: a "needs you now" first, then the rest
  behind sheets and "More".

**H9 Help users recognise, diagnose and recover from errors.**

- *Good:* the foundation is `useErrorMessage`, a 300-line bilingual map with
  courier-specific wording, used on 132 files.
- *Weak:* the remaining paths that skip it. `getErrorMessage` (28 files,
  including `ConfirmDialog`), raw server text in auth and the storefront
  checkout, verbatim field messages, a silent session expiry, a palette that
  shows failure as "no results", and validation errors that stay off-screen.

**H10 Help and documentation.**

- *Good:* per-page tutorial videos (`PageHeader tutorial`), help-centre cards
  on home, field hints throughout.
- *Weak:* help depends on hover tooltips that phones never show, empty states
  carry no next step, and the WhatsApp setup assumes developer-console fluency.

## Where to start

Most of the top ten are small, shared-component fixes that repair many screens
at once:

1. **U-01, U-02, U-05, U-04: one localisation sweep.** Remove
   `getErrorMessage`, make `StatusBadge` text and `ConfirmDialog` labels
   localised by default, and stop showing server text.
2. **U-03, U-18: storefront checkout.** Map error codes and validate the coupon
   before the order is placed.
3. **U-14, U-15, U-16: stop silent data loss.** Rebuild `Modal` on Dialog, add
   the unsaved-changes hook, and add session-expiry recovery.
4. **U-06, U-07, U-08, U-10, U-11: phone layouts.** Cards in `DataTable`, phone
   bulk select, tap-to-call, a phone order summary, and a filter sheet.
5. **U-09, U-12, U-13, U-19, U-20, U-21: model fixes.** Local-time dates, one
   settings hub, fixed guide links, shipping precedence, one profit definition,
   and locale sync from the profile.
