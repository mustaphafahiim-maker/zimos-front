import { describe, expect, it } from "vitest";
import {
  LABEL_DARK,
  LABEL_LIGHT,
  MIN_TEXT_CONTRAST,
  checkAccent,
  contrastRatio,
  labelOn,
  mixHex,
  parseHex,
  relativeLuminance,
  suggestAccent,
  toHex,
} from "./contrast";

const LIGHT = { page: "#F5F4EF", card: "#FFFFFF" };
const DARK = { page: "#0B1220", card: "#121B2E" };

describe("contrastRatio", () => {
  it("matches the WCAG reference points", () => {
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#1F5D5B", "#1F5D5B")).toBe(1);
    // The classic just-failing grey on white.
    expect(contrastRatio("#777777", "#FFFFFF")).toBeCloseTo(4.48, 2);
    expect(contrastRatio("#767676", "#FFFFFF")).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it("reads luminance from #rrggbb only", () => {
    expect(relativeLuminance("#FFFFFF")).toBeCloseTo(1, 5);
    expect(relativeLuminance("#000000")).toBe(0);
    expect(parseHex("1f5d5b")).toEqual([31, 93, 91]);
    expect(parseHex("#abc")).toBeNull();
    expect(parseHex("teal")).toBeNull();
    expect(toHex([31, 93, 91])).toBe("#1F5D5B");
    expect(mixHex("#000000", "#FFFFFF", 0.5)).toBe("#808080");
  });
});

describe("labelOn", () => {
  it("picks white or ink the way the storefront does", () => {
    expect(labelOn("#000000")).toBe(LABEL_LIGHT);
    expect(labelOn("#1E40AF")).toBe(LABEL_LIGHT);
    expect(labelOn("#FFD60A")).toBe(LABEL_DARK);
    expect(labelOn("#A594FF")).toBe(LABEL_DARK);
  });
});

describe("checkAccent", () => {
  it("passes a stock accent in its own mode", () => {
    const check = checkAccent("#1F5D5B", LIGHT);
    expect(check.ok).toBe(true);
    expect(check.failing).toEqual([]);
    expect(check.label).toBeGreaterThan(7);
  });

  it("flags a light accent on a light page as hard to read as text, but fine under a dark label", () => {
    const check = checkAccent("#FFD60A", { page: "#FFFFFF", card: "#FFFFFF" });
    expect(check.ok).toBe(false);
    expect(check.failing).toEqual(["text"]);
    expect(check.onPage).toBeLessThan(2);
    expect(check.label).toBeGreaterThan(MIN_TEXT_CONTRAST);
  });

  it("flags the one-colour-for-both-modes problem: a deep accent on a dark page", () => {
    const check = checkAccent("#1E40AF", DARK);
    expect(check.failing).toEqual(["text"]);
    expect(checkAccent("#1E40AF", LIGHT).ok).toBe(true);
  });

  it("flags a mid-tone accent that neither label colour can sit on", () => {
    // Between the two labels' reach: white and ink both fall short on it.
    const check = checkAccent("#E0484A", DARK);
    expect(check.label).toBeLessThan(MIN_TEXT_CONTRAST);
    expect(check.failing).toContain("label");
  });

  it("uses the worse of the two grounds for text", () => {
    const check = checkAccent("#6B7280", { page: "#FFFFFF", card: "#E5E7EB" });
    expect(check.onCard).toBeLessThan(check.onPage);
    expect(check.failing).toContain("text");
  });
});

describe("suggestAccent", () => {
  it("offers nothing for an accent that already reads well", () => {
    expect(suggestAccent("#1F5D5B", LIGHT, "light")).toBeNull();
    expect(suggestAccent("#5B8DF6", DARK, "dark")).toBeNull();
    expect(suggestAccent("not a colour", LIGHT, "light")).toBeNull();
  });

  it("darkens in light mode until it passes, keeping the hue", () => {
    const suggestion = suggestAccent("#FFD60A", { page: "#FFFFFF", card: "#FFFFFF" }, "light");
    expect(suggestion).not.toBeNull();
    expect(checkAccent(suggestion!, { page: "#FFFFFF", card: "#FFFFFF" }).ok).toBe(true);
    expect(relativeLuminance(suggestion!)).toBeLessThan(relativeLuminance("#FFD60A"));
    // Still a warm yellow-brown: red and green lead blue.
    const [r, g, b] = parseHex(suggestion!)!;
    expect(r).toBeGreaterThan(b);
    expect(g).toBeGreaterThan(b);
  });

  it("lightens in dark mode until it passes, keeping the hue", () => {
    const suggestion = suggestAccent("#1E40AF", DARK, "dark");
    expect(suggestion).not.toBeNull();
    expect(checkAccent(suggestion!, DARK).ok).toBe(true);
    expect(relativeLuminance(suggestion!)).toBeGreaterThan(relativeLuminance("#1E40AF"));
    const [r, , b] = parseHex(suggestion!)!;
    expect(b).toBeGreaterThan(r);
  });

  it("stays as close to the merchant's colour as it can", () => {
    // Just short of passing: the suggestion should be a small step away, not black.
    const suggestion = suggestAccent("#808080", { page: "#FFFFFF", card: "#FFFFFF" }, "light")!;
    expect(contrastRatio(suggestion, "#FFFFFF")).toBeLessThan(5.2);
    expect(contrastRatio(suggestion, "#FFFFFF")).toBeGreaterThanOrEqual(MIN_TEXT_CONTRAST);
  });

  it("pushes a mid-tone accent out of the zone neither label reaches", () => {
    const suggestion = suggestAccent("#E0484A", DARK, "dark")!;
    const check = checkAccent(suggestion, DARK);
    expect(check.ok).toBe(true);
    expect(labelOn(suggestion)).toBe(LABEL_DARK);
  });
});
