# 05 — The new experience

Inputs: `03-priorities.md` (jobs), `04-audit.md` (68 issues), the brief
(answers not raw data, ≤ 3 clicks, Stripe / Shopify / Linear references).
"Click" = a tap or click that changes what is on screen; typing is not
counted. Counts start from wherever the merchant already is in the app.

## 1. Information architecture

### 1.1 Phone (primary)
A **bottom tab bar** (built, S1) for the four daily destinations plus
"More":

| Tab | Screen | Why it is a tab |
|---|---|---|
| الرئيسية Home | answers + to-do | first thing every day |
| الأوردرات Orders | list as cards, stage chips | the core loop |
| التأكيد Confirm (badge = waiting calls) | confirmation queue | agents live here |
| المنتجات Products | product cards | stock, prices, new product |
| المزيد More | the full side menu as a drawer | everything else |

### 1.2 Side menu (desktop, and "More" on the phone)
Ordered by daily job (built, S1). Groups 1–5 open by default, 6–9 closed:

1. **Home**
2. **Orders** — Orders · Confirm orders · Lost orders · Returns · Fraud protection
3. **Products** — Products · Offers · Discounts · Reviews · Media library
4. **Customers** — Customers · WhatsApp inbox
5. **Money** — Profit · COD settlements · Payments · Ad spend
6. **Online store** — Website · Funnels · Shipping · Store settings
7. **Marketing** — Marketing (pixels) · Automations · Affiliates · AI studio
8. **Analytics** — Reports · Live now · Store traffic · Sales sources
9. **More ways to sell** — Digital · Courses · Subscriptions · Shoppable images · Services
10. (no heading, always open) Apps · Settings · Activity log · Refer & earn · Support

Rules: nothing is removed; every page stays reachable in ≤ 2 clicks from the
menu and in 1 step from ⌘K. Long-tail tools live in group 9 so a new
merchant sees ~20 entries, not 39.

