import { describe, expect, it } from "vitest";
import type { ConfirmationTaskRow, Order } from "@store-builder/api-client";
import { HIGH_PRIORITY_TOTAL_MINOR, toOutcomePayload, toQueueItem } from "./queueAdapter";
import { dueLabel, isDueNow } from "./shared";

describe("toOutcomePayload", () => {
  it("confirmed", () => expect(toOutcomePayload("confirmed", { note: null })).toEqual({ outcome: "confirmed" }));
  it("no_answer", () => expect(toOutcomePayload("no_answer", { note: null })).toEqual({ outcome: "unreachable", notes: "no answer" }));
  it("busy with note", () => expect(toOutcomePayload("busy", { note: "call later" })).toEqual({ outcome: "unreachable", notes: "busy · call later" }));
  it("postponed", () => expect(toOutcomePayload("postponed", { note: "tomorrow 5pm" })).toEqual({ outcome: "postponed", notes: "postponed · tomorrow 5pm" }));
  it("cancelled with reason", () =>
    expect(toOutcomePayload("cancelled", { note: null, cancelReason: "price" })).toEqual({ outcome: "rejected", notes: "cancelled", rejectionReason: "price" }));
  it("cancelled without reason", () =>
    expect(toOutcomePayload("cancelled", { note: null }).rejectionReason).toBe("cancelled by customer"));
  it("wrong_number", () =>
    expect(toOutcomePayload("wrong_number", { note: null })).toEqual({ outcome: "rejected", notes: "wrong number", rejectionReason: "wrong_number" }));
  it("truncates long reasons and notes", () => {
    const p = toOutcomePayload("cancelled", { note: "x".repeat(2000), cancelReason: "r".repeat(500) });
    expect(p.rejectionReason).toHaveLength(300);
    expect(p.notes).toHaveLength(1000);
  });
});

const task = (order: Partial<Order>): ConfirmationTaskRow =>
  ({
    id: "t1",
    orderId: "order-123456789",
    status: "queued",
    attemptCount: 0,
    outcome: null,
    nextRetryAt: null,
    lockedByUserId: null,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: null,
    order: { totalAmount: "1000", riskFlags: [], ...order },
  }) as unknown as ConfirmationTaskRow;

describe("toQueueItem priority", () => {
  it("normal below threshold", () => expect(toQueueItem(task({ totalAmount: String(HIGH_PRIORITY_TOTAL_MINOR - 1) })).priority).toBe("normal"));
  it("high at threshold", () => expect(toQueueItem(task({ totalAmount: String(HIGH_PRIORITY_TOTAL_MINOR) })).priority).toBe("high"));
  it("flagged wins over high", () =>
    expect(toQueueItem(task({ totalAmount: "999999", riskFlags: ["repeat_rejecter"] } as Partial<Order>)).priority).toBe("flagged"));
});

describe("isDueNow / dueLabel", () => {
  const now = Date.parse("2026-09-14T12:00:00Z");
  const at = (ms: number) => ({ nextAttemptAt: new Date(now + ms).toISOString() });

  it("null next attempt is due", () => {
    expect(isDueNow({ nextAttemptAt: null }, now)).toBe(true);
    expect(dueLabel({ nextAttemptAt: null }, "en", now)).toBe("due now");
  });
  it("past and exact time are due", () => {
    expect(isDueNow(at(-1000), now)).toBe(true);
    expect(isDueNow(at(0), now)).toBe(true);
    expect(dueLabel(at(-1000), "ar", now)).toBe("مستحق الآن");
  });
  it("future is not due", () => {
    expect(isDueNow(at(1000), now)).toBe(false);
    expect(dueLabel(at(12 * 60_000), "en", now)).toBe("due in 12m");
    expect(dueLabel(at(125 * 60_000), "en", now)).toBe("due in 2h 05m");
    expect(dueLabel(at(125 * 60_000), "ar", now)).toBe("مستحق خلال 2 س 05 د");
  });
});
