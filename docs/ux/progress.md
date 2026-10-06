# UX redesign — progress

Branch: `ux-redesign` (from `claude/gracious-cori-p3g4hr` @ `1fc9906`).
Backend (read only): `zimos-backen` `claude/gracious-cori-p3g4hr`.
Resume rule: read this file, then `07-plan.md`, then continue at the first
unchecked step. Handoff items from the backend live in
`docs/progress/frontend-handoff.md` of the backend repo; the ones done here
are listed under *Handoff items done*.

## Phases
- [x] 1 Understanding — `01-understanding.md`
- [x] 2 Feature inventory — `02-features.md`
- [x] 3 Priorities — `03-priorities.md`
- [x] 4 Audit — `04-audit.md` (68 issues, against base + S1)
- [x] 5 Proposal — `05-proposal.md`
- [x] 6 Design system — `06-design-system.md`, tokens `packages/ui/src/tokens.css`
- [x] 7 Plan — `07-plan.md`
- [ ] 8 Implementation (steps below)

## Implementation steps
- [x] S1 Family tokens + calm shell: neutral palette, Readex Pro, Arabic
      first, sidebar ordered by daily jobs, one word for orders (أوردر),
      phone bottom tab bar with the waiting-call badge. (dc297fb)
- [x] S2 Home answers first: to-do tile, honest profit, product behind a
      loss, rates as "N of 10", lost orders, details folded; fixed the
      hidden bottom menu block and the /abandoned 404. (6b57cf7)
- [x] S3 Words everywhere: ~90 error messages rewritten in Egyptian Arabic;
      getErrorMessage (28 files) and sign-in/up pages go through the same
      translations; unknown English server text never shows in the Arabic UI;
      session-expired notice + return to the page; status words in Arabic
      (StatusBadge fallback, stages: one name «مستني تأكيد»); ConfirmDialog
      defaults; friendly error / no-permission cards; back arrow mirrors.
- [x] S4 Orders list: search then stage chips then one toolbar row (filters,
      date, sort); secondary tools fold behind «أدوات تانية» on phones; phone
      cards with select, call and WhatsApp (ContactActions), name first;
      select-all on phones; dates start at the device's midnight, not UTC;
      a guiding empty state for a store with no orders yet.
- [x] S5 Order page: hero card (customer, phone, one-tap call/WhatsApp,
      address, total, payment) and a next-step card per stage that scrolls to
      its section; actions swipe in one row on phones; work sections on the
      wide column, notes/tags/background beside them; tel: link in the
      summary; Arabic address formatting; Fulfillment no longer sees
      Analytics links it cannot open.
- [x] S6 Confirmation queue: header answers «باقي ٥ مكالمات · ٤ منهم معادهم
      جه»; «استلم واتصل» claims then opens the dialer on phones; warning when
      ≤3 min are left on a claim; outcome buttons with icon and meaning
      colour; full-width actions on phones; guiding empty state; filters side
      by side; Egyptian copy. (Callback time for «أجّل» waits on the backend.)
- [x] S7 Products list: phone cards (photo, name, price, stock, status,
      actions, select) instead of an 820px table; table/grid from md; a
      guiding first-product empty state; calm table; Egyptian copy.
