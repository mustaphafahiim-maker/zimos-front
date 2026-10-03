# UI rules for coding agents

Read `CLAUDE.md`, `docs/LANES.md` and `docs/UI_SYSTEM.md` first. These rules
extend the existing project conventions, not the lane feature assignments.

1. **Inspect and reuse.** Check `packages/ui/src/index.ts`, the app's
   components and a sibling page before adding anything. No second button,
   table, modal engine or icon library. New dependencies need a concrete gap.
2. **Use the current stack.** Dashboard/admin are React + Vite. Storefront
   and marketing are Next.js. A visual direction does not require a migration.
3. **Use semantic tokens.** Colours come from the host's CSS. Do not duplicate
   colour constants in TypeScript or paste screenshots' colour values into
   page code. Decorative `line` and interactive `line-strong` are different.
4. **Keep information readable.** Use opaque Section/Card for business data,
   prices, charts, long text, long forms and the editor canvas. Limit Glass
   to reviewed navigation, overlays and secondary floating controls.
5. **Keep the prototype scoped.** `/design-system` is DEV only. No API calls,
   auth bypass for product screens, navigation-registry entry, merchant fixture
   imports or automatic production rollout.
6. **Keep one icon language.** Lucide; 18px navigation, 16px compact actions,
   20px prominent actions, stroke 1.75. Preserve existing meanings in
   `lib/navigation.ts`. Branded assets are separate from UI glyphs. Keep the
   approved ZIMOS logo exports rather than recreating them with text or icons.
7. **Localize new UI.** Every new visible or accessible UI string through
   `useT({ en, ar })`. Use logical start/end properties. Do not mirror logos
   or numeric order identifiers. Use locale-aware money/date formatting.
8. **Preserve interaction semantics.** Use Base UI dialogs/menus rather than
   visual divs pretending to be overlays. Keep translated accessible names,
   focus containment/restoration, Escape and keyboard navigation. Do not use
   colour alone for statuses. Touch actions should be at least 44px.
9. **Handle every data state.** Loading, empty, error, no-permission and ready
   all need intentional display. Never pass fictional lab data as real data.
10. **Respect preferences and performance.** Honour reduced motion,
    reduced transparency and forced colours. Offer an opaque fallback.
    No idle particles, decorative looping effects or nested blur stacks.
11. **Verify the slice.** Follow LANES' typecheck and interactive verification
    rules, without running or adding test suites. Verify both languages,
    themes and a small mobile viewport for changed UI. Record limits honestly.

If the needed pattern does not exist, extend a shared primitive with a
documented purpose and show it in the lab. Do not invent a one-page visual
exception and copy it across the product.
