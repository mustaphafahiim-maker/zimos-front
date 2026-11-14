import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { priorityBadge } from "./tickets.ts";

describe("the queue's priority badge", () => {
  it("marks urgent and high tickets, and nothing else", () => {
    assert.deepEqual(priorityBadge("urgent"), { label: "Urgent", tone: "danger" });
    assert.deepEqual(priorityBadge("high"), { label: "High priority", tone: "warning" });
    assert.equal(priorityBadge("normal"), null);
    assert.equal(priorityBadge("low"), null);
  });
});
