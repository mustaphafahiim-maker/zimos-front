# ZIMOS UX redesign, part 1: understanding the system

Research notes for the redesign. They were read from the code on 2026-10-06 and nothing was changed.
Path prefixes: **BE** = backend repo `zimos-backen/`, **FE** = this repo `zimos-front/`.
**Verified** means the cited file says so. **Inferred** means it is a reading of the code or the spec that the code does not state outright.

---

## 1. What ZIMOS does, and for whom

ZIMOS is a store and funnel builder for Egyptian merchants who mostly sell on **cash on delivery (COD)**.
A merchant builds a store or a sales funnel, runs ads to it, and takes orders.
The team phones each COD buyer to confirm the order, books a courier, prints the waybill, and later collects the cash the courier brought in.
The product exists to make that loop fast and to keep fake orders and returns down.

| Actor | Who they are | Where they work | Evidence |
|---|---|---|---|
| **Merchant (owner)** | A small Egyptian seller. "follows their orders from mobile most of the time" | Merchant dashboard (EN/AR, RTL), which is also a PWA | **Verified**: BE `docs/SPEC.md` §20.1; FE `apps/merchant-dashboard/public/manifest.webmanifest`; FE `src/lib/navigation.ts` (`ar` labels) |
| **Merchant team** | Confirmation agents, order operators, fulfilment, accountant, editor, and a co-admin | The same dashboard, filtered by role | **Verified**: BE `src/core/security/permissions.js` `SYSTEM_ROLES` |
| **Shopper** | The merchant's customer. Checks out as a guest, identified by phone, with no account or login | Storefront (Next.js): product, cart, checkout, funnel `/f`, pay page, order tracking, recovery link `/r/:token`, post-purchase offer, downloads, courses (`/learn`), subscription portal | **Verified**: FE `apps/storefront/src/app/store/[workspaceId]/*` (there is no account or login route); BE `src/modules/storefront/storefrontRoutes.js` (`/orders/track`) |
| **Affiliate** (the merchant's marketer) | Promotes the merchant's products with a `ref` link and earns a commission on delivered orders | Public storefront portal: log in with phone + OTP | **Verified**: BE `src/modules/affiliates/affiliateRoutes.js` (`portal`); FE storefront `.../affiliate` |
| **Referral agent** (ZIMOS's sales agent) | Brings merchants to ZIMOS with a referral code and earns a share of their subscription payments | Platform-admin console, "My referrals" page only | **Verified**: BE `src/db/migrations/105-create-platform-roles.js` (`agent`); FE `apps/platform-admin/src/App.tsx` `/my-referrals` |
| **Referring merchant** | Any merchant who joins "Refer & earn" | Dashboard `/referrals` | **Verified**: BE `src/modules/referrals/merchantReferrals.js` |
| **Platform staff** | ZIMOS employees: creator, admin, and any custom console role | Platform-admin console | **Verified**: BE `src/core/security/platformPermissions.js` |
| **ZIMOS support inside a store** | Platform staff acting in a store | They can open a store's data only while the merchant has granted time-boxed support access (1h to 7 days); each use is written to the store's activity log | **Verified**: BE `src/modules/supportAccess/supportAccess.js` |
| **External parties** | Couriers (Bosta, Mylerz, J&T), payment gateways (Paymob, Kashier), Fawaterak (ZIMOS's own billing), WhatsApp Cloud API, dropship suppliers, service providers, API and app developers | Adapters and webhooks; no UI of their own | **Verified**: BE `src/modules/shipping/carriers/`, `payments/gateways/`, `billing/fawaterak/`, `dropship/`, `serviceListings/`, `apiKeys/`, `webhooks/` |

Scope guardrails that limit the UX: there is no call centre, no cloaking, no fake counters, stock or reviews, no broadcast campaigns, and no WhatsApp through a QR code.
**Verified**: BE `docs/SPEC.md` §21; BE `docs/LANES.md` §1 rule 6.

---

## 2. User roles and what each can do

### 2.1 Merchant workspace roles

**How access works.** A user can belong to several stores, with one role per store.
A role is a list of permission strings; the owner holds `'*'`.
The server checks one permission per route, and the dashboard only hides navigation entries.
**Verified**: BE `src/core/middleware/rbac.js`, `tenantContext.js` (`hasPermission`), `workspaces/workspaceService.js` (memberships).

| Role (key) | Permissions | In plain terms | Notable *cannot* |
|---|---|---|---|
| Owner (`owner`) | `*` | Everything | — |
| Workspace Manager (`workspace_manager`). The invite dialog calls it **"Admin"** | Every permission except `orders.confirm`, `billing.manage` and `customers.reveal_sensitive` | Runs the store: orders, products, website, funnels, team, settings, money reports, refunds | Cannot claim or record calls in the confirmation queue, cannot use the WhatsApp inbox, cannot pay the ZIMOS subscription |
| Editor (`editor`) | `website.edit`, `template.manage`, `products.*`, `funnels.manage`, `inventory.view` | Builds products, pages and funnels | Cannot publish the website or funnels; no orders, no analytics |
| Order Operator (`order_operator`) | `orders.view/manage`, `shipping.manage`, `customers.view`, `inventory.view`, `products.view` | Edits and cancels orders, books couriers, bulk actions, assigns and corrects confirmation tasks | Cannot record a confirmation call itself (no `orders.confirm`); cannot refund |
| Confirmation Agent (`confirmation_agent`) | `orders.view`, `orders.confirm`, `customers.view` | Works the confirmation queue, the WhatsApp inbox, and WhatsApp messages to lost orders | Cannot edit, cancel or ship orders |
| Fulfillment (`fulfillment`) | `orders.view`, `shipping.manage`, `inventory.view`, `products.view` | Prints waybills, manifests and invoices (needs only `orders.view`); configures carriers and shipping rates | **Cannot book a courier.** `POST /orders/:id/shipments`, `/orders/bulk` and bulk-ship all require `orders.manage`, although the role's own comment says it "books couriers" |
| Accountant (`accountant`) | `orders.view`, `refunds.manage`, `tax.manage`, `financial_reports.view`, `profit.manage`, `analytics.view`, `billing.manage` | Refunds, COD settlements, profit, analytics, the ZIMOS subscription | Cannot change orders |
| Custom ("Partial") | Built from 12 section checkboxes (`orders`, `shipping`, `products`, `customers`, `discounts`, `store`, `funnels`, `analytics`, `finance`, `messaging`, `apps`, `settings`), plus an "Advanced" list of single permissions | Whatever was ticked | Nobody can grant more than they hold. `billing.manage` and `customers.reveal_sensitive` are owner-only. Team size is limited by the plan (`members`) |

**Verified**: BE `src/core/security/permissions.js` (`SYSTEM_ROLES`, `ACCESS_SECTIONS`); BE `src/modules/team/teamRoutes.js` (`OWNER_ONLY`, invite `access: admin|partial`, `requirePlanLimit('members')`); BE `src/modules/orders/orderRoutes.js` and `shipping/bulkShipRoutes.js` (the Fulfillment gap); BE `src/modules/whatsapp/inboxRoutes.js` (`orders.confirm`); FE `pages/confirmation/confirmationRoles.ts` (`CONFIRM_ROLES = owner, confirmation_agent`).

### 2.2 Dashboard sections and who can open them (system roles)

Abbreviations: O = Owner, M = Manager, E = Editor, OP = Order Operator, CA = Confirmation Agent, F = Fulfillment, A = Accountant.
The sections are those of FE `src/lib/navigation.ts`; the permissions come from each module's `*Routes.js`. **Verified**, unless a row says otherwise.

| Nav group → entry | Permission the API checks | Who can open it |
|---|---|---|
| Orders → Orders, order page, waybill and invoice PDFs | `orders.view` (actions: `orders.manage`) | O M OP CA F A (actions: O M OP) |
| Orders → Confirmation queue | `orders.confirm` to work it; `orders.manage` to assign, correct or release | Work it: O CA. Supervise it: O M OP |
| Orders → Lost orders | `orders.view`; edits `orders.manage`; WhatsApp `orders.confirm` | Same as Orders |
| Orders → Returns, Fraud protection | `orders.view` / `orders.manage`; blocklist `customers.view/manage` | Lists: O M OP CA F A |
| Products → Products, Reviews, Offers, Media, Digital, Courses | `products.view` / `products.manage` | View: O M E OP F. Edit: O M E |
| Customers → Customers / WhatsApp inbox | `customers.view` / `orders.confirm` | Customers: O M OP CA. Inbox: O CA |
| Marketing → Marketing (pixels), Discounts, Automations, Affiliates | `workspace.manage`, `discounts.manage`, `automations.manage`, `affiliates.manage` | O M |
| Online store → Website, Funnels | `website.edit` / `funnels.manage` (publishing: `website.publish` / `funnels.publish`) | Edit: O M E. Publish: O M |
| Analytics → Overview, Live, Traffic, Sources | `analytics.view` | O M A. The nav hides them from E, OP and CA. **F still sees them and gets a 403**, because `fulfillment` is missing from `NO_ANALYTICS_ROLES` (FE `lib/analyticsAccess.ts`) |
| Analytics → Profit, Ad spend | `financial_reports.view`, `profit.manage` | O M A |
| Money → Payments (gateways, methods) | `workspace.manage`; refunds `refunds.manage`; transfer review `orders.manage` | O M (refunds: O M A) |
| Money → COD settlements | Read `financial_reports.view`; write `refunds.manage` | O M A |
| Money → Shipping & Tax | `shipping.manage` / `tax.manage` | Shipping: O M OP F. Tax: O M A |
| Apps / Settings → Team / Billing / Activity / Support | `apps.manage` / `users.manage` / `billing.manage` / `audit_log.view` / `workspace.manage` | O M, except Billing: O A |
| Refer & earn | Any signed-in account (`/api/v1/me/referrals`) | Everyone |

### 2.3 Platform-admin (console) roles

Console roles are **data**, kept in the `platform_roles` table. Each account holds its own editable permission set, and checks look only at that set.
This is a separate namespace from workspace permissions.
**Verified**: BE `src/core/security/platformPermissions.js`; BE `src/db/migrations/105-create-platform-roles.js`.

| Role | Default permissions | Console sections |
|---|---|---|
| Creator | `*` | Everything, including Admin users (`admins.manage`) and Service listings |
| Admin | Overview; workspaces view; subscriptions view/manage; plans; templates; risk; providers view; system; feature flags; announcements; support; audit; admins view; agents view/manage; `commissions.mark_paid`. Migrations 107, 111 and 413 added `payments.record`, `workspaces.manage` (suspend a store) and `providers.manage` | Merchants (Workspaces, Users, Subscriptions, Plans, Usage), Referrals (Agents, Program), Marketplace (Templates, Themes, Suppliers, Apps), Operations (Carriers, Gateways, WhatsApp numbers), Risk (Fraud signals, Global blocklist, Delivery network), Support (Tickets, Announcements, Education), System (Flags, Audit, Health, Queues) |
| Agent | `referrals.view_own` | My referrals (read-only: their own codes, referred stores, commissions) |

**Verified**: FE `apps/platform-admin/src/lib/nav.ts`, `App.tsx`.
**Verified by absence** (no migration adds the keys): the default Admin set lacks `service_listings.*`, so only the creator sees "Service listings" until someone grants it.

---

## 3. How money flows

| # | Flow | Who pays whom, and when | Proof |
|---|---|---|---|
| 1 | **COD sale** | The shopper pays the courier in cash on delivery. A COD order counts as a sale from the moment it is placed, but its `financial_state` stays `pending` until the merchant records the settlement. "Delivered" is never taken to mean "paid". | **Verified**: BE `orders/orderStage.js` (`countsAsSaleSql`), `db/models/Order.js` (top comment) |
| 2 | **Courier → merchant (COD settlement)** | The courier remits the cash it collected, less its fees. The merchant builds a draft settlement from delivered, unsettled COD orders per carrier (collected − fees = net). Confirming it writes `amountPaid` and moves each order to `paid` or `partially_paid`. A courier statement (xlsx or CSV) can be imported: each row is matched by waybill and flagged `ok`, `amount_mismatch`, `already_settled`, `not_settleable`, `not_found` or `duplicate`, and delivered orders the statement leaves out show as **money the courier still holds**. | **Verified**: BE `settlements/settlementService.js`, `settlements/settlementStatementService.js` |
| 3 | **Online payment (Paymob, Kashier)** | The shopper pays by card or wallet into the **merchant's own gateway account**; ZIMOS never holds the money. The order waits in `awaiting_payment` with an expiry. It gets no confirmation call and is not a sale until it is paid. The shopper can retry, or switch to COD on the pay page (the COD checks are re-run). | **Verified**: BE `payments/gateways/README.md`, `payments/onlinePaymentService.js`, `payments/codSwitchChecks.js` |
| 4 | **Manual transfer and deposits** | The shopper pays by InstaPay, Vodafone Cash or bank transfer and uploads a receipt; the merchant confirms or rejects it. A **deposit** is the same mechanism on a COD order (for example, the shipping fee paid up front): the order becomes `partially_paid` and the rest is collected on delivery. | **Verified**: BE `payments/manualTransferService.js` |
| 5 | **Payment-method fee or discount** | The merchant can add a fee or a discount per method (fixed or %) as its own order line, and choose which methods each funnel offers. | **Verified**: BE `payments/paymentRulesService.js` |
| 6 | **Delivery fees** | The shopper pays a shipping line priced by the merchant's rules: offer override, free-shipping products, a free-shipping threshold, then the governorate rate or weight tier, then a default. The courier the merchant books never changes this price. The courier charges the merchant separately; that fee is deducted at settlement. The profit page counts outbound shipping plus return shipping. | **Verified**: BE `shipping/shippingPricing.js`, `settlements/settlementStatementService.js` (`fee` column), `profit/pnlService.js` |
| 7 | **Refunds** | COD, manual and mock payments: one step, recorded as processed, and the merchant hands the money back personally. Gateway payments: two steps. A `pending` row is written first, then the gateway is called and the row settles to `processed` or `failed` (by webhook or sweep). Refunds made in the gateway's own dashboard are picked up too. Cancelling an order can include a refund (needs `refunds.manage`). A **return** (requested → approved/rejected → separate restock) issues no refund on its own. | **Verified**: BE `payments/paymentService.js`, `payments/gatewayRefundService.js`, `orders/orderCancelRefund.js`, `returns/returnService.js` |
| 8 | **Merchant → ZIMOS subscription** | The merchant pays for a plan, monthly or yearly (yearly = 10 × monthly). It is paid on Fawaterak's hosted checkout in EGP when `ONLINE_BILLING_ENABLED`; otherwise a platform admin records the payment by hand (`payments.record`). Subscription states: `draft`, `trialing`, `active`, `past_due`, `suspended`, `cancelled`. With `REQUIRE_SUBSCRIPTION_TO_GO_LIVE`, a draft store takes no orders until it starts a trial, activates a free plan, or pays. Unpaid past the grace day means **creation lock** (no new products or funnels, HTTP 402); a manual suspension returns 403. Fawaterak refunds are done by hand. Prices are data that admins set in Plans. | **Verified**: BE `docs/billing-fawaterak.md`, `billing/subscriptionChargeService.js`, `billing/goLiveService.js`, `core/middleware/subscriptionGuard.js`, `db/models/Subscription.js` |
| 9 | **ZIMOS % fees** | Plans carry `transactionFeeBp` and `codFeeBp`, and the profit page subtracts them as "ZIMOS fees". Nothing charges them: only admin, profit and the model read them, and SPEC §17.4 forbids per-order fees for now. | **Verified**: BE `profit/pnlService.js` (`planFees`). That they are not charged is **Inferred** from a grep |
| 10 | **Referral-agent commission** | A referral code on a subscription gives the merchant a discount. Each billing invoice paid while the code is active writes a ledger row: amount received × rate (default 30%, overridable per code), for the first payment and for renewals (`isFirstPayment`). It is tracking only: a person with `commissions.mark_paid` marks a row paid, and a reversed manual payment voids it. | **Verified**: BE `referrals/commissionPolicy.js`, `referrals/commissionService.js`, `billing/subscriptionChargeService.js` |
| 11 | **Merchant "Refer & earn"** | The same ledger. The share comes from a platform setting (`merchant_referral_program.rateBp`). The merchant asks for a payout by Vodafone Cash, InstaPay or bank transfer, and ZIMOS pays by hand. | **Verified**: BE `referrals/merchantReferrals.js` |
| 12 | **Merchant → affiliate** | An order with the affiliate's `ref` in its attribution earns a % or fixed commission, optionally limited to certain products. It is `pending`, becomes `approved` when the order is delivered, and becomes `void` if it is cancelled or returned. The merchant records a payout by hand; that marks every approved commission `paid`, which is final. | **Verified**: BE `affiliates/commissionService.js`, `affiliates/affiliateService.js` |
| 13 | **Shopper subscriptions and instalments** | Card only, on a gateway that can save the card. Each renewal is a new order charged to the saved card, retried after 1, 3 and 7 days, then cancelled. COD never starts one. | **Verified**: BE `subscriptions/subscriptionService.js` |
| 14 | **Services marketplace and dropship** | Merchants pay service providers off the platform. A dropship order is forwarded to a supplier from the order page. | **Verified**: BE `docs/SPEC.md` §20.5; BE `dropship/dropshipOrders.js` |

**Money model.** Amounts are integer minor units; rates are basis points (3000 = 30%). **Verified**: BE `docs/LANES.md` §1 rule 7; `referrals/commissionPolicy.js`.

---

## 4. Glossary of core domain concepts

**Order state.** An order has three independent state machines plus its shipments:
- `confirmation_state`: `pending` / `confirmed` / `rejected` / `unreachable` / `postponed`
- `financial_state`: `pending` / `partially_paid` / `paid` / `failed` / `refunded` / `partially_refunded`
- `fulfillment_state`: `unfulfilled` / `partially_fulfilled` / `fulfilled` / `returned`

`orderStateService` is the only place that writes them. **Verified**: BE `db/models/Order.js`.

**Stage** is the one status the merchant sees, the tab an order sits under. It is derived in SQL and never stored, so the counts, lists and detail page always agree. The first matching rule wins:

| Stage | Meaning |
|---|---|
| `cancelled` | Cancelled, or the confirmation call ended in a rejection |
| `returned` | The parcel came back (latest live shipment `returned`) |
| `delivered` | The parcel arrived |
| `delivery_failed` | The courier could not deliver |
| `out_for_delivery` | With the courier, on the round |
| `shipped` | Picked up or in transit |
| `awaiting_payment` | Prepaid (card, wallet, transfer) and not paid yet; waiting on the shopper, not the team |
| `needs_follow_up` | The COD call was unanswered or the customer postponed |
| `pending_confirmation` | Waiting for the COD call |
| `ready_to_ship` | Confirmed (or paid) and still on the merchant's desk. This includes a printed but not yet collected waybill (shipment `created`) |

**Verified**: BE `orders/orderStage.js`. A test order (`is_test`) is never counted as a sale. **Verified**: same file.

**Confirmation queue and task.** Each COD order gets one task (prepaid orders get none). The lifecycle is `queued` → claim → `in_progress` → outcome.
- Claiming locks the task to one agent for a TTL (default 15 minutes); an expired lock is released lazily.
- Outcomes:
  - `confirmed` or `rejected` close the task (`done`).
  - `unreachable` and `postponed` send it back to the queue: retry after 4 h for `unreachable`, 24 h for `postponed`.
- Managers can assign tasks to an agent, and the assignment survives retries. A manager can also correct a finished outcome while the order is unshipped.
- Channels: `call`, `whatsapp`, `other`.
- "Confirm via WhatsApp" sends a template with Confirm and Cancel buttons; the customer's tap settles the order.
- When upsell merging is on, a funnel order's task stays unavailable until the **offer window** closes (default 15 minutes).

**Verified**: BE `cod/confirmationService.js`, `cod/confirmationValidation.js`, `config/env.js` (`CONFIRMATION_LOCK_TTL_MINUTES`), `orders/whatsappConfirm.js`, `funnels/funnelOfferMerge.js`.

**Shipment and waybill.** A shipment is one courier booking for an order. Its statuses are `created` → `picked_up` → `in_transit` → `out_for_delivery` → `delivered` / `failed` / `returned`, or `cancelled`. A re-send or a late upsell adds another shipment, and the newest live one decides the stage. The **waybill** is the courier label / AWB number, printed as a PDF (A4 × 4 or 10 × 15 cm, with a "COLLECT (CASH)" box) along with a courier handover manifest. Carriers are Bosta, Mylerz and J&T, plus a sandbox carrier. Status updates arrive by webhook or polling, and tracking numbers can also be imported from CSV. **Verified**: BE `db/models/Shipment.js`, `orders/orderDocuments.js`, `shipping/carriers/`, `shipping/carrierWebhookService.js`, `shipping/carrierSyncService.js`, `orders/orderRoutes.js` (`/import-tracking`).

**Settlement.** A COD settlement is a remittance from one courier reconciled against delivered COD orders. It goes from `draft` (editable) to `confirmed` (locked; orders marked paid). See §3, flow 2. **Verified**: BE `settlements/settlementService.js`.

**Offer.** An offer is how a product is sold: one or more variants × quantities at a price (for example, a 3-pack at a bundle price). It can carry a default flag, a badge, a shipping override, and a real countdown in minutes. The "Offers" page is the hub for bundles, bumps, upsells and cross-sells (**Inferred** from FE nav and BE `offers/`). Bundles and tiers are priced on the server. **Verified**: BE `db/models/Offer.js`, `bundles/bundlePricing.js`.

**Order bump.** A tick box above the order button. It adds one pre-chosen offer as an extra line of the *same* order (`is_order_bump`). It can be set for the whole store or per funnel step. The server prices it, never the browser. **Verified**: BE `checkout/orderBump.js`.

**Upsell / downsell.** Funnel steps shown after checkout.
- If accepted during the offer window, the offer is merged into the order as a line (`is_upsell`).
- If accepted later, it becomes a separate linked order with free shipping.
- Each offer step can be accepted only once.

**Verified**: BE `funnels/funnelOfferMerge.js`.

**Funnel.** A published sequence of step pages (`landing`, `sales`, `opt_in`, `checkout`, `upsell`, `downsell`, `thank_you`, `custom`, `article`), served on the storefront at `/f/:ref`. It has split tests, geo redirects, and its own payment methods. **Verified**: BE `db/models/FunnelStep.js`, `funnels/splitTests.js`, `funnels/geoRedirects.js`; FE storefront `.../f/[ref]`.

**Abandoned checkout / lost order.** The checkout form autosaves a session.
- A session is **abandoned** after 60 minutes of inactivity, a status worked out when the list is read. **Lost orders** (the nav label) widens this with the store's `abandoned_after_minutes` and with refused checkouts.
- `lost_reason` values: `incomplete`, `invalid_data`, `integrity_check`, `otp_unverified`, `outside_country`, `vpn`, `blocked`, `limit_exceeded`, `payment_failed`.
- Each lost order has a review status (`under_review` / `completed`), a recovery link `/r/:token`, a convert-to-order action, and a WhatsApp message.
- A lost order holds no stock and fires no pixel.

**Verified**: BE `checkoutSessions/checkoutSessionStatus.js`, `checkoutSessions/lostOrderService.js`.

**Fraud flags and risk.**
- **Rules.** Fraud rules are set per store: blacklist, duplicate window, orders per phone per day, rejection threshold, max items, minutes between COD orders per IP, outside country, VPN, minimum network delivery rate, high risk, strict phone. Each rule's action is **flag** (the order goes through and carries a `risk_flags` entry), **block** (refused), or **to_lost** (refused and kept as a lost order).
- **Risk score.** Every storefront order also gets a `risk_score`, a `risk_level` (`low`/`moderate`/`high`) and a data-quality rating. These are markers only, unless the `high_risk` rule is on.
- **"Block and cancel"** blocks the order's phone and IP and cancels the order.
- **Platform signals.** A platform-wide delivery-rate network score and a global blocklist feed the rules.

**Verified**: BE `fraud/fraudRules.js`, `risk/riskService.js`, `fraud/protectionActions.js`, `db/models/Order.js`.

**Return vs `returned`.** A *return* is a request after delivery, with a reason code and its own approve and restock steps. The stage `returned` means the *parcel* came back through the courier, often a refusal at the door. They are different things with the same word. **Verified**: BE `returns/returnService.js`, `orders/orderStage.js`.

**Words with two meanings (UX hazard).** **Verified** by the model names in BE `src/db/models/`:
- "Invoice": an `Invoice` is store → shopper; a `BillingInvoice` is ZIMOS → merchant.
- "Subscription": a `Subscription` is the merchant's ZIMOS plan; a `CustomerSubscription` is a shopper's subscription.
- "Referral": an agent's code, a merchant's Refer & earn, and an affiliate's `ref` link.

**Draft store / go live, and apps.**
- A new store can start as a `draft` that can be built but takes no orders until it goes live. **Verified**: BE `billing/goLiveService.js`.
- Some features sit behind catalogue "apps" (for example, `protection`) that are on until uninstalled or off until installed. **Verified**: BE `apps/appGate.js`, `apps/appCatalogue.js`.

---

## 5. Findings that matter for the redesign

1. **The core daily loop is: Orders → Confirmation queue → ship (book courier, print waybill) → track → settle COD → profit.** The stage tabs mirror this loop (§4), and so does the nav order. **Verified**: FE `lib/navigation.ts` (its comment states the order). Making this loop one-handed on a phone is the main job (**Inferred** from SPEC §20.1).
2. **Role gaps (Verified, §2).**
   - The "Admin" (Workspace Manager) role cannot confirm orders or use the inbox.
   - Fulfillment cannot book couriers.
   - Fulfillment sees Analytics links that return a 403.
   - Order Operators supervise the queue but cannot work it.
3. **Money is split in time.** A COD order is a "sale" when placed, "delivered" when the courier says so, and "paid" only when a settlement is confirmed. Screens must not merge these three (**Verified**, §3 flows 1–2).
4. **Five ledgers are recorded by hand**: affiliate payouts, agent commissions, Refer & earn payouts, manual transfers and deposits, and manual subscription payments. Each needs clear "owed / paid" states (**Verified**, §3).
