import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { planMoveLabel } from "./planMove.ts";

describe("a pay-per-order store's move on its charge row", () => {
  it("says where it moves and that it switches only when paid", () => {
    const pending = { status: "pending", targetPlanId: "p1", targetPlanName: "Starter", targetBillingCycle: "monthly" };
    assert.equal(planMoveLabel(pending), "Move from pay per order to Starter (monthly) — switches when paid");
    assert.equal(planMoveLabel({ ...pending, status: "paid", targetBillingCycle: "yearly" }), "Move from pay per order to Starter (annual)");
  });

  it("says nothing on any other charge, or from an API without the field", () => {
    assert.equal(planMoveLabel({ status: "pending", targetPlanId: null }), null);
    assert.equal(planMoveLabel({ status: "paid" }), null);
  });
});
