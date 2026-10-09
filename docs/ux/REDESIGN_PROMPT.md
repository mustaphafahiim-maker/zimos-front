# ZIMOS — full product redesign brief

Paste this whole file into a new chat. It is complete: you do not need
anything else from the owner to begin.

---

## 0. Start now

You are the lead product designer **and** the engineer for ZIMOS, a store
builder for Egyptian merchants who sell cash-on-delivery. You are rebuilding
how the product looks, flows and feels — the merchant dashboard first, then
the store editor and funnel builder, then the shopper's storefront.

- **Begin with Phase 1 the moment you finish reading.** No questions, no plan
  for approval, no "shall I continue". Decide, write the decision in one line,
  keep going. If something is truly ambiguous, take the option that is easier
  to undo and note it.
- **The owner judges by what he sees.** He rejected the last round as "you
  fiddled with small things and went in circles reviewing". Every phase ends
  with before/after screenshots of real pages. Work nobody can see in a
  screenshot is not this job.
- **No audit rounds, no reviewer agents, no reports.** Read a screen, redesign
  it, look at it, move on. One pass of checks at the end of each phase
  (section 9). Use sub-agents only to build separate pages in parallel, never
  to review.
- **Use what the owner sent, in detail** (section 2 and the code in
  Appendix A). Do not bring in a different style.
- Reply to the owner in Egyptian Arabic, short.

Read `CLAUDE.md` and `docs/LANES.md` first. Their engineering rules stand
(section 8). The owner has lifted exactly these for this work: existing
screens **may** be restyled and re-laid-out; **one** icon package may be added
(section 4.2).

---

## 1. Who you are designing for

A merchant in Cairo, Mansoura or Assiut selling clothes, cosmetics or
gadgets from Facebook and TikTok ads. Customers pay the courier in cash.
The merchant runs the store **from a phone**, between calls, often with one
or two helpers. Everything is in **Arabic, right-to-left, Egyptian dialect**.

How this merchant thinks — the product must answer these, in this order,
without being asked:

1. **«فيه إيه مستنيني دلوقتي؟»** New orders nobody has called yet (an order
   not confirmed within hours is usually lost). Confirmed orders with no
   courier booked. Deliveries that failed and need a second try. Returns on
   their way back. Bank transfers to approve. Products about to run out.
   Messages unanswered.
2. **«كسبت كام النهارده؟»** Orders and sales today against yesterday at the
   same hour — and real profit, after product cost, shipping, ad spend and
   returns. Revenue alone lies in COD: a third of placed orders may never be
   paid.
3. **«فلوسي فين؟»** Cash the couriers are holding, when the next settlement
   lands, what was settled this week.
4. **«الإعلانات جايبة همّها؟»** Not cost per order — cost per **delivered**
   order, per campaign. Which campaign brings orders that get refused.
5. **«إيه اللي ماشي وإيه اللي واقف؟»** Products by delivered profit, stock
   days left at today's pace, products that keep coming back.
6. **«مين العميل ده؟»** Has he ordered before, did he accept or refuse, is
   the number flagged.

The COD order journey is the backbone of the whole product:

```
visit → add to cart → checkout started → order placed → confirmed by phone
      → handed to courier → delivered and paid → (returned)
```

Three rates decide whether the merchant makes money: **confirmation rate**
(confirmed ÷ placed), **delivery rate** (delivered ÷ shipped) and **return
rate**. They belong on every screen that talks about performance, broken
down by governorate, courier, product and ad source.

Design consequences that hold everywhere:

- The first screen of any page on a 390×844 phone shows what the page is for
  and its one main action. Everything used rarely is one tap away, not on
  the page.
- A number never stands alone: it comes with what it is compared to and what
  to do about it.
- Calling and WhatsApp are one tap from anywhere a customer appears.
- Nothing the merchant types is ever lost silently.

---

## 2. What the owner sent — this is the visual direction

### 2.1 Reference shots (Dribbble)

1. **"Glass UI Elements" — Ghani Pradita for Paperpillar.** A pastel
   purple → pink → peach gradient ground. White frosted cards with large
   radii. Pill-shaped rows: an icon, a label, a number. Soft glows. One
   floating gradient feature card.
2. **"Glassmorphism Dashboard UI Design" — Leon Abramovic (two shots).** One
   large frosted app window floating over a vivid blue / orange / pink
   gradient. A translucent side menu inside the window. KPI cards with a
   sparkline and a green/red % change. Tables inside glass cards. Small quiet
   section labels. Round blue "+" buttons.

### 2.2 Three components — full code in Appendix A

| Component | What it is | Where it goes in ZIMOS |
|---|---|---|
| **`liquid-glass`** (ui-layouts) | `GlassEffect` (a pane: 3px backdrop blur + an SVG turbulence/displacement filter, a 25% white fill, a two-sided inner rim), `GlassDock` (a row of app icons that swell on hover with an overshooting spring, `cubic-bezier(0.175, 0.885, 0.32, 2.2)`), `GlassButton`. | The pane recipe for every surface (section 4.1). The **dock** is the phone tab bar and the editor's tool strip. The overshoot spring is the house easing for anything that pops. |
| **`advanced-stats`** | Stat cards: a quiet title, one big value, a badge with ▲/▼ and the % change, and a small area chart under it. | Every KPI in the product: home, the reports hub, product and funnel performance. Build it on the existing SVG charts — **do not install recharts**. |
| **`sheen-pill-button`** | A full-pill button with a gradient fill and a band of light that sweeps across. | The main action on every screen, the current side-menu item, the selected tab. |

Take the design from that code, not its dependencies: no recharts, no
Unsplash images, no copy-pasting a second button component beside the one in
`packages/ui`. Fold the look into the shared components.

### 2.3 The feel: a Mac

The owner's words: *"I want to use it as if I'm using a MacBook — in look and
in smoothness."* That means the **idioms of macOS**, built from our own
parts (no Apple artwork, no Apple logos, no SF Symbols — see 4.2):

- **A window, not a web page.** Three glass panes over a wallpaper: side
  menu, toolbar, content.
- **Finder-style side menu.** Small grey group headings, 34–36px rows, an
  18px icon, the current row a filled pill. Groups collapse and remember it.
  A pinned "shortcuts" group on top.
- **Spotlight.** `⌘K` (already `components/CommandPalette.tsx`) becomes the
  universal launcher: any page, any order by number or phone, any product or
  customer, any action («أوردر جديد», «ضيف منتج»), and recent items.
- **A Dock on the phone.** The tab bar is a floating glass dock; the pressed
  icon swells, badges show counts.
- **Sheets.** Create, edit and filter open as a sheet — up from the bottom on
  a phone, centred on a desktop — with a spring. They never navigate away
  from the list underneath.
- **Quick Look.** From any list, a row opens a preview (Space on desktop, tap
  on phone) without leaving the list; "open fully" is inside it.
