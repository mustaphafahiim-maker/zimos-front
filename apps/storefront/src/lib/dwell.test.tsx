// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createDwellClock } from "./dwell";

function clock() {
  let t = 1_000;
  return { now: () => t, advance: (ms: number) => (t += ms) };
}

describe("createDwellClock", () => {
  it("counts only visible time, and hands back the last reading when the next page starts", () => {
    const c = clock();
    const dwell = createDwellClock(c.now);
    expect(dwell.start("pv-one-0001", true)).toBeNull();
    c.advance(4_000);
    expect(dwell.pause()).toEqual({ pageViewId: "pv-one-0001", dwellMs: 4_000 });
    c.advance(60_000); // hidden: not counted
    dwell.resume();
    c.advance(2_000);
    dwell.setProduct("prod-1");
    expect(dwell.start("pv-two-0002", true)).toEqual({ pageViewId: "pv-one-0001", dwellMs: 6_000, productId: "prod-1" });
    expect(dwell.current()).toBe("pv-two-0002");
  });

  it("reports a reading once: nothing new, nothing sent", () => {
    const c = clock();
    const dwell = createDwellClock(c.now);
    dwell.start("pv-once-0001", true);
    c.advance(1_500);
    expect(dwell.pause()).toEqual({ pageViewId: "pv-once-0001", dwellMs: 1_500 });
    expect(dwell.pause()).toBeNull();
    expect(dwell.start("pv-once-0002", true)).toBeNull();
  });

  it("a page opened in a background tab starts counting when it is shown", () => {
    const c = clock();
    const dwell = createDwellClock(c.now);
    dwell.start("pv-bg-0001", false);
    c.advance(30_000);
    expect(dwell.pause()).toBeNull();
    dwell.resume();
    c.advance(5_000);
    expect(dwell.pause()).toEqual({ pageViewId: "pv-bg-0001", dwellMs: 5_000 });
  });

  it("keeps the first product a page names", () => {
    const c = clock();
    const dwell = createDwellClock(c.now);
    dwell.start("pv-prod-0001", true);
    dwell.setProduct("first");
    dwell.setProduct("second");
    c.advance(1_000);
    expect(dwell.pause()).toMatchObject({ productId: "first" });
  });
});