### 1.3 Command bar (⌘K / search button in the top bar)
Exists (`CommandPalette.tsx`). Proposal: Arabic normalisation (ا/أ/إ/آ,
ة/ه, ى/ي, tashkeel) so «اعدادات» finds «الإعدادات» (U-34); show network
errors as errors (U-33); a visible close on touch; actions first ("أوردر
جديد", "ضيف منتج", "اتصل بالأوردر الجاي").

## 2. Core flows and click counts

| Task (role) | Before | After (target) | How |
|---|---|---|---|
| See what needs me (owner) | 2+ (home → scroll past 25 tiles → orders → filter) | **0** | Home to-do tile is the first thing on screen (S2) |
| Confirm the next COD order (agent) | 4: tab → claim → find phone → call, then outcome 2–3 | **3**: Confirm tab → «اتصل» (claims + `tel:`) → outcome | Claim-and-call opens the dialer; outcome buttons big; "postponed" asks for a time |
| Ship all ready orders (operator) | 5+: orders → stage tab → select each → bulk → book | **3**: home «احجز المندوب» → select all → book | Home deep link `?stage=ready_to_ship` (S2); select-all on phone cards |
| Call a customer from an order | 3+ (copy number, open dialer) | **1** | `tel:` link + WhatsApp link on order page and cards |
| Know this week's profit (owner) | 3: menu → Profit → read table | **0** | Home profit tile in a sentence (S2) |
| Find which product loses money | 4: Profit → group by product → sort → read | **0–1** | Home product tile names it; 1 tap to the report |
| Add a product (editor/owner) | 2 + long form | **2**: Products → «ضيف منتج» → save | Form asks only name, price, photo first; rest folded |
| Create a phone order | 3 + unsearchable 200-item select | **2** + search | Home «أوردر جديد» → search product (U-51) |
| Bring back a lost order | 3 | **2**: home lost tile → WhatsApp | Lost tile deep link (S2) |
| Check courier settlement (accountant) | 3 | **2** | Money → COD settlements; answer on top ("شركات الشحن لسه معاها X") |
| Find an order by phone | 2 + full number | **1** + last digits | Backend request: suffix search (U-35) |

## 3. Home screens show answers (built in S2)

Each tile is a sentence first, then the number, then one action:

- «٥ أوردرات مستنية مكالمة تأكيد» → ابدأ الاتصال
- «كسبت تقريبًا ٤٬٤١٧ ج.م. في آخر ٧ أيام» — or, honestly, «ضيف تكلفة كل
  منتج، وإحنا نقولك كسبت كام بجد» when costs are missing
- «"تيشيرت أبيض" خسّرك ٤٬٠٠٠ ج.م. في آخر ٧ أيام — ٦ من ١٠ رجعوا مرتجع»
- «بتأكد ٦ من كل ١٠ أوردرات دفع عند الاستلام»
- «١٢ عميل بدأوا يطلبوا ومكمّلوش» → رجّعهم
- «أغلب أوردراتك من القاهرة»

The raw metric wall is kept, folded, under «كل الأرقام بالتفصيل».
Other answer-first screens (later steps): Profit («الشحن والمرتجعات أكلوا
٣٨٪ من ربحك»), Settlements («بوسطة لسه معاها ١٢٬٠٠٠ ج.م.»), Confirmation
queue header («باقي ٨ مكالمات — آخر واحدة من ساعتين»).

## 4. Proactive next action

The home to-do tile is the suggestion engine. Signals already available
from the API (no backend change):

| Signal (source) | Suggestion |
|---|---|
| Queue `pending` > 0 (`/confirmation-tasks/counts`) | «ابدأ الاتصال» |
| Stage `ready_to_ship` (`/orders/pipeline`) | «احجز المندوب» |
| Stage `delivery_failed` | «كلّم العميل» |
| Stage `needs_follow_up` | «افتح» |
| Lost orders in period (`/analytics/overview`) | «رجّعهم» |
| Cost coverage < 80% (`/profit/pnl`) | «ضيف تكلفة المنتجات» |
| A product with negative profit | «اعرف السبب» |
| Setup guide incomplete (`/dashboard/setup-guide`) | the next unfinished step |

When nothing is waiting: «مفيش حاجة مستنياك دلوقتي» plus the next growth
step (share the store link).

## 5. Onboarding: real value in under 10 minutes

Target path (timed estimate, **Inferred**):
1. Sign up with phone/email + password (1 min) — plan step moved after the
   store exists; username auto-suggested (U-68).
2. Store name → address suggested even for Arabic names (U-48) (30 s).
3. Pick a template (1 min).
4. First product: name, price, one photo — description optional in the
   guide's promise (U-29) (2 min).
5. COD is on by default; shipping = one flat price per Egypt or pick a
   courier (2 min).
6. Publish, then **place a test order on your own store** from the guide
   (2 min) → the order appears in the to-do tile: the merchant sees the full
   loop (order → confirm → ship) with their own data.

Setup guide stays at the top of Home until done; when real work is waiting
it moves below the to-do tile (S2). Domain step links to
`/store-settings/domains` (U-13).

## 6. Empty states that guide

Pattern (`EmptyState`): icon · why it is empty · one primary next step ·
optional secondary link. Examples:

| Screen | Copy (ar) | Primary action |
|---|---|---|
| Orders | «لسه مفيش أوردرات. أول ما عميل يطلب هيظهر هنا.» | شارك لينك متجرك / اعمل أوردر تجريبي |
| Confirmation | «مفيش مكالمات مستنياك 👌 الأوردرات الجديدة بتنزل هنا لوحدها.» | شوف الأوردرات |
| Products | «ضيف أول منتج: اسم وسعر وصورة كفاية.» | ضيف منتج |
| Customers | «العملاء بيتسجلوا لوحدهم مع أول أوردر.» | — |
| Lost orders | «محدش ساب طلبه في النص. كويس!» | — |
| Settlements | «لما شركة الشحن تحوّلك فلوس، سجّلها هنا عشان تعرف مين لسه عليه.» | سجّل تحصيل |

## 7. Errors in friendly Egyptian Arabic

Rules: what happened + what to do, no codes, no English, no blame.
`lib/errorMessages.ts` already maps 80+ codes; its Arabic is formal MSA —
rewrite to Egyptian, and route `lib/errors.ts` (English-only, 28 files,
U-01), login/sign-up (U-02) and storefront checkout (U-03) through it.

| Case | Before | After |
|---|---|---|
| Network | "Can't reach the server…" (English in Arabic UI) | «النت فصل أو السيرفر مش بيرد. اتأكد من الاتصال وجرّب تاني.» |
| Session ended | silent redirect to login | «الجلسة خلصت. ادخل تاني وهترجع لنفس الصفحة.» |
| Permission | «ليست لديك صلاحية…» | «الصفحة دي مش ضمن صلاحياتك. اطلب من صاحب المتجر يفتحهالك.» |
| Validation | generic | «فيه خانات محتاجة تتظبط — معلّمين باللون الأحمر.» + scroll to the first |
| Stock | "There isn't enough stock" | «الكمية دي مش موجودة في المخزن.» |

## 8. What changes visually
See `06-design-system.md`: one neutral family, the brand blue as the only
accent, 20 px cards, very soft shadows, Readex Pro, bento home.
