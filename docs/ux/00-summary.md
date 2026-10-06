# 00 — Summary of the UX redesign (living document)

Branch `ux-redesign` (from `claude/gracious-cori-p3g4hr` @ `1fc9906`).
Status on 2026-10-06: Phases 1–7 written; Phase 8 round 1 (S1–S17) and
round 2 (R2-1 … R2-12, from the re-audit `08-reaudit.md`, plan
`09-plan-round2.md`) done. Backend handoff items 160–187 and 191, 193, 195
are built; 188–190, 192, 194, 196–199 are being finished (see
`progress.md`). This file is rewritten at the end of every round; the
step-by-step record is `progress.md`.

## What changed, screen by screen

| Screen | Before | After |
|---|---|---|
| Whole dashboard (S1, R2-7, R2-9) | Navy/blue glass frame, Inter/Jakarta with Arabic falling back to system fonts, English by default, 39 menu items in an order unrelated to daily work, only a hamburger on phones | One family token file shared by the four products (only `--brand` differs); light neutral palette, Readex Pro, 20 px cards, very soft shadows; Arabic by default; menu ordered by the daily job. Phone tab bar that follows the role (an editor sees Home + Products), lights «المزيد» on its pages, and opens the menu from its own side without repeating the tabs. Every control ≥ 44 px on touch screens, 16 px field text (no iOS zoom) |
| Home (S2, R2-2, R2-11, R2-12) | A wall of ~25 zero-value KPI tiles | Answers: a to-do tile that counts only calls that are due («ومكالمتين متأجلين لبعدين»), says «معرفناش نجيب اللي مستنياك» with a retry on failure, hides itself for roles without access and nudges a store with no orders; honest profit (asks for product costs and says what the pre-cost figure includes); best seller vs. best earner named correctly; the product/store filter sits with the numbers it changes («أرقام Demo T-Shirt») |
| Errors, words and numbers (S3, R2-6, R2-10) | English errors in the Arabic UI, formal MSA, «3 أوردر» next to «٢٥٠ ج.م.», «القاهرة (Cairo)», «manual-courier», «الفانلز» beside «مسارات البيع» | ~90 errors in friendly Egyptian Arabic; one number system and real plurals everywhere («دقيقتين»، «٣ أوردرات»); place names in the screen's language; «المندوب بتاعك»; one word list (06 §6) applied; activity log fully in Arabic |
| Orders list (S4, R2-12) | 1.5–2 phone screens of controls before the first order; UTC dates | First order on the first screen; stage chips in the COD order with empty stages dimmed; call/WhatsApp on each card; dates in the merchant's time zone; governorate picked from a list |
| Order page (S5, R2-12) | ~15 stacked sections; a row of nine equal buttons with cancel third; «استرداد» offered on unpaid COD orders | Hero with one-tap call/WhatsApp and «الخطوة الجاية»; one action in view, the tools under «أكتر», cancel last and apart; unpaid COD reads «هيتدفع عند الاستلام» with nothing to refund |
| Confirmation queue (S6, R2-5) | 517 px per card on a phone; «استلام واتصال» didn't call | 319 px per card, customer and phone first; claim + dial in one tap («استلم» where no dialer opens); «سجّل واللي بعده» brings the next order in; callback time picker |
| Products and the first product (S7, S8, R2-4) | 820 px table; a new product saved as a hidden draft, price and photo below a dozen optional fields | Phone cards; name → price → quantity → photos first, the rest folded; on sale when saved unless «اعرضه في المتجر على طول» is unticked |
| Lists on phones (R2-1, R2-11, R2-12) | Tables scrolling sideways; card opened only through a tiny name link | Cards everywhere; tap anywhere on a card to open it; blank and zero lines left out; lost orders show one stat line and fold their filters |
| Dialogs (S10, R2-7) | Hand-built modal, backdrop tap discarded forms | Base UI dialog; a clean dialog closes on a tap outside, a dialog with typing asks «تسيب التعديلات؟» |
| Settings (S14, R2-8, R2-9) | 15 stacked sections; two different forms called «بيانات المتجر»; section tabs wrapping into 4 rows | Tabs as one scrolling row with real tab semantics; «هوية المتجر» vs «بيانات التواصل» |
| Store texts (handoff 167, R2-12) | 32,677 px on a phone | One folded line per store page with its change count; leave-page guard |
| Storefront checkout (S13, handoffs 163–165, 183–186) | Typed governorate and city; no phone order bar | Region → city → area pickers priced per pick, address search, express buttons (Apple Pay, Google Pay, PayPal), a sticky total + «اطلب دلوقتي» bar, refusals in the shopper's language; shopper accounts, saved addresses, returns from the tracking page |
| New dashboard areas (handoffs) | — | Places and delivery prices, live map, emails and sending domain, domains (buy, renew with a quote, redirect), webhooks + MCP, Zapier/Make, email marketing, your other store (Shopify/Woo), imports (products by link, contacts by sheet), shopper returns and accounts, display rules in the builder |

## Skipped or waiting, and why
- Handoff 188–190, 192, 194, 196–199: interrupted by a container restart
  (out of memory with seven agents); the unfinished work is saved on the
  agents' branches and is being finished three agents at a time.
- Signed-in shopper features need the backend to allow the
  `X-Shopper-Token` header (CORS); requested in `backend-requests.md`.
- Moving the store identity form into Store settings (R2-8 second half):
  waits until the Store settings tabs stop changing in parallel branches.
- Swipe-down to close a bottom sheet: no gesture library; not added.
- In-app unsaved-changes blocking: needs a data router; tab close/reload is
  guarded.
- No dependencies were added. Map geometry for the live map was generated
  from Natural Earth (public domain) into a source file, not a package.

## Recommended next steps
1. Finish and merge the third handoff batch (188–199).
2. Re-audit (round 3) on the new screens: storefront account and checkout
   on phones, the new dashboard areas, dark mode.
3. A third wording pass on the older MSA screens still left (website
   builder intro, payments, some settings sections).
4. Platform admin in Arabic for referral agents (audit U-56).
