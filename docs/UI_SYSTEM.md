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
| Loading, error and permission handling | `components/DataState.tsx` |
| Empty content | `components/EmptyState.tsx` |
| Toast feedback | `components/Toast.tsx` |
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

The brief rules out glass, glow, gradients as structure and 3D. Where it and
the Glass material below disagree, the brief is the newer decision: keep
Glass in the lab until the owner chooses, and do not add it to product
screens. The shared `Button` already follows the brief — flat, one weight, a
clear edge.

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
