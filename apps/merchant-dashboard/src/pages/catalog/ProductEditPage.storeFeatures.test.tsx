import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type { Product } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { fakeBackend, type FakeCall } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ProductEditPage } from "./ProductEditPage";

// The switches are build constants; the tests turn them on and off.
const flags = vi.hoisted(() => ({ on: false }));
vi.mock("@/lib/features", async (original) => {
  const real = await original<typeof import("@/lib/features")>();
  const gated = ["SIZE_CHARTS_ENABLED", "PREORDERS_ENABLED", "PURCHASE_LIMITS_ENABLED", "PRODUCT_SPECS_ENABLED", "PRODUCT_QUESTIONS_ENABLED"] as const;
  const mocked: Record<string, unknown> = { ...real };
  for (const name of gated) Object.defineProperty(mocked, name, { enumerable: true, get: () => flags.on });
  return mocked;
});

const product = fake<Product>({
  id: "prod_1",
  name: "Linen shirt",
  slug: "linen-shirt",
  status: "active",
  productType: "physical",
  description: "",
  variants: [],
  media: [],
  offers: [],
  collections: [],
  customFields: [],
});

/** The store-feature endpoints the product page reads when its sections are on. */
const FEATURE_PATHS = ["/size-charts", "/preorders/prod_1", "/purchase-limits/prod_1", "/product-specs/keys", "/product-questions"];
const endOf = (call: FakeCall) => FEATURE_PATHS.find((end) => call.path.split("?")[0].endsWith(end));

describe("the product page and the ported store features", () => {
  it("asks the API for none of them while their switches are off", async () => {
    flags.on = false;
    api.getProduct.mockResolvedValue(product);
    const calls = fakeBackend({});
    renderWithProviders(<ProductEditPage />, { route: "/catalog/prod_1", path: "/catalog/:productId" });
    expect(await screen.findByRole("heading", { name: /Linen shirt/ })).toBeInTheDocument();
    expect(calls.filter(endOf)).toEqual([]);
    expect(screen.queryByText("Pre-orders")).not.toBeInTheDocument();
    expect(screen.queryByText("Purchase limits")).not.toBeInTheDocument();
  });

  it("shows their sections and reads each one while the switches are on", async () => {
    flags.on = true;
    api.getProduct.mockResolvedValue(product);
    const calls = fakeBackend({
      "GET /size-charts": { sizeCharts: [] },
      "GET /preorders/prod_1": { productId: "prod_1", name: "Linen shirt", preorder: { enabled: false, shipsAt: null, limit: null, message: null }, variants: [] },
      "GET /purchase-limits/prod_1": { productId: "prod_1", limits: { min: null, max: null, maxPerCustomer: null } },
      "GET /product-specs/keys": { keys: [] },
      "GET /product-specs/products/prod_1": { values: {} },
      "GET /product-questions": { questions: [], total: 0, pending: 0 },
    });
    renderWithProviders(<ProductEditPage />, { route: "/catalog/prod_1", path: "/catalog/:productId" });
    expect(await screen.findByRole("heading", { name: /Linen shirt/ })).toBeInTheDocument();
    await waitFor(() => expect(new Set(calls.map(endOf).filter(Boolean)).size).toBe(FEATURE_PATHS.length));
    expect(await screen.findByText("Pre-orders")).toBeInTheDocument();
    expect(await screen.findByText("Purchase limits")).toBeInTheDocument();
  });
});
