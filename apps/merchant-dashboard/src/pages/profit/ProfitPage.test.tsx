import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import type { AnalyticsSummary } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ProfitPage } from "./ProfitPage";

function summary(profit: Record<string, unknown>, delivered = 4): AnalyticsSummary {
  return fake<AnalyticsSummary>({
    range: { from: "2026-08-22T00:00:00.000Z", to: "2026-09-21T00:00:00.000Z", timeZone: "UTC" },
    currency: "EGP",
    orders: {
      placed: 10,
      pending: 0,
      confirmed: 6,
      rejected: 0,
      unreachable: 0,
      postponed: 0,
      cancelled: 0,
      delivered,
      returned: 0,
    },
    rates: { confirmation: 100, delivery: 66.7, return: 0 },
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
      deliveredItemsRevenue: 100000,
      discounts: 2000,
      productCost: 40000,
      refunded: 0,
      grossProfit: 58000,
      costCoverage: 100,
      ...profit,
    },
    series: [
      { date: "2026-09-19", orders: 4, revenue: 100000, delivered: 2 },
      { date: "2026-09-20", orders: 6, revenue: 150000, delivered: 2 },
    ],
    topProducts: [],
    newCustomers: 3,
  });
}

describe("ProfitPage", () => {
  it("shows the margin and the breakdown when every delivered unit has a cost", async () => {
    api.getAnalyticsSummary.mockResolvedValue(summary({}));

    renderWithProviders(<ProfitPage />, { route: "/profit" });

    expect(await screen.findByText("How the profit is worked out")).toBeInTheDocument();
    // 58000 / 100000 = 58%.
    expect(screen.getByText("58.0%")).toBeInTheDocument();
    expect(screen.queryByText(/have a cost price/)).not.toBeInTheDocument();
  });

  it("warns, with the real coverage, when cost prices are missing", async () => {
    api.getAnalyticsSummary.mockResolvedValue(summary({ costCoverage: 40 }));

    renderWithProviders(<ProfitPage />, { route: "/profit" });

    expect(
      await screen.findByText(/Only 40\.0% of the delivered units have a cost price/)
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Add cost prices" })).toHaveAttribute(
      "href",
      "/catalog"
    );
  });

  it("says nothing was delivered rather than drawing an empty breakdown", async () => {
    api.getAnalyticsSummary.mockResolvedValue(
      summary({ deliveredItemsRevenue: 0, productCost: 0, grossProfit: 0, costCoverage: null }, 0)
    );

    renderWithProviders(<ProfitPage />, { route: "/profit" });

    expect(await screen.findByText("Nothing delivered in this range yet")).toBeInTheDocument();
    expect(screen.queryByText("How the profit is worked out")).not.toBeInTheDocument();
  });
});
