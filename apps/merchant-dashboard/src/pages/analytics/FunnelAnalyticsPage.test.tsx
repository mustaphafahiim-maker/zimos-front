import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import type { FunnelAnalyticsDetail } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { FunnelAnalyticsPage } from "./FunnelAnalyticsPage";

const detail = (overrides: Record<string, unknown> = {}) =>
  fake<FunnelAnalyticsDetail>({
    range: { from: "2026-08-22T00:00:00.000Z", to: "2026-09-21T00:00:00.000Z", timeZone: "UTC" },
    currency: "EGP",
    funnel: { id: "f1", name: "Headphones COD", subdomain: "headphones", status: "published" },
    sessions: 40,
    completed: 10,
    orders: 12,
    revenue: 300000,
    upsellOrders: 2,
    upsellRevenue: 50000,
    conversionRate: 25,
    steps: [
      { key: "product", name: "Product page", stepType: "landing", reached: 40, dropped: 20, reachRate: 100 },
      { key: "checkout", name: "COD checkout", stepType: "checkout", reached: 20, dropped: 10, reachRate: 50 },
      { key: "upsell", name: "Extra offer", stepType: "upsell", reached: 10, dropped: 0, reachRate: 25 },
    ],
    sources: [
      { source: "facebook", medium: "cpc", campaign: "launch", sessions: 30, completed: 8, orders: 10, revenue: 250000 },
      { source: "direct", medium: null, campaign: null, sessions: 10, completed: 2, orders: 2, revenue: 50000 },
    ],
    series: [
      { date: "2026-09-19", sessions: 15, orders: 4, revenue: 100000 },
      { date: "2026-09-20", sessions: 25, orders: 8, revenue: 200000 },
    ],
    ...overrides,
  });

const render = () =>
  renderWithProviders(<FunnelAnalyticsPage />, {
    route: "/analytics/funnels/f1",
    path: "/analytics/funnels/:funnelId",
  });

describe("FunnelAnalyticsPage", () => {
  it("asks for this funnel's range and shows steps, sources and totals", async () => {
    api.getFunnelAnalyticsDetail.mockResolvedValue(detail());

    render();

    expect(await screen.findByRole("heading", { name: "Headphones COD" })).toBeInTheDocument();
    expect(api.getFunnelAnalyticsDetail).toHaveBeenCalledWith("ws_1", "f1", expect.objectContaining({ from: expect.any(String) }));
    expect(screen.getByText("25.0%")).toBeInTheDocument();
    expect(screen.getByText("COD checkout")).toBeInTheDocument();
    // 20 of 40 sessions reached the checkout.
    expect(screen.getByText("50% of sessions")).toBeInTheDocument();
    expect(screen.getByText("facebook")).toBeInTheDocument();
    expect(screen.getByText("cpc · launch")).toBeInTheDocument();
    expect(screen.getByText("Direct / untagged")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit funnel" })).toHaveAttribute("href", "/funnels/f1");
  });

  it("says there were no sessions instead of drawing empty steps", async () => {
    api.getFunnelAnalyticsDetail.mockResolvedValue(
      detail({ sessions: 0, completed: 0, orders: 0, revenue: 0, conversionRate: null, sources: [], series: [] })
    );

    render();

    expect(await screen.findByText("No sessions in this period")).toBeInTheDocument();
    expect(screen.queryByText("Step by step")).not.toBeInTheDocument();
  });
});
