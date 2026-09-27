import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { Order, OrderCounts } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { OrdersListPage } from "./OrdersListPage";

function order(overrides: Record<string, unknown> = {}): Order {
  return fake<Order>({
    id: "o1",
    orderNumber: "ORD-1001",
    confirmationState: "pending",
    financialState: "pending",
    fulfillmentState: "unfulfilled",
    paymentMethod: "cod",
    currency: "EGP",
    totalAmount: "25000",
    contactSnapshot: { fullName: "Mona Ali", phone: "01112345672" },
    funnelId: null,
    funnel: null,
    cancelledAt: null,
    createdAt: "2026-09-14T10:00:00.000Z",
    items: [{ id: "i1" }, { id: "i2" }],
    ...overrides,
  });
}

const counts: OrderCounts = {
  all: 7,
  pending: 3,
  confirmed: 1,
  unreachable: 1,
  postponed: 0,
  rejected: 0,
  cancelled: 2,
  unfulfilled: 5,
  fulfilled: 0,
  returned: 0,
  unpaid: 5,
};

describe("OrdersListPage", () => {
  it("lists newest first with channel, statuses and item counts, and shows tab counts", async () => {
    api.getOrderCounts.mockResolvedValue(counts);
    api.listOrders.mockResolvedValue({
      orders: [
        order(),
        order({
          id: "o2",
          orderNumber: "ORD-1002",
          contactSnapshot: { fullName: "Karim Said", phone: "01000000000" },
          funnelId: "f1",
          funnel: { id: "f1", name: "Headphones COD", subdomain: "hp" },
          items: [{ id: "i3" }],
        }),
      ],
      nextCursor: null,
    });

    renderWithProviders(<OrdersListPage />, { route: "/orders" });

    expect(await screen.findByText("ORD-1001")).toBeInTheDocument();
    expect(api.listOrders).toHaveBeenCalledWith("ws_1", expect.objectContaining({ sort: "newest", cancelled: false, limit: 50 }));
    expect(screen.getByText("Mona Ali")).toBeInTheDocument();
    const table = within(screen.getByRole("table"));
    expect(table.getByText("Headphones COD")).toBeInTheDocument();
    // "Online store" is also a channel-filter option; the cell is what matters.
    expect(table.getByText("Online store")).toBeInTheDocument();
    expect(screen.getByText("2 items")).toBeInTheDocument();
    expect(screen.getByText("1 item")).toBeInTheDocument();
    // "All" excludes the cancelled ones: 7 - 2.
    expect(screen.getByRole("tab", { name: /^All\s*5$/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Awaiting confirmation\s*3/ })).toBeInTheDocument();
  });

  it("filters by tab and searches after a pause", async () => {
    api.getOrderCounts.mockResolvedValue(counts);
    api.listOrders.mockResolvedValue({ orders: [order()], nextCursor: null });

    const { user } = renderWithProviders(<OrdersListPage />, { route: "/orders" });
    await screen.findByText("ORD-1001");

    await user.click(screen.getByRole("tab", { name: /Delivered/ }));
    await waitFor(() =>
      expect(api.listOrders).toHaveBeenLastCalledWith("ws_1", expect.objectContaining({ fulfillmentState: "fulfilled", cancelled: false }))
    );

    await user.click(screen.getByRole("tab", { name: /Cancelled/ }));
    await waitFor(() => expect(api.listOrders).toHaveBeenLastCalledWith("ws_1", expect.objectContaining({ cancelled: true })));

    await user.type(screen.getByRole("searchbox"), "Mona");
    await waitFor(() => expect(api.listOrders).toHaveBeenLastCalledWith("ws_1", expect.objectContaining({ q: "Mona" })));
    // The tab counts follow the search but never the tab itself.
    expect(api.getOrderCounts).toHaveBeenLastCalledWith("ws_1", expect.objectContaining({ q: "Mona" }));
    expect(api.getOrderCounts).toHaveBeenLastCalledWith("ws_1", expect.not.objectContaining({ cancelled: expect.anything() }));
  });

  it("selects rows and offers to export just those", async () => {
    api.getOrderCounts.mockResolvedValue(counts);
    api.listOrders.mockResolvedValue({ orders: [order(), order({ id: "o2", orderNumber: "ORD-1002" })], nextCursor: null });

    const { user } = renderWithProviders(<OrdersListPage />, { route: "/orders" });
    await screen.findByText("ORD-1001");

    await user.click(screen.getByRole("checkbox", { name: "Select order ORD-1002" }));
    expect(screen.getByText("1 selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Export selected/ })).toBeInTheDocument();
  });

  it("explains an empty result differently when nothing is filtered", async () => {
    api.getOrderCounts.mockResolvedValue({ ...counts, all: 0, cancelled: 0 });
    api.listOrders.mockResolvedValue({ orders: [], nextCursor: null });

    renderWithProviders(<OrdersListPage />, { route: "/orders", locale: "ar" });

    expect(await screen.findByText("مفيش طلبات لسه")).toBeInTheDocument();
  });
});
