# 00 — Summary of the UX redesign (living document)

Branch `ux-redesign` (from `claude/gracious-cori-p3g4hr` @ `1fc9906`).
Status on 2026-10-06: Phases 1–7 written; Phase 8 steps S1–S12, S14–S16
done; S13 (storefront checkout) waits on a parallel branch; backend
handoff items being built (see `progress.md`). This file is rewritten at
the end of every round; the step-by-step record is `progress.md`.

## What changed, screen by screen

| Screen | Before | After |
|---|---|---|
| Whole dashboard (S1) | Navy/blue glass frame, Inter/Jakarta fonts with Arabic falling back to system, English by default, 39 menu items in an order unrelated to daily work, no phone navigation besides a hamburger | One family token file shared by the four products (only `--brand` differs); light neutral palette, Readex Pro for Arabic + Latin, 20 px cards, very soft shadows; Arabic by default; menu ordered by the daily job; one word «أوردر»; phone tab bar (Home · Orders · Confirm with a waiting-call badge · Products · More) |
| Home (S2) | A wall of ~25 zero-value KPI tiles, 8 shortcut tiles, then charts | Answers: a to-do tile («٥ أوردرات مستنية مكالمة تأكيد» → one tap), honest profit (asks for product costs instead of claiming a fake profit), the product that lost/earned most, rates as «٦ من كل ١٠», lost orders to win back, where orders come from; the metric wall folded under «كل الأرقام بالتفصيل» |
| Errors & statuses (S3) | English errors in the Arabic UI (28 screens), formal MSA, raw server text, silent session expiry, English status badges, one state with three names | ~90 errors in friendly Egyptian Arabic that say what to do; never English in the Arabic UI; session-expired notice that returns to the page; Arabic status pills with a dot; «مستني تأكيد» everywhere |
| Orders list (S4) | 1.5–2 phone screens of controls before the first order; phone as plain text; no bulk on phone; UTC dates | First order on the first screen; search → stage chips → one toolbar; call/WhatsApp on each card; select + bulk on phone; dates in the merchant's time zone; guiding empty state |
| Order page (S5) | ~15 stacked sections, contact buried | Hero: customer, one-tap call/WhatsApp, address, total; «الخطوة الجاية» per stage that jumps to its section; work vs. background in two columns |
| Confirmation queue (S6) | «استلام واتصال» didn't call; silent 15-min expiry; no callback time | Header «باقي ٥ مكالمات · ٤ منهم معادهم جه»; claim + dial in one tap; warning ≤3 min; outcome buttons with icons; «يتكلم تاني الساعة» picker (backend added `callbackAt`) |
| Products (S7) | 820 px table scrolling sideways on phones | Phone cards with photo, price, stock, status, actions; first-product empty state |
| Product form (S8) | Description required (API doesn't), errors off screen, no unsaved guard, 15 sections | Name + price + photo; first error scrolled into view; leave-page warning; advanced sections folded |
| Onboarding (S9/S15) | Guide's domain link went to the wrong page; glass/blob sign-in; language only after sign-in; no way out of the plan step | Guide leads with one next step; correct links; test-order opens the store; calm sign-in with a language switch; sign out on the plan step |
| Dialogs & toasts (S10) | Hand-built modal: no focus trap, backdrop tap discarded forms | Base UI dialog (91 screens): focus trap/restore, close button, no accidental discard, bottom sheet on phones; toasts with icon and close |
| Profit & settlements (S11) | Tables first; jargon («Max affordable CPA») | «فضلك X — يعني Y٪ من كل جنيه بعته» + biggest cost; «شركات الشحن لسه عليها X لـ N أوردر»; no page wider than a phone (38 routes checked) |
| ⌘K (S12) | No Arabic folding; errors looked like "no results"; no touch close | «اعدادات» finds «الإعدادات»; real error state; close button; «أوردر جديد» opens a new order |
| Settings (S14) | 15 stacked sections | Six tabs, old #links still land right |
| Platform admin (S16) | Its own teal palette | Same family tokens |
| Shipping → Places (handoff 163/164) | — | Regions → cities → areas with inline prices, import, platform list |
| Collections, funnels (handoff 162/166) | — | Smart collections by tags / all products; funnel bulk actions |

## Skipped or waiting, and why
- S13 storefront checkout and the 163/164 storefront pickers: wait until the
  checkout file-field/billing branch (handoff 165) lands, to avoid two
  branches editing the same checkout page.
- In-app unsaved-changes blocking: needs React Router's data router
  (`useBlocker`); the app uses `BrowserRouter`. Tab close/reload is guarded.
- No dependencies were added.

## Recommended next steps
1. Re-run the Nielsen audit (Phase 4) on the new UI (S17) and plan round 2.
2. Storefront checkout on phones: sticky total + order button, place pickers.
3. Customers list and inbox on phones; analytics pages as answers.
4. Platform admin in Arabic for referral agents (audit U-56).
