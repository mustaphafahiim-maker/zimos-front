import { describe, expect, it } from "vitest";
import { confirmationTiming, formatDuration, formatRelative } from "./orderTimeline";
import { resolveSort } from "./listSort";

const placed = "2026-09-28T09:00:00.000Z";

describe("confirmationTiming", () => {
  it("measures placement to confirmation in whole minutes", () => {
    expect(
      confirmationTiming({ createdAt: placed, confirmationState: "confirmed", confirmedAt: "2026-09-28T09:25:20.000Z" })
    ).toEqual({ placedAt: placed, confirmedAt: "2026-09-28T09:25:20.000Z", minutesToConfirm: 25 });
  });

  it("has no confirmation line for an unconfirmed order, even with a stale stamp", () => {
    expect(confirmationTiming({ createdAt: placed, confirmationState: "pending", confirmedAt: null }).confirmedAt).toBeNull();
    expect(
      confirmationTiming({ createdAt: placed, confirmationState: "rejected", confirmedAt: "2026-09-28T10:00:00.000Z" })
    ).toEqual({ placedAt: placed, confirmedAt: null, minutesToConfirm: null });
  });

  it("does not guess for a confirmed order with no recorded time (older orders)", () => {
    expect(confirmationTiming({ createdAt: placed, confirmationState: "confirmed" }).minutesToConfirm).toBeNull();
    expect(confirmationTiming({ createdAt: placed, confirmationState: "confirmed", confirmedAt: null }).confirmedAt).toBeNull();
  });

  it("never reports a negative time (clock skew)", () => {
    expect(
      confirmationTiming({ createdAt: placed, confirmationState: "confirmed", confirmedAt: "2026-09-28T08:59:59.000Z" })
        .minutesToConfirm
    ).toBe(0);
  });
});

describe("formatRelative", () => {
  const now = new Date("2026-09-28T12:00:00.000Z").getTime();

  it("speaks English", () => {
    expect(formatRelative("2026-09-28T11:59:50.000Z", now, "en-US")).toBe("now");
    expect(formatRelative("2026-09-28T11:35:00.000Z", now, "en-US")).toBe("25 minutes ago");
    expect(formatRelative("2026-09-28T09:00:00.000Z", now, "en-US")).toBe("3 hours ago");
    expect(formatRelative("2026-09-27T12:00:00.000Z", now, "en-US")).toBe("yesterday");
    expect(formatRelative("2026-09-21T12:00:00.000Z", now, "en-US")).toBe("7 days ago");
  });

  it("speaks Arabic", () => {
    const text = formatRelative("2026-09-28T09:00:00.000Z", now, "ar-EG");
    expect(text).toMatch(/ساعات/);
    expect(text).toMatch(/٣/);
  });

  it("reads a future time as now", () => {
    expect(formatRelative("2026-09-28T12:05:00.000Z", now, "en-US")).toBe("now");
  });
});

describe("formatDuration", () => {
  it("uses minutes, then hours and minutes, then days", () => {
    expect(formatDuration(25, "en-US", false)).toBe("25 min");
    expect(formatDuration(120, "en-US", false)).toBe("2 hr");
    expect(formatDuration(125, "en-US", false)).toMatch(/^2 hr,? 5 min$/);
    expect(formatDuration(3 * 24 * 60, "en-US", false)).toBe("3 days");
  });

  it("uses Arabic plural forms", () => {
    expect(formatDuration(25, "ar-EG", true)).toMatch(/دقيقة/);
    expect(formatDuration(125, "ar-EG", true)).toMatch(/ساعت/);
  });
});

describe("resolveSort", () => {
  const allowed = ["newest", "oldest", "total_desc", "total_asc"] as const;

  it("prefers the URL, then storage, then the default", () => {
    expect(resolveSort("oldest", "total_asc", allowed, "newest")).toBe("oldest");
    expect(resolveSort(null, "total_asc", allowed, "newest")).toBe("total_asc");
    expect(resolveSort(null, null, allowed, "newest")).toBe("newest");
  });

  it("ignores anything off the whitelist", () => {
    expect(resolveSort("created_at DESC", "hacked", allowed, "newest")).toBe("newest");
    expect(resolveSort("bogus", "oldest", allowed, "newest")).toBe("oldest");
  });
});
