import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { ApiError, type ProductPreorders, type PurchaseLimits, type StockAlertVariant } from "@store-builder/api-client";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { PreorderSection } from "./PreorderSection";
import { PurchaseLimitsSection } from "./PurchaseLimitsSection";
import { WaitingRestockCard } from "./WaitingRestockCard";

const noPreorder: ProductPreorders = {
  productId: "prod_1",
  name: "Linen shirt",
  preorder: { enabled: false, shipsAt: null, limit: null, message: null },
  variants: [{ id: "var_1", sku: "LS-M", optionValues: { Size: "M" }, available: 0, preordered: 0 }],
};

describe("PreorderSection", () => {
  it("shows pre-orders off, as the product has them", async () => {
    const calls = fakeBackend({ "GET /preorders/prod_1": noPreorder });
    renderWithProviders(<PreorderSection productId="prod_1" />);
    const toggle = await screen.findByRole("switch", { name: "Take pre-orders when sold out" });
    expect(toggle).not.toBeChecked();
    expect(screen.getByText("Off: a sold-out variant shows “Sold out” and can't be ordered.")).toBeInTheDocument();
    expect(callsTo(calls, "GET", "/workspaces/ws_1/preorders/prod_1")).toHaveLength(1);
  });

  it("turns pre-orders on with a limit and saves", async () => {
    const calls = fakeBackend({
      "GET /preorders/prod_1": noPreorder,
      "PUT /preorders/prod_1": { ...noPreorder, preorder: { enabled: true, shipsAt: null, limit: 20, message: null } },
    });
    const { user } = renderWithProviders(<PreorderSection productId="prod_1" />);
    await user.click(await screen.findByRole("switch", { name: "Take pre-orders when sold out" }));
    await user.type(screen.getByLabelText(/Limit per variant/), "20");
    await user.click(await screen.findByRole("button", { name: "Save" }));

    await waitFor(() => expect(callsTo(calls, "PUT", "/workspaces/ws_1/preorders/prod_1")).toHaveLength(1));
    expect(callsTo(calls, "PUT", "/preorders/prod_1")[0].body).toMatchObject({ enabled: true, limit: 20 });
    expect(await screen.findByText("Saved. The product page shows the change right away.")).toBeInTheDocument();
  });

  it("refuses a limit that is not a whole number", async () => {
    const calls = fakeBackend({ "GET /preorders/prod_1": noPreorder });
    const { user } = renderWithProviders(<PreorderSection productId="prod_1" />);
    await user.click(await screen.findByRole("switch", { name: "Take pre-orders when sold out" }));
    await user.type(screen.getByLabelText(/Limit per variant/), "abc");
    await user.click(await screen.findByRole("button", { name: "Save" }));
    expect((await screen.findAllByText("Enter a whole number from 1 to 1,000,000, or leave it empty for no limit.")).length).toBeGreaterThan(0);
    expect(callsTo(calls, "PUT", "/preorders/prod_1")).toHaveLength(0);
  });

  it("names the permission when the API refuses to show pre-orders", async () => {
    fakeBackend({ "GET /preorders/prod_1": new ApiError("Forbidden", 403, "FORBIDDEN", {}) });
    renderWithProviders(<PreorderSection productId="prod_1" />);
    expect(await screen.findByText("Seeing pre-orders needs the “view products” permission. Ask the store owner.")).toBeInTheDocument();
  });

  it("names the permission when the API refuses the change", async () => {
    fakeBackend({ "GET /preorders/prod_1": noPreorder, "PUT /preorders/prod_1": new ApiError("Forbidden", 403, "FORBIDDEN", {}) });
    const { user } = renderWithProviders(<PreorderSection productId="prod_1" />);
    await user.click(await screen.findByRole("switch", { name: "Take pre-orders when sold out" }));
    await user.click(await screen.findByRole("button", { name: "Save" }));
    expect((await screen.findAllByText("Changing pre-orders needs the “manage products” permission. Ask the store owner.")).length).toBeGreaterThan(0);
  });

  it("reads in formal Arabic", async () => {
    fakeBackend({ "GET /preorders/prod_1": noPreorder });
    renderWithProviders(<PreorderSection productId="prod_1" />, { locale: "ar" });
    expect(await screen.findByRole("switch", { name: "استقبال طلبات مسبقة عند نفاد المنتج" })).toBeInTheDocument();
  });
});

const noLimits: PurchaseLimits = { min: null, max: null, maxPerCustomer: null };

