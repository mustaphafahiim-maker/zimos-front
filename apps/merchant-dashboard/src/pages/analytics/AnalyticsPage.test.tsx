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

const emptyTraffic = {
  sessions: 0,
  visitors: 0,
  pageViews: 0,
  productViews: 0,
  addToCart: 0,
  checkouts: 0,
  purchases: 0,
  conversionRate: null,
  addToCartRate: null,
  checkoutRate: null,
  byDevice: [],
  bySource: [],
  topPages: [],
};

const previousSummary = () =>
  summary({
    range: { from: "2026-07-23T00:00:00.000Z", to: "2026-08-22T00:00:00.000Z", timeZone: "UTC" },
    revenue: { ...summary().revenue, gross: 200000 },
  });

describe("AnalyticsPage", () => {
  it("asks for the range and the period before it, and shows the deltas", async () => {
    api.getAnalyticsSummary.mockResolvedValueOnce(summary()).mockResolvedValueOnce(previousSummary());

    renderWithProviders(<AnalyticsPage />, { route: "/analytics" });

    // "Gross sales" is both a tile and a breakdown row.
    expect((await screen.findAllByText("Gross sales")).length).toBeGreaterThan(0);
    // Two windows: the selected range and the one immediately before it.
    expect(api.getAnalyticsSummary).toHaveBeenCalledTimes(2);
    const [first, second] = api.getAnalyticsSummary.mock.calls;
    expect(first[0]).toBe("ws_1");
    expect(new Date(second[1]!.to!).getTime()).toBe(new Date(first[1]!.from!).getTime());
    // 250000 vs 200000 => +25%.
    expect(screen.getByText(/25\.0%/)).toBeInTheDocument();
    // The compared windows are named from the real ranges, not made up.
    // Day numbers shift with the machine's timezone; the months don't.
    expect(screen.getByText(/compared to/)).toHaveTextContent(/Aug \d+ – Sep \d+ compared to Jul \d+ – Aug \d+/);
  });

  it("renders the real figures, breakdown, journey, status rows and top products", async () => {
    api.getAnalyticsSummary.mockResolvedValue(summary());

    renderWithProviders(<AnalyticsPage />, { route: "/analytics" });

    expect(await screen.findByText("Sales breakdown")).toBeInTheDocument();
    expect(screen.getByText("Order journey")).toBeInTheDocument();
    expect(screen.getByText("Orders by status")).toBeInTheDocument();
    expect(screen.getByText("Couldn't reach them")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Linen shirt" })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Daily gross sales in EGP/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Orders per day/ })).toBeInTheDocument();
    // Delivered = 4 of 10 placed.
    expect(screen.getByText("40% of placed")).toBeInTheDocument();
  });

  it("keeps the tiles at zero and drops the charts when nothing was ordered", async () => {
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

    expect(await screen.findByText("No orders in this period")).toBeInTheDocument();
    expect(screen.getByText("Gross sales")).toBeInTheDocument();
    expect(screen.queryByText("Sales breakdown")).not.toBeInTheDocument();
  });

  it("shows sessions, the conversion funnel, devices, sources and pages when the store reports visits", async () => {
    const traffic = {
      sessions: 200,
      visitors: 150,
      pageViews: 600,
      productViews: 300,
      addToCart: 40,
      checkouts: 20,
      purchases: 10,
      conversionRate: 5,
      addToCartRate: 20,
      checkoutRate: 10,
      byDevice: [
        { device: "mobile", sessions: 160 },
        { device: "desktop", sessions: 40 },
      ],
      bySource: [
        { source: "facebook", medium: "cpc", sessions: 120, orders: 8 },
        { source: "direct", medium: null, sessions: 80, orders: 2 },
      ],
      topPages: [{ path: "/products/linen-shirt", views: 250 }],
    };
    api.getAnalyticsSummary.mockResolvedValue(summary({ traffic }));

    renderWithProviders(<AnalyticsPage />, { route: "/analytics" });

    expect((await screen.findAllByText("Sessions")).length).toBeGreaterThan(0);
    expect(screen.getByText("Conversion funnel")).toBeInTheDocument();
    // 40 of 200 sessions added to cart.
    expect(screen.getByText("20.0% of sessions")).toBeInTheDocument();
    expect(screen.getByText("Mobile")).toBeInTheDocument();
    expect(screen.getByText("facebook")).toBeInTheDocument();
    expect(screen.getByText("/products/linen-shirt")).toBeInTheDocument();
  });

  it("explains that visits appear once the store sends them, on an older summary with none", async () => {
    api.getAnalyticsSummary.mockResolvedValue(summary({ traffic: { ...emptyTraffic } }));

    renderWithProviders(<AnalyticsPage />, { route: "/analytics" });

    expect(await screen.findByText("No visits recorded yet")).toBeInTheDocument();
    expect(screen.queryByText("Conversion funnel")).not.toBeInTheDocument();
  });

  it("re-queries when the merchant picks another range from the date menu", async () => {
    api.getAnalyticsSummary.mockResolvedValue(summary());

    const { user } = renderWithProviders(<AnalyticsPage />, { route: "/analytics" });

    await screen.findAllByText("Gross sales");
    api.getAnalyticsSummary.mockClear();
    await user.click(screen.getByRole("button", { name: "Date range" }));
    await user.click(await screen.findByRole("menuitemradio", { name: "Last 7 days" }));

    expect(api.getAnalyticsSummary).toHaveBeenCalledTimes(2);
    const [call] = api.getAnalyticsSummary.mock.calls;
    const spanDays =
      (new Date(call[1]!.to!).getTime() - new Date(call[1]!.from!).getTime()) / 86_400_000;
    expect(Math.round(spanDays)).toBe(7);
  });
});
