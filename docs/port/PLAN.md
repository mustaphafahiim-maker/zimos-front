# Porting the rest of zimos-additions onto main

Branch `port/on-ziad-main` in both repositories starts from `main` (the deployed line) and adds what
`zimos-additions` still has and `main` does not, one feature per commit, each behind its switch and off by
default — the way the earlier port batches (B1–B12, F0–F12) were done. A plain merge of the two lines was
measured first and set aside: 644 conflicted files in the frontend, 426 in the API, and 196 against 126
migrations added on each side.

## Rules for every feature

- API: the module, its migrations under their original numbers, its routes behind
  `requireStoreFeature('<name>')`, the tables classified in `scripts/launch-reset-tables.js`, the name added
  to `.env.example`, and an integration test that covers both "off" and "on".
- Dashboard: `VITE_<NAME>_ENABLED` in `lib/features.ts` (and its row in `features.test.ts`); storefront:
  `NEXT_PUBLIC_<NAME>_ENABLED`. Off means nothing of the feature is shown or requested.
- Typecheck both apps; run the feature's API test on a database migrated from `main`.

## Done

| Feature | API switch | Commit (API / frontend) |
|---|---|---|
| Price history (lowest price in 30 days) | `price_history` | see `git log` on this branch |

## Left, in the order planned

API modules `main` does not have (41), grouped; a group moves together with its screens.

1. **Small and self-contained**: customerNotes, customerTimeline, searchInsights, boughtTogether, freeGifts,
   spinWheel, cartOffers, postPurchaseSurvey, storeLocator, fonts, customCode, privacyRequests.
2. **Pricing**: priceLists, priceSchedules, quotes, businessCustomers, accountCredit.
3. **Stock**: stockLocations, stockLots, stockForecast, purchasing.
4. **Stores and team**: stores, team, storeTransfer, storeGate, supportAccess, trash.
5. **Integrations**: apps, partnerApps, sheets, emailMarketing, emailDomains, dropship, mcp, marketplace,
   affiliates, subscriptions, places.
6. **Overlap with what `main` built its own way — compare before porting, do not copy blindly**:
   clickAndCollect and deliverySlots (main has self-delivery, pickup, couriers, zones and hours).
7. **The dashboard redesign** (shell, orders, confirmation station, product page, store and funnel editors,
   settings layout): `main` has the palette, the glass shell and the report kit; the redesigned screens come
   after the features they show are in.
