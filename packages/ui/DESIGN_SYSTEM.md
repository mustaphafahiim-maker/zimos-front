# Zimos design system

The visual identity for all four frontends. It continues the existing
"Nile & Souk" palette rather than replacing it: a blue/teal primary family, a
warm amber secondary, and a Clean Corporate / Modern SaaS base (clear hierarchy,
generous spacing, light shadows) with the warmth carried by colour.

Source of truth for values is each app's CSS file — this document records the
decisions and the reasoning so they can be reviewed. If the two disagree, the
CSS wins and this file is out of date.

| App | Colour file |
| --- | --- |
| merchant-dashboard | `apps/merchant-dashboard/src/index.css` |
| platform-admin | `apps/platform-admin/src/index.css` |
| storefront | `apps/storefront/src/app/globals.css` |
| marketing | `apps/marketing/src/app/globals.css` |

---

## 1. Colour

All values are the `--color-*` brand tokens. Light values live on `:root`, dark
values on `.dark`; `@theme inline` exposes them to Tailwind so `bg-primary`,
`text-ink`, `border-line` … flip with the theme without `dark:` variants.

`(=)` means unchanged by this revision.

### 1.1 Neutrals — merchant-dashboard, platform-admin, storefront

| Token | Light | Dark |
| --- | --- | --- |
| `ink` | `#16211f` (=) | `#e7ecf5` (=) |
| `ink-soft` | `#3c4a46` (=) | `#a9b4c9` (=) |
| `paper` | `#f5f4ef` (=) | `#0b1220` (=) |
| `paper-raised` | `#ffffff` (=) | `#121b2e` (=) |
| `line` | `#dcdace` (=) | `#22304a` (=) |

Light grounds stay warm paper. The dark grounds are the same navy as the
marketing site, so the platform reads as one system after dark.

### 1.2 Primary

| Token | Dashboard light | Dashboard dark | Admin light | Admin dark |
| --- | --- | --- | --- | --- |
| `primary` | `#2563eb` (=) | `#5b8df6` (=) | `#1f5d5b` (=) | **`#4db3ac`** (was `#5b8df6`) |
| `primary-dark` | `#1e3a8a` (=) | `#2563eb` (=) | `#123c3a` (=) | **`#2a7f78`** (was `#2563eb`) |
| `primary-soft` | `#e8f0fe` (=) | `#16233f` (=) | `#e4efee` (=) | **`#152a35`** (was `#16233f`) |

- Dashboard blue `#2563eb` is kept as is; it is also the standard trust-blue
  for SaaS products (same value used for primary and focus ring).
- Admin was teal in light mode but fell back to the marketing **blue** in dark
  mode, because the dark palette had been copied verbatim. The new dark ramp is
  the same teal hue (≈178°) lifted for a navy ground.
- `primary-dark` in dark mode deliberately stays a *deep* shade: both
  `BrandPanel` components paint `bg-primary-dark` behind white text. White on
  `#2563eb` is 5.2:1, on `#2a7f78` 4.8:1.
- Because of that, `primary-dark` **text** on `primary-soft` is only 3.02:1
  (dashboard) / 3.11:1 (admin) in dark mode. Every element that pairs them adds
  `dark:text-primary` (and `dark:hover:text-primary` where the pairing comes
  from a hover state) instead of changing the token: 4.89:1 / 5.91:1. Light
  mode is untouched (9.04:1 / 10.32:1). Elements: sidebar active + hovered nav
  item, header avatar initial (both apps); store switcher's current store,
  `StatusBadge` `info` tone, Catalog status tabs and list/grid toggle, website
  editor's active page tab, template thumbnail placeholder (dashboard).

### 1.3 Accent (secondary) — dashboard and admin

| Token | Light | Dark |
| --- | --- | --- |
| `accent` | `#e2a33d` (=) | `#e8b96a` (=) |
| `accent-dark` | **`#91641c`** (was `#b87f24`) | `#d9a441` (=) |
| `accent-soft` | `#fbf0dc` (=) | `#2b2013` (=) |

`accent-dark` is used as badge text on `accent-soft` (`StatusBadge`,
confirmation queue). The old value measured 3.0:1 there; `#91641c` is the same
hue, darker, and measures 4.6:1 (5.2:1 on white).

