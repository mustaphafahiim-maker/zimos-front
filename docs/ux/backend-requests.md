# Requests to the backend chat

The frontend (ux-redesign) cannot edit the backend. Each line: what, why,
which screen. The backend marks them done in its
`docs/progress/frontend-handoff.md`; this file is then ticked.

- [ ] Order search by the **last digits** of a phone (e.g. 4–9 digits), not only 10+. Why: agents and couriers read the last digits off a waybill or caller ID (audit U-35). Screen: Orders list search, ⌘K.
- [ ] The **Fulfillment** role cannot book a courier: `POST /orders/:id/shipments`, `/orders/bulk` and bulk-ship require `orders.manage`, though the role is meant to book couriers (01 §2.1). Why: the role's main job fails with "no permission". Screen: Orders list bulk "Book courier", order page shipment card. (Permission change → backend decision; frontend will not work around it.)
- [ ] `fulfillment` missing from the analytics-hidden roles is a frontend list (`lib/analyticsAccess.ts`) — **frontend will fix**, listed here only so the backend knows the intended rule: Fulfillment has no `analytics.view`.
- [ ] Optional `Accept-Language` support: return translated `error.message` (ar/en/fr) for codes the dashboard and storefront do not map. Why: unmapped codes reach the shopper in English (U-02, U-03). Screen: storefront checkout, sign-in. Frontend maps every known code meanwhile.
- [ ] Confirmation outcome "postponed" with a **callback time** (`callbackAt`) in the outcome payload. Why: «كلّمني بكرة الساعة ٥» is the most common postponement and is lost today (U-31). Screen: Confirmation queue.