- **System Settings layout** for Settings, Store settings, Shipping and
  Payments: a searchable list of sections on the side, one section in the
  pane; on a phone, a list that pushes to a section.
- **Segmented controls** whose thumb slides between segments.
- **Context menus** on right-click / long-press of a row: open, call,
  WhatsApp, copy number, change status.
- **Edit in place** with autosave and an **Undo** toast, instead of
  "open → edit → save → back" for a price, a stock count or a status.
- **Notification Centre.** The bell opens a panel from the side, grouped by
  kind, each item with its action.
- **Smooth, never slow.** Springs, 200–350ms, interruptible. Lists appear
  instantly from cache and refresh behind; going back restores scroll;
  links prefetch on hover / touch-start; every wait shows the shape of what
  is coming (skeletons), never a bare spinner.

### 2.4 The skill

`ui-ux-pro-max` is installed at user level (`~/.claude/skills/ui-ux-pro-max`).
Use its priority order as the checklist for each screen: accessibility →
touch → performance → style → layout → type & colour → motion → forms →
navigation → charts. There is no Python on the machine: read its CSVs with
Grep. It must not supply a palette or fonts — the store's `--brand` colour
and the tokens in `packages/ui/src/tokens.css` stay the anchor.

---

## 3. What exists today

Monorepo (`npm` workspaces):

| Path | What | Check |
|---|---|---|
| `apps/merchant-dashboard` | React 19, Vite, Tailwind 4, react-router 7 | `npx tsc -b` |
| `apps/storefront` | Next.js — the shopper's store | `npx tsc --noEmit` |
| `apps/platform-admin`, `apps/marketing` | out of scope | — |
| `packages/ui` | shadcn on Base UI, `tokens.css` | — |
| `packages/api-client` | typed client, `src/endpoints/<domain>.ts` | — |

**Already built in the look of section 2 — continue from it, do not restart.**
If these files are not in your checkout, build them from section 4.

- `apps/merchant-dashboard/src/liquid-glass.css` — the whole look as one
  removable layer under `:root:not([data-glass="off"])`, imported after
  `index.css`. Switch: Settings → Appearance (`components/GlassToggle.tsx`).
- `components/SaveBar.tsx` (sticky unsaved-changes bar),
  `lib/useUnsavedGuard.ts` (ask before a tab switch drops a draft),
  `PageHeader primaryAction` (the main action as a bar above the phone tab
  bar), `DataState skeleton=…` and `DataTable loading` (content-shaped
  loading), `KpiCard trend` (sparkline + % chip).
- Session: a rate limit or an outage no longer signs the merchant out
  (`context/AuthContext.tsx`, `routes/ProtectedRoute.tsx`).

**Side menu today** (`lib/navigation.ts`) — nine groups, about 45 items:
home · orders (orders, confirmation queue, lost orders, returns, fraud) ·
products (catalog, offers, discounts, reviews, media) · customers (customers,
inbox) · money (profit, settlements, payments, ads) · store (website, blog,
funnels, shipping, store settings) · marketing (campaigns, automations,
affiliates, gift cards, AI) · analytics (analytics, realtime, web analytics,
attribution) · more ways to sell (digital, courses, subscriptions, shoppable
images, services) · footer (apps, settings, activity, referrals, support).

**Home today** (`pages/DashboardHomePage.tsx`, `pages/home/*`): greeting and
a range switch (today / 7 days / 30 days, opens on 7 days), then tiles from
`HomeAnswers.tsx` — `NeedsYouTile`, `ProfitTile`, `ProductTile`, `SalesTile`,
`OrdersTile`, `RateTile` (confirmation, delivery), `LostTile`, `WhereTile` —
plus `SetupGuideCard`, `QuickActions`, `SiteAnalytics`, `StoreOverview`.

**Analytics today** is spread over four menu items and three more pages:
`pages/analytics/AnalyticsPage.tsx`, `reports/` (`OverviewTab`,
`DetailTabs`), `AttributionPage`, `FunnelAnalyticsPage`,
`FunnelPagePerformance`, `WebAnalyticsPage`, `RealtimePage` + `LiveView` +
`liveMap/`, and separately `pages/profit`, `pages/ads`, `pages/settlements`.

**Store editor today:** `/website` (`pages/website/WebsitePage.tsx`,
`ThemeGallery.tsx`, `StoreTextsPage.tsx`), the editor at
`/website/:websiteId/edit` (`pages/website/editor/WebsiteEditorPage.tsx`,
`BlockLibrary.tsx`), previews in `components/StorefrontPreview.tsx` and
`TemplateLivePreview.tsx`, and store settings at `/store-settings/:tab`
(`pages/storeDesign/` — general, store info, pages, policies, SEO, checkout
form, thank-you, domains, languages, customer accounts, access, privacy,
scripts, custom code).

**Funnel builder today:** `/funnels` (`FunnelsPage`, `FunnelWizard`,
`FunnelTemplateGallery`, `marketplace/`), the editor at `/funnels/:funnelId`
(`FunnelEditorPage.tsx` — 1,800 lines — with `StepChain`, `FlowMapTools`,
`FlowLinkPoints`, `StepDetailsForm`, `FunnelStepPageEditor`,
`SplitTestVersions`, `FunnelGrowthPanel`, `FunnelEmailsTab`, `FunnelIssues`).

**Storefront routes** (`apps/storefront/src/app/store/[workspaceId]/…`):
home, `products`, `products/[idOrSlug]`, `cart`, `checkout`, `pay/[orderId]`,
`offer/[orderId]`, `orders/[orderId]`, `track`, `account/*`, `blog/*`,
`f/[ref]/*` (funnel pages), `policies/[key]`, `preview/[token]`, and more.

Installed and usable: `@dnd-kit/*` (drag and drop), `lucide-react` (current
icons). The dashboard has **no** animation library and **no** chart library;
keep it that way unless section 4 says otherwise.

Phone page heights measured today (390px wide) — the longest pages are the
ones to restructure first: website/templates ≈ 11,100px · settings → account
≈ 7,900 · order page ≈ 5,000 · shipping ≈ 4,450 · store settings ≈ 4,100 ·
analytics ≈ 3,600 · apps ≈ 3,500 · product page ≈ 3,150 · home ≈ 2,400 ·
orders list ≈ 2,100.

---

## 4. The design system

### 4.1 Surfaces (values in use)

**The wallpaper — an aurora.** A fixed layer behind the app
(`.glass-app::before`, `position: fixed; z-index: -1`). Gradients only:
nothing to blur, nothing to download.

```
light  base #d5defc
       pools (radial ellipses ≈ 62–70vw × 60–66vh, to transparent at ≈ 70%):
         top-left      color-mix(in srgb, var(--brand) 40%, white)
         top-right     #b9a5ff   violet
         bottom-right  #ffa8d4   pink
         bottom-left   #ffc594   peach
         centre        #8fdcff   sky
dark   base #070a16
       pools  color-mix(in srgb, var(--brand) 60%, black), #43259a, #7a1d5c,
              #6b3414, #0b5578
```

