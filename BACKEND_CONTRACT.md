# Backend contract for the dashboard prototype

The merchant dashboard now shows every feature we want Zimos to have (a mix of
Shopify, LightFunnels and EasyOrders). Features whose backend does not exist yet
run on a localStorage mock in `apps/merchant-dashboard/src/mock/`. This file is
the list of what the backend has to provide to make each screen real, in the
order we should build it.

Conventions (same as the existing API): all routes under
`/api/v1/workspaces/:workspaceId/...` unless noted, money as integer minor units
in strings, percentages as basis points, cursor pagination `{ items, nextCursor }`.
Types are in `apps/merchant-dashboard/src/mock/types.ts` and are meant to be
copied into `packages/api-client/src/types.ts` when the endpoint lands.

Legend: **EXISTS** = backend has it, UI just needs to switch from `mockApi` to
`apiClient`. **EXTEND** = table/module exists, needs new fields or routes.
**NEW** = nothing exists.

---

## Phase 1 — wire what already exists (no backend work)

| Screen | mockApi call | Backend |
|---|---|---|
| Funnels list / editor / publish / pause | `listFunnels`, `getFunnel`, `saveFunnel`, `setFunnelStatus`, `deleteFunnel` | **EXISTS** `src/modules/funnels` (funnel + steps + edges + publish/pause/resume/revisions). Add `api-client` methods and replace the mock. |
| Funnel duplicate | `duplicateFunnel` | **NEW** `POST /funnels/:id/duplicate` (copy steps + edges, status draft). |
| Templates gallery | `listTemplates` | **EXTEND** `templates` table: add `kind` (store/funnel/landing), `category`, `price_amount`, `is_free`, `primary_color`, `tags`, `rtl`. |
| Domains tab | `listDomains`, `addDomain`, `verifyDomain`, `removeDomain` | **EXTEND** `src/modules/domains`: add `target` (`store` \| `funnel`) + `target_id` so a domain can point at one funnel. |
| Team tab | `listStaff`, `saveStaff` | **EXISTS** members + invites + roles. Add roles `confirmation_agent` and `fulfillment` to the system-role seed with the right permission sets. |
| Plan tab | `getPlan` | **EXTEND** `GET /billing/subscription` should return `ordersThisMonth`, `softOrderQuota`, `transactionFeeBasisPoints`, `codFeeBasisPoints`. |
| Inventory adjust | `adjustInventory` | **EXISTS** `POST /inventory/adjust`. |
| Order pipeline board | `apiClient.listOrders` | **EXISTS**. Add `?q=` search on order number / customer name / phone to `GET /orders`. |

## Phase 2 — the COD money-makers (EasyOrders parity)

### 2.1 Fraud protection / fake order blocker — **NEW** `src/modules/fraud/`
- `GET/PUT /fraud/settings` → `FraudSettings` (rules array with `enabled` + `value`, `action: block|flag_for_review`).
- `GET /fraud/blocklist`, `POST /fraud/blocklist`, `DELETE /fraud/blocklist/:id` → `BlockedEntry` (phone / ip / email, reason, source, hits).
- `GET /fraud/flagged?status=` → orders whose `riskFlags` is non-empty (reuse `orders.risk_flags`). `POST /fraud/flagged/:orderId/approve|block`.
- Hook: run the rules inside `orderService.createOrder` **before** inventory reservation. Rules: blacklisted phone, duplicate (same phone + same product within N minutes), max orders per phone per day, Egyptian phone format (`^01[0125]\d{8}$`), high-rejection customer (`customers.total_rejected_orders / total_orders`), OTP for orders above X, IP/country mismatch. `block` → 422 with code `ORDER_BLOCKED`; `flag_for_review` → create order with `riskFlags` + `confirmationState: pending` and push to the confirmation queue with a `flagged` priority.

### 2.2 Abandoned checkouts — **EXTEND** `checkout_sessions` + `carts`
- `GET /abandoned-checkouts?status=` → `AbandonedCheckout` (contact captured so far, items, total, step reached, source store/funnel, recovery status, last activity). A checkout session is "abandoned" after 30 min with no order.
- `POST /abandoned-checkouts/:id/recover` `{ channel: whatsapp|sms, message }` → sends via notifications with a signed cart-resume link, sets `recovery_status = contacted`.
- `PATCH /abandoned-checkouts/:id` `{ recoveryStatus }`.
- Emit `checkout_abandoned` event for automations (2.4).

