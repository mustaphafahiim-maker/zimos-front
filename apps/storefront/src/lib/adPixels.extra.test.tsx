import { beforeEach, describe, expect, it, vi } from "vitest";

const flags = vi.hoisted(() => ({ extra: true }));
vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  get AD_PIXELS_ENABLED() {
    return flags.extra;
  },
}));

type AdPixels = typeof import("./adPixels");

/** The pixel list is built from the switch as the module loads, so each case loads it afresh. */
async function load(extra: boolean): Promise<AdPixels> {
  flags.extra = extra;
  vi.resetModules();
  return import("./adPixels");
}

const STORE = {
  trackingPixels: [
    { platform: "meta", pixelId: "123456789012345", scope: { type: "all", ids: [] } },
    { platform: "pinterest", pixelId: "2612345678901", scope: { type: "all", ids: [] } },
    { platform: "x", pixelId: "o1abc", scope: { type: "all", ids: [] }, events: { purchase: "tw-o1abc-o2def", page_view: "not an id" } },
    { platform: "taboola", pixelId: "1234567", scope: { type: "all", ids: [] }, events: { purchase: "make_purchase" } },
    // Never placed in a script: not the shape of an id.
    { platform: "pinterest", pixelId: "');alert(1);//", scope: { type: "all", ids: [] } },
  ],
};

beforeEach(() => {
  delete (window as unknown as { pintrk?: unknown }).pintrk;
});

describe("the extra ad platforms' pixels in the store", () => {
  it("are dropped while their switch is off: only the pixels the store always had are loaded", async () => {
    const { storePixelsOf } = await load(false);
    expect(storePixelsOf(STORE).map((pixel) => pixel.platform)).toEqual(["meta"]);
  });

  it("are kept with the switch on, with each platform's own event names of the expected shape", async () => {
    const { storePixelsOf } = await load(true);
    const pixels = storePixelsOf(STORE);
    expect(pixels.map((pixel) => pixel.platform)).toEqual(["meta", "pinterest", "x", "taboola"]);
    expect(pixels.find((pixel) => pixel.platform === "x")?.events).toEqual({ purchase: "tw-o1abc-o2def" });
    expect(pixels.find((pixel) => pixel.platform === "taboola")?.events).toEqual({ purchase: "make_purchase" });
    expect(pixels.find((pixel) => pixel.platform === "pinterest")?.events).toBeUndefined();
  });

  it("tell Pinterest about an order under its own event name, with the order's id for dedup", async () => {
    const { registerPixels, sendToAdPixels, storePixelsOf } = await load(true);
    const pintrk = vi.fn();
    (window as unknown as { pintrk: unknown }).pintrk = pintrk;
    registerPixels(storePixelsOf(STORE));
    sendToAdPixels("Purchase", { valueMinor: 25000, currency: "EGP", orderId: "ord_1", numItems: 2, contentIds: ["prod_1"] });

    expect(pintrk).toHaveBeenCalledWith("track", "checkout", {
      value: 250,
      currency: "EGP",
      order_quantity: 2,
      order_id: "ord_1",
      event_id: "ord_1",
      line_items: [{ product_id: "prod_1" }],
    });
    // A checkout step before the purchase has no Pinterest event.
    pintrk.mockClear();
    sendToAdPixels("InitiateCheckout", { valueMinor: 25000, currency: "EGP" });
    expect(pintrk.mock.calls.filter(([command]) => command === "track")).toEqual([]);
  });
});
