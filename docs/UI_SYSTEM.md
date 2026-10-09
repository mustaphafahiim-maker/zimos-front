# ZIMOS UI foundation — development proposal

This is a reviewable first slice of the Glass UI direction, not a replacement
of all screens. It extends the existing UI package and dashboard conventions.
The proposed shell in the lab is independent of the authenticated AppShell.

## Open the lab

From the repository root:

```bash
npm ci
npm run dev:dashboard
```

Open `http://localhost:5173/design-system`. No backend or login is needed.
If another local lane owns that port, start this app on an unused port:

```bash
npm run dev -w apps/merchant-dashboard -- --port 5209 --strictPort
```

The lab is **development only** (`import.meta.env.DEV`). Production continues
to use the existing route tree, auth and workspace requirements. Do not make
the lab public by placing it inside the authenticated product's route tree.
The fixtures are fictional, live only in the lab and make no API requests.

## Architecture verified on zimos-additions

| Surface | Current implementation | Foundation source |
| --- | --- | --- |
| Merchant dashboard | React 19, Vite, TypeScript, Tailwind 4 | `apps/merchant-dashboard/src/index.css` |
| Platform admin | React + Vite | `apps/platform-admin/src/index.css` |
| Public storefront | Next.js | `apps/storefront/src/app/globals.css` |
| Marketing website | Next.js | `apps/marketing/src/app/globals.css` |
| Shared UI | shadcn source using Base UI, Lucide | `packages/ui/src` |

Do not migrate the dashboard to Next.js for this work. Do not add Magic UI,
Aceternity, Motion or another icon library for effects that existing CSS and
primitives can deliver. The new files add no dependencies.

The older `packages/ui/DESIGN_SYSTEM.md` is a historical cross-app record.
Its dashboard light palette, display font and radius descriptions are stale
relative to current CSS. Current CSS remains authoritative; neither that
document nor a screenshot is permission to replace runtime tokens.

## Current dashboard foundations

| Role | Light value | Dark value |
| --- | --- | --- |
| `primary` | `#2563EB` | `#5b8df6` |
| `primary-soft` | `#E8F0FE` | `#16233f` |
| `paper` | `#f5f6fa` | `#0b1220` |
| `paper-raised` | `#ffffff` | `#121b2e` |
| `ink` | `#131a2b` | `#e7ecf5` |
| `ink-soft` | `#4b5468` | `#a9b4c9` |
| Decorative `line` | `#e3e6ee` | `#22304a` |
| Control `line-strong` | `#868b98` | `#4f6a9d` |

These are a snapshot, not a second token definition. The lab reads CSS live.
Control borders use `line-strong`/`--input`; decorative borders use `line`.

- Spacing: existing Tailwind 4px scale. Keep page gutters and density tied to
  the existing PageHeader, Section and DataTable patterns.
- Controls: `--radius: 0.625rem`; generated size variants derive from it.
- Cards: `--radius-card: 0.75rem`.
- Display stack: Inter Variable → Plus Jakarta Sans → Tajawal → system.
- Body stack: Plus Jakarta Sans → Tajawal → system. The imported Inter and
  the Tailwind font utility do not mean all body text uses Inter. Font family
  resolution and font loading must be checked separately in the browser.
- This proposal leaves font choices and approved logo assets intact.
- Text contrast: verify 4.5:1 for normal text and 3:1 for large text; meaningful
  control boundaries and focus indicators need 3:1. Glass contrast depends on
  the actual backdrop and must be checked wherever it is adopted.

## Existing components to reuse

