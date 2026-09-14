import { afterEach, describe, expect, it, vi } from "vitest";
import {
  basisPointsToPercentInput,
  formatMoney,
  humanize,
  majorToMinor,
  minorToMajorInput,
  percentToBasisPoints,
} from "./format";

describe("money input helpers", () => {
  it("round-trips 199.50", () => {
    expect(majorToMinor("199.50")).toBe(19_950);
    expect(minorToMajorInput(19_950)).toBe("199.50");
    expect(majorToMinor(minorToMajorInput("19950"))).toBe(19_950);
  });
  it("rejects empty and garbage input", () => {
    expect(majorToMinor("")).toBeNaN();
    expect(majorToMinor("   ")).toBeNaN();
    expect(majorToMinor("abc")).toBeNaN();
    expect(minorToMajorInput("")).toBe("");
    expect(minorToMajorInput(null)).toBe("");
  });
  it("handles negatives", () => {
    expect(majorToMinor("-12.34")).toBe(-1_234);
    expect(minorToMajorInput(-1_234)).toBe("-12.34");
  });
  it("rounds float noise", () => expect(majorToMinor("0.29")).toBe(29));
});

describe("percent helpers", () => {
  it("converts percent <-> basis points", () => {
    expect(percentToBasisPoints("10")).toBe(1_000);
    expect(percentToBasisPoints("12.5")).toBe(1_250);
    expect(basisPointsToPercentInput(1_250)).toBe("12.5");
    expect(basisPointsToPercentInput("1000")).toBe("10");
    expect(percentToBasisPoints(basisPointsToPercentInput(725))).toBe(725);
  });
  it("rejects bad input", () => {
    expect(percentToBasisPoints("")).toBeNaN();
    expect(percentToBasisPoints("abc")).toBeNaN();
    expect(basisPointsToPercentInput("abc")).toBe("");
    expect(basisPointsToPercentInput(undefined)).toBe("");
  });
});

describe("formatMoney / humanize (en default)", () => {
  it("formats with ISO code and Latin digits", () => {
    const s = formatMoney(123_400);
    expect(s).toContain("EGP");
    expect(s).toContain("1,234.00");
  });
  it("humanizes known and unknown keys", () => {
    expect(humanize("cod")).toBe("Cash on delivery");
    expect(humanize("partially_paid")).toBe("Partially paid");
    expect(humanize("some_new_state")).toBe("Some new state");
    expect(humanize(null)).toBe("—");
  });
});

describe("formatMoney / humanize (ar via stored locale)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("uses Arabic digits and local labels", async () => {
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => (k === "zimos.locale" ? "ar" : null),
      setItem: () => {},
      removeItem: () => {},
    });
    vi.resetModules();
    const fmt = await import("./format");
    const s = fmt.formatMoney(123_400);
    expect(s).not.toContain("EGP");
    expect(s).toMatch(/[٠-٩]/);
    expect(fmt.humanize("cod")).toBe("الدفع عند الاستلام");
    // unknown keys fall back to the English humanizer
    expect(fmt.humanize("some_new_state")).toBe("Some new state");
  });
});
