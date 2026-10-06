# 06 — Design system: one family, four products

Token file: **`packages/ui/src/tokens.css`** (exported as
`@store-builder/ui/tokens.css`). Each product imports it once and sets
`data-product` on `<html>`. Nothing else in the tokens differs between
products.

| Product | `data-product` | `--brand` | White text on it |
|---|---|---|---|
| ZIMOS store builder (this repo) | `store` (default) | `#165DFF` | 5.19:1 |
| Affiliate marketplace | `affiliate` | `#6D28D9` | 7.10:1 |
| Fulfillment | `fulfillment` | `#0F766E` | 5.47:1 |
| Profit analytics | `analytics` | `#B45309` | 5.02:1 |

Verified by `scratchpad/contrast.cjs` (WCAG 2 relative luminance), not
by eye. Every primary shade is derived from `--brand` with `color-mix`:

| Token | Light | Dark | Use |
|---|---|---|---|
| `--color-primary` | brand | brand 62% + white | the one accent: main button, active nav, focus ring, links |
| `--color-primary-dark` | brand 72% + black | brand 40% + white | text on primary-soft, hover |
| `--color-primary-soft` | brand 9% + white | brand 22% + paper | selected row, active chip, tinted tile |

Checked for all four brands: primary-dark on primary-soft ≥ 7.1:1 (light),
≥ 8.2:1 (dark); dark-mode primary on paper ≥ 5.9:1.

## 1. Principles