| Need | Source |
| --- | --- |
| Buttons, inputs, cards, alerts, spinner | `@store-builder/ui` |
| Accessible dialog, menu, select, sheet, tabs | Base UI wrappers in `@store-builder/ui` |
| Page heading and actions | `components/PageHeader.tsx` |
| Titled content surface | `components/Section.tsx` |
| Dense business lists | `components/DataTable.tsx` |
| Label, hint, validation | `components/Field.tsx` |
| Native form selection | `components/Select.tsx` |
| Filtering choices | `components/FilterTabs.tsx` |
| Business status | `components/StatusBadge.tsx` |
| Loading, error and permission handling | `components/DataState.tsx` — loading is a content-shaped skeleton (`skeleton="card" \| "table" \| "tiles"`), never a bare spinner |
| Empty content | `components/EmptyState.tsx` |
| Toast feedback | `components/Toast.tsx` |
| A long form's save action, kept in reach | `components/SaveBar.tsx` — appears when dirty, sticks above the phone tab bar |
| A page's one creation action | `PageHeader primaryAction` — header on desktop, a fixed bar above the tab bar on phones (`PageActionBar` for tabs without a header) |
| Unsaved edits vs a tab switch | `lib/useUnsavedGuard.ts` — `UnsavedGuardProvider` around the tabs, `useReportDirty(dirty)` in each form, `confirmLeave()` before switching |
| Live application shell | `components/DashboardLayout.tsx` |
| Commerce navigation icon meanings | `lib/navigation.ts` |

There are existing accessibility follow-ups, not fixed by a visual effect:
`Modal.tsx` implements Escape/backdrop dismissal but has no focus trap or
focus restoration. Use the Base UI `Dialog` for new modal interaction. The
shared Dialog's default close text is English and its close placement is
physical `right`; the lab disables that button and composes a translated,
logical-positioned `DialogClose`. ThemeToggle still has English accessible
labels in Arabic. These should be addressed in separate bounded changes.

## Opt-in Glass material

Source: `packages/ui/src/styles.css`. Import it once in the adopting host:

```tsx
import '@store-builder/ui/styles.css';
import { GlassPanel, GlassButton } from '@store-builder/ui';

<GlassPanel purpose="navigation">
  <nav aria-label={translatedNavigationLabel}>{navigationItems}</nav>
</GlassPanel>
```

| Component | Purpose | Interaction ownership |
| --- | --- | --- |
| `GlassPanel` | Navigation, floating panel or overlay chrome | Host supplies semantic navigation and controls |
| `GlassButton` | Small secondary floating control | Existing shared Button / Base UI |
| `GlassDialogContent` | Dialog chrome | Existing Dialog; put long forms in an opaque Card inside |
| `GlassDropdownMenuContent` | Short floating action menu | Existing Menu; retain keyboard and focus behavior |

Do not create GlassCard, GlassTable, GlassInput and GlassChart aliases merely
to repeat a CSS effect. A new component needs a distinct reusable behavior.

| Region | Material |
| --- | --- |
| Proposed shell navigation, topbar, short floating menus | Glass permitted after review |
| Short dialog chrome / secondary floating actions | Glass permitted after review |
| Data tables, financial values, charts, dense forms, builder canvas | Opaque Card / Section |
| Merchant storefront | Merchant-controlled branding; untouched by this proposal |

This table is for the `Glass*` components above and for any other app. The
merchant dashboard's sheets no longer follow its third row: since 2026-10-07
its cards and tables are glass through the layer described under "Liquid
glass in the merchant dashboard" below.

This implementation uses CSS translucency and backdrop blur. It does not
simulate optical refraction. Fill is 84% of the host raised-surface token in
light mode, 92% in dark; blur is 16px (8px for small buttons). No new brand
colour is introduced. Borders and text retain the existing semantic tokens.
The material's hover transition is 180ms. There is no motion dependency.

Opaque fallback applies when backdrop filtering is unsupported, when
`prefers-reduced-transparency: reduce` or forced colours are requested, or
under `[data-glass="off"]`. Reduced motion removes material transitions and
lab skeleton animation. The lab toggles data-glass on the document so its
portalled menu/dialog follow the same preference; it restores the previous
attribute on unmount. An eventual product preference belongs to the product
shell rather than to each control.

This material uses existing token names. Admin and marketing adoption needs
review of their host tokens, Tailwind sources and portal theme scope. Do not
import the dashboard CSS into another app.

## Proposed identity (brand board)

The lab opens with a brand board built from the owner's identity brief:
`apps/merchant-dashboard/src/design-system/brand/`. It is a proposal, shown
only in the lab.