### 1.4 Status — dashboard and admin

| Token | Light | Dark |
| --- | --- | --- |
| `danger` / `danger-soft` | `#b3452f` / `#f6e6e1` (=) | `#e8846a` / `#2b1613` (=) |
| `success` / `success-soft` | **`#357150`** (was `#3b7a57`) / `#e5f0e9` (=) | `#5cbf8f` / `#132b1f` (=) |

`success` is text on `success-soft` (`StatusBadge` success tone, success
toasts) and on cards (`Alert` success). The old value measured 4.38:1 on
`success-soft`; `#357150` is the same hue, slightly darker, and measures 4.95:1
there, 5.79:1 on white, and 4.68:1 at the Alert description's 90% opacity.
`danger` on `danger-soft` is 4.55:1 light, 6.47:1 dark.

### 1.5 Component tokens (`packages/ui`) — dashboard and admin

The shared components are built against the component-library token names
(`--background`, `--primary`, `--ring` …). Until this revision those were the
library's neutral greys, so cards, outline buttons, inputs, focus rings and the
page background rendered grey (and near-black, not navy, in dark mode). They now
point at the brand tokens above, so the components change colour through CSS
variables alone — no component source was edited.

| Token | Light | Dark |
| --- | --- | --- |
| `--background` | `var(--color-paper)` | same |
| `--foreground` | `var(--color-ink)` | same |
| `--card`, `--popover` | `var(--color-paper-raised)` | same |
| `--card-foreground`, `--popover-foreground` | `var(--color-ink)` | same |
| `--primary` | `var(--color-primary)` | same |
| `--primary-foreground` | `#ffffff` | `#0b1220` |
| `--secondary` | `var(--color-primary-soft)` | same |
| `--secondary-foreground` | `var(--color-primary-dark)` | `var(--color-primary)` |
| `--muted` | `#ecebe3` | `#1a2540` |
| `--muted-foreground` | `var(--color-ink-soft)` | same |
| `--accent` | `var(--color-accent)` | same |
| `--accent-foreground` | `#16211f` | `#0b1220` |
| `--destructive` | `var(--color-danger)` | same |
| `--border` | `var(--color-line)` | same |
| `--input` | `var(--color-line)` | `#2c3b57` |
| `--ring` | `var(--color-primary)` | same |
| `--chart-1…5` | primary, accent, primary-dark, accent-dark, success | same |
| `--sidebar*` | paper-raised / ink / primary / primary-soft / line | foregrounds as above |

Notes:
- `--primary-foreground` is dark in dark mode because the lifted primaries are
  light: `#0b1220` on `#5b8df6` is 5.9:1 and on `#4db3ac` 7.5:1, while white on
  them would be 3.2:1 and 2.5:1.
- `--muted` is a step between `paper` and `line`, so ghost/outline hover is
  visible on both white cards and the paper ground.
- `--input` is a touch lighter than `line` in dark mode so field outlines stay
  visible on `paper-raised`.
- Tailwind's `bg-accent` is the brand amber (the `--color-accent` brand token
  wins in `@theme inline`), so `--accent` is set to match it and
  `--accent-foreground` is dark ink, which reads on amber in both themes.
- Because `bg-accent` is amber, `DropdownMenu` and `Select` highlight the
  focused / open item with `bg-muted text-foreground` rather than the library's
  `bg-accent text-accent-foreground`: 13.81:1 light, 12.81:1 dark.
- `Alert` `success` uses the `success` token (`text-success`, description at
  90%) instead of hard-coded emerald, so it follows the palette and the theme.

### 1.6 storefront

No colour change. The default palette is the merchant-branding fallback:
`--brand-primary` `#1f5d5b` / `--brand-secondary` `#e2a33d` in light, `#5b8df6` /
`#e8b96a` in dark. `.brand-theme` re-points `--color-primary` / `--color-accent`
at the merchant's `themeSettings.primaryColor` / `secondaryColor` and derives
the `-dark` / `-soft` steps with `color-mix()`. That mechanism is product logic
and is out of scope for visual-identity work.

### 1.7 marketing

Marketing keeps its own cool neutrals (`paper` `#f5f7fb`, `ink` `#0b1220`,
`line` `#dce3ee`), primary `#2563eb` / dark `#5b8df6`, and a slightly deeper
amber `#d9a441`. One value changed:

