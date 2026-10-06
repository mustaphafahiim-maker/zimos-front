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
- [ ] S6 Confirmation queue — next

## Handoff items done (from backend `frontend-handoff.md`)
- (file does not exist yet on 2026-10-06)

## Local verification setup (any new session)
- Postgres 16: `pg_ctlcluster 16 main start`; scratch DB `zimos_scratch`
  (postgres/postgres). Backend `.env` from `.env.example` with
  `DB_NAME=zimos_scratch`, raised `RATE_LIMIT_MAX`; `npx sequelize-cli
  db:migrate && db:seed:all`; demo login `demo@zimos.test` /
  `DemoPassw0rd!123` (username set to `demo` in the scratch DB).
- Dashboard: `apps/merchant-dashboard/.env` from `.env.example`;
  `npx vite --port 5173`. Screens checked with Playwright at 390 px and
  1366 px in Arabic.

## Backend requests
See `backend-requests.md` (6 open).

## Decisions
- 2026-10-06 Glass frame retired on this branch: the brief asks for a light
  neutral palette with very soft shadows; glass classes now resolve to
  opaque surfaces (06 §5).
- 2026-10-06 Dashboard defaults to Arabic when no language was chosen.
- 2026-10-06 Font: Readex Pro (already a dependency) for Arabic + Latin.
- 2026-10-06 No new dependencies so far.