**Three panes of one glass** from `md` up, 12px from the screen edge and from
each other: side menu, toolbar, and the page pane (`main`, radius 1.75rem).
On a phone the page pane runs edge to edge and the toolbar is solid.

```
page pane       paper-raised 50%   (dark 58%)
side menu       paper-raised 54%   (dark 60%)
card            paper-raised 58%   (dark 46%)   near-white on the pane
bars, overlays  paper-raised 88–94% + backdrop-filter: blur(22–28px) saturate(160–180%)
rim             inset 0 1px 0 rgb(255 255 255 / .98), inset 0 0 0 1px rgb(255 255 255 / .62)
                + on large panes: inset 0 18px 28px -22px rgb(255 255 255 / .95),
                                  inset 0 -14px 22px -20px rgb(18 44 110 / .14)
shadow          0 1px 1px rgb(18 44 110 / .04), 0 18px 40px -20px rgb(18 44 110 / .26)
radius          cards 1.5rem · fields 0.875rem · buttons, tabs, chips 9999px
```

Blur **only** where content passes underneath (toolbar, phone dock, menus,
dialogs, sheets, toasts). In-flow panes are translucent with no
`backdrop-filter`: behind them is only the still wallpaper, so there is
nothing to blur, and a list of fifty cards stays cheap on a mid-range phone.
The SVG displacement filter from `liquid-glass` is for **small floating
pieces only** (the dock, a floating action) — never on a pane that holds
text or scrolls.

**Selection and the main action** share one fill:

```
light  linear-gradient(135deg, var(--brand), color-mix(in srgb, var(--brand) 66%, #5b21b6))   white text
dark   linear-gradient(135deg, var(--color-primary), color-mix(in srgb, var(--color-primary) 70%, #a78bfa))   dark ink
glow   0 10px 22px -10px color-mix(in srgb, var(--brand) 70%, transparent)
sheen  a 112° white band (transparent 38% → rgb(255 255 255 / .34) 50% → transparent 62%)
       as the top background layer, background-size 260% 100%,
       sliding from 160% to -60% over 650ms on hover
```

Used by: primary buttons, the current side-menu row, the selected tab or
filter chip, the "needs you now" tile.

**Stat card (`advanced-stats`):** quiet label with an icon chip → one big
tabular figure → a pill chip, ▲/▼ + % in `success` / `danger` on their soft
tints → an area sparkline (2px line, a 12% wash under it). Never a figure
without its comparison; when there is nothing to compare, say so in words.

**Hard floor.** Text is never written straight on the wallpaper. Every text
run holds **4.5:1 against the pixel actually painted behind it** (3:1 at
24px and up), light and dark, desktop and phone. Measure it: render the
page, make the text transparent, sample the pixel under each run. Do not
estimate. Secondary ink and the coloured text shades are a step deeper inside
`.glass-app` for this reason; if you raise the wallpaper's colour, measure
again.

Under `prefers-reduced-transparency` or `forced-colors`, and with the switch
off, every pane is solid and the wallpaper is flat.

### 4.2 Icons — replace the set

The current icons (`lucide-react`, thin outline, one weight) read as generic.
Move to **Phosphor Icons** — `@phosphor-icons/react`, MIT licence — the one
new package the owner allows:

- `regular` at rest; **`fill` for the selected / current state** (the Mac and
  iPhone convention: the current tab is the filled glyph); `duotone` for
  empty states, feature tiles and onboarding; `bold` only at 16px inside
  buttons.
- Sizes: 18px in the side menu, 20px in toolbars, 22–24px in the dock, 16px
  in buttons and chips, 40–48px duotone in empty states.
- **One file owns the mapping**: `apps/merchant-dashboard/src/components/icons.ts`
  exports semantic names (`IconOrders`, `IconConfirm`, `IconCourier`,
  `IconProfit`, …). Pages import from there, never from the package. Migrate
  the shell first, then page by page; `lucide-react` leaves when the last
  import is gone (`packages/ui` keeps its own internal ones).
- In the storefront (Next.js server components) import from the package's
  SSR entry.
- Decorative icons are `aria-hidden`; an icon-only button has an
  `aria-label` through `useT`.
- Directional glyphs (arrows, chevrons, "back") flip in RTL
  (`rtl:rotate-180`); a phone, a clock or a chart does not.
- **Not SF Symbols.** Apple's licence does not allow them outside Apple
  platforms. Not emoji. No second icon family.

### 4.3 Motion

- House curves as CSS variables: a soft spring for moves and sheets (CSS
  `linear()` spring, ≈ 320ms), the overshoot `cubic-bezier(0.175, 0.885,
  0.32, 2.2)` from `liquid-glass` for small pops (dock icon, badge, toggle),
  ease-out 140–200ms for fades and colour.
- Transform and opacity only. Never animate width, height, top or left.
- Page-to-page: the **View Transitions API** — a row's title, amount and
  status chip travel into the detail header; sheets rise; the rest
  cross-fades. Fallback: the existing `page-in` fade.
- Lists: items settle in 30–40ms apart, once, the first ten only.
- Pressed: 0.97 scale. Hover on something that opens: lift 2px.
- A motion library is **not** added by default. If a layout animation is
  truly impossible natively, `motion` may be added to the dashboard — say
  why in the phase note.
- All of it off under `prefers-reduced-motion`.

### 4.4 Words and numbers

`docs/ux/06-design-system.md` section 6 is the word list: «أوردر /
الأوردرات» (never «طلب» for an order), «مسار البيع», «مستني تأكيد», «شغّال»,
«المندوب». One word per thing across the product. Every string through
`useT({ en, ar })`, both languages. Numbers through `fmt` / `formatMoney` /
`countOf` — never raw digits in a string. Money and counts in
`tabular-nums`, inside `<bdi dir="ltr">` where a number meets Arabic text.

---

## 5. Phases — in this order

Each phase: capture "before" (390×844 touch and 1366×800, light and dark) →
build → capture "after" → the checks in section 9 → a five-line note to the
owner with the pictures → **next phase without waiting.**

### Phase 1 — The system: shell, icons, motion

1. Icons (4.2) across the shell.
2. Side menu, Finder-style. Regroup to seven headings; **URLs do not change**,
   role rules (`hiddenForRoles`) stay:
   - **اليوم** (home)
   - **الأوردرات** — orders, confirmation, lost orders, returns, protection
   - **المنتجات** — products, offers & discounts (offers, discounts and gift
     cards as tabs of one hub), reviews, media
   - **العملاء** — customers, messages
   - **التسويق** — campaigns, automations, ads, affiliates, AI studio
   - **المتجر** — store editor, funnels, blog, shipping, payments, store
     settings
   - **الفلوس والتقارير** — profit, settlements, **reports** (one hub —
     Phase 5)
   - closed by default: more ways to sell; footer: apps, settings (activity
     log and referrals move inside it), support.
   Counts as badges on rows that have work waiting (to confirm, to ship,
   unread).
