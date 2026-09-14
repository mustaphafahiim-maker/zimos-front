import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/apiClient", () => ({ apiClient: {} }));

import { DEFAULT_LOW_STOCK_THRESHOLD, applyStockLevel, readThreshold, writeThreshold, type InventoryItem } from "./inventoryAdapter";

const item: InventoryItem = {
  variantId: "v1",
  productId: "p1",
  productName: "P",
  variantLabel: "M",
  sku: null,
  onHand: 0,
  reserved: 0,
  available: 0,
  costAmount: null,
  currency: "EGP",
  lowStockThreshold: 10,
};

describe("applyStockLevel", () => {
  it("uses server available when present", () => {
    expect(applyStockLevel(item, { variantId: "v1", stockOnHand: 20, reservedStock: 5, availableStock: 15 })).toMatchObject({ onHand: 20, reserved: 5, available: 15 });
  });
  it("falls back to onHand − reserved", () => {
    const level = { variantId: "v1", stockOnHand: 20, reservedStock: 7 } as unknown as Parameters<typeof applyStockLevel>[1];
    expect(applyStockLevel(item, level).available).toBe(13);
  });
});

describe("thresholds", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("round-trips through localStorage", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v) });
    expect(readThreshold("w", "v1")).toBe(DEFAULT_LOW_STOCK_THRESHOLD);
    writeThreshold("w", "v1", 3);
    expect(readThreshold("w", "v1")).toBe(3);
    store.set("zimos.inventory.threshold.w.v1", "-1");
    expect(readThreshold("w", "v1")).toBe(DEFAULT_LOW_STOCK_THRESHOLD);
  });

  it("falls back when storage throws or is missing", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
    });
    expect(() => writeThreshold("w", "v1", 3)).not.toThrow();
    expect(readThreshold("w", "v1")).toBe(DEFAULT_LOW_STOCK_THRESHOLD);
    vi.stubGlobal("localStorage", undefined);
    expect(readThreshold("w", "v1")).toBe(DEFAULT_LOW_STOCK_THRESHOLD);
  });
});