### 2.3 Shipping carriers — **NEW** `src/modules/shipping/carriers/`
- `GET /shipping/carriers` static catalogue (`Carrier`).
- `GET/POST/PATCH/DELETE /shipping/carrier-accounts` → `CarrierAccount` (credentials encrypted at rest, `is_default`, `auto_create_shipment_on: never|confirmed|paid`, `cod_collection`).
- `POST /shipping/carrier-accounts/:id/test` → hits the carrier API.
- Adapter interface per carrier (`createShipment`, `cancelShipment`, `track`, `printLabel`): start with Bosta and J&T (Egypt), then Aramex. Existing `shipments` table + `zg` tracking codes stay; add `carrier_account_id`, `carrier_tracking_number`, `label_url`.
- `POST /orders/bulk/create-shipments` `{ orderIds, carrierAccountId? }`.
- Tracking webhook per carrier → updates `shipments.status` and fires `order_shipped` / `order_delivered` events.

### 2.4 Automations — **EXTEND** `automation_rules` (model exists, no routes)
- `GET/POST/PATCH/DELETE /automations` → `Automation` (trigger, steps with delay + channel + template + body).
- Triggers: `order_created`, `order_confirmed`, `order_shipped`, `order_delivered`, `order_cancelled`, `checkout_abandoned`, `confirmation_unreachable`.
- Needs a **job queue** (BullMQ + Redis is the obvious choice) for delayed steps. This is also the queue the README says outbound email/SMS should move to.
- Channels: `whatsapp` (Meta Cloud API adapter next to Brevo/Twilio), `sms` (Twilio exists), `email` (Brevo exists), `webhook` (reuse `webhook_endpoints` + HMAC util).
- Template variables: `customer.firstName`, `order.number`, `order.total`, `cart.link`, `cart.itemCount`, `shipment.carrier`, `shipment.trackingUrl`.
- `GET /automations/:id/runs` for the runs counter.

### 2.5 Checkout settings — **EXTEND** `workspaces.settings` jsonb
- `GET/PUT /settings/checkout` → `CheckoutSettings`. The public storefront reads it from `GET /store/:workspaceId`.
- `phoneOtpVerification: true` wires the existing OTP module into `POST /store/:id/checkout`.

## Phase 3 — conversion tooling (LightFunnels parity)

### 3.1 Conversion offers — **EXTEND** `offers` or **NEW** `conversion_offers`
- `GET/POST/PATCH/DELETE /conversion-offers` → `ConversionOffer` with `type: order_bump|post_purchase_upsell|cross_sell|downsell|bundle`, trigger products, offered products, discount, bundle tiers, counters (impressions / accepted / revenue).
- Storefront: `GET /store/:id/offers?context=checkout|post_purchase|cart&productIds=` returns applicable offers. Accepting a post-purchase upsell → existing linked-order path in `orderService` (`linked_from_order_id`). Order bump → extra `order_items` row with `is_order_bump = true` (column exists). Bundle tiers → pricing step in `orderService`.
- Downsell on cancel: storefront calls `GET /store/:id/offers?context=cancel` before confirming a cancel; accepting applies the discount to the order and keeps it.

### 3.2 A/B experiments — **EXTEND** `experiments` + `experiment_assignments` (models exist, no routes)
- `GET/POST/PATCH/DELETE /experiments`, `POST /experiments/:id/start|pause|complete`, `POST /experiments/:id/winner` `{ variantId }`.
- Runtime: funnel session runtime picks a variant per visitor (sticky via `experiment_assignments`), records `visitors` / `conversions` per variant. `auto_pause_loser` runs a nightly job (z-test ≥ 95 %).

### 3.3 Tracking pixels + server-side events — **NEW** `src/modules/tracking/`
- `GET/POST/PATCH/DELETE /tracking-pixels` → `TrackingPixel` (platform, pixel id, CAPI token encrypted, events, status).
- `POST /tracking-pixels/:id/test` sends a test purchase event.
- Storefront injects the client pixels from `GET /store/:id` and posts `page_view/view_content/add_to_cart/initiate_checkout/purchase` to `POST /store/:id/events`; the server forwards to Facebook CAPI / TikTok Events API / Snap CAPI with `event_id` dedup and hashed phone/email.
- Store the raw events in `analytics_events` (table exists) → this is also the source for 4.1.

