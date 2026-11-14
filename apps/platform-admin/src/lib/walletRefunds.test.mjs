import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { REFUND_STATUS, refundActions } from "./walletRefunds.ts";

describe("what the console may do with a refund request", () => {
  it("approve or reject while it waits; reject or mark paid once approved", () => {
    assert.deepEqual(refundActions("requested"), { approve: true, reject: true, markPaid: false });
    assert.deepEqual(refundActions("approved"), { approve: false, reject: true, markPaid: true });
  });

  it("nothing once it is closed", () => {
    for (const status of ["rejected", "cancelled", "paid"]) {
      assert.deepEqual(refundActions(status), { approve: false, reject: false, markPaid: false });
    }
  });

  it("names every status", () => {
    for (const status of ["requested", "approved", "rejected", "cancelled", "paid"]) assert.ok(REFUND_STATUS[status].label);
  });
});
