import { beforeEach, describe, expect, it, vi } from "vitest";

// The registry is a module's own state: each test starts from an empty one.
async function fresh() {
  vi.resetModules();
  return import("./prefetch");
}

describe("prefetching a page's code", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("loads the page whose address is the longest match, once", async () => {
    const { registerPrefetch, prefetchRoute } = await fresh();
    const list = vi.fn(() => Promise.resolve());
    const vip = vi.fn(() => Promise.resolve());
    registerPrefetch("/loyalty", list);
    registerPrefetch("/loyalty/vip", vip);

    prefetchRoute("/loyalty/vip?tab=levels");
    prefetchRoute("/loyalty/vip");
    expect(vip).toHaveBeenCalledTimes(1);
    expect(list).not.toHaveBeenCalled();

    prefetchRoute("/loyalty/anything");
    expect(list).toHaveBeenCalledTimes(1);
  });

  it("does nothing for a page that is not code-split, or whose switch left it unregistered", async () => {
    const { registerPrefetch, prefetchRoute } = await fresh();
    const orders = vi.fn(() => Promise.resolve());
    registerPrefetch("/orders-archive", orders);
    prefetchRoute("/orders");
    prefetchRoute("/blog");
    expect(orders).not.toHaveBeenCalled();
  });

  it("tries again after a load that failed", async () => {
    const { registerPrefetch, prefetchRoute } = await fresh();
    const load = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValue(undefined);
    registerPrefetch("/inbox", load);
    prefetchRoute("/inbox");
    await Promise.resolve();
    await Promise.resolve();
    prefetchRoute("/inbox");
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("gives a link the three moments a page is warmed at", async () => {
    const { registerPrefetch, prefetchProps } = await fresh();
    const load = vi.fn(() => Promise.resolve());
    registerPrefetch("/media", load);
    const props = prefetchProps("/media");
    expect(Object.keys(props).sort()).toEqual(["onFocus", "onPointerEnter", "onTouchStart"]);
    props.onPointerEnter();
    expect(load).toHaveBeenCalledTimes(1);
  });
});