- [x] S8 Product form: description optional (API accepts it; matches the
      setup guide's promise), first error scrolled into view and focused,
      leave-page warning while basics are unsaved, advanced sections folded
      under «إعدادات تانية» (offers stay visible).
- [x] S9 Onboarding: setup guide leads with «الخطوة الجاية», other steps
      below, done steps in one line; domain step → /store-settings/domains;
      test-order step opens the store; local percent digits; sign-in pages
      calm (no glass/blobs) with a language switch; login email LTR; sign
      out on the plan step. (Covers S15 auth restyle too.)
- [x] S10 Dialogs and toasts: Modal (91 call sites, same props) on Base UI
      Dialog — focus trap + restore, translated close button, backdrop tap no
      longer discards forms, bottom sheet on phones; toasts with icon + close,
      errors stay 10 s; install prompt sits above the phone tab bar.
- [x] S11 Profit + settlements: profit opens with «فضلك X — يعني Y% من كل
      جنيه بعته» and the biggest cost as a share of sales (hidden when no
      costs are set, so it never claims a fake profit); plain «أقصى تكلفة
      إعلان للأوردر»; settlements header «شركات الشحن لسه عليها X لـ N أوردر»;
      title matches the menu. PageHeader actions wrap: 38 routes checked at
      390 px, none wider than the screen.
- [x] S12 Command bar: Arabic-insensitive matching (أ/إ/آ, ة/ه, ى/ي,
      diacritics), a real error state instead of «no results», a close button
      for touch, «أوردر جديد» really opens a new order, confirm-orders action,
      no duplicate rows, Egyptian copy.
- [ ] S13 Storefront checkout (phone) — waits for the 165 agent branch (same file)
- [x] S14 Settings: 15 stacked sections → six tabs (المتجر، الرسايل، الفريق،
      الباقة والفواتير، حسابي، المطورين) kept in ?tab=; old #whatsapp /
      #notifications links open the right tab; the billing banner links to
      the billing tab.
- [x] S15 Auth pages — done inside S9 (calm card, language switch, LTR email).
- [x] S16 Platform admin adopts the family tokens (data-product="store",
      Readex Pro); the console now matches the dashboard's palette and radii.

## Handoff items done (from backend `frontend-handoff.md`)
- [x] Request: order search by last phone digits — placeholder + hint
- [x] Request: Fulfillment can book couriers — no UI gate existed; works
- [x] Request: errors in the reader's language — dashboard sends Accept-Language
- [x] Request: postponed/no-answer callback time — CallbackPicker in the queue
- [x] Request: time-zone aware order dates — list sends `tz` with the dates
- [x] 163 + 164 (dashboard): Shipping → «المناطق» tab — regions/cities/areas
      browser, add/rename/hide/delete, import sheet (+sample CSV with the
      shipping column), start from the platform list, inline prices saved
      together, inherited-price hints; order page names the city/area rule.
      Storefront checkout pickers + quote: pending (after 165 lands).
- [x] 162 smart collections (type: manual / by tags / all products, tag
      chips, refresh, «اعمل مجموعة كل المنتجات» empty state, 409 toast)
- [x] 166 funnel bulk (select, publish/pause/resume/duplicate/delete, ≤50,
      results dialog for failures)
- [ ] 160 storefront texts · 161 store scripts · 165 checkout file + billing ·
      167 Lead instead of Purchase · 168 Pinterest CAPI

## Local verification setup (any new session)
- Postgres 16: `pg_ctlcluster 16 main start`; scratch DB `zimos_scratch`
  (postgres/postgres). Backend `.env` from `.env.example` with
  `DB_NAME=zimos_scratch`, raised `RATE_LIMIT_MAX`; `npx sequelize-cli
  db:migrate && db:seed:all`; demo login `demo@zimos.test` /
  `DemoPassw0rd!123` (username set to `demo` in the scratch DB).
- Dashboard: `apps/merchant-dashboard/.env` from `.env.example`;
  `npx vite --port 5173`. Screens checked with Playwright at 390 px and
  1366 px in Arabic.
- Platform admin: apps/platform-admin/.env from .env.example, npx vite
  --port 5174; the scratch demo user was given platform_role creator and
  platform_permissions {*} (scratch DB only).

## Backend requests
See `backend-requests.md` (all 6 done by the backend on 2026-10-06).

## Decisions
- 2026-10-06 Glass frame retired on this branch: the brief asks for a light
  neutral palette with very soft shadows; glass classes now resolve to
  opaque surfaces (06 §5).
- 2026-10-06 Dashboard defaults to Arabic when no language was chosen.
- 2026-10-06 Font: Readex Pro (already a dependency) for Arabic + Latin.
- 2026-10-06 No new dependencies so far.
- 2026-10-06 Product description no longer required on create: a frontend-only
  rule (backend allows ""); the guide promises name + price + photo.
- 2026-10-06 Unsaved-changes guard is beforeunload only: the app uses
  BrowserRouter (no data router), so in-app blocking (useBlocker) is not
  available without a router migration.