3. Phone dock: floating glass, five slots — اليوم, الأوردرات, التأكيد (with
   its count), المنتجات, المزيد. Pressed icon swells; current is the filled
   glyph.
4. Spotlight (2.3): search orders by number / phone, products, customers,
   pages, actions, recents — with keyboard navigation and result groups.
5. Primitives every later phase uses: `Sheet` (bottom on phone, centred on
   desktop, spring, focus trap, drag to dismiss), `QuickLook`, `ContextMenu`,
   sliding `Segmented`, `Undo` toast, `Popover` for edit-in-place. Built on
   `packages/ui` / Base UI — not a new library.
6. Motion variables and view transitions (4.3). Prefetch on hover /
   touch-start; lists cached and refreshed behind; scroll restored on back.

### Phase 2 — Home: «اليوم»

The merchant's day on one screen, in the order of section 1. It opens on
**today**, not on seven days.

1. **Header** — greeting, store switcher, range (النهارده · ٧ أيام · ٣٠ يوم),
   and a small live chip: visitors now · checking out now → realtime.
2. **«مستنيك دلوقتي»** — the work queue, ranked by money at risk and by age.
   One row per kind of work: the count, **the cost of waiting** («أقدم واحد
   مستني من ٣ ساعات»), one button that starts it. Rows: orders to call,
   confirmed and waiting for a courier, failed deliveries to retry, returns
   to receive, transfers to approve, products out or nearly out, messages
   unanswered, abandoned checkouts worth recovering (with their value). A
   kind with nothing waiting is not shown; when all are clear, one calm line
   says so.
3. **«النهارده»** — four stat cards in one row (two by two on a phone):
   orders, sales, confirmed so far, handed to couriers. Each against
   yesterday at the same hour, with an hour-by-hour sparkline.
4. **«فلوسك»** — net profit for the range (after cost, shipping, ads,
   returns), cash with couriers, next settlement and its date. If product
   costs are missing, say which products and link to fix them — never show a
   profit computed from incomplete costs as if it were whole.
5. **«رحلة الأوردر»** — the COD funnel for the range as four connected
   steps: placed → confirmed → shipped → delivered, the rate between each,
   and **the weakest step called out in a sentence** with its top reason
   («أضعف حتة: التأكيد — ٤ من كل ١٠ ما ردّوش») and a link to the report.
6. **«الإعلانات»** — only when an ad account is connected: spend, orders,
   **cost per delivered order**, best and worst campaign. Not connected: one
   line and a connect button.
7. **«المنتجات»** — top three by delivered profit; running out (days of
   stock left); high return rate.
8. **«آخر الأوردرات»** — five rows, with call / WhatsApp / Quick Look.
9. The setup guide is a single slim progress row once the store has its
   first order, and gone when complete.

Rules: every tile answers one question in a sentence, shows one number with
its comparison, and offers one action. No vanity numbers (page views) on
home. Roles without analytics see the queue and the orders, not the money.
Build from the endpoints that exist (`insights`, `profit`,
`settlementStatements`, `lostOrders`, `orderRiskCounts`, `stockAlerts`,
`live`, `reports`, `dashboard`, `homeFilters`). Where the API does not give a
number, **do not invent it**: add the exact field you need to
`docs/ux/needs-backend.md` and leave that tile out until it exists.

### Phase 3 — Orders: the flow that makes the money

- **List.** One toolbar: search, and one **Filters** sheet holding date,
  risk, sort, saved views, columns and page size. Stage chips in a single
  scrolling row with counts; empty stages behind «كمان». Rows: customer and
  amount first, status chip, place, age. Row → **Quick Look**. Select many →
  a bulk bar (confirm, book courier, print, export). Context menu on each
  row. A phone row is a card with call and WhatsApp.
- **Confirmation queue** — a calling station. One order at a time, large:
  who, what they ordered, how much, where, their history with the store
  (delivered / refused before, flagged number). Big buttons: call, WhatsApp,
  **confirmed**, no answer (reschedules itself), cancelled (with reason),
  edit the order. The next order slides in. Progress for the session («٧ من
  ٢٣»). Keyboard shortcuts on desktop.
- **Order page.** Hero: who · how much · where · **what happens next** as
  one button. Then items, money, notes. Timeline, session details and
  attribution are closed accordions. Status changes in place with Undo.
- **Create order** — a sheet in three short steps (customer → items →
  delivery), each validating as it goes.
- **Lost orders, returns, protection** — same list pattern, each with its
  one recovery action in the row.

### Phase 4 — Products and selling

- **Catalog.** Grid ↔ list switch (remembered). Edit price and stock in
  place. Filters in one sheet. Quick Look on a product.
- **Product page.** Sections — basics, media, price & stock, options, SEO —
  with a sticky section index on desktop and accordions on a phone; the save
  bar always in reach; photos by drag and drop with reorder; variants as an
  editable grid.
- **Offers & discounts** — one hub, tabs for offers, discount codes and gift
  cards; creating one is a sheet with a live preview of how the shopper sees
  it.
- **Customers.** A row shows what matters for COD — orders, delivered rate,
  last order. The customer page leads with their history and a call /
  WhatsApp bar.

### Phase 5 — Reports: one hub that answers questions

