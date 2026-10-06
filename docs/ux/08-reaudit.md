# ZIMOS UX redesign, part 8: re-audit after S1–S16 and R2-1

## Method

**What was audited.** The merchant dashboard on branch `ux-redesign` at
`c414944` (HEAD when the audit ended). That covers S1–S12, S14–S16, R2-1
(DataTable phone cards) and the handoff items merged since. S13 (storefront
checkout) has not been done, so the four checkout rows are re-checked in the
code only.

**How.**

- **Code reading.** Every file that 04 cites was re-read, plus every file
  changed since `dc297fb`.
- **The running app.** Playwright drove the dashboard in Arabic at 390 px
  (mobile emulation, touch) and at 1366 px, in light mode and in dark mode
  (`.dark` on `<html>`). Read-only: dialogs were opened and closed, nothing
  was saved.
- **A 49-route sweep at 390 px** recorded:
  - horizontal overflow
  - tap targets under 24 px and under 44 px
  - H1 compared with the breadcrumb
  - tables left on phones
  - English words
  - mixed digit systems
- **DOM measurements** for card spacing, dialog controls and drawer focus.
- **Contrast** was computed with the WCAG 2 formula from the values in
  `packages/ui/src/tokens.css`.

Screenshots are in the session scratchpad (`audit2/`).

**Same conventions as 04.**

- Severity 4–1 on Nielsen's scale.
- *Verified* means seen in the code or on screen. *Inferred* means it depends
  on data, devices or roles that could not be exercised.
- Path prefixes: `md/` = `apps/merchant-dashboard/src/`, `ui/` =
  `packages/ui/src/components/`, `sf/` = `apps/storefront/src/`, `api/` =
  `packages/api-client/src/`.

**Things that are not findings.** Other agents were editing the working tree
while this ran:

- `CopyButton.tsx` and `ui/alert.tsx` had uncommitted fixes, which touch U-39
  and U-63.
- Near the end, `/login` stopped loading because of an in-progress
  api-client export.
- A one-off `useAuth must be used within an AuthProvider` error appeared
  during a hot reload.

None of these is counted below; rows that depend on them say so.

**Good news first.**

- No route among the 49 is wider than a 390 px screen.
- RTL discipline holds: one decorative physical class in product code.
- Dark mode works through the tokens. The only dark-mode failures are
  hard-coded `text-white` (see N-09).
- The new Base UI dialog traps focus and returns it to the button that opened
  it (measured).
- On a phone the orders list shows the first order on the first screen.

## 1. Status of the 68 original issues

**Totals: 22 Fixed · 21 Partly fixed · 25 Open · 0 Regressed.**

None regressed. U-19 got wider (a fifth pricing surface) without getting
worse, and U-12 picked up a new name collision, which is logged as N-02.

