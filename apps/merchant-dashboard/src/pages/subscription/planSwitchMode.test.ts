import { describe, expect, it } from "vitest";
import type { PlanSwitchPreview } from "@store-builder/api-client";
import { formatHours, renewalLine } from "./planSwitchMode";

const renewal = (at: string | null) => ({ at, amount: 60000, currency: "EGP", billingCycle: "monthly" as const });
const line = (kind: PlanSwitchPreview["kind"], nextRenewal: PlanSwitchPreview["nextRenewal"]) => renewalLine({ kind, nextRenewal });

// What the confirmation's "Next renewal" row says (preview.nextRenewal).
describe("renewalLine", () => {
  it("a date: shown for every kind, the plan the store is on included", () => {
    for (const kind of ["upgrade", "scheduled", "immediate", "trial_change", "none", "move"] as const) {
      expect(line(kind, renewal("2030-02-01T00:00:00.000Z"))).toBe("date");
    }
  });

  it("a move without a date: it follows the payment", () => {
    expect(line("move", renewal(null))).toBe("after_payment");
  });

  it("a free plan (nextRenewal null): no row", () => {
    for (const kind of ["immediate", "scheduled", "move"] as const) expect(line(kind, null)).toBeNull();
  });

  it("the plan the store is on, from an older API without a date: no row", () => {
    expect(line("none", renewal(null))).toBeNull();
  });

  it("a date missing or unreadable where one was expected: the amount alone, never an invalid date", () => {
    expect(line("upgrade", renewal(null))).toBe("amount");
    expect(line("scheduled", renewal("not a date"))).toBe("amount");
    expect(line("move", renewal("not a date"))).toBe("after_payment");
  });
});

// The hours a plan switch's charge lives, in words (the confirmation's line).
describe("formatHours", () => {
  it("in English", () => {
    expect(formatHours(1, "en")).toBe("1 hour");
    expect(formatHours(48, "en")).toBe("48 hours");
  });

  it("in Arabic, with its number forms", () => {
    expect(formatHours(1, "ar")).toBe("ساعة واحدة");
    expect(formatHours(2, "ar")).toBe("ساعتان");
    expect(formatHours(5, "ar")).toBe("٥ ساعات");
    expect(formatHours(48, "ar")).toBe("٤٨ ساعة");
  });
});
