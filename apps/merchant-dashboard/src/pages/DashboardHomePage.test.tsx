import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import type { AnalyticsSummary, ConfirmationQueueCounts, FunnelAnalyticsOverview, Order, Workspace } from "@store-builder/api-client";
import { api, fake, testWorkspace } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { DashboardHomePage } from "./DashboardHomePage";

const summary = (gross: number) =>
  fake<AnalyticsSummary>({
    range: { from: "2026-08-22T00:00:00.000Z", to: "2026-09-21T00:00:00.000Z", timeZone: "UTC" },
    currency: "EGP",
    orders: { placed: 10, pending: 2, confirmed: 6, rejected: 1, unreachable: 1, postponed: 0, cancelled: 0, delivered: 4, returned: 1 },
    rates: { confirmation: 75, delivery: 66.7, return: 20 },
    revenue: { gross, delivered: 100000, collected: 90000, refunded: 0, shippingCharged: 5000, discounts: 2000, averageOrderValue: 25000 },
    profit: { deliveredItemsRevenue: 95000, discounts: 2000, productCost: 40000, refunded: 0, grossProfit: 53000, costCoverage: 100 },
    series: [],
    topProducts: [{ productId: "prd_1", name: "Linen shirt", quantity: 7, revenue: 140000 }],
    newCustomers: 3,
  });

// Awaiting = waiting for a call (pending) + someone on it (inProgress).
const queue: ConfirmationQueueCounts = {
  pending: 3,
  pendingDue: 3,
  inProgress: 2,
  inProgressMine: 0,
  done: 9,
  assignedToMe: 0,
  unassigned: 5,
};

const order = fake<Order>({
  id: "o1",
  orderNumber: "ORD-1001",
  confirmationState: "pending",
  totalAmount: "25000",
  currency: "EGP",
  contactSnapshot: { fullName: "Mona Ali" },
  funnelId: null,
  createdAt: "2026-09-14T10:00:00.000Z",
  items: [],
});

describe("DashboardHomePage", () => {
  it("shows real 30-day stats with deltas, the confirmation queue's count, recent orders and top products", async () => {
    api.getAnalyticsSummary.mockResolvedValueOnce(summary(250000)).mockResolvedValueOnce(summary(200000));
    api.getConfirmationQueueCounts.mockResolvedValue(queue);
    api.listOrders.mockResolvedValue({ orders: [order], nextCursor: null });
    api.getFunnelAnalytics.mockResolvedValue(
      fake<FunnelAnalyticsOverview>({
        totals: { sessions: 0, completed: 0, orders: 0, revenue: 0, upsellOrders: 0, upsellRevenue: 0, conversionRate: null },
        funnels: [],
      })
    );

    renderWithProviders(<DashboardHomePage />, { route: "/" });

    expect(await screen.findByText("Gross sales")).toBeInTheDocument();
    expect(screen.getByText("+25.0%", { exact: false })).toBeInTheDocument();
    const awaiting = screen.getByRole("link", { name: /Awaiting confirmation/ });
    expect(awaiting).toHaveAttribute("href", "/confirmation-queue");
    expect(awaiting).toHaveTextContent("5");
    expect(await screen.findByText("ORD-1001")).toBeInTheDocument();
    expect(screen.getByText("Linen shirt")).toBeInTheDocument();
    expect(screen.getByText("75.0%")).toBeInTheDocument();
    expect(screen.getByText("No funnel sessions in the last 30 days.")).toBeInTheDocument();
    // The order roll-up the page used to walk is not needed any more.
    expect(api.listOrders).toHaveBeenCalledTimes(1);
    expect(api.listOrders.mock.calls[0][1]).toEqual({ limit: 6 });
  });

  it("falls back to the order roll-up for a role without analytics, and asks for no analytics", async () => {
    api.getConfirmationQueueCounts.mockResolvedValue(queue);
    api.listOrders.mockResolvedValue({ orders: [order], nextCursor: null });

    renderWithProviders(<DashboardHomePage />, {
      route: "/",
      workspace: { currentWorkspace: fake<Workspace>({ ...testWorkspace, role: "order_operator" }) },
    });

    expect(await screen.findByText("Total orders")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Awaiting confirmation/ })).toHaveTextContent("5");
    expect(api.getAnalyticsSummary).not.toHaveBeenCalled();
    expect(api.getFunnelAnalytics).not.toHaveBeenCalled();
  });
});
