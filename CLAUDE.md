# ZIMOS frontend — rules for Claude

Read `docs/LANES.md` before doing anything: it holds the working rules, what
is already built, and the slice of `docs/SPEC.md` each parallel chat owns.
Where `docs/LANES.md` and `docs/SPEC.md` differ, `docs/LANES.md` wins.

The short version:

- For UI work, also read `docs/UI_RULES.md` and `docs/UI_SYSTEM.md`. The
  dashboard's glass look is one layer, `apps/merchant-dashboard/src/liquid-glass.css`
  (off with `data-glass="off"`): extend it there, never page by page. The
  development-only `/design-system` lab proposes an opt-in Glass material;
  it does not authorize restyling existing screens or changing the stack.

- Do not stop to ask, plan for approval, or ask whether to continue. Decide,
  note the decision in the backend repo's `docs/progress/lane-N.md`, keep
  building.
- Do not run the test suites and do not write tests. Verify by opening the
  page on your lane's port; run `npx tsc -b` (dashboard, admin) or
  `npx tsc --noEmit` (storefront) before committing.
- Work only in your lane's worktree and ports.
- Every string through `useT({ en, ar })`; logical Tailwind classes only;
  every page handles loading, empty, error and no-permission.
- Reuse the existing components and the tokens in `index.css`. No new UI
  library, no restyling of existing screens.
- New API calls go in your own `packages/api-client/src/endpoints/<domain>.ts`
  with one export line in `index.ts` — do not append to `client.ts` or
  `types.ts`.
- Design reference: `C:/Users/GMP/Downloads/hi-events/frontend` — study the
  layout and flows, never copy its code or assets (it is AGPL).
- One feature, one commit; then `git fetch origin`, `git merge
  origin/zimos-additions`, `git push origin HEAD:zimos-additions`. Never
  force-push, never push to `main`.
- `git` is at `"/c/Program Files/Git/bin/git.exe"`. No Python or `gh` on this
  machine — script with `node`.