### 3.4 Payments & currencies — **EXTEND** `src/modules/payments`
- `GET/PUT /settings/payments` → per-workspace `PaymentGateway[]` (enabled, credentials encrypted, fee). Real adapters: Paymob first (cards + wallets + Fawry reference), then InstaPay, then Stripe.
- `GET/PUT /settings/currencies` → `CurrencySetting[]`; storefront prices convert with `rateToDefault` + rounding rule; orders keep the presented currency in `orders.currency` (column exists).

### 3.5 Ad review shield (camouflage) — **NEW**
- `GET/PUT /settings/camouflage` → `CamouflageSettings`.
- `hostResolver` / storefront middleware: if enabled and (country in `blockedCountries` OR user-agent matches) → serve the decoy page instead of the funnel/product page. Needs a GeoIP lookup (MaxMind lite).

## Phase 4 — insights

### 4.1 Analytics — **EXTEND** `analytics_events`
- `GET /analytics/overview?range=7d|30d|90d` → `AnalyticsOverview` (totals + previous period + daily series + top products + by source + by governorate + pipeline counts). Compute with SQL over `orders`, `shipments`, `analytics_events`; cache per workspace for 5 min.
- `GET /analytics/export.csv?range=`.

### 4.2 Inventory list — **EXTEND** `src/modules/inventory`
- `GET /inventory?lowStock=true&q=` → `InventoryRow[]` (joins `product_variants` with product name; `low_stock_threshold` column to add).
- `PATCH /inventory/:variantId` `{ lowStockThreshold }`.
- Emit `low_stock` event for automations.

### 4.3 Apps & integrations — **NEW** `src/modules/apps/`
- `GET /apps` catalogue, `GET /apps/installed`, `POST /apps/:key/install|uninstall`, `GET/PUT /apps/:key/config`. Each "app" is really a feature flag + config blob; the heavy ones (WhatsApp, Bosta, Paymob) reuse the adapters above.

## Phase 5 — beyond the competitors (types in `src/mock/types2.ts`, mock in `src/mock/api2.ts`)

### 5.1 Ads & media buying — **NEW** `src/modules/ads/`
- `GET/POST/DELETE /ads/accounts` → `AdAccount`. OAuth with Meta Marketing API, TikTok Business API, Snap Marketing API; store long-lived tokens encrypted; refresh job.
- `GET /ads/campaigns?range=` → `Campaign[]` with nested `adSets[].creatives[]`. Spend/impressions/clicks pulled from the platform insights API (hourly job). **Orders are joined to campaigns** by `utm_campaign/utm_content` + `fbclid/ttclid` captured on the storefront session and stored on `orders.attribution` (new jsonb). Confirmed/delivered/returned counts come from our own order states, so CPCO/CPD/real ROAS are computed here, not on the platform.
- `POST /ads/campaigns/:id/status`, `PATCH /ads/campaigns/:id/budget` write back to the platform.
- `GET/PUT /products/:id/economics` → `ProductEconomics` (COGS, shipping, carrier fee, packaging, return cost, historical rates). Break-even CPD / ROAS are derived on the client from this.
- Auto-rules (pause if CPD > break-even for N days, scale budget, alert) → **EXTEND** automations (2.4) with trigger `campaign_metrics_daily`.

### 5.2 Profit & loss — **NEW** `GET /analytics/pnl?range=` → `PnlReport`
- Revenue counts **delivered** orders only. Costs: COGS (from economics × delivered units), ad spend (5.1), carrier shipping + COD fees (from settlements 5.4 when reconciled, else from shipping rates), returns/RTO cost, packaging, payment/platform fees, team (fixed monthly from settings). Cache daily.

