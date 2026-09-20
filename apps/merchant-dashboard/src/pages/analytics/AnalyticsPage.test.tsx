import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import type { AnalyticsSummary } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AnalyticsPage } from "./AnalyticsPage";

function summary(overrides: Record<string, unknown> = {}): AnalyticsSummary {
  return fake<AnalyticsSummary>({
    range: { from: "2026-08-22T00:00:00.000Z", to: "2026-09-21T00:00:00.000Z", timeZone: "UTC" },
    currency: "EGP",
    orders: {
      placed: 10,
      pending: 2,
      confirmed: 6,
      rejected: 1,
      unreachable: 1,
      postponed: 0,
      cancelled: 0,
      delivered: 4,
      returned: 1,
    },
    rates: { confirmation: 75, delivery: 66.7, return: 20 },
    revenue: {
      gross: 250000,
      delivered: 100000,
      collected: 90000,
      refunded: 0,
      shippingCharged: 5000,
      discounts: 2000,
      averageOrderValue: 25000,
    },
    profit: {
      deliveredItemsRevenue: 95000,
      discounts: 2000,
      productCost: 40000,
      refunded: 0,
      grossProfit: 53000,
      costCoverage: 100,
    },
    series: [
      { date: "2026-09-19", orders: 4, revenue: 100000, delivered: 2 },
      { date: "2026-09-20", orders: 6, revenue: 150000, delivered: 2 },
    ],
    topProducts: [{ productId: "prd_1", name: "Linen shirt", quantity: 7, revenue: 140000 }],
    newCustomers: 3,
    ...overrides,
  });
}

describe("AnalyticsPage", () => {
  it("asks for the range and the period before it, and shows the deltas", async () => {
    api.getAnalyticsSummary
      .mockResolvedValueOnce(summary())
      .mockResolvedValueOnce(summary({ revenue: { ...summary().revenue, gross: 200000 } }));

    renderWithProviders(<AnalyticsPage />, { route: "/analytics" });

    expect(await screen.findByText("Revenue")).toBeInTheDocument();
    // Two windows: the selected range and the one immediately before it.
    expect(api.getAnalyticsSummary).toHaveBeenCalledTimes(2);
    const [first, second] = api.getAnalyticsSummary.mock.calls;
    expect(first[0]).toBe("ws_1");
    expect(new Date(second[1]!.to!).getTime()).toBe(new Date(first[1]!.from!).getTime());
    // 250000 vs 200000 => +25%.
    expect(screen.getByText(/25\.0%/)).toBeInTheDocument();
  });

  it("renders the real figures, status rows and top products", async () => {
    api.getAnalyticsSummary.mockResolvedValue(summary());

    renderWithProviders(<AnalyticsPage />, { route: "/analytics" });

    expect(await screen.findByText("Where the orders stand")).toBeInTheDocument();
    expect(screen.getByText("Confirmed")).toBeInTheDocument();
    expect(screen.getByText("Linen shirt")).toBeInTheDocument();
    expect(screen.getByText("7 units")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Daily revenue in EGP/ })).toBeInTheDocument();
  });

  it("shows an empty state instead of empty charts when nothing was ordered", async () => {
    api.getAnalyticsSummary.mockResolvedValue(
      summary({
        orders: {
          placed: 0,
          pending: 0,
          confirmed: 0,
          rejected: 0,
          unreachable: 0,
          postponed: 0,
          cancelled: 0,
          delivered: 0,
          returned: 0,
        },
        series: [],
        topProducts: [],
        rates: { confirmation: null, delivery: null, return: null },
      })
    );

    renderWithProviders(<AnalyticsPage />, { route: "/analytics" });

    expect(await screen.findByText("No orders in this range")).toBeInTheDocument();
    expect(screen.getByText("Nothing sold yet in this range")).toBeInTheDocument();
    expect(screen.queryByText("Where the orders stand")).not.toBeInTheDocument();
  });

  it("re-queries when the merchant changes the range", async () => {
    api.getAnalyticsSummary.mockResolvedValue(summary());

    const { user } = renderWithProviders(<AnalyticsPage />, { route: "/analytics" });

    await screen.findByText("Revenue");
    api.getAnalyticsSummary.mockClear();
    await user.click(screen.getByRole("button", { name: "Last 7 days" }));

    expect(api.getAnalyticsSummary).toHaveBeenCalledTimes(2);
    const [call] = api.getAnalyticsSummary.mock.calls;
    const spanDays =
      (new Date(call[1]!.to!).getTime() - new Date(call[1]!.from!).getTime()) / 86_400_000;
    expect(Math.round(spanDays)).toBe(7);
  });
});
