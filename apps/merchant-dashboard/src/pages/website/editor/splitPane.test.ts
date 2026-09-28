import { describe, expect, it } from "vitest";
import {
  SPLIT_DEFAULT_RATIO,
  SPLIT_HANDLE_PX,
  SPLIT_KEY_STEP_PX,
  SPLIT_MIN_PX,
  clampSplitPx,
  keyboardSplitPx,
  readSplitRatio,
  splitPx,
  splitRatio,
} from "./splitPane";

const H = 800; // container height
const AVAILABLE = H - SPLIT_HANDLE_PX;

describe("clampSplitPx", () => {
  it("keeps a height that leaves both panes their minimum", () => {
    expect(clampSplitPx(400, H)).toBe(400);
  });

  it("never lets the top pane go below the minimum", () => {
    expect(clampSplitPx(10, H)).toBe(SPLIT_MIN_PX);
    expect(clampSplitPx(-50, H)).toBe(SPLIT_MIN_PX);
  });

  it("never lets the bottom pane go below the minimum", () => {
    expect(clampSplitPx(H, H)).toBe(AVAILABLE - SPLIT_MIN_PX);
  });

  it("splits evenly when the pane is too short for both minimums", () => {
    expect(clampSplitPx(50, 200)).toBe((200 - SPLIT_HANDLE_PX) / 2);
  });

  it("falls back to the default share for a non-finite height", () => {
    expect(clampSplitPx(Number.NaN, H)).toBeCloseTo(AVAILABLE * SPLIT_DEFAULT_RATIO);
  });
});

describe("splitRatio / splitPx", () => {
  it("round-trips a height through a ratio", () => {
    const ratio = splitRatio(300, H);
    expect(splitPx(ratio, H)).toBeCloseTo(300);
  });

  it("clamps a stored ratio at a smaller container", () => {
    // 95% of a short pane would starve the library: the bottom keeps its minimum.
    expect(splitPx(0.95, 400)).toBe(400 - SPLIT_HANDLE_PX - SPLIT_MIN_PX);
  });

  it("returns the default ratio for an unmeasured container", () => {
    expect(splitRatio(100, 0)).toBe(SPLIT_DEFAULT_RATIO);
  });
});

describe("readSplitRatio", () => {
  it("reads a sensible stored value", () => {
    expect(readSplitRatio("0.6")).toBe(0.6);
  });

  it.each([null, undefined, "", "abc", "0", "1", "-0.3", "Infinity"])("falls back to the default for %s", (raw) => {
    expect(readSplitRatio(raw)).toBe(SPLIT_DEFAULT_RATIO);
  });
});

describe("keyboardSplitPx", () => {
  it("moves the handle one step with the arrows", () => {
    expect(keyboardSplitPx("ArrowDown", {}, 300, H)).toBe(300 + SPLIT_KEY_STEP_PX);
    expect(keyboardSplitPx("ArrowUp", {}, 300, H)).toBe(300 - SPLIT_KEY_STEP_PX);
  });

  it("moves four steps with Shift", () => {
    expect(keyboardSplitPx("ArrowDown", { shiftKey: true }, 300, H)).toBe(300 + 4 * SPLIT_KEY_STEP_PX);
  });

  it("jumps to either end with Home and End, still clamped", () => {
    expect(keyboardSplitPx("Home", {}, 300, H)).toBe(SPLIT_MIN_PX);
    expect(keyboardSplitPx("End", {}, 300, H)).toBe(AVAILABLE - SPLIT_MIN_PX);
  });

  it("stays clamped at the ends", () => {
    expect(keyboardSplitPx("ArrowUp", {}, SPLIT_MIN_PX, H)).toBe(SPLIT_MIN_PX);
  });

  it("ignores other keys", () => {
    expect(keyboardSplitPx("Enter", {}, 300, H)).toBeNull();
  });
});
