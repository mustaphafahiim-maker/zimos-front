# 09 — Plan, round 2

Source: the re-audit `08-reaudit.md` (N-01 … N-25, plus the round-1
issues still open in `04-audit.md`). Same rules as `07-plan.md`: one
screen or one shared piece per step, highest impact first, a commit per
step, no change to money, stock, order or permission logic.

R2-1 (phone cards in `DataTable`) was done before the re-audit.

| Step | What changes | Issues | Where |
|---|---|---|---|
| R2-2 | Home tells the truth: an error is an error with «جرّب تاني», a role without access sees no tile, a store with no orders gets the first-order nudge instead of "all confirmed". Only calls that are due count, on home and on the tab-bar badge; calls booked for later are one quiet line. The to-do rows keep white text on the full brand fill. | N-01, N-05, N-09 (tile) | `DashboardHomePage.tsx`, `home/HomeAnswers.tsx`, `MobileTabBar.tsx`, `Bento.tsx` |
| R2-3 | Storefront checkout on phones: region → city → area pickers priced per pick (handoff 163/164), sticky «الإجمالي + اطلب دلوقتي» bar, refusals in the shopper's language, optional name not marked required. | S13, U-03, U-18, U-57, U-62 | `apps/storefront` checkout, product quick order, funnel step |
| R2-4 | First product: new products default to active, or ask «اعرضه في المتجر دلوقتي؟»; the first card is name → price → photo; the rest folds; no Markdown help next to the toolbar. | N-04, U-17 | `catalog/components/ProductDetailsForm.tsx`, `CatalogProductsPage.tsx` |
| R2-5 | Queue diet: fix the `Card` gap doubling once; customer + phone as the card title; tick box in the header; assignment folded into one line; «سجّل واللي بعده». Target ≥ 2 cards per phone screen. | N-03, N-23, U-31, U-32 | `ConfirmationQueuePage.tsx`, `ui/card.tsx` call sites |
| R2-6 | Numbers: `fmt` formats numbers through Intl; every count through `pluralOf`; notifications use `formatMoney`; the setup guide shows one count. | N-10, N-13, U-41 | `i18n/LocaleContext.tsx`, `lib/notificationText.ts`, `SetupGuideCard.tsx` |
| R2-7 | Touch sizes: 44 px controls on coarse pointers in Button/Input/Select and Modal footers; 16 px field text on phones (no iOS zoom); dialogs close on backdrop when clean and ask before discarding when dirty. | N-08, N-24, U-36, U-37 | `packages/ui`, `Modal.tsx`, `Select.tsx`, `Textarea.tsx` |
| R2-8 | One settings model: Settings → المتجر moves into Store settings as «هوية المتجر»; the public tab becomes «بيانات التواصل في المتجر». | N-02, U-12 | `SettingsPage.tsx`, `StoreDesignPage.tsx`, `navigation.ts` |
| R2-9 | Shell: «المزيد» active on non-tab routes; the menu opens as a bottom sheet without the four tab duplicates; 12 px tab labels; role-aware tabs; section tabs as one scrolling tablist. | N-06, N-17 | `MobileTabBar.tsx`, `DashboardLayout.tsx`, `FilterTabs.tsx` |
| R2-10 | Words pass 2: Arabic governorate names only, courier codes through `providerName`, store-text keys behind "details", activity event names; one word list in 06. | N-14, N-21 | `lib/format.ts`, `StoreTextsPage.tsx`, activity log |
| R2-11 | Contrast and cards: `text-white` on token fills → foreground tokens; phone cards tappable with `href(row)`, no repeated labels, 44 px tick boxes. | N-09, N-07 | `NotificationsBell.tsx` and the other `text-white` sites, `DataTable.tsx` |
| R2-12 | Smaller fixes: tile copy (N-11, N-12), unpaid COD shows «هيتدفع عند الاستلام» and no refund before collection (N-15, display only), one primary order action + «أكتر» (N-16), lost orders filters like the orders list (N-18), store texts grouped and guarded (N-19), filtered tiles labelled (N-20), ⌘K double X (N-22), list leftovers (N-25). | N-11 … N-25 | per issue |

Handoff items from the backend keep priority over these steps when they
arrive.
