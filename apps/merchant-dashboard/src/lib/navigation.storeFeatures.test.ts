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

describe("menu entries of gift cards and the blog", () => {
  it("has neither while their switches are off", async () => {
    const keys = keysOf(await navWith({}));
    expect(keys).not.toContain("giftCards");
    expect(keys).not.toContain("blog");
  });

  it("adds each only with its own switch", async () => {
    const cards = await navWith({ GIFT_CARDS_ENABLED: true });
    expect(keysOf(cards)).toContain("giftCards");
    expect(keysOf(cards)).not.toContain("blog");
    expect(cards.NAV_ITEMS.find((item) => item.key === "giftCards")?.to).toBe("/gift-cards");

    const blog = await navWith({ BLOG_ENABLED: true });
    expect(keysOf(blog)).toContain("blog");
    expect(keysOf(blog)).not.toContain("giftCards");
    expect(blog.NAV_LABELS.ar.blog).toBe("المدونة");
  });
});

describe("the menu entry of loyalty and rewards", () => {
  it("is not there while its four programmes are off", async () => {
    expect(keysOf(await navWith({}))).not.toContain("loyalty");
  });

  it("opens the first programme that is switched on", async () => {
    const all = await navWith({ LOYALTY_ENABLED: true, VIP_TIERS_ENABLED: true, CUSTOMER_REFERRALS_ENABLED: true, STORE_CREDIT_ENABLED: true });
    expect(all.NAV_ITEMS.find((item) => item.key === "loyalty")?.to).toBe("/loyalty");
    expect(all.NAV_LABELS.en.loyalty).toBe("Loyalty & rewards");
    expect(all.NAV_LABELS.ar.loyalty).toBe("الولاء والمكافآت");

    const vip = await navWith({ VIP_TIERS_ENABLED: true, STORE_CREDIT_ENABLED: true });
    expect(vip.NAV_ITEMS.find((item) => item.key === "loyalty")?.to).toBe("/loyalty/vip");

    const invites = await navWith({ CUSTOMER_REFERRALS_ENABLED: true });
    expect(invites.NAV_ITEMS.find((item) => item.key === "loyalty")?.to).toBe("/loyalty/referrals");

    const credit = await navWith({ STORE_CREDIT_ENABLED: true });
    expect(credit.NAV_ITEMS.find((item) => item.key === "loyalty")?.to).toBe("/store-credit");
    expect(keysOf(credit).filter((key) => key === "loyalty")).toHaveLength(1);
  });
});
