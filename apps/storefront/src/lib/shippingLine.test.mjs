import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { freeShippingRemaining, quotePricesShipping, shippingLineFor } from "./shippingLine.ts";

/**
 * What the cart and checkout say about shipping, from a quote: the number the
 * order will be charged, "Free", a request to pick the area first — never a
 * number that may be wrong — or the old "confirmed on the call" line for a
 * store that prices no shipping.
 */

const quote = (over = {}) => ({
  pricingMode: "rates",
  amount: 4500,
  currency: "EGP",
  subtotal: 20000,
  weightGrams: null,
  weightEstimated: false,
  tier: null,
  rule: "governorate_rate",
  destinationRequired: true,
  configured: true,
  freeShipping: null,
  ...over,
});

describe("quotePricesShipping", () => {
  it("follows `configured`", () => {
    assert.equal(quotePricesShipping(quote({ configured: true })), true);
    assert.equal(quotePricesShipping(quote({ configured: false, pricingMode: "weight_tiers" })), false);
  });

  it("reads an answer from an older backend the old way (tier stores only)", () => {
    assert.equal(quotePricesShipping(quote({ configured: undefined, pricingMode: "rates" })), false);
    assert.equal(quotePricesShipping(quote({ configured: undefined, pricingMode: "weight_tiers" })), true);
  });
});

describe("shippingLineFor", () => {
  it("shows the charged amount once a governorate is chosen", () => {
    assert.deepEqual(shippingLineFor(quote(), { hasGovernorate: true, fresh: true }), { kind: "amount", amount: 4500 });
  });

  it("shows Free for 0", () => {
    assert.deepEqual(shippingLineFor(quote({ amount: 0, rule: "default_rate" }), { hasGovernorate: true, fresh: true }), {
      kind: "free",
    });
  });

  it("asks for the area before showing a destination price", () => {
    assert.deepEqual(shippingLineFor(quote(), { hasGovernorate: false, fresh: true }), { kind: "pick_governorate" });
  });

  it("shows a destination-free answer before the area is chosen", () => {
    const free = quote({ amount: 0, rule: "free_threshold", destinationRequired: false });
    assert.deepEqual(shippingLineFor(free, { hasGovernorate: false, fresh: true }), { kind: "free" });
  });

  it("does not trust a stale answer: calculating, or pick the area", () => {
    assert.deepEqual(shippingLineFor(quote(), { hasGovernorate: true, fresh: false }), { kind: "calculating" });
    const free = quote({ amount: 0, rule: "free_threshold", destinationRequired: false });
    assert.deepEqual(shippingLineFor(free, { hasGovernorate: false, fresh: false }), { kind: "pick_governorate" });
  });

  it("keeps the old line for a store that prices no shipping", () => {
    const none = quote({ configured: false, amount: 0, rule: "no_rate" });
    assert.deepEqual(shippingLineFor(none, { hasGovernorate: true, fresh: true }), { kind: "on_confirmation" });
    assert.deepEqual(shippingLineFor(none, { hasGovernorate: false, fresh: true }), { kind: "on_confirmation" });
  });
});

describe("freeShippingRemaining", () => {
  it("is the amount still to add, only below the threshold", () => {
    assert.equal(freeShippingRemaining({ thresholdAmount: 50000, remainingAmount: 12000, qualified: false }), 12000);
    assert.equal(freeShippingRemaining({ thresholdAmount: 50000, remainingAmount: 0, qualified: true }), null);
    assert.equal(freeShippingRemaining(null), null);
    assert.equal(freeShippingRemaining(undefined), null);
  });
});
