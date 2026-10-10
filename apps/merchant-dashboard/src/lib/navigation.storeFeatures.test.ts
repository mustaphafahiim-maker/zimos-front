import { afterEach, describe, expect, it, vi } from "vitest";

type Navigation = typeof import("./navigation");

/** The navigation is built once from the switches, so each case loads it afresh. */
async function navWith(on: Record<string, boolean>): Promise<Navigation> {
  vi.resetModules();
  vi.doMock("@/lib/features", async (original) => ({ ...(await original<typeof import("@/lib/features")>()), ...on }));
  return import("./navigation");
}

function keysOf(nav: Navigation): string[] {
  return nav.NAV_GROUPS.flatMap((group) => group.items.map((item) => item.key as string));
}

afterEach(() => {
  vi.doUnmock("@/lib/features");
});

describe("menu entries of the ported store features", () => {
  it("has no Questions or Size charts entry while their switches are off", async () => {
    const keys = keysOf(await navWith({}));
    expect(keys).not.toContain("productQuestions");
    expect(keys).not.toContain("sizeCharts");
  });

  it("adds each entry only with its own switch", async () => {
    const questions = await navWith({ PRODUCT_QUESTIONS_ENABLED: true });
    expect(keysOf(questions)).toContain("productQuestions");
    expect(keysOf(questions)).not.toContain("sizeCharts");

    const charts = await navWith({ SIZE_CHARTS_ENABLED: true });
    expect(keysOf(charts)).toContain("sizeCharts");
    expect(keysOf(charts)).not.toContain("productQuestions");
    expect(charts.NAV_LABELS.en.sizeCharts).toBe("Size charts");
    expect(charts.NAV_LABELS.ar.productQuestions).toBe("الأسئلة");
  });
});
