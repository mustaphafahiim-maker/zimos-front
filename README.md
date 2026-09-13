# ZIMOS — Frontend

Commerce Without Limits. The ZIMOS frontend is an npm-workspaces monorepo with
four apps and two shared packages.

```
apps/
  merchant-dashboard/  React 19 + Vite. The merchant workspace: orders, call center,
                       WhatsApp inbox, funnels, ads analytics, profit, settlements, catalog…
  platform-admin/      React 19 + Vite. Internal console for the ZIMOS team.
  storefront/          Next.js 16. The public shop customers buy from (COD-first, RTL).
  marketing/           Next.js 16. zimos.co marketing site, Arabic-first.
packages/
  api-client/          Typed client for the ZIMOS backend API (tokens, auto-refresh).
  ui/                  Shared UI kit + ZIMOS brand system (tokens, logo, primitives).
```

## Brand system

Everything visual comes from one place: `packages/ui/src/brand/zimos.css`.

| Token | Value | Use |
|---|---|---|
| Z Blue | `#0066FF` | Primary actions, emphasis |
| Sky Blue | `#66C2FF` | Supporting accent |
| Navy | `#0B1F66` | Important type, dark compositions |
| Ice | `#E8F4FF` | Separators, soft fills |
| Cloud | `#F7FAFF` | Surfaces |

- **Type:** Inter for Latin, Noto Sans Arabic for Arabic (applied automatically under `dir="rtl"`).
- **Shape:** cards `rounded-2xl`, buttons and inputs 10 px, modals 20 px, light-blue borders.
- **Status colours** (success, warning, danger) are functional only.
- **Utilities:** `bg-paper`, `bg-paper-raised`, `text-ink`, `text-ink-soft`, `border-line`,
  `bg-primary`, `bg-primary-soft`, `bg-zimos-ice`, `bg-zimos-navy`, and so on.

### Logo

Use only `<ZimosLogo />` and `<ZimosMark />` from `@store-builder/ui`. Never redraw
or retype the logo. The approved logo currently exists only as raster exports with a
baked-in background, served from each app's `public/brand/`.

> **Required for final output:** the official transparent SVG logo files. See
> `apps/*/public/brand/README.md`.

## Languages

- **Dashboard:** English and Arabic with full RTL. Each page owns its strings:
  `const t = useT({ en: {...}, ar: {...} })` from `src/i18n/LocaleContext.tsx`.
  Use logical Tailwind classes (`ms-`, `pe-`, `start-`, `text-end`…), never `left`/`right`.
- **Storefront:** follows the store's locale, with a customer language switch.
- **Marketing:** `/ar` (default) and `/en`.

## Prototype data

Features whose backend does not exist yet run on a localStorage mock in
`apps/merchant-dashboard/src/mock/` (and `apps/platform-admin/src/mock/`). Every mock
method is annotated with the endpoint it should become. The full backend contract is in
[`BACKEND_CONTRACT.md`](BACKEND_CONTRACT.md).

## Getting started

```bash
npm install
```

Each app has an `.env.example`. Copy it to `.env` (Vite apps) or `.env.local` (Next.js).

```bash
npm run dev:dashboard    # http://localhost:5173
npm run dev:admin        # http://localhost:5174
npm run dev:storefront   # http://localhost:3000  -> open /store/<workspaceId>
npm run dev:marketing    # http://localhost:3001
```

The backend is expected at `http://localhost:4000/api/v1`. The Vite apps proxy `/api`
and `/uploads` to it in development.

Demo login (after seeding the backend): `demo@zimos.test` / `DemoPassw0rd!123`.

## Build

```bash
npm run build:all
```