Replace the four analytics menu items and the scattered pages with **one
"التقارير" hub**, one range picker kept across tabs (with "compare to the
period before"), and seven tabs named after the question each answers:

| Tab | Answers | Built from |
|---|---|---|
| المبيعات والربح | How much did I really make? | analytics overview, profit |
| رحلة الأوردر | Where do I lose orders? Confirmation, delivery and return rates by governorate, courier, product, source; reasons for refusal | reports, overview, detail tabs |
| الإعلانات | Which campaign pays? Spend → orders → **delivered** orders → profit, by campaign / ad set / UTM | ads, attribution |
| المنتجات | What sells and what comes back? Profit per product after returns, stock days | reports, profit |
| العملاء | Who buys again? New vs returning, repeat rate, by governorate | reports |
| المتجر | Who visits and where do they leave? Traffic, store funnel, page performance | web analytics, funnel analytics |
| دلوقتي | What is happening this minute? | realtime, live map |

Every tab has the same anatomy: a KPI strip of stat cards → **one** main
chart → one breakdown table (sortable, exportable) → **one sentence of plain
Arabic that says what the numbers mean and what to do** («التوصيل في أسيوط
بينجح ٥ من كل ١٠ — جرّب شركة شحن تانية هناك»). Not every chart stacked on a
page. Old URLs redirect into the hub. Nothing that is reported today may
disappear: before moving a page, list what it shows; afterwards, tick each
one off.

### Phase 6 — The store editor: world-class and simple

Today it is the weakest part of the product. Rebuild it so a merchant who
has never built a site publishes a good-looking store in ten minutes.

- **Three zones.** Left: pages and the section list of the current page
  (drag to reorder with `@dnd-kit`). Centre: the **real storefront, live**,
  in a frame with a device switch — phone by default. Right: the inspector
  for whatever is selected — Content, Style, Visibility.
- **Edit where you look.** Click anything in the preview to select it (a
  message bridge to the storefront's `preview/[token]` route). Double-click
  text to type in place. Click an image to replace it from the media
  library. Selected section: a small floating bar — move up, move down,
  duplicate, hide, delete.
- **Add a section** from a "+" between sections in the preview → a library
  sheet of visual thumbnails grouped by purpose (hero, products, offer,
  trust, reviews, FAQ, footer), searchable.
- **Theme panel.** Brand colour, font pair, corner radius, button style —
  changing live, with a handful of presets.
- **Never lose work.** Autosaved draft, Undo / Redo (`⌘Z`, `⇧⌘Z`), version
  history with restore, a shareable preview link. **Publish** is the one
  main button and says what will change.
- **Fast.** A change patches the preview; it does not reload it. Saves are
  debounced.
- **First run.** Three steps: choose a template (2-column grid with a
  category filter and search; a template opens in a sheet with a live
  preview) → brand it → publish.
- **On a phone** the editor is the preview, with the inspector as a bottom
  sheet and the section list one tap away.
- **Both languages.** Arabic and English content side by side in the
  inspector.
- **Store settings** (`/store-settings`) take the System Settings layout
  (2.3). Every existing tab stays reachable.

### Phase 7 — The funnel builder

- **The canvas is the funnel.** Steps as cards on a flow map — landing →
  checkout → upsell → downsell → thank-you — joined by arrows that carry the
  **live conversion %** and the drop-off. "+" on an arrow adds a step; an
  upsell branches yes / no. Drag to rearrange. Pan and zoom.
- **A step opens in the same editor shell as Phase 6** — one page editor in
  the product, not two.
- **Start in under five minutes.** The wizard asks three things — what you
  sell, which offer, which template — and builds the funnel.
- **Performance on the canvas.** Visits, orders and revenue per step; a
  split test on a step shows both versions and the leader.
- Settings, emails and growth tools move to a side sheet; they do not crowd
  the canvas. `FunnelEditorPage.tsx` is 1,800 lines — split it by zone while
  you are there, behaviour unchanged.

### Phase 8 — Settings, shipping, payments

System Settings layout everywhere. Account splits into profile · language &
look · notifications (a table: events down, channels across) · security ·
devices. Shipping: the default price first; the 27 governorates as one
compact table with search and "apply to all / to selected", not 27 cards;
groups, weight bands and zones in their own tabs. Apps: installed first,
category chips in one scrolling row, a grid of cards.

### Phase 9 — The storefront (the shopper's side)

`apps/storefront`. The glass look is the **dashboard's**; a store looks the
way its merchant's theme says. Here the work is flow, speed and polish:

- **Product page**: gallery that swipes, price and offer clear, options as
  large chips, a sticky «اطلب الآن» bar, trust lines (الدفع عند الاستلام،
  الاستبدال، مدة التوصيل) near the button.
- **Checkout**: one page, the fewest fields that get a parcel delivered —
  name, phone, governorate → area, address. Labels above fields, the right
  keyboard for each, validation as you type, the Egyptian phone format
  checked, shipping price and total updating live, the order summary always
  visible. No account required.
- **After the order**: a clear confirmation («هنكلّمك نأكّد»), the upsell
  when the store has one, and a tracking page that reads like a timeline.
- **Speed budget** on a mid-range Android over 4G: LCP under 2.5s, CLS under
  0.1, INP under 200ms. Images sized and lazy, space reserved, skeletons.
- **Icons** from the same family as the dashboard (4.2). RTL throughout;
  44px targets; every state handled.

### Phase 10 — The sweep

Every remaining dashboard page brought to the system: icons, sheets instead
of full-page forms, Quick Look on lists, skeletons, empty states with one
action, the word list. A page-by-page table of done / left at the end.

---

## 6. Patterns that hold on every page

- **Lists.** Search and one Filters sheet. Rows open Quick Look. Bulk bar on
  selection. On a phone a row is a card: name and money on the first line,
  status chip and the one action on the second. Saved views where they
  exist.
- **Forms.** Label above the field, hint under it, error under the field in
  words that say how to fix it. On submit the first invalid field is
  scrolled to and focused. `SaveBar` when dirty; `useUnsavedGuard` before
  leaving. Long forms are sections, not one scroll.
- **States.** Loading is a skeleton in the shape of the content. Empty says
  what this page is for and offers the one action that fills it. Error says
  what happened and offers retry. No-permission says who can grant it.
- **Feedback.** Every action answers within 100ms (pressed state), completes
  optimistically where it is safe, and confirms with a toast — with Undo for
  anything reversible. Destructive actions ask once, in a sheet, naming what
  will be lost.
- **Touch.** Anything a thumb presses is at least 44px, 8px apart. Nothing
  depends on hover.
- **Keyboard** (desktop). Everything reachable by Tab, focus always visible,
  `⌘K` everywhere, `?` shows the shortcuts.

## 7. What "smooth" means here — measure it

- Tapping a menu item shows the next page's frame in under 100ms (cached
  data or its skeleton).
- Going back is instant and lands on the same scroll position.
- No layout shift when data arrives: skeletons hold the space.
- Scrolling a list of fifty cards on a mid-range phone stays at 60fps — no
  `backdrop-filter` on in-flow panes, no shadows animating, no images
  without dimensions.
- Typing in a search field never stutters: debounce the request, not the
  input.

## 8. Rules that do not bend

- Every string through `useT({ en, ar })`. Logical Tailwind classes only
  (`ms-`, `me-`, `ps-`, `pe-`, `start-`, `end-`) — never left / right.
- Every page handles loading, empty, error and no-permission.
- **No feature disappears.** Before re-laying a page, list what it can do;
  after, confirm each is still reachable. Role and plan gates are preserved
  exactly.
- Do not change money, stock, order-state or permission logic.
- New API calls only in your own
  `packages/api-client/src/endpoints/<domain>.ts` with one export line in
  `index.ts`. Do not append to `client.ts` or `types.ts`.
- No new UI library, no chart library, no second design language. The only
  new package: `@phosphor-icons/react` (and `motion` only under 4.3).
- Reuse `PageHeader`, `Section`, `DataTable`, `DataState`, `EmptyState`,
  `Modal`, `KpiCard`, `FilterTabs`, `SectionTabs`, `StatusBadge`,
  `ContactActions`, `SaveBar`. Extend them; do not fork them.
- The look lives in `liquid-glass.css` and the shared components — never as
  one-off classes on a page.
- Do not run the test suites and do not write tests. Verify in the running
  app.
- The reference at `C:/Users/GMP/Downloads/hi-events/frontend` is AGPL:
  study its layout and flows, never copy its code or assets.
- **Git.** In the owner's local folder
  (`C:\Users\GMP\Downloads\zimos-frontend-main\…`) do **not** commit, push,
  fetch, merge or switch branches — he keeps git out of that checkout. In a
  cloud checkout, follow the commit rule in `CLAUDE.md`.

## 9. Checks — once per phase, then move on

1. `npx tsc -b` in `apps/merchant-dashboard` (`npx tsc --noEmit` in
   `apps/storefront`) exits clean.
2. Every touched page opened at 390×844 with touch and at 1366×800, light
   and dark: no console errors, no failed requests, no horizontal scroll.
3. Contrast measured on rendered pixels (4.1) — no text run under the floor.
4. Arabic and English both read correctly; RTL mirrors; numbers in the
   locale's digits.
5. Glass switch off: the same pages are clean and solid.
6. Reduced motion: nothing moves.

Local sign-in for checks: `demo@zimos.test`, password in the backend seed
(`src/db/seeders/20260101000000-demo-data.js`). No bundled Chromium — use
Playwright with `channel: 'msedge'`. Full reloads hit the auth rate limit
(10 a minute): move between pages inside the app. No Python, no `gh` —
script with `node`. `git` is at `"/c/Program Files/Git/bin/git.exe"`.

## 10. Done means

All ten phases built. For each: before/after pictures on phone and desktop,
the checks passing, and three lines on what changed for the merchant. One
closing list: anything left open, and every field the backend still owes
(`docs/ux/needs-backend.md`).

---

# Appendix A — the owner's components, as he sent them

Reference code. Take the design from it (section 2.2); do not paste it in
beside the existing components and do not install its dependencies.

## A.1 `liquid-glass` (ui-layouts) — `GlassEffect`, `GlassDock`, `GlassButton`, `GlassFilter`

`liquid-glass.tsx`

````tsx
"use client";

import React from "react";

// Types
interface GlassEffectProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  href?: string;
  target?: string;
}

