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
- [x] S13 Storefront checkout (phone): sticky total + order bar, shopper-language errors — see R2-3.
- [x] S14 Settings: 15 stacked sections → six tabs (المتجر، الرسايل، الفريق،
      الباقة والفواتير، حسابي، المطورين) kept in ?tab=; old #whatsapp /
      #notifications links open the right tab; the billing banner links to
      the billing tab.
- [x] S15 Auth pages — done inside S9 (calm card, language switch, LTR email).
- [x] S16 Platform admin adopts the family tokens (data-product="store",
      Readex Pro); the console now matches the dashboard's palette and radii.
- [x] R2-1 DataTable phone cards (18 screens): each row a card on phones —
      title, tick box beside it, label/value lines; columns can opt out
      (phoneHidden); dense numeric reports keep the table (phoneCards=false).

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
- [x] 160 store texts: Website → «نصوص المتجر» (/website/texts) — per-language
      overrides, default shown per row, placeholders, search, changed-only,
      one PUT; storefront merges them over its dictionary (server + client).
- [x] 161 store scripts: Store settings → Custom code → «السكريبتات» — table /
      phone cards, add/edit dialog (position, pages, code ≤50k), reorder,
      toggle, delete; storefront injects by page type with the existing guards.
- [x] 165 checkout photo field + optional billing address (form settings,
      storefront checkout on cart/product/funnel, order page thumbnails + card)
- [x] 167 «سجّل الطلبات كـ» Purchase/Lead per store and funnel (+ storefront events)
- [x] 168 Pinterest server events (ad account id, token mask, test events)
- [x] 163/164 storefront place pickers + quote, S13 checkout phone layout (R2-3)
- [x] 172 home filters: product and store (when >1 website) pickers on the
      home, remembered per store; profit tiles step aside while filtered (P&L
      has no product split); «الزيارات للمتجر كله» note; stale ids reset.
- [x] 169 Google Ads purchase + lead conversion labels (dialog + storefront send_to)
- [x] 170 GTM ready-made container download + dataLayer events table (+ storefront pushes)
- [x] 178 webhook custom headers (masked, change/keep) + grouped new topics + edit dialog
- [x] 179 «مساعدين الذكاء الاصطناعي (MCP)» panel: server URL, tools, AI key shown once, setups
- [x] 176 buy a domain (search, buy dialog with the API's price, price-change re-confirm, bought domains table with renew/auto-renew)
- [x] 177 «حوّل الزوار للدومين الأساسي» switch per non-primary domain
- [x] 173 sending domain for customer emails (records with copy, verify, change, remove)
- [x] 174 block email designer (simple text / designer, up-down blocks, variables, preview phone/desktop, test send)
- [x] 175 emails per funnel (funnel settings → Emails) and per website (when >1)
- [ ] 171 live map (agent running)

## Round 2 (plan: `09-plan-round2.md`, from the re-audit `08-reaudit.md`)
- [x] R2-1 Phone cards in DataTable (before the re-audit).
- [x] R2-2 Home tells the truth: queue/pipeline/recent orders keep error,
      no-permission (403 → tile hidden) and zero apart; error tile with
      «جرّب تاني» stays on top; partial failure shows the rows that loaded +
      «جزء من القايمة مجاش»; a store with 0 orders gets «لسه مفيش أوردرات»
      (recent-orders tile hidden then); only due calls count (home + tab
      badge), «ومكالمتين متأجلين لبعدين» under the list; to-do rows outlined
      so white text sits on the full brand fill (N-09). Checked at 390/1366
      with the API forced to 500, 403 and an empty store.
- [x] R2-3 Storefront checkout (S13 + handoff 163/164 storefront side):
      region → city → area pickers from the store's own places, each pick
      re-quotes shipping and the order sends province/city/area/placeId
      (also on the product quick-order form and funnel step); phone bar with
      the estimated total + «اطلب دلوقتي» that hides while the page button
      or the keyboard is up; known refusals in ar/en/fr, never untranslated
      English; refused coupon shown beside the code; optional name not
      marked required (U-62). Checked at 390 (ar, fr) and 1366; 3 scratch
      COD orders placed with 40.00 / 45.50 place prices. Funnel step
      typechecked only (only funnel is an unpublished draft). Two backend
      requests added (quote `configured` flag; cart estimate name match).
- [x] R2-4 First product (N-04): a new product is on sale when saved, with
      a visible «اعرضه في المتجر على طول» tick that turns it into a draft;
      the form starts with name → price → quantity → photos, the rest folds
      under «تفاصيل تانية (اختياري)» and opens itself when one of its fields
      has an error; a 0 quantity warns it shows as sold out; Markdown syntax
      help dropped (toolbar does it); form copy in Egyptian Arabic. Edit
      mode keeps its layout (status select). Checked at 390/1366.
- [ ] R2-5 … R2-12 — see the plan.

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
See `backend-requests.md` (first 6 done by the backend; 4 new from handoffs 175–176).

## Decisions
- 2026-10-06 Glass frame retired on this branch: the brief asks for a light
  neutral palette with very soft shadows; glass classes now resolve to
  opaque surfaces (06 §5).
- 2026-10-06 Dashboard defaults to Arabic when no language was chosen.
- 2026-10-06 Font: Readex Pro (already a dependency) for Arabic + Latin.
- 2026-10-06 No new dependencies so far.
- 2026-10-06 Product description no longer required on create: a frontend-only
  rule (backend allows ""); the guide promises name + price + photo.
- 2026-10-06 New products default to active (was draft) with a visible
  draft switch: the status default is a form default, not stock/pricing
  logic; the API accepts both (re-audit N-04).
- 2026-10-06 Unsaved-changes guard is beforeunload only: the app uses
  BrowserRouter (no data router), so in-app blocking (useBlocker) is not
  available without a router migration.