1. **Answers first.** A tile states the conclusion in words ("3 orders are
   waiting for a call"), the number second, the chart third.
2. **One accent.** The brand colour marks the single most important action
   on a screen and where you are. Everything else is neutral. Status colours
   (green/red/amber) mean status only and always come with a word or icon.
3. **Arabic RTL first, phone first.** Designs start at 390 px in Arabic.
   Desktop is the same bento grid with more columns. Only logical
   properties (`ms-`, `pe-`, `start-`, `text-end`).
4. **Calm surfaces.** Opaque white cards on a light grey page, a hairline
   edge and a very soft wide shadow. No glass on data, no gradients as
   structure, no decorative motion.
5. **Thumb reach.** The phone gets a bottom tab bar for the four daily
   destinations; primary actions sit at the bottom of the screen on phones
   (sticky action bar) and at the top end on desktop.

## 2. Tokens

### Colour — neutrals
| Token | Light | Dark | Use |
|---|---|---|---|
| `paper` | `#F5F6F8` | `#0E1014` | page background |
| `paper-raised` | `#FFFFFF` | `#171A20` | cards, sidebar, sheets |
| `paper-sunken` | `#EEF0F3` | `#1E2229` | wells, table heads, skeletons, segmented controls |
| `ink` | `#14161A` | `#ECEEF2` | text (17.6:1) |
| `ink-soft` | `#5A606B` | `#A3A9B5` | secondary text (6.3:1 / 7.4:1) |
| `line` | `#E6E8EC` | `#262A33` | decorative hairlines only |
| `line-strong` | `#8B919C` | `#666D7C` | control borders (3.2:1 / 3.4:1, WCAG 1.4.11) |

### Colour — status
| Token | Light text / soft | Contrast | Meaning |
|---|---|---|---|
| `success` | `#1F7A4D` / `#E6F4EC` | 4.7:1 | delivered, paid, confirmed, up-trend that is good |
| `danger` | `#C0362C` / `#FCEBEA` | 4.8:1 | failed, cancelled, returned, loss |
| `accent` (attention) | `#8A5300` on `#FFF3DC`, fill `#F0A020` | 5.8:1 | waiting, needs a decision |

`accent` keeps its historical name so the existing badges keep working; in
this system it is the *attention* colour, not a second brand colour.

### Type
One family for Arabic and Latin: **Readex Pro** (`@fontsource/readex-pro`,
already a dashboard dependency — no new package). Inter remains as a
fallback for Latin.

| Role | Size / line | Weight | Tailwind |
|---|---|---|---|
| Hero number | 32/40 (phone 28/36) | 600 | `text-3xl font-semibold tabular-nums` |
| Page title | 24/32 (phone 22/30) | 600 | `text-2xl font-semibold` |
| Tile title | 15/22 | 500 | `text-[15px] font-medium` |
| Body | 14/22 (15 on phone forms) | 400 | `text-sm` |
| Caption | 12/18 | 400 | `text-xs text-ink-soft` |

Numbers use `tabular-nums` and `<bdi dir="ltr">` for money/IDs so digits never
reorder inside Arabic sentences. Arabic is never uppercased or letter-spaced.

### Shape and elevation
| Token | Value | Use |
|---|---|---|
| `--radius` | 12 px | inputs, buttons, chips |
| `--radius-card` | 20 px | cards, bento tiles, sheets |
| `--radius-pill` | 999 px | status badges, segmented controls, tab bar indicator |
| `--shadow-card` | hairline + `0 8px 24px -12px` at 8% | every card |
| `--shadow-raised` | `0 16px 32px -16px` at 14% | hover on clickable tiles, sticky bars |
| `--shadow-pop` | `0 24px 48px -16px` at 22% | menus, dialogs, command bar |

### Spacing
4 px Tailwind scale. `--bento-gap` 12 px on phones, 16 px from 640 px.
`--page-gutter` 16 px / 24 px. Card padding 16 px phone, 20 px desktop.
Touch targets ≥ 44 px (buttons are `h-11` on phones, `h-10` desktop).

## 3. Layout: the bento grid

`components/Bento.tsx` (new, dashboard):

- `<Bento>` — a CSS grid: 1 column < 640 px, 2 columns ≥ 640, 4 columns ≥ 1024,
  gap `--bento-gap`, `grid-auto-flow: dense`.
- `<BentoTile span={1|2|4} tone="default|brand|attention|success|danger" to?>`
  — an opaque card (radius 20, soft shadow). `to` makes the whole tile a link
  with a hover lift. `tone="brand"` is the single hero tile per screen.
- Tile anatomy: eyebrow (icon + label, `ink-soft`), the **answer sentence**,
  the number, an optional sparkline, and at most one action link at the end.

## 4. Components (changes to existing ones, no new library)

| Component | Change |
|---|---|
| `Card` (ui) | radius → `--radius-card`, shadow → `--shadow-card`, hairline `line` ring |
| `Button` (ui) | radius → `--radius`; `h-11` under 640 px for touch |
| `PageHeader` | title + one-line answer; on phones the primary action moves to a sticky bottom bar |
| `EmptyState` | icon, one sentence on *why it is empty*, one primary next step, optional secondary link |
| `DataState` / errors | friendly Egyptian Arabic copy from `lib/friendlyErrors.ts`, never raw codes |
| `StatusBadge` | pill, soft tone + dot, always a word |
| `DashboardLayout` | opaque white sidebar; phone bottom tab bar (Home · Orders · Confirm · Products · More) |
| `CommandPalette` | unchanged behaviour, `--shadow-pop` + radius 20 |

## 5. Glass

The 2026-10-04 Glass frame is retired on `ux-redesign`: the owner's redesign
brief asks for a light neutral palette with very soft shadows. The glass
classes stay in the CSS (so nothing breaks) but resolve to opaque surfaces.
`data-glass` is no longer needed.

## 6. Voice (Egyptian Arabic)

- Short, warm, direct, second person: «عندك ٣ أوردرات مستنية تأكيد».
- Use the merchant's words: أوردر (not طلب) in the orders area, شحنة,
  بوليصة, تحصيل, مرتجع. One term per concept everywhere (the audit found
  «الطلبات» and «الأوردرات» on the same screen).
- Errors say what happened and what to do: «النت فصل. اتأكد من الاتصال
  وجرّب تاني.» Never a code, never English inside Arabic.

## 7. Adoption

1. `apps/merchant-dashboard/src/index.css` imports the token file and drops
   its own `:root` / `.dark` palette; `@theme inline` keeps exposing the
   tokens to Tailwind. `index.html` sets `data-product="store"`.
2. `apps/platform-admin` adopts the same file in a later step (same token
   names already).
3. The storefront is merchant-branded and does **not** take these tokens.
4. The other three products copy `tokens.css` verbatim and change only
   `data-product`.