interface DockIcon {
  src: string;
  alt: string;
  onClick?: () => void;
}

// Glass Effect Wrapper Component
const GlassEffect: React.FC<GlassEffectProps> = ({
  children,
  className = "",
  style = {},
  href,
  target = "_blank",
}) => {
  const glassStyle = {
    boxShadow: "0 6px 6px rgba(0, 0, 0, 0.2), 0 0 20px rgba(0, 0, 0, 0.1)",
    transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 2.2)",
    ...style,
  };

  const content = (
    <div
      className={`relative flex font-semibold overflow-hidden text-black cursor-pointer transition-all duration-700 ${className}`}
      style={glassStyle}
    >
      {/* Glass Layers */}
      <div
        className="absolute inset-0 z-0 overflow-hidden rounded-inherit rounded-3xl"
        style={{
          backdropFilter: "blur(3px)",
          filter: "url(#glass-distortion)",
          isolation: "isolate",
        }}
      />
      <div
        className="absolute inset-0 z-10 rounded-inherit"
        style={{ background: "rgba(255, 255, 255, 0.25)" }}
      />
      <div
        className="absolute inset-0 z-20 rounded-inherit rounded-3xl overflow-hidden"
        style={{
          boxShadow:
            "inset 2px 2px 1px 0 rgba(255, 255, 255, 0.5), inset -1px -1px 1px 1px rgba(255, 255, 255, 0.5)",
        }}
      />

      {/* Content */}
      <div className="relative z-30">{children}</div>
    </div>
  );

  return href ? (
    <a href={href} target={target} rel="noopener noreferrer" className="block">
      {content}
    </a>
  ) : (
    content
  );
};

// Dock Component
const GlassDock: React.FC<{ icons: DockIcon[]; href?: string }> = ({
  icons,
  href,
}) => (
  <GlassEffect
    href={href}
    className="rounded-3xl p-3 hover:p-4 hover:rounded-4xl"
  >
    <div className="flex items-center justify-center gap-2 rounded-3xl p-3 py-0 px-0.5 overflow-hidden">
      {icons.map((icon, index) => (
        <img
          key={index}
          src={icon.src}
          alt={icon.alt}
          className="w-16 h-16 transition-all duration-700 hover:scale-110 cursor-pointer"
          style={{
            transformOrigin: "center center",
            transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 2.2)",
          }}
          onClick={icon.onClick}
        />
      ))}
    </div>
  </GlassEffect>
);

// Button Component
const GlassButton: React.FC<{ children: React.ReactNode; href?: string }> = ({
  children,
  href,
}) => (
  <GlassEffect
    href={href}
    className="rounded-3xl px-10 py-6 hover:px-11 hover:py-7 hover:rounded-4xl overflow-hidden"
  >
    <div
      className="transition-all duration-700 hover:scale-95"
      style={{
        transitionTimingFunction: "cubic-bezier(0.175, 0.885, 0.32, 2.2)",
      }}
    >
      {children}
    </div>
  </GlassEffect>
);