| ID | Status | Evidence |
|---|---|---|
| U-01 | Fixed | `md/lib/errors.ts:17-20`: `getErrorMessage` now returns `errorMessageNow`, which is localised; `ConfirmDialog` inherits it. |
| U-02 | Fixed | `md/pages/LoginPage.tsx:138` maps through `errorMessageNow`. `md/lib/apiClient.ts:14-18` sends `Accept-Language`. Arabic field errors fall back to «راجع الخانة دي» (`md/lib/errors.ts:49`), which is generic but never English. |
| U-03 | Open | `sf/lib/placeOrder.ts:145-146` still returns `err.message`. The storefront sends no `Accept-Language`. S13 not started. |
| U-04 | Fixed | `StatusBadge` → `humanize` with `HUMANIZE_AR` (`md/lib/format.ts:131-183`); Arabic `formatAddress` (`:96`). An unknown value still title-cases to English (`:189`, e.g. «Manual»; see N-14). |
| U-05 | Fixed | `md/components/ConfirmDialog.tsx:8-10`: Arabic defaults «إلغاء/تأكيد/ثانية واحدة…». |
| U-06 | Partly fixed | Phone cards in `DataTable` (`md/components/DataTable.tsx:72-120`) and on products. Still tables at 390: Settings → team (560 px, role column cut off), order items (480 px), settlements aging (640 px), profit (832 px), attribution (896 px). 23 files still render raw `<table>`. |
| U-07 | Fixed | Select-all and tick boxes on order cards (`md/pages/orders/OrdersListPage.tsx:778-785`) and on product cards. |
| U-08 | Fixed | «اتصل / واتساب» on every order card and in the order hero (390 screenshots). |
| U-09 | Fixed | The list sends `tz: deviceTimeZone()` (`OrdersListPage.tsx:169,231`). |
| U-10 | Partly fixed | The hero and the next-step card lead the page. The page is still 5,322 px (≈7 screens) at 390 and keeps two action areas; nine equal buttons at 1366 (N-16). The work sections are in formal Arabic. |
| U-11 | Fixed | At 390 the first order card starts about 440 px down: search, chips, one toolbar row. |
| U-12 | Partly fixed | Settings has 6 tabs (`md/pages/settings/SettingsPage.tsx:204`). The store setup is still split between «الإعدادات» and «إعدادات المتجر», now with a name clash (N-02). |
| U-13 | Fixed | `md/pages/home/SetupGuideCard.tsx:71` → `/store-settings/domains`. |
| U-14 | Fixed | `md/components/Modal.tsx` is on Base UI: focus trap, focus returns to «تغيير الحالة» after Esc (measured), 44 px close button, a backdrop tap no longer discards. Remaining gaps are in N-08. |
| U-15 | Partly fixed | `beforeunload` exists only in `ProductDetailsForm` and the two editors. Store-settings tabs, Settings tabs, store texts, product sub-sections and in-app navigation are still unguarded. |
| U-16 | Partly fixed | `md/lib/apiClient.ts:23-29` redirects with `?expired=1&next=`, so the merchant gets a notice and comes back to the page. The full reload still loses whatever was typed. |
| U-17 | Partly fixed | The product form scrolls to the first error (`ProductDetailsForm.tsx:195`). `md/components/Field.tsx` still has no `aria-describedby`. ChoosePlan and the other forms are unchanged. |
| U-18 | Open | `sf/lib/i18n.ts:368`: «will be applied when your order is confirmed». No coupon check. |
| U-19 | Open | The «أسعار الشحن» tab is unchanged. The new «المناطق» tab adds a fifth pricing surface; its "uses the governorate price" hints help a little. H1 is still «الشحن والضرائب». |
| U-20 | Fixed | The home profit tile reads the same P&L as `/profit` (`md/pages/home/HomeAnswers.tsx:264-316`). |
| U-21 | Open | `md/lib/useTeammateLocale.ts:19-27` unchanged: it pushes the local choice to the profile and never reads the profile. |
| U-22 | Partly fixed | Still 39 entries; four groups start folded (`md/components/DashboardLayout.tsx:74`). The phone drawer repeats the four tab-bar destinations (N-06). |
| U-23 | Partly fixed | The queue is fixed. H1 still differs from the menu on: Lost orders «الطلبات المفقودة», Shipping «الشحن والضرائب», Customers «جهات الاتصال», Fraud «الاحتيال» vs «النصب», Marketing «أدوات التتبع», Reports «التحليلات», Profit «الأرباح الحقيقية». |
| U-24 | Partly fixed | Core screens say أوردر. «طلب» remains in: notifications («طلب جديد»), settlements KPIs (under a header that says أوردر), shortcuts, QuickActions, lost orders, export, order summary, profit. |
| U-25 | Partly fixed | One count rule now (badge = home = queue `pending`). The order page still names the stage «مستني تأكيد» on the badge and «التأكيد: مستني مكالمة» on the chip; the queue tab says «مستنية». |
| U-26 | Fixed | Answers first: to-do, profit, rates; the metric wall folded under «كل الأرقام بالتفصيل». |
| U-27 | Fixed | `LostTile` → `/abandoned-carts`. |
| U-28 | Partly fixed | The guide renders for every role (`md/pages/DashboardHomePage.tsx`), and the × is 44 px. Hiding it is still permanent with no way back (`SetupGuideCard.tsx:107-113`; no other reference to the key). |
| U-29 | Fixed | The description is optional on create. |
| U-30 | Fixed | Claim, then `tel:` on touch (`md/pages/confirmation/ConfirmationQueuePage.tsx:808-814`). |
| U-31 | Partly fixed | `CallbackPicker` added. No «سجّل واللي بعده». An outcome still takes pick + save. |
| U-32 | Partly fixed | Warning at ≤ 3 min (`ConfirmationQueuePage.tsx:852`). No extend and no automatic re-claim. |
| U-33 | Partly fixed | A real error state and a close button. Key hints «↵ / Esc» still show on phones, and two X's appear (N-22). |
| U-34 | Fixed | `md/components/CommandPalette.tsx:68-76` folds أ/إ/آ, ة, ى. |
| U-35 | Fixed | Placeholder and hint «أو آخر ٤ أرقام». |
| U-36 | Partly fixed | Now 44 px: the modal close, the guide ×, queue and order-card actions. Still small: header hamburger, bell and search 36 px (`DashboardLayout.tsx:462`); drawer close 24 px (`:445`, measured); drawer group headings 32 px and items 40 px; product, customer and settlement tick boxes 16 px; product-card actions 32 px; stage chips 36 px. |
| U-37 | Open | `ui/button.tsx` sizes are unchanged (default `h-9`). Dialogs render outside `main`, so they miss the CSS lift: the delete-product dialog's buttons measure 36 px. |
| U-38 | Partly fixed | The `PageHeader` back arrow mirrors. Forgot/Reset/Verify/AuthCallback still say «← العودة لتسجيل الدخول»; AI Studio links end in «→». |
| U-39 | Open | `md/pages/website/editor/NewPageDialog.tsx:11-19` is English; so are `md/components/ThemeToggle.tsx:107-108` and the tab title «— Dashboard» (`DashboardLayout.tsx:406`). `CopyButton` «Copy link/Copied» is being fixed in the working tree (uncommitted). |
| U-40 | Partly fixed | Redesigned screens speak Egyptian Arabic. Elsewhere formal Arabic (MSA) dominates: 254 «جارٍ», 163 «لا يوجد/لا توجد», 357 «تم» in strings. The order-page sections, customers, lost orders, team and shipping are MSA. |
| U-41 | Open | `fmt()` (`md/i18n/LocaleContext.tsx:146-147`) pastes Latin digits, while Intl gives Arabic-Indic. Seen side by side: guide «3 من 5» next to «٪٦٠»; tab badge «11» against home «١١»; chips «22»; queue tabs «(11)». |
| U-42 | Open | «الأوردرات المفقودة» (`md/lib/navigation.ts:297`) and «الطلبات المفقودة» (`md/pages/abandoned/LostOrdersPage.tsx:142`) both remain. |
| U-43 | Partly fixed | Orders, queue and products have guiding `EmptyState`s. `DataState`'s empty state is still a grey sentence with no action (`md/components/DataState.tsx:93-98`). |
| U-44 | Open | Only analytics entries are hidden by role (`navigation.ts:160-193`). The tab bar shows Orders, Confirm and Products to every role. The refusal still doesn't name the permission. |
| U-45 | Fixed | Toast icon, close button, errors stay 10 s. |
| U-46 | Partly fixed | Home answers are visible sentences. `title` tooltips remain in the folded KPI wall and on catalog hints. |
| U-47 | Open | `WhatsappSection` unchanged. |
| U-48 | Open | `md/lib/storeAddress.ts:41-47` unchanged: Arabic names still suggest nothing. |
| U-49 | Fixed | ChoosePlan has «اخرج من الحساب». |
| U-50 | Open | `StatusChanger` still offers Cancelled, with «إلغاء» as the dismiss button (`md/pages/orders/components/StatusChanger.tsx:75,283-292`). |
| U-51 | Open | `md/pages/orders/ManualOrderPage.tsx:156` still caps at 200; native select at `:436`. |
| U-52 | Open | Drawer: focus stays on «المزيد» when it opens and lands on `BODY` after Esc (measured). The store switcher is still hand-built (`DashboardLayout.tsx:270-338`). |
| U-53 | Open | `WorkspaceContext` unchanged (Inferred, as before). |
| U-54 | Open | `KeyboardShortcuts` unchanged: single-key N/P/F. |
| U-55 | Fixed | The install prompt sits at `bottom-[calc(4.75rem+safe-area)]`. |
| U-56 | Open | S16 gave the platform admin the tokens only; it is still English. |
| U-57 | Open | No sticky total + order bar on phones (`sf/.../checkout/page.tsx:355` is `lg:sticky` only). Inferred, as before. |
| U-58 | Fixed | `md/components/AuthBackdrop.tsx:23` renders `LanguageSwitch`. |
| U-59 | Partly fixed | Home uses `BentoSkeleton`; `DataState` is still a spinner in 30vh (`DataState.tsx:52-62`). |
| U-60 | Open | «ملء الشاشة» with a maximise icon (`DashboardLayout.tsx:55,482`). |
| U-61 | Open | CouponLinkDialog «تصميم المتجر ← نموذج الشراء»; SelectionExtras «الإعدادات ← الويب هوك» (now the «المطورين» tab); referrals «الإعدادات ← الفواتير». |
| U-62 | Open | `sf/components/checkout/OrderFormFields.tsx:176`: `required` is hard-coded. |
| U-63 | Open | `ui/dialog.tsx:68` and `ui/sheet.tsx:66` still use `right-4` and an English "Close". The `ui/alert.tsx` `text-left`/`right-3` fix is uncommitted in the working tree. |
| U-64 | Fixed | `LoginPage.tsx:275` has `dir="ltr"`. |
| U-65 | Partly fixed | «أقصى تكلفة إعلان للأوردر» (`RealProfitPage.tsx:94`). The «Create a discount» command still opens the list (`CommandPalette.tsx:176`). |
| U-66 | Open | Still latent, and now also on phone cards (`<li onClick>`, `DataTable.tsx:86`). |
| U-67 | Open | `md/pages/storeDesign/GeneralTab.tsx:66`: «الصق رابطًا من مكتبة الصور». |
| U-68 | Open | Sign-up still asks to confirm the password (`RegisterPage.tsx:75`) and runs the username step first. |