### 5.3 Call center — **EXTEND** `confirmation_tasks` + **NEW** `calls`
- `GET /confirmation-tasks` → `ConfirmationItem` (add `attempts`, `last_outcome`, `next_attempt_at`, `priority`, `customer_history`, `risk_flags`; joins customer + order).
- `POST /confirmation-tasks/:id/outcome` with `CallOutcome` (`confirmed | no_answer | busy | cancelled | postponed | wrong_number | duplicate`) + `note` + `postponeMinutes`; terminal outcomes update `orders.confirmation_state`; non-terminal bump `attempts` and schedule `next_attempt_at`; after `maxAttempts` → auto-cancel or flag per settings.
- `POST /calls` / `GET /calls` → `CallLog` (agent, duration, outcome, recording url). VoIP adapters: Twilio Voice first (click-to-call from browser via WebRTC token), then Maqsam/Ziwo (KSA/Egypt).
- `GET /agents` → members with role `confirmation_agent` + presence (`online|on_call|break|offline`, stored in Redis with TTL).
- `GET/PUT /settings/call-center` → `CallCenterSettings`. The WhatsApp-first flow: order created → bot asks "reply 1" → if no reply in N min → task enters the call queue.

### 5.4 COD settlements — **NEW** `src/modules/settlements/`
- `GET /settlements` → `Settlement` per carrier payout; `GET /settlements/:id/orders` → order-level match (`SettlementOrder`).
- Sources: carrier API (Bosta/J&T expose payout reports) or CSV upload `POST /settlements/import`. Matching by carrier tracking number ↔ `shipments.carrier_tracking_number`; mismatches → `status = discrepancy` with `discrepancy_amount`.
- `POST /settlements/:id/mark-received|reconcile|dispute`.

### 5.5 WhatsApp inbox + bot — **NEW** `src/modules/whatsapp/`
- Meta Cloud API: webhook `POST /webhooks/whatsapp` → `wa_conversations` / `wa_messages` (`WaConversation`, `WaMessage`), linked to customer by phone and to the latest open order.
- `GET /whatsapp/conversations`, `POST /whatsapp/conversations/:id/messages` (template vs free-form inside 24h window), `PATCH .../status|assign`.
- Bot: `GET/PUT /whatsapp/bot` → `WaBotSettings` + `WaBotRule[]`. Rule engine runs on every inbound message: `reply_1` → confirm order, `reply_2` → cancel, keyword → send tracking / handoff; outside hours auto-reply. Emits `order_confirmed` etc. into the event bus so automations and the call queue react.

### 5.6 Affiliates — **NEW** `src/modules/affiliates/`
- `GET/POST/PATCH /affiliates` → `Affiliate`; public `GET /ref/:code` sets a cookie (window from settings) and redirects; checkout stores `orders.affiliate_id`. Commission accrues on `confirmed` or `delivered` per affiliate; `POST /affiliates/:id/pay` records a payout.

### 5.7 Reviews & Returns — **EXISTS**, surface in the dashboard
- Reviews: `GET /reviews?status=` + `PATCH /reviews/:id` (module exists). Add `photos`.
- Returns: existing module; add `kind: customer_return | rto`, `carrier_name`, and the explicit `restock` and `refund` steps the UI shows.

### 5.8 Suppliers marketplace — **NEW** (platform-level, not per workspace)
- `GET /suppliers`, `GET /suppliers/products` → `Supplier`, `SupplierProduct`. `POST /workspaces/:id/catalog/import-from-supplier` creates a draft product with `supplier_product_id` and cost. Dropship flow: on `order_confirmed`, create a purchase order for the supplier; settlement splits COD payout (5.4) between supplier cost and merchant margin.

### 5.9 Multi-store overview — **NEW** `GET /me/stores/overview` → `StoreSummary[]` aggregated across the user's active memberships.

---

## Cross-cutting

- **Job queue**: BullMQ + Redis. Needed by automations, carrier webhooks, CAPI forwarding, experiment auto-pause, abandoned-checkout detection.
- **Encrypted secrets**: one `secrets` helper (AES-GCM with a `SECRETS_KEY` env) for carrier / gateway / CAPI credentials.
- **Events bus**: a tiny in-process emitter (`order.created`, `order.confirmed`, …) that both automations and webhooks subscribe to; today these are scattered inside services.
- **Security fixes already identified** (do first): implement `verifyGatewaySignature` in billing, fail boot in production when JWT secrets are the defaults, move Google OAuth tokens out of the URL (short-lived code → exchange), confirm `/auth/verify-email` and `/auth/resend-verification` paths the dashboard calls.