- `geometry.ts` holds the numbers: a Z of three modules (24 / 12 / 28 / 12 /
  24 on a 100-unit square), one 29° diagonal, one corner radius, plus the
  16-unit small-size drawing and the drawn wordmark. Change the mark there,
  nowhere else.
- `ZimosBrand.tsx` renders the mark, wordmark, lockups and app icon from it.
- `brand.css` scopes the palette to `.zb` (Deep Navy `#081F5C`, Product Blue
  `#165DFF`, Cyan `#12C8DA`, Light Surface `#F6F9FF`). No product token
  changes.

Until the owner signs it off, the product keeps the approved logo files
(`components/ZimosLogo.tsx`, `public/brand/`) and the tokens in `index.css`.
Rolling it out is a separate, bounded change: the logo component and
favicons, then the tokens.

The brief rules out glass, glow, gradients as structure and 3D for the logo.
For the product surface the owner chose Glass on 2026-10-04 (below); the mark
itself stays flat.

## Liquid glass in the merchant dashboard

History: the owner chose Glass for the product surface on 2026-10-04; the
`ux-redesign` branch retired it on 2026-10-06 for calm opaque surfaces
(`docs/ux/06-design-system.md`); on 2026-10-07 the owner asked for a liquid
glass look again, tables first. It is now one layer on top of the calm
surfaces, not a rewrite of them.

Source: `apps/merchant-dashboard/src/liquid-glass.css`, imported after
`index.css` in `main.tsx`. Delete that import and the dashboard is the calm
design again. Nothing in `index.css`, the tokens or the page files changed.

What the layer does:

- **Backdrop.** Still pools of light in `--color-primary` and `--color-cyan`
  behind the app, on fixed pseudo-elements of `.glass-app`. Nothing moves.
- **Sheets.** The shared `Card` (so `Section`, `KpiCard`), the cards pages
  draw by hand (`bg-paper-raised` with a card-sized radius), outlined
  sections, bento tiles and the side menu are translucent panes with a bright
  rim and a soft sheen.
- **Tables.** A table is one sheet: its card or wrapper is the pane, the head
  is a tint of the pane rather than an opaque band, hairlines are translucent
  and the row under the pointer lights up. This covers `DataTable`, the shared
  `Table` and the raw tables in pages.
- **Frame and overlays.** The top bar, the phone tab bar, menus, selects,
  dialogs, `Modal`, the command bar and toasts are frosted, at 88–94% so their
  text holds over a photo or the brand tile passing beneath.
- **Controls.** Outline buttons, text fields and segmented tracks are small
  panes; the main action keeps the flat brand fill and gains a gloss on its
  top edge.
- **Stat tiles** settle in one after another when a page of figures arrives,
  and a `KpiCard` takes the colour of its trend under the pointer.

Blur is used only where content passes beneath a surface (top bar, tab bar,
overlays). Sheets in the page flow have only the still backdrop behind them,
so they are translucent without `backdrop-filter`: a page of tables costs no
more to draw, and no sheet becomes a containing block for a fixed child. The
side menu and the phone menu are deliberately not blurred for the same reason
(the store switcher keeps a full-screen click-catcher); the phone menu is
solid.

On a phone the layer is lighter: the top bar is solid (one blurred bar, the
tab bar, not two), `Modal` and the command bar are solid sheets, and list
cards keep the two crisp rim lines without the two soft inner glows.

Pages reach the layer through shared components and through class patterns,
not by opting in one by one. A new surface gets it by using `Card`/`Section`,
or the existing hand-drawn recipe. Do not add per-page glass classes. The
layer is unlayered CSS, so it also beats Tailwind hover utilities: a rule that
sets a colour must leave room for the element's own state (see the
`hover:text-` and `hover:border-` exemptions in the file).

**Off switch.** `data-glass="off"` on `<html>` removes the layer: it is
written under `:root:not([data-glass="off"])`. It is set by Settings → Account
→ Language and appearance (`components/GlassToggle.tsx`, stored as
`zimos.glass`), and by the pre-paint script in `index.html` when the device
asks for reduced transparency or forced colours. A media query in the layer
turns the panes solid for the same two preferences if the script did not run.
With the switch off, the orders page is pixel-identical to a capture taken
before the layer existed.