describe("PurchaseLimitsSection", () => {
  it("shows the product has no limits", async () => {
    const calls = fakeBackend({ "GET /purchase-limits/prod_1": { productId: "prod_1", limits: noLimits } });
    renderWithProviders(<PurchaseLimitsSection productId="prod_1" />);
    expect(await screen.findByLabelText("Minimum per order")).toHaveValue("");
    expect(screen.getByText("No limits: customers can order any quantity.")).toBeInTheDocument();
    expect(callsTo(calls, "GET", "/workspaces/ws_1/purchase-limits/prod_1")).toHaveLength(1);
  });

  it("saves a minimum and a maximum per order", async () => {
    const calls = fakeBackend({
      "GET /purchase-limits/prod_1": { productId: "prod_1", limits: noLimits },
      "PUT /purchase-limits/prod_1": { productId: "prod_1", limits: { min: 2, max: 10, maxPerCustomer: null } },
    });
    const { user } = renderWithProviders(<PurchaseLimitsSection productId="prod_1" />);
    await user.type(await screen.findByLabelText("Minimum per order"), "2");
    await user.type(screen.getByLabelText("Maximum per order"), "10");
    await user.click(await screen.findByRole("button", { name: "Save" }));

    await waitFor(() => expect(callsTo(calls, "PUT", "/workspaces/ws_1/purchase-limits/prod_1")).toHaveLength(1));
    expect(callsTo(calls, "PUT", "/purchase-limits/prod_1")[0].body).toMatchObject({ min: 2, max: 10, maxPerCustomer: null });
    expect(await screen.findByText("Saved. The product page and checkout use the new limits right away.")).toBeInTheDocument();
  });

  it("refuses a maximum below the minimum", async () => {
    const calls = fakeBackend({ "GET /purchase-limits/prod_1": { productId: "prod_1", limits: noLimits } });
    const { user } = renderWithProviders(<PurchaseLimitsSection productId="prod_1" />);
    await user.type(await screen.findByLabelText("Minimum per order"), "5");
    await user.type(screen.getByLabelText("Maximum per order"), "3");
    await user.click(await screen.findByRole("button", { name: "Save" }));
    expect((await screen.findAllByText("The maximum must be at least the minimum.")).length).toBeGreaterThan(0);
    expect(callsTo(calls, "PUT", "/purchase-limits/prod_1")).toHaveLength(0);
  });

  it("reads in formal Arabic", async () => {
    fakeBackend({ "GET /purchase-limits/prod_1": { productId: "prod_1", limits: noLimits } });
    renderWithProviders(<PurchaseLimitsSection productId="prod_1" />, { locale: "ar" });
    expect(await screen.findByLabelText("أقل كمية في الطلب")).toBeInTheDocument();
    expect(screen.getByText("بدون حدود: يستطيع العميل طلب أي كمية.")).toBeInTheDocument();
  });
});

const waitingShirt: StockAlertVariant = {
  productId: "prod_1",
  productName: "Linen shirt",
  variantId: "var_1",
  sku: "LS-M",
  optionValues: { Size: "M" },
  waiting: 3,
  notified: 1,
  lastRequestAt: "2026-10-09T10:00:00.000Z",
};

describe("WaitingRestockCard", () => {
  it("says how many products shoppers are waiting for", async () => {
    const calls = fakeBackend({ "GET /stock-alerts": { variants: [waitingShirt] } });
    renderWithProviders(<WaitingRestockCard />);
    expect(await screen.findByText("1 product shoppers are waiting for")).toBeInTheDocument();
    expect(callsTo(calls, "GET", "/workspaces/ws_1/stock-alerts")).toHaveLength(1);
  });

  it("opens the list of who is waiting for what", async () => {
    fakeBackend({ "GET /stock-alerts": { variants: [waitingShirt] } });
    const { user } = renderWithProviders(<WaitingRestockCard />);
    await user.click(await screen.findByText("1 product shoppers are waiting for"));
    expect(await screen.findByRole("dialog", { name: "Waiting for restock" })).toBeInTheDocument();
    expect(screen.getAllByText(/Linen shirt/).length).toBeGreaterThan(0);
  });

  it("shows nothing when no one is waiting", async () => {
    const calls = fakeBackend({ "GET /stock-alerts": { variants: [] } });
    const { container } = renderWithProviders(<WaitingRestockCard />);
    await waitFor(() => expect(callsTo(calls, "GET", "/stock-alerts")).toHaveLength(1));
    await waitFor(() => expect(container.querySelector("button")).toBeNull());
    expect(screen.queryByText(/waiting for/)).not.toBeInTheDocument();
  });
});
