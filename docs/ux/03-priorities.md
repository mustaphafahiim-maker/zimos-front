# 03 — User priorities (Jobs to be Done)

Sources: roles and permissions from `01-understanding.md` §2 (Verified in
code), feature status from `02-features.md`, pain points from
`04-audit.md`. Which tasks are *daily* and their order is **Inferred** from
the COD business loop the code implements (order → confirm → ship → deliver
→ collect cash) and from SPEC §20.1 ("follows orders from mobile most of
the time"). No usage analytics were available to verify frequency.

## Merchant owner (role `owner`) — on a phone, between other work

| # | Job to be done | Features that serve it today | Gaps (audit IDs) |
|---|---|---|---|
| 1 | *"When I open the app, tell me what needs me right now, so nothing waits too long."* | Home to-do tile (new, S2), confirmation queue counts, order stages, notifications bell | Badge on phone tab bar (done S1). Order list needs 1.5–2 screens of filters before the first order on a phone (U-11). |
| 2 | *"Know whether I'm actually making money this week, and which product is eating it."* | Real profit (`/profit`), product economics, ad spend, home profit tile (S2) | Two different "net profit" definitions (U-20); costs must be entered first or profit is meaningless (handled on home S2: asks for costs instead of showing a fake number). |
| 3 | *"Get the confirmed orders out of the door with the courier today."* | Orders list `?stage=ready_to_ship`, courier booking, waybill PDF, shipment batches, daily delivery sheet | No bulk select on phone cards (U-07); order page buries contact and actions (U-10). |
| (4) | *"Get my store live and selling in minutes."* (first week) | Setup guide, templates, product form, COD on by default | Guide's domain step 404s into the wrong page (U-13); product form requires a description the guide doesn't mention (U-29); sign-up has 6 fields + plan step first (U-68). |

## Confirmation agent (`confirmation_agent`) — on a phone, all day

| # | Job | Features | Gaps |
|---|---|---|---|
| 1 | *"Call the next customer and record the result in two taps."* | Confirmation queue: claim lock, outcomes, channels, WhatsApp confirm | "Claim & call" doesn't call (U-30); slow outcome flow, no callback time on "postponed" (U-31); silent 15-min lock expiry (U-32). |
| 2 | *"Fix a wrong address or phone while the customer is on the line."* | Order contact edit, address matching | Phone is plain text, no `tel:` (U-08). |
| 3 | *"Answer customers on WhatsApp."* | WhatsApp inbox, quick replies | Inbox setup is a Meta developer-console task (U-47) — owner's job. |

## Order operator / fulfillment (`order_operator`, `fulfillment`) — desk + phone

| # | Job | Features | Gaps |
|---|---|---|---|
| 1 | *"Book couriers for all ready orders and print the waybills."* | Bulk actions, bulk waybills (A4×4, 10×15), courier manifest | Fulfillment role cannot book (permission gap, 01 §2.1 — backend, logged in `backend-requests.md`); bulk not reachable on phone (U-07). |
| 2 | *"Chase failed deliveries and returns."* | `delivery_failed` / `returned` stages, returns page | Date filter in UTC (U-09). |
| 3 | *"Find an order fast from a waybill or a phone number."* | Orders search, ⌘K | Phone search needs 10+ digits (U-35); ⌘K has no Arabic normalisation (U-34). |

## Accountant (`accountant`) — desk, weekly

| # | Job | Features | Gaps |
|---|---|---|---|
| 1 | *"Check the courier paid me what they collected."* | COD settlements, statement import, discrepancies, money still with couriers | English status fallbacks in settlements (U-04). |
| 2 | *"See real profit by product/campaign."* | Profit P&L, costs, ad spend, campaigns | Jargon ("max CPA", U-65). |
| 3 | *"Process refunds."* | Two-step refunds, manual transfers | Pending manual-transfer queue has no screen (02 backend-only). |

## Editor (`editor`) — desk

| # | Job | Features | Gaps |
|---|---|---|---|
| 1 | *"Add or update a product with photos and variants."* | Product form, variants bulk editor, media library | Validation errors not scrolled into view on phone (U-17); no unsaved-changes guard (U-15). |
| 2 | *"Change the store's look or a landing page."* | Website editor, funnels | Desktop-first editors (acceptable: inferred desk task). |
| 3 | *"Launch an offer."* | Offers hub (10 sub-screens), discounts, coupons | Offers sub-screens are hidden behind the hub (02). |

## Shopper (storefront) — phone, once

| # | Job | Features | Gaps |
|---|---|---|---|
| 1 | *"Order with cash on delivery without creating an account."* | COD form, phone OTP, order bump | "Place order" below the fold after bumps (U-57); coupon unchecked until order is placed (U-18); raw English server errors (U-03). |
| 2 | *"Know where my parcel is."* | Tracking page | — |

## Referral agent / affiliate

| Job | Features | Gaps |
|---|---|---|
| *"See what I earned and what's still owed."* | Console "My referrals"; affiliate OTP portal | Console is English-only (U-56). |

## What this means for the redesign (priority order)

1. **Today's work on a phone** — home to-do (done), tab bar (done), orders list
   and order page for one-thumb use, confirmation queue speed.
2. **Trust in the words** — every error and status in friendly Egyptian
   Arabic; one word per concept.
3. **Money answers** — profit that is honest about missing costs, the
   product behind a loss, settlements in plain words.
4. **First 10 minutes** — onboarding to a live store and a first test order.
5. Everything else keeps working and gets the new look through the shared
   tokens and components.
