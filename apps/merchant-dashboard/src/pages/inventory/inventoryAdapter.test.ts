import { beforeEach, describe, expect, it, vi } from "vitest";

const request = vi.fn();
const listProducts = vi.fn();
vi.mock("@/lib/apiClient", () => ({ apiClient: { request: (...a: unknown[]) => request(...a), listProducts: (...a: unknown[]) => listProducts(...a) } }));

import { DEFAULT_LOW_STOCK_THRESHOLD, applyStockLevel, listInventoryItems, writeThreshold, type InventoryItem } from "./inventoryAdapter";

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

describe("thresholds (stored on the variant)", () => {
  beforeEach(() => {
    request.mockReset();
    listProducts.mockReset();
  });

  it("saves through PATCH /catalog/variants/:id", async () => {
    request.mockResolvedValue({ variant: { id: "v1", lowStockThreshold: 3 } });
    await writeThreshold("w", "v1", 3);
    expect(request).toHaveBeenCalledWith("/workspaces/w/catalog/variants/v1", { method: "PATCH", body: { lowStockThreshold: 3 } });
  });

  it("reads the variant's threshold, or the default when unset", async () => {
    listProducts.mockImplementation(async (_w: string, { status }: { status: string }) =>
      status === "active"
        ? {
            products: [
              {
                id: "p1",
                name: "P",
                variants: [
                  { id: "v1", sku: null, stockOnHand: 5, reservedStock: 0, currency: "EGP", optionValues: {}, lowStockThreshold: 4 },
                  { id: "v2", sku: null, stockOnHand: 5, reservedStock: 0, currency: "EGP", optionValues: {}, lowStockThreshold: null },
                ],
              },
            ],
            nextCursor: null,
          }
        : { products: [], nextCursor: null }
    );
    const rows = await listInventoryItems("w");
    expect(rows.find((r) => r.variantId === "v1")?.lowStockThreshold).toBe(4);
    expect(rows.find((r) => r.variantId === "v2")?.lowStockThreshold).toBe(DEFAULT_LOW_STOCK_THRESHOLD);
  });
});