| Token | Light | Dark |
| --- | --- | --- |
| `accent` | `#d9a441` (=) | `#e8b96a` (=) |
| `accent-dark` | **`#91641c`** (was `#b37f27`) | `#d9a441` (=) |
| `accent-soft` | `#fbf0dc` (=) | `#2b2013` (=) |

`accent-dark` is not decorative only: it is the text colour of the Pricing
badge and of the order-lifecycle code chip, both on `accent-soft`. The old value
measured 3.11:1 there; `#91641c` (the apps' `accent-dark`) measures 4.60:1.
Dark mode was already 7.08:1. The hero eyebrow rule and the badge dot use the
same token and simply get a shade deeper.

The Features section renders `Card` and `Badge` from `packages/ui`, so marketing
defines the component tokens those two read — a subset of §1.5, pointed at its
own palette:

| Token | Light | Dark |
| --- | --- | --- |
| `--foreground`, `--card-foreground` | `var(--color-ink)` | same |
| `--card` | `var(--color-paper-raised)` | same |
| `--primary-foreground` | `#ffffff` | `#0b1220` |
| `--secondary` | `var(--color-primary-soft)` | same |
| `--secondary-foreground` | `var(--color-primary-dark)` | `var(--color-primary)` |
| `--muted` | `#e9eef6` | `#1a2540` |
| `--muted-foreground` | `var(--color-ink-soft)` | same |
| `--border` | `var(--color-line)` | same |
| `--ring` | `var(--color-primary)` | same |

- `--muted` sits between `paper` and `line`, as it does in the apps.
- Tailwind's `@source` lists `card.tsx` and `badge.tsx` by file rather than the
  whole package, so only those components' classes are generated. Using another
  shared component on marketing means adding its file there, plus any token it
  reads that is missing above.

---

## 2. Typography

| Role | Family | Where |
| --- | --- | --- |
| UI text (Latin) | **Inter Variable** (`@fontsource-variable/inter`) | dashboard, admin |
| Display headings `h1–h4` | **Fraunces** | dashboard, admin, storefront |
| Headings (English) | **Fraunces** | marketing `.lang-en` |
| Body (English) | **Plus Jakarta Sans** | marketing `.lang-en`, storefront |
| Headings + body (Arabic) | **Tajawal** 400 / 500 / 700 | marketing `.lang-ar` |
| Arabic glyphs (fallback) | **Tajawal** 400 / 500 / 700 | storefront, after the Latin family in each stack |
| Arabic glyphs (fallback) | **Tajawal** 400 / 500 / 700 | merchant-dashboard, after the Latin family in `--font-sans` / `--font-display` (the funnel builder's Arabic mode) |

- Tajawal replaces Noto Kufi Arabic (headings) and IBM Plex Sans Arabic (body)
  on the marketing site. It is loaded through `next/font/google` like the other
  families. Tajawal has no 600 weight; `font-semibold` renders at 700.
- Arabic headings keep `line-height: 1.28` and `letter-spacing: 0`.
- **Storefront Arabic.** The storefront has no locale switch, so Tajawal sits
  after Fraunces in `--font-display` and after Plus Jakarta Sans in
  `--font-sans`. The Latin faces have no Arabic glyphs, so Arabic text (UI copy,
  prices, merchant pages) falls through to Tajawal while Latin text renders
  exactly as before. Previously Arabic headings rendered in Times New Roman and
  Arabic body text in the system UI font. Tajawal is loaded from the same Google
  Fonts `<link>` in the root layout as the storefront's other families.
- **Fraunces** stays for display headings for now.

---

## 3. Layout principles

- **Base style everywhere: Clean Corporate / Modern SaaS.** Clear type
  hierarchy, generous whitespace, content before decoration.
- **Spacing:** Tailwind's 4px scale. Page gutters `p-6` in the apps; marketing
  sections `py-20`–`py-24` with a `max-w-6xl` container.
- **Surfaces:** `paper` for the page, `paper-raised` for cards, sidebars and
  headers. Separate with a 1px `line` border or `ring-1 ring-foreground/10`
  rather than heavy shadows.
- **Shadows:** `shadow-xs` on controls, `shadow-lg` only on floating layers
  (menus, popovers, dialogs).
- **Radius:** `0.625rem` in the apps (`--radius`, `--radius-card`); `1rem` cards
  on marketing.
- **Actions:** one filled primary action per view; secondary actions outline or
  ghost; destructive actions use the tinted `danger` style.
- **Warmth:** amber is for highlights — badges, markers, small decorative
  accents, the brand panel mosaic. Not for large fills behind body text.
- **Focus:** always visible — 2px `primary` outline, or the components'
  `ring-3 ring-ring/50`.
- **Contrast targets:** 4.5:1 for body text, 3:1 for large text and control
  boundaries.
- **Motion:** 150–250ms ease; everything honours `prefers-reduced-motion`.
- **Bento Grid — one exception:** the marketing Features section only. Every
  other section and app stays on the base style. Six `Card` tiles sit in three
  rows of one wide (two-column) and one narrow tile, alternating 2+1 / 1+2 / 2+1
  from `lg`; two columns from `sm`, one on phones. The grid follows `dir`, so
  the pattern mirrors in Arabic. The lead tile (call confirmation) is the only
  tinted one (`primary-soft`). Wide tiles carry a faint primary dot field that
  fades out from the inline-end top corner. Amber appears only as the dot in
  the section badge.

---

## 4. Per-app summary

| | merchant-dashboard | platform-admin | storefront | marketing |
| --- | --- | --- | --- | --- |
| Primary | Blue `#2563eb` / dark `#5b8df6` | Teal `#1f5d5b` / dark `#4db3ac` | Merchant's `primaryColor` (default teal) | Blue `#2563eb` / dark `#5b8df6` |
| Accent | Amber `#e2a33d` | Amber `#e2a33d` | Merchant's `secondaryColor` (default amber) | Amber `#d9a441` |
| Neutrals | Warm paper / navy | Warm paper / navy | Warm paper / navy | Cool paper / navy |
| Fonts | Inter + Fraunces | Inter + Fraunces | Plus Jakarta Sans + Fraunces · Arabic: Tajawal | EN: Jakarta + Fraunces · AR: Tajawal |
| Uses `packages/ui` | Yes | Yes | No | Card, Badge (Features) |
| Style | Base | Base | Base | Base + Bento Features |

---

## 5. Known gaps and follow-ups

Ratios below are measured from the rendered page (computed colours, WCAG 2
relative luminance), not estimated.

### 5.1 Open

1. **Storefront default palette** is teal in light and blue in dark (the same
   split admin had). Left alone because it is the merchant-branding fallback;
   needs a product decision before it changes.
2. **Dashboard / admin UI font disagrees with §2.** §2 says UI text is Inter
   Variable, but the rendered body text is **Plus Jakarta Sans** on every page
   of both apps (verified with the browser's platform-font report). Cause: the
   unlayered `:root { --font-sans: "Plus Jakarta Sans", … }` in each app's CSS
   wins over the `@theme inline` value `'Inter Variable'`, and `body` reads
   `var(--font-sans)`. Both `index.html` files also load Jakarta + Fraunces from
   Google Fonts, while `@fontsource-variable/inter` is bundled (~220 KB of woff2
   across subsets) but draws nothing. Needs a decision: keep Jakarta (update §2
   and drop the Inter import) or switch to Inter (change `--font-sans` in both
   apps).

### 5.2 Resolved

| Gap | Before | After | Fix |
| --- | --- | --- | --- |
| Dark-mode `primary-dark` text on `primary-soft` (nav, avatar, badges, tabs) | 3.02:1 dashboard / 3.11:1 admin | 4.89:1 / 5.91:1 | `dark:text-primary` on the elements (§1.2) |
| DropdownMenu / Select focused item on amber | amber highlight | 13.81:1 / 12.81:1 on `muted` | `bg-muted text-foreground` in the components (§1.5) |
| Alert `success` hard-coded emerald | off-palette | 5.79:1 light / 7.61:1 dark | `success` token (§1.5) |
| `success` text on `success-soft` (badges, toasts) | 4.38:1 | 4.95:1 | `success` light `#357150` (§1.4) |
| Marketing Pricing badge (`accent-dark` on `accent-soft`) | 3.11:1 | 4.60:1 (dark 7.08:1) | marketing `accent-dark` light `#91641c` (§1.7) |