// SVG Filter Component
const GlassFilter: React.FC = () => (
  <svg style={{ display: "none" }}>
    <filter
      id="glass-distortion"
      x="0%"
      y="0%"
      width="100%"
      height="100%"
      filterUnits="objectBoundingBox"
    >
      <feTurbulence
        type="fractalNoise"
        baseFrequency="0.001 0.005"
        numOctaves="1"
        seed="17"
        result="turbulence"
      />
      <feComponentTransfer in="turbulence" result="mapped">
        <feFuncR type="gamma" amplitude="1" exponent="10" offset="0.5" />
        <feFuncG type="gamma" amplitude="0" exponent="1" offset="0" />
        <feFuncB type="gamma" amplitude="0" exponent="1" offset="0.5" />
      </feComponentTransfer>
      <feGaussianBlur in="turbulence" stdDeviation="3" result="softMap" />
      <feSpecularLighting
        in="softMap"
        surfaceScale="5"
        specularConstant="1"
        specularExponent="100"
        lightingColor="white"
        result="specLight"
      >
        <fePointLight x="-200" y="-200" z="300" />
      </feSpecularLighting>
      <feComposite
        in="specLight"
        operator="arithmetic"
        k1="0"
        k2="1"
        k3="1"
        k4="0"
        result="litImage"
      />
      <feDisplacementMap
        in="SourceGraphic"
        in2="softMap"
        scale="200"
        xChannelSelector="R"
        yChannelSelector="G"
      />
    </filter>
  </svg>
);
// Main Component
export const Component = () => {
  const dockIcons: DockIcon[] = [
    {
      src: "https://cdn.21st.dev/assets/mirror/8d/8d2757d81dfac86570f4c8836c7406741afce9309493d7d32a5176dfb48604b6.png",
      alt: "Claude",
    },
    {
      src: "https://cdn.21st.dev/assets/mirror/a7/a7f5c3a20ee7e3979c200ae2de37dee2396d7b2eae8da7c5c294b1f308f8ebe3.png",
      alt: "Finder",
    },
    {
      src: "https://cdn.21st.dev/assets/mirror/06/06182c64d1993c122cceffea2e27a04c36a824f54b4a01163547b77f197f37bc.png",
      alt: "Chatgpt",
    },
    {
      src: "https://cdn.21st.dev/assets/mirror/b4/b4b6b0474a5074704d0f627855076899d0f1ab61685645103d3839d56297a93a.png",
      alt: "Maps",
    },
    {
      src: "https://cdn.21st.dev/assets/mirror/c2/c208bfbd8c5ceaf0d16c20f77f769600c3ee2c3084934bb74273f348948dc192.png",
      alt: "Safari",
    },
    {
      src: "https://cdn.21st.dev/assets/mirror/ce/ce6c5811b78662b15db06143f35dca896cd78790a05e2f652a921d0c18fbc166.png",
      alt: "Steam",
    },
  ];

  return (
    <div
      className="min-h-screen h-full flex items-center justify-center font-light relative overflow-hidden w-full"
      style={{
        background: `url("https://cdn.21st.dev/assets/mirror/17/171c1b4f04924b3d3783eb3181616526d023c11de774861827927a3a863094f9.jpg") center center`,
        animation: "moveBackground 60s linear infinite",
      }}
    >
      <style>{`
        @keyframes moveBackground {
          0% { background-position: 0 0; }
          to { background-position: 0 -1000%; }
        }
      `}</style>
      <GlassFilter />

      <div className="flex flex-col gap-6 items-center justify-center w-full">
        <GlassDock icons={dockIcons} href="https://x.com/notsurajgaud" />

        <GlassButton href="https://x.com/notsurajgaud">
          <div className="text-xl text-white">
            <p>How can i help you today?</p>
          </div>
        </GlassButton>
      </div>
    </div>
  );
};

export default Component;
````

`demo.tsx` — how it is used

````tsx
import { Component } from "@/components/ui/liquid-glass";

export default function DemoOne() {
  return <Component />;
}
````

## A.2 `advanced-stats` — stat cards with a change badge and an area chart

Its original depends on `recharts`, `class-variance-authority` and the stock shadcn `chart` and `badge` files; those are left out here. In ZIMOS the chart is the existing inline-SVG `Sparkline` in `components/charts.tsx`.

`advanced-stats.tsx`

````tsx
'use client'
import { cn } from '@/lib/utils'
import React, { useRef } from 'react'
import { ClippedAreaChart } from '@/components/ui/advanced-stats-utils/charts'
import { TimelineAnimation } from '@/components/ui/advanced-stats-utils/timeline-animation'

const kpis = [
  { label: 'Total Revenue', value: '$2.4M', change: '+12.5%', status: 'up' },
  {
    label: 'Active Subscriptions',
    value: '14,205',
    change: '+4.2%',
    status: 'up',
  },
  {
    label: 'Avg. Response Time',
    value: '184ms',
    change: '-8.1%',
    status: 'down',
  },
  { label: 'Churn Rate', value: '1.2%', change: '-0.4%', status: 'down' },
]

export default function AdvancedStats() {
  const timelineRef = useRef<HTMLDivElement>(null)

  return (
    <section
      ref={timelineRef}
      className="flex flex-col gap-8 py-4 bg-white min-h-screen justify-center md:px-0 px-5 font-dmSans"
    >
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Chart Section */}
          <TimelineAnimation
            animationNum={1}
            timelineRef={timelineRef}
            className="lg:col-span-2 p-8 rounded-3xl bg-zinc-50 border border-zinc-200"
          >
            <ClippedAreaChart />
          </TimelineAnimation>

          {/* Breakdown Section */}
          <div>
            <div className="flex flex-col gap-4">
              <TimelineAnimation
                animationNum={2}
                timelineRef={timelineRef}
                className="p-6 rounded-3xl h-full bg-zinc-900 text-white flex flex-col justify-between shadow-lg"
              >
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-2">
                    Primary Goal
                  </p>
                  <h4 className="text-xl font-bold tracking-tight">
                    Enterprise Adoption
                  </h4>
                </div>
                <div className="mt-8">
                  <div className="flex justify-between items-end mb-2">
                    <span className="text-3xl font-semibold tracking-tighter ">
                      82%
                    </span>
                    <span className="text-xs font-medium text-zinc-400 mb-1">
                      Target: 90%
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                    <div className="h-full bg-white w-[82%] rounded-full" />
                  </div>
                </div>
              </TimelineAnimation>

              <TimelineAnimation
                animationNum={3}
                timelineRef={timelineRef}
                className="p-6 rounded-3xl h-full bg-zinc-50 border border-zinc-200"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="size-8 rounded-lg bg-zinc-50 flex items-center justify-center border border-zinc-100">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      className="w-6 h-6"
                      color="#000000"
                      fill="none"
                      stroke="#141B34"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M15 8C15 9.65685 13.6569 11 12 11C10.3431 11 9 9.65685 9 8C9 6.34315 10.3431 5 12 5C13.6569 5 15 6.34315 15 8Z" />
                      <path d="M16 4C17.6569 4 19 5.34315 19 7C19 8.22309 18.2681 9.27523 17.2183 9.7423" />
                      <path d="M13.7143 14H10.2857C7.91876 14 5.99998 15.9188 5.99998 18.2857C5.99998 19.2325 6.76749 20 7.71426 20H16.2857C17.2325 20 18 19.2325 18 18.2857C18 15.9188 16.0812 14 13.7143 14Z" />
                      <path d="M17.7143 13C20.0812 13 22 14.9188 22 17.2857C22 18.2325 21.2325 19 20.2857 19" />
                      <path d="M8 4C6.34315 4 5 5.34315 5 7C5 8.22309 5.73193 9.27523 6.78168 9.7423" />
                      <path d="M3.71429 19C2.76751 19 2 18.2325 2 17.2857C2 14.9188 3.91878 13 6.28571 13" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-zinc-900">User Growth</h4>
                </div>
                <p className="text-sm text-zinc-500">
                  Organic acquisition is up{' '}
                  <span className="text-zinc-900 font-semibold">24%</span>{' '}
                  compared to previous quarter.
                </p>
              </TimelineAnimation>
            </div>
          </div>
        </div>

        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6">
          {kpis.map((kpi, index) => (
            <TimelineAnimation
              animationNum={4 + index}
              timelineRef={timelineRef}
              key={kpi.label}
              className={cn(
                'p-6 rounded-2xl border bg-zinc-50 border-zinc-200 transition-colors',
                kpi.status === 'up'
                  ? 'hover:border-emerald-400 hover:bg-emerald-50'
                  : 'hover:border-rose-400 hover:bg-rose-50'
              )}
            >
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest mb-2">
                {kpi.label}
              </p>
              <div className="flex items-baseline justify-between">
                <p className="text-2xl font-black text-zinc-900  tracking-tighter">
                  {kpi.value}
                </p>
                <span
                  className={cn(
                    'text-xs font-bold  px-1.5 py-0.5 rounded',
                    kpi.status === 'up'
                      ? 'text-emerald-600 bg-emerald-50'
                      : 'text-rose-600 bg-rose-50'
                  )}
                >
                  {kpi.change}
                </span>
              </div>
            </TimelineAnimation>
          ))}
        </div>
      </div>
    </section>
  )
}
````