**Contrast.** Inside `.glass-app` secondary ink and coloured text are one step
deeper than on a white card (`--lg-ink-soft`, `--lg-text-*`, `--destructive`).
Worst-case ratios for sheets in the page, measured on rendered pixels against
the strongest part of the backdrop (Edge, 1440 × 900, 2026-10-07), light /
dark:

| Text | Page ground | Sheet | Table head | Side menu |
| --- | --- | --- | --- | --- |
| ink | 13.4 / 11.0 | 16.0 / 11.4 | 16.9 / 11.6 | 14.9 / 10.1 |
| ink-soft | 5.5 / 6.1 | 6.6 / 6.3 | 6.9 / 6.4 | 6.1 / 5.6 |
| primary text | 4.8 / 5.5 | 5.8 / 5.7 | 6.1 / 5.8 | 5.4 / 5.1 |
| success text | 4.9 / 6.2 | 5.9 / 6.4 | 6.3 / 6.5 | 5.5 / 5.7 |
| danger text | 5.0 / 6.0 | 5.9 / 6.2 | 6.3 / 6.3 | 5.5 / 5.5 |
| accent-dark | 4.7 / 7.0 | 5.6 / 7.3 | 5.9 / 7.4 | 5.2 / 6.4 |

For what floats, computed from the live tokens with pure white, pure black and
the brand fill beneath: the bars' lowest is 4.99 light / 4.65 dark (the active
tab label), menus 5.04 / 6.28 (`ink-soft`), and the delete button of a `Modal`
4.65 / 4.70.

The light backdrop is as strong as these numbers allow: `ink-soft` has only
6.3:1 on pure white, so a more vivid backdrop would take page-ground text under
4.5:1. Change a fill or a glow only together with this measurement.

**Not covered.** The reference component's optical refraction (an SVG
displacement filter) is not used: it works in Chromium only, costs too much on
a data surface, and has nothing to bend when only a soft backdrop is behind a
sheet. The full-screen editors, the sign-in pages, platform-admin, the
storefront and marketing are untouched (the main action's gloss and the
frosted menus do reach the editors and sign-in, since they are not scoped to
the shell). Not measured on a real low-end phone or in Safari/Firefox.

## Review before rollout

1. Review the lab in English/LTR and Arabic/RTL, light and dark, at desktop
   and 390px mobile widths. Check menus, dialog focus/restore, Escape, form
   validation, search/filter, toast and all data states.
2. Compare Glass on/off. Check actual readable contrast over each intended
   backdrop and keep data surfaces opaque. Inspect reduced motion and
   transparency fallback. Profile on a real mid-range mobile before putting
   blur on several persistent surfaces.
3. Choose the shell direction with the product owner. Adopt it in one bounded
   AppShell change; preserve routing, role visibility and workspace switching.
4. Review that change before progressively applying it to further surfaces.
   This lab does not establish that the whole SaaS is complete or integrated.

## Prompt for Claude

```text
Read CLAUDE.md, docs/LANES.md, docs/UI_RULES.md and docs/UI_SYSTEM.md.
Work in the current React/Vite dashboard; do not migrate the framework.
Before creating a component, inspect @store-builder/ui and the existing
dashboard page patterns. Reuse PageHeader, Section, DataTable, Field,
StatusBadge, DataState and the existing navigation registry.
Use current index.css semantic tokens, Lucide icons and useT({ en, ar }).
Use logical layout properties and verify Arabic/RTL and dark mode.
Show loading, empty, error and no-permission states.
The Glass lab is a proposal. Do not restyle existing screens or roll it
into the production shell unless the task explicitly asks for that change.
When adopting Glass, import its opt-in stylesheet once; keep tables,
analytics and long forms opaque. Use Base UI primitives for overlays.
Follow the current verification rules; typecheck and verify by opening
the feature. Do not create or run test suites under the lane contract.
```
