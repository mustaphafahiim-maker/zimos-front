# 07 — Implementation plan

Ordered by impact (how many merchants × how often × how bad, from
`03-priorities.md` and `04-audit.md`). One screen per step, one commit per
step on `ux-redesign`, typecheck before each commit, verified at 390 px and
1366 px in Arabic (and English for layout direction). Status is mirrored in
`progress.md`.

| Step | Screen | What changes | Audit IDs |
|---|---|---|---|
| **S1** ✅ | Tokens + shell | Family tokens file, neutral palette, Readex Pro, Arabic default, menu by daily job, one word for orders, phone tab bar with waiting-call badge | U-22, U-23 (part), U-40 (part) |
| **S2** ✅ | Home | Answer tiles in a bento grid, to-do tile, honest profit, product behind a loss, rates as "N of 10", lost orders, details folded; fixes `/abandoned` 404 and the hidden bottom menu block | U-26, U-27, U-28, U-20 (home side) |
| **S3** | Words everywhere (errors, statuses, dialogs) | Egyptian-Arabic rewrite of `errorMessages.ts`; `getErrorMessage` localised (28 files); session-expired notice and return to the page; `StatusBadge` never shows English; `ConfirmDialog` defaults translated; `DataState` copy | U-01, U-02, U-04, U-05, U-16, U-25, U-40, U-41 |
| **S4** | Orders list | Phone: search + stage chips first, other filters in a sheet; cards with tap-to-call and WhatsApp, select + bulk bar; Cairo-day date shortcuts; guiding empty state | U-07, U-08, U-09, U-11, U-43 |
| **S5** | Order page | Summary header: customer, phone (call/WhatsApp), total, stage, *the one next action*; sections grouped and folded; back arrow logical | U-10, U-38, U-50 |
| **S6** | Confirmation queue | «اتصل» = claim + dial; large outcome buttons; callback time on postponed; lock countdown; answer header | U-30, U-31, U-32 |
| **S7** | Products list | Phone cards (photo, price, stock), primary «ضيف منتج», guiding empty state | U-06 (products), U-43 |
| **S8** | Product form | Essentials first (name, price, photo), the rest folded; scroll to first error; unsaved-changes guard | U-15, U-17, U-29 |
| **S9** | Onboarding (setup guide, sign-up, plan, store picker) | Domain step link, local digits, sign-out on plan step, language switch on auth pages, test-order step | U-13, U-29, U-48, U-49, U-58, U-68 |
| **S10** | Dialogs and toasts | `Modal` on Base UI Dialog (focus trap, close button, no discard on backdrop tap when dirty); toasts with icon, close, longer for errors; install prompt above tab bar | U-14, U-45, U-52, U-55 |
| **S11** | Profit + settlements | Answer header sentence; one definition of net profit; plain-word labels | U-20, U-65 |
| **S12** | Command bar | Arabic normalisation, error state, touch close, actions first | U-33, U-34 |
| **S13** | Storefront checkout (phone) | Sticky total + «اطلب دلوقتي» bar; Arabic/French errors; optional-name fix | U-03, U-57, U-62 |
| **S14** | Settings | Tabs instead of 15 stacked sections; store setup in one place | U-12 |
| **S15** | Auth pages | Calm card instead of glass/blobs; email `dir=ltr` | U-64 |
| **S16** | Platform admin | Adopt family tokens (`data-product="store"`) | U-56 (visual part) |
| **S17** | Re-audit | Re-run Phase 4 on the new UI → next plan | — |

Rules for every step:
- No change to business logic (money, stock, orders, pricing, settlement,
  permissions); anything needing the backend goes to
  `backend-requests.md` and the rest of the screen ships.
- Reuse `PageHeader`, `Section`, `DataState`, `EmptyState`, `StatusBadge`,
  `Bento`; every string via `useT({ en, ar })`; logical classes only.
- Loading, empty, error and no-permission states on every touched page.