`demo.tsx` — how it is used

````tsx
import AdvancedStats from '@/components/ui/advanced-stats'

export default function Default() {
  return <AdvancedStats />
}
````

## A.3 `sheen-pill-button` — the pill with the sweeping band of light

`sheen-pill-button.tsx`

````tsx
"use client";

import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ReactNode,
} from "react";

import { cn } from "@/lib/utils";

export type SheenPillButtonProps = Readonly<
  {
    children: ReactNode;
    width?: number;
    height?: number;
    highlight?: number;
  } & ComponentPropsWithoutRef<"button">
>;

const SHEEN_PILL_RADIUS = 9999;

const SHEEN_SHELL =
  "group relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-4 overflow-hidden border border-double border-[rgba(51,51,51,0.08)] bg-[rgba(255,255,255,0.08)] backdrop-blur-[5px] brightness-[1.05]";

const SHEEN_SHELL_SHADOW =
  "[box-shadow:inset_2px_-2px_1px_-1px_rgba(255,255,255,0.9),inset_-2px_2px_1px_-1px_rgba(255,255,255,0.9),inset_6px_-6px_1px_-6px_rgba(255,255,255,0.55),inset_-6px_6px_1px_-6px_rgba(255,255,255,0.55),inset_0_0_2px_rgba(0,0,0,0.8),0_4px_8px_rgba(0,0,0,0.2)]";

const SHEEN_SHELL_HOVER_SHADOW =
  "hover:[box-shadow:inset_2px_-2px_1px_-1px_rgba(255,255,255,0.95),inset_-2px_2px_1px_-1px_rgba(255,255,255,0.95),inset_6px_-6px_1px_-6px_rgba(255,255,255,0.65),inset_-6px_6px_1px_-6px_rgba(255,255,255,0.65),inset_0_0_2px_rgba(0,0,0,0.65),0_6px_12px_rgba(0,0,0,0.22)]";

export const SheenPillButton = forwardRef<
  HTMLButtonElement,
  SheenPillButtonProps
>(
  (
    {
      children,
      className,
      width = 180,
      height = 60,
      highlight = 15,
      type = "button",
      disabled,
      style,
      ...props
    },
    ref,
  ) => {
    const shadeVeilWidth = width - 16;
    const shadeVeilHeight = height - 16;
    const rimWireWidth = width - 9;
    const rimWireHeight = height - 9;

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled}
        data-slot="sheen-pill-button"
        className={cn(
          SHEEN_SHELL,
          "transition-[transform,background-color,box-shadow,filter] duration-250 ease-linear motion-reduce:transition-none",
          "hover:scale-[1.02] hover:bg-transparent hover:brightness-110",
          "active:scale-100 motion-reduce:hover:scale-100",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-900",
          "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          SHEEN_SHELL_SHADOW,
          SHEEN_SHELL_HOVER_SHADOW,
          className,
        )}
        style={{
          width,
          height,
          borderRadius: SHEEN_PILL_RADIUS,
          ...style,
        }}
        {...props}
      >
        <span
          aria-hidden="true"
          data-layer="sheen-shade-veil"
          className="pointer-events-none absolute top-[35%] left-1/2 z-0 -translate-x-1/2 border border-[rgba(0,0,0,0.9)] blur-sm transition-[opacity,transform,filter] duration-250 ease-linear group-hover:opacity-80 group-hover:blur-md motion-reduce:transition-none"
          style={{
            width: shadeVeilWidth,
            height: shadeVeilHeight,
            borderRadius: SHEEN_PILL_RADIUS,
          }}
        />

        <span
          aria-hidden="true"
          data-layer="sheen-light-band"
          className="pointer-events-none absolute inset-0 z-10 opacity-80 blur-[7px] transition-[opacity,transform,filter] duration-250 ease-linear group-hover:scale-105 group-hover:opacity-100 group-hover:blur-[9px] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          style={{
            borderRadius: SHEEN_PILL_RADIUS,
            background: `linear-gradient(45deg, rgba(255,255,255,0.8) 0%, transparent ${highlight}%, transparent calc(100% - ${highlight}%), rgba(255,255,255,0.8) 100%)`,
          }}
        />

        <span
          aria-hidden="true"
          data-layer="sheen-rim-wire"
          className="pointer-events-none absolute top-1/2 left-1/2 z-20 -translate-x-1/2 -translate-y-1/2 border border-[rgba(255,255,255,0.2)] blur-[1px] transition-[border-color,opacity] duration-250 ease-linear group-hover:border-[rgba(255,255,255,0.45)] group-hover:opacity-100 motion-reduce:transition-none"
          style={{
            width: rimWireWidth,
            height: rimWireHeight,
            borderRadius: SHEEN_PILL_RADIUS,
          }}
        />

        <span
          data-layer="sheen-label-well"
          className="relative z-30 flex h-full w-full items-center justify-center gap-4 px-[0.8rem]"
        >
          <span
            data-layer="sheen-label"
            className="text-lg leading-none whitespace-nowrap text-[#3e3e3e] filter-[drop-shadow(0_25px_3px_rgba(102,102,102,0.15))] transition-[color,filter,transform] duration-250 ease-linear group-hover:translate-y-[-0.5px] group-hover:text-neutral-800 group-hover:filter-[drop-shadow(0_28px_4px_rgba(102,102,102,0.2))] motion-reduce:transition-none motion-reduce:group-hover:translate-y-0"
          >
            {children}
          </span>
        </span>
      </button>
    );
  },
);

SheenPillButton.displayName = "SheenPillButton";

export default SheenPillButton;
````

`demo.tsx` — how it is used

````tsx
import { SheenPillButton } from "@/components/ui/sheen-pill-button";

export default function SheenPillButtonDemo() {
  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-white">
      <SheenPillButton width={200} height={60}>
        Get started
      </SheenPillButton>
    </div>
  );
}
````