## 2. New issues introduced or revealed by the redesign

25 issues: 4 rated 3, 16 rated 2, 5 rated 1. By basis:

- 19 are fully Verified.
- 5 are Verified, with an Inferred consequence or source: N-01, N-04, N-14,
  N-20, N-23.
- 1 is Inferred: N-24.

| ID | Sev | Heuristic | Location | Problem | Recommendation | Basis |
|---|---|---|---|---|---|---|
| N-01 | 3 | H1, H9 | `md/pages/DashboardHomePage.tsx:158,162,191,378-382`; `md/pages/home/HomeAnswers.tsx:218,229-235` | The to-do tile and the latest-orders tile turn failures into good news. Queue counts, pipeline and recent orders are fetched with `.catch(() => null)`, and null is read as zero. A network error, a 403 for a role without order access, or a server hiccup therefore shows «مفيش حاجة مستنياك دلوقتي — كل الأوردرات اتأكدت وفي طريقها» and «لسه مفيش أوردرات… شارك لينك متجرك». A store with no orders at all also hears that "every order is confirmed". This is the tile merchants trust most, and a false all-clear means calls that are not made. | Keep error, no-permission and zero apart. On error, a row «معرفناش نجيب الأوردرات — جرّب تاني» with retry. For a role without access, hide the tile. For a store with 0 orders, the first-order nudge, not "all confirmed". | Verified (code); which roles hit the 403 path is Inferred |
| N-02 | 3 | H4 | `md/pages/settings/SettingsPage.tsx:125,131`; `md/pages/storeDesign/StoreDesignPage.tsx:23,48`; `md/lib/navigation.ts:173,214` | Settings → tab «المتجر» opens a section titled «بيانات المتجر» (name, logo, colours). «إعدادات المتجر» → tab «بيانات المتجر» is a different form: the contact details shown on the store. Two places carry the same title with different fields. The menu also shows both «الإعدادات» and «إعدادات المتجر». | Move Settings → المتجر into Store settings as one "identity" tab. Rename the public tab «بيانات التواصل في المتجر». Keep «الإعدادات» for account, team and billing. | Verified |
| N-03 | 3 | H8 | `/confirmation-queue` at 390; `md/pages/confirmation/ConfirmationQueuePage.tsx:868-907,448`; `ui/card.tsx:13` | One pending queue card is 517 px tall at 390, so an agent sees about one card per screen (723 px between the header and the tab bar). Causes: `Card` already spaces its children with `gap-6`, and the page adds `space-y-4`, so every gap is 40 px (measured). The order number appears twice: the tick-box label «تحديد ORD-…» and the heading. The manager's assignment row («مش متوزع» + select) sits on every card. The title is the order code, not the customer. The assignment filter shows only «الكل», with its label hidden on phones. The same gap doubling affects 36 `<Card className="space-y-…">` call sites, including the order page's confirmation panel. | Fix the spacing once, either by dropping `space-y` where `Card` already gaps or by `gap-0` on those cards. Make customer + phone the title. Put the tick box in the header with only an aria-label. Fold assignment into one line, with the select behind «…» for managers. Label the filter «مين شغال عليها». Aim for ≤ 300 px per card. | Verified (DOM) |
| N-04 | 3 | H2, H5 | `/catalog/new` at 390; `md/pages/catalog/components/ProductDetailsForm.tsx:165`; `md/pages/catalog/CatalogProductsPage.tsx:116` | The first product is saved as a hidden draft. Status defaults to «مسودة», with no hint that a draft is not on the store, while the empty state promises «اسم وسعر وصورة واحدة كفاية عشان تبدأ تبيع». Essentials do not come first either. The required price (card 2, ~1.3 screens down) and the required photo (card 3, ~2.5 screens down) come after optional fields: a description editor with Markdown help, a dialect picker, AI, status, type, quantity tracking, tags and shipping. | Default a new product to «شغّال», or ask «اعرضه في المتجر دلوقتي؟» on save. Order the first card name → price → photo and fold the rest. Drop the Markdown syntax help, since the toolbar exists. | Verified (default, order); effect on the store Inferred |
| N-05 | 2 | H2 | `/`, tab bar, `/confirmation-queue` at 390; `md/components/MobileTabBar.tsx:50`; `HomeAnswers.tsx:218-220` | "Waiting for a call" counts calls booked for later. Home said «١١ أوردر مستني مكالمة تأكيد» and the badge said 11. On the same data the queue header said «باقي ١١ مكالمة · ٩ منهم معادهم جه». | Use `pendingDue` for the badge and the to-do line, and mention the rest («+٢ متأجلين لبعدين»). | Verified |
| N-06 | 2 | H1, H8 | Tab bar and drawer at 390; `MobileTabBar.tsx:65,78-86,113`; `DashboardLayout.tsx:432-465` | The new shell has rough edges: (a) on any page reached through «المزيد», nothing in the bar is active, so the bar stops saying where you are; (b) «المزيد» sits bottom-left, but the drawer slides in from the right edge; (c) the drawer starts with Home, Orders, Confirm and Products, which are already in the bar; (d) the header hamburger and the More tab open the same drawer; (e) labels are 11 px; (f) the bar shows Orders, Confirm and Products to every role. | Show «المزيد» as active on non-tab routes. On phones open the menu as a bottom sheet from that tab, without the four duplicates and without the header hamburger. Use 12 px labels. Make the tabs role-aware. | Verified |
| N-07 | 2 | H7, H8 | `/customers`, `/abandoned-carts`, `/settlements` at 390; `md/components/DataTable.tsx:80-115` | Phone cards (R2-1) have three problems. (a) Tapping the card does nothing: no page passes `onRowClick` and there is no stretched link, so the only way into a customer is the 69×19 px name. (b) Every card repeats every label («النوع: عميل», «نسبة الاستلام: لا توجد شحنات منتهية بعد»), so 19 customers make a 4,331 px page. (c) Tick boxes are bare 16 px inputs, and header-less cells sit in `<dl>` without dt/dd. | Let a page give `href(row)` and render the title as a stretched link, as the order cards do. Offer `secondary` and `badge` slots instead of label lists, and hide empty or default values. Put tick boxes in 44 px labels. | Verified |
| N-08 | 2 | H3, H5 | `md/components/Modal.tsx:38,57-66`; `md/index.css:469` | The new bottom sheet never closes on a backdrop tap, even for read-only and confirm dialogs. It has no swipe-down, and its only close is the X in the top corner, out of thumb reach. X and Esc still discard a half-typed form without asking. Because the sheet is portalled outside `main`, the CSS height lift misses it: buttons in the delete-product dialog measure 36 px. | Close on backdrop or swipe when the form is clean; ask «تسيب التعديلات؟» when it is dirty. Make footer controls `h-11` on coarse pointers inside `Modal`. | Verified |
| N-09 | 2 | H4 (a11y) | `md/components/Bento.tsx:39`; `HomeAnswers.tsx:245`; `md/components/NotificationsBell.tsx:169`; `md/pages/catalog/components/ProductImagesSection.tsx:289`; `md/pages/shoppable/ShoppableImagesPage.tsx:330,349`; `md/pages/funnels/FunnelEditorPage.tsx:1423` | Contrast on the new tokens. **Light mode, home to-do tile:** the white row text sits on brand + 10 % white, 4.42:1 (3.72:1 on hover). The 85 % white eyebrow is 4.18:1. Both are below 4.5:1 for 13–15 px text. **Dark mode:** dark mode lifts primary and danger to light tints and expects dark text on them (`--primary-foreground: #0e1014`). Hard-coded `text-white` therefore gives 2.43:1 on `bg-danger` (the bell's unread badge, on every page) and 2.70:1 on `bg-primary`. | Use a darker fill for the rows, or full-opacity white on a darker fill (≥ 4.5:1). Replace `text-white` on token fills with `text-primary-foreground` / `text-paper-raised`, as `MobileTabBar` already does. | Verified (computed from tokens.css) |
| N-10 | 2 | H4 | `md/i18n/LocaleContext.tsx:146-147`; `md/lib/plural.ts` (2 callers); `md/pages/orders/components/OrderSessionDetails.tsx:69`; `md/pages/settlements/SettlementsPage.tsx:92,101`; `md/pages/orders/components/OrderBulkBar.tsx:72,87`; `md/lib/notificationText.ts:60` | Only the home tiles and the queue header use the new plural helper. Everywhere else counts go through `fmt`, which gives Latin digits and no Arabic plural: «عميل متكرر · 3 أوردر», «4 طلب · ١٬٧٥٠ ج.م. مستحق», «تم تحديث {count} أوردر», «{n} أنواع» for 11 and up, «باقي 2 دقيقة». Notifications show «250.00 EGP» while the rest of the app shows «٢٥٠٫٠٠ ج.م.». | Make `fmt` format numbers through Intl. Move every count string to `pluralOf`. Use `formatMoney` in notifications. This pairs with U-41. | Verified |
| N-11 | 2 | H2 | `/` at 390 and 1366; `HomeAnswers.tsx:146,152,368-376` | Without product costs (the demo store's case), the product tile falls back to the best seller by units. It keeps the profit eyebrow «أكتر منتج بيكسّبك» ("your best earner") and the action «اعرف السبب» ("see why"), and that action opens the product list. | Give the fallback its own eyebrow «أكتر منتج اتباع» and action «شوف المنتجات». | Verified |
| N-12 | 2 | H2 | `HomeAnswers.tsx:281-289`; `api/endpoints/profit.ts:19-44` | The no-costs profit tile says «قبل تكلفة المنتج، دخلك X … بعد الشحن والرسوم». X is `projected.netProfit`. That figure also subtracts ads, return shipping and ZIMOS fees, and it includes open orders at the expected delivery rate. Both "came in" and "after shipping and fees" misdescribe it. | Name what the number contains, e.g. «من غير تكلفة المنتج: فاضلك تقريبًا X بعد الشحن والمرتجعات والرسوم والإعلانات (محسوب معاه اللي لسه في الطريق)». | Verified (code + API type docs) |
| N-13 | 2 | H1, H4 | `/` at 390; `SetupGuideCard.tsx:41,60,121,156` | The setup guide shows two progress counts on one card: «خلصت 3 من 5 خطوات» (required steps, Latin digits) and «خلصت ٤ خطوات» (all done steps, optional ones included), next to «٪٦٠». | Use one count, required steps only. List the optional done steps without a number. Format digits through Intl. | Verified |
| N-14 | 2 | H2 | Order page, `/customers`, `/settlements`, `/orders` filters, `/website/texts`, `/activity` at 390 | English or raw values still reach the Arabic screen: governorates as «الجيزة (Giza)» and «، EG» (order hero, customer card); the courier code «manual-courier» / «Manual» (settlements; `humanize` falls back to English, `md/lib/format.ts:189`); «مثلًا Cairo» as the governorate filter placeholder; the developer key «common.continueShopping» under every store text (`md/pages/website/StoreTextsPage.tsx:463`); English event words in the activity log («Webhook», «Email domain», «Store script»). | Show the Arabic governorate name only. Pass carrier codes through `providerName`. Make the governorate filter a picker. Hide text keys behind "details". Translate activity event names. | Verified (screens); the source of the bilingual governorate string is Inferred |
| N-15 | 2 | H2, H5 | `/orders/:id` at 390, on an unconfirmed COD order; `md/pages/orders/components/PaymentsSection.tsx:223-224,284` | An unpaid cash-on-delivery order shows «المدفوع ٠ ج.م.» beside «المتاح للاسترداد ٢٥٠ ج.م.» and a «استرداد» button: an invitation to refund money that was never collected. The chip «الدفع: مش مدفوع» in amber also presents the normal COD state as a warning. | Hide refund until something has been collected, or label it «بعد التحصيل». Show unpaid COD as neutral «هيتدفع عند الاستلام». | Verified (screen); the 250 comes from the API |
| N-16 | 2 | H5, H8 | `/orders/:id` at 1366; `md/pages/orders/components/OrderHeaderTools.tsx` | The order page still has two action areas. The second is a row of nine equal buttons, with the red «إلغاء الأوردر» third, between «تحميل بوليصة الشحن» and «تأكيد عبر واتساب». | One primary action taken from the next-step card, then a «أكتر» menu. Cancel goes last, set apart. This completes U-10. | Verified |
| N-17 | 2 | H4 | `/settings`, `/store-settings`, `/shipping` at 390; `md/components/FilterTabs.tsx:32-55` | The new section tabs (Settings 6, Store settings 10, Shipping 5) are built from FilterTabs: toggle buttons in `role=group`, without tablist semantics or arrow keys. They are 36 px tall and wrap into 2–4 rows on a phone; Store settings takes 4 rows before any content. | One horizontally scrolling row with `role=tablist`, or a select on phones. 44 px targets. | Verified |
| N-18 | 2 | H8 | `/abandoned-carts` at 390; `LostOrdersPage.tsx:160,475-640` | Before the first lost order, the phone shows three KPI cards, four tabs and five stacked full-width filters (product, reason, source, from, to). The first card starts about 1.4 screens down. Date fields read «mm/dd/yyyy». The source filter says «المتجر والفانلز» while the menu says «مسارات البيع». | Reuse the orders-list pattern: search, tabs, one «الفلاتر» toggle and date shortcuts. | Verified |
| N-19 | 2 | H8, H5 | `/website/texts` at 390; `md/pages/website/StoreTextsPage.tsx` | The new «نصوص المتجر» page lists every text with two fields, one after another: 32,677 px at 390, about 39 screens, with 217 targets under 44 px. One save writes everything, but leaving the page is not guarded. | Group by page in collapsed sections, each showing how many texts changed. Put search first. Add the `beforeunload` guard. | Verified |
| N-20 | 2 | H1 | `/` at 390; `DashboardHomePage.tsx:158-193,258-300` | The new home product/store filter changes only some tiles. The to-do tile and the latest orders stay store-wide, and the profit tiles vanish. A small note is the only explanation. On a phone the filter select also pushes the to-do tile down. | Label filtered tiles («لـ Demo T-Shirt») and keep the to-do tile above the filter, or move the filter into the details section. | Verified (code); confusion Inferred |
| N-21 | 1 | H4 | `CatalogProductsPage.tsx:83` vs `md/pages/catalog/catalogLabels.ts:18`; `md/lib/errorMessages.ts` (SHIPPING_GROUP_CURRENCY) | New words drift. The products tab says «شغّال» while the badge on the same card says «نشط». «الفانلز» appears in an error message and a filter, against «مسارات البيع» in the menu. Names are quoted “…” in some dialogs and «…» on home. | Add these to the 06 glossary and add a grep check in review. | Verified |
| N-22 | 1 | H4 | ⌘K on a phone; `CommandPalette.tsx:287-310,353-354` | `type="search"` adds the browser's blue × (clear) next to the custom grey X (close): two X's that do different things. The footer still shows «↵ للفتح / Esc» on touch screens. | Use `type="text"` or hide the native cancel button. Hide key hints on coarse pointers. | Verified |
| N-23 | 1 | H2 | `ConfirmationQueuePage.tsx:808-814`; `md/pages/confirmation/CallbackPicker.tsx:62` | On a desktop «استلم واتصل» only claims, because the dialer opens only on coarse pointers. The «بعد ساعة» chip is recomputed from "now" on every render, so after a minute it shows as unpicked although the value is still set. | Label the button «استلم» on fine pointers and show the number large. Remember which chip was picked. | Verified (label); Inferred (chip) |
| N-24 | 1 | H5 | `md/components/Select.tsx:10`; `md/components/Textarea.tsx:10`; ⌘K input | Selects, textareas and the ⌘K field use 14 px text. iOS Safari zooms the page when such a field gets focus: queue notes, the status reason, every filter select. | 16 px on coarse pointers, as `ui/input.tsx` already does with `text-base md:text-sm`. | Inferred |
| N-25 | 1 | H6, H8 | `/catalog` and `/orders` at 390 | Small leftovers on the redesigned lists: products select-all is a lone 16 px box with no visible label (orders has one), and «المجموعات» floats on its own line. Order stage chips put «مستني الدفع 0», which does not apply to COD, second, and show stages with zero orders. | Give select-all a visible label. Order the chips by the COD flow and dim or hide empty stages. | Verified |

Dark mode was checked on home, orders, the order page and products (390), and
on home (1366). Apart from N-09, the token pairs pass in dark mode:

- ink-soft on raised: 7.4:1
- primary on paper: 7.05:1
- every status text on its soft fill: ≥ 6.5:1

The only light-mode pairs near the limit are primary on primary-soft (4.56:1)
and success on success-soft (4.69:1). Both pass for normal text.

## 3. Round 2: the next ten steps, by impact

1. **Make home honest (N-01, N-05).** Separate error, no-permission and zero
   in the to-do and recent-orders tiles. Count calls that are due now. A small
   change that protects the screen merchants trust most.
2. **Storefront checkout, S13 (U-03, U-18, U-57, U-62).** Handoff 165 has
   merged, so this is unblocked. Map error codes to shopper copy, check the
   coupon before the order is placed, add a sticky «الإجمالي عند الاستلام +
   اطلب» bar on phones, and drop `required` from an optional name.
3. **First-product flow (N-04, U-17).** Default to active or ask on save. Put
   name → price → photo first. Add `aria-describedby` in `Field` and scroll to
   the first error on the other forms.
4. **Queue diet and speed (N-03, U-31, U-32, N-23).** Fix the `Card` gap
   doubling across all 36 sites. Make the customer the title, fold
   assignment, add «سجّل واللي بعده» and «مدّ الوقت». Target ≥ 2 cards per
   screen.
5. **Numbers and plurals (U-41, N-10, N-13).** One number formatter behind
   `fmt`, one digit system, `pluralOf` for every count, `formatMoney` in
   notifications.
6. **Touch-size primitives (U-36, U-37, N-08, N-24).** Coarse-pointer 44 px
   in `ui` Button, Input and Select, and in Modal footers. `size-11` header
   icons and drawer close. 44 px label wrappers for tick boxes. 16 px text on
   coarse pointers.
7. **One settings model (U-12, N-02, U-61, U-60).** Merge the store profile
   into Store settings, remove the «بيانات المتجر» clash, and build help paths
   from `NAV_LABELS` so they cannot drift.
8. **Role-aware, accessible shell (U-44, U-52, N-06, N-17).**
   - Rebuild the drawer and the store switcher on Base UI.
   - Give «المزيد» an active state.
   - Drop the duplicate menu entries and the extra hamburger.
   - Hide tabs and menu items a role cannot open.
   - Make section tabs a real tablist.
9. **Words, round 2 (U-23, U-24, U-40, U-42, N-14, N-21).**
   - Egyptian voice and «أوردر» on the order-page sections, settlements, lost
     orders, customers, notifications and shortcuts.
   - Page titles read from `NAV_LABELS`.
   - Rename Lost orders.
   - Never show raw codes or English values.
10. **Contrast and cards (N-09, N-07, U-06).**
    - Fix the brand-tile rows and replace `text-white` on token fills.
    - `DataTable` cards with a stretched link and primary/secondary lines.
    - Convert Settings → team and the order items table on phones.
