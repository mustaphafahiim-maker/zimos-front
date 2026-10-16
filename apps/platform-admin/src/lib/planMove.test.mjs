import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planMoveLabel, voidLabel } from "./planMove.ts";

describe("a pay-per-order store's move on its charge row", () => {
  it("says where it moves and that it switches only when paid", () => {
    const pending = { status: "pending", targetPlanId: "p1", targetPlanName: "Starter", targetBillingCycle: "monthly" };
    assert.equal(planMoveLabel(pending), "Move from pay per order to Starter (monthly) — switches when paid");
    assert.equal(planMoveLabel({ ...pending, status: "paid", targetBillingCycle: "yearly" }), "Move from pay per order to Starter (annual)");
  });

  it("says why a void move is not due", () => {
    const base = { status: "void", targetPlanId: "p1", targetPlanName: "Pro", targetBillingCycle: "monthly" };
    assert.equal(planMoveLabel({ ...base, voidReason: "cancelled" }), "Move from pay per order to Pro (monthly) — cancelled by the store, not due");
    assert.equal(planMoveLabel({ ...base, voidReason: "replaced" }), "Move from pay per order to Pro (monthly) — replaced by another move, not due");
    assert.equal(planMoveLabel({ ...base, voidReason: "expired" }), "Move from pay per order to Pro (monthly) — expired unpaid, not due");
    assert.equal(planMoveLabel({ ...base, voidReason: "cancelled_by_merchant" }), "Move from pay per order to Pro (monthly) — cancelled by the store, not due");
    assert.equal(planMoveLabel({ ...base, voidReason: "voided_by_admin" }), "Move from pay per order to Pro (monthly) — voided in the console, not due");
    assert.equal(planMoveLabel({ ...base, voidReason: "payment_failed" }), "Move from pay per order to Pro (monthly) — its payment didn't go through, not due");
  });

  it("says nothing on any other charge, or from an API without the field", () => {
    assert.equal(planMoveLabel({ status: "pending", targetPlanId: null }), null);
    assert.equal(planMoveLabel({ status: "paid" }), null);
  });
});

describe("why another void charge is not due", () => {
  it("names the reason, and says nothing for a move's charge or one that is not void", () => {
    assert.equal(voidLabel({ status: "void", voidReason: "voided_by_admin" }), "Voided in the console, not due");
    assert.equal(voidLabel({ status: "void", voidReason: "cancelled_by_merchant" }), "Cancelled by the store, not due");
    assert.equal(voidLabel({ status: "void", voidReason: "payment_failed" }), "Its payment didn't go through, not due");
    assert.equal(voidLabel({ status: "void", voidReason: null }), "Cancelled by the store, not due");
    assert.equal(voidLabel({ status: "void", targetPlanId: "p1", voidReason: "replaced" }), null);
    assert.equal(voidLabel({ status: "pending" }), null);
  });
});
