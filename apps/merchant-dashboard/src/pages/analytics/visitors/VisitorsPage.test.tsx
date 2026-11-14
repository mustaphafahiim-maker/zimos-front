import { beforeEach, describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { api } from "@/test/mocks";
import { currentPath, renderWithProviders } from "@/test/renderWithProviders";
import { VisitorsPage } from "./VisitorsPage";

const summary = {
  from: "2026-10-15T00:00:00.000Z",
  to: "2026-10-22T00:00:00.000Z",
  timeZone: "Africa/Cairo",
  visits: 40,
  visitors: 30,
  pageViews: 120,
  orders: 3,
  conversionRate: 10,
  funnel: [
    { key: "visit", visitors: 30, dropRate: null },
    { key: "product", visitors: 18, dropRate: 40 },
    { key: "cart", visitors: 6, dropRate: 66.7 },
    { key: "checkout", visitors: 4, dropRate: 33.3 },
    { key: "order", visitors: 3, dropRate: 25 },
  ],
  daily: [{ day: "2026-10-21", visits: 40, visitors: 30 }],
  sources: [
    { source: "facebook", visits: 25, visitors: 20, conversionRate: 15 },
    { source: "direct", visits: 15, visitors: 10, conversionRate: 0 },
  ],
  countries: [{ country: "EG", visits: 38 }],
  governorates: [
    { governorate: "cairo", visits: 20, fromOrders: 2, approximate: 18 },
    { governorate: "giza", visits: 3, fromOrders: 3, approximate: 0 },
  ],
  devices: [{ device: "mobile", visits: 33 }],
  browsers: [{ browser: "Chrome", visits: 30 }],
  pages: {
    avgDwellMs: 75000,
    timedPageViews: 90,
    topPages: [{ path: "/products/linen-shirt", views: 50, visits: 30, avgDwellMs: 42000, timedViews: 40 }],
    topProducts: [{ productId: "p1", name: "Linen shirt", views: 20, visits: 15, avgDwellMs: 61000, timedViews: 18 }],
  },
  overCap: { events: 0, pageViews: 0 },
};

const visit = {
  sessionId: "session-aaaa-1",
  visitor: "V-1a2b3c4d",
  startedAt: "2026-10-21T10:00:00.000Z",
  lastSeenAt: "2026-10-21T10:05:00.000Z",
  country: "EG",
  city: "Cairo",
  governorate: "cairo",
  geoSource: "ip_approx",
  device: "mobile",
  browser: "Chrome",
  os: "Android OS",
  source: "facebook",
  medium: "cpc",
  campaign: "eid",
  utmContent: null,
  utmTerm: null,
  referrerDomain: "facebook.com",
  landingPath: "/",
  clickIds: { gclid: false, fbclid: true, ttclid: false },
  pageViews: 3,
  dwellMs: 95000,
  reached: { product: true, cart: true, checkout: false, order: false },
};

function serve(over: Record<string, unknown> = {}) {
  api.request.mockImplementation(async (path: string) => {
    const route = path.split("?")[0];
    if (route.endsWith("/visitors/summary")) return over.summary ?? summary;
    if (route.endsWith("/visitors/sessions")) return { from: "", to: "", page: 1, pageSize: 25, total: 1, sessions: [visit] };
    if (route.includes("/visitors/sessions/")) {
      return {
        session: visit,
        quarantined: false,
        events: [
          { at: "2026-10-21T10:00:00.000Z", type: "page_view", path: "/", title: "Home", dwellMs: 20000, productId: null, productName: null, orderId: null, amount: null },
          { at: "2026-10-21T10:01:00.000Z", type: "page_view", path: "/products/linen-shirt", title: "Shirt", dwellMs: 75000, productId: "p1", productName: "Linen shirt", orderId: null, amount: null },
          { at: "2026-10-21T10:01:01.000Z", type: "view_product", path: "/products/linen-shirt", title: null, dwellMs: null, productId: "p1", productName: "Linen shirt", orderId: null, amount: null },
          { at: "2026-10-21T10:03:00.000Z", type: "add_to_cart", path: "/products/linen-shirt", title: null, dwellMs: null, productId: null, productName: null, orderId: null, amount: null },
        ],
      };
    }
    if (route.endsWith("/visitors/campaigns")) {
      return {
        from: "",
        to: "",
        campaigns: [
          { source: "facebook", campaign: "eid", visits: 25, visitors: 20, carts: 5, orders: 3, revenue: 90000, currency: "EGP", conversionRate: 15, spend: null, cpa: null },
          { source: "google", campaign: "brand", visits: 4, visitors: 4, carts: 1, orders: 1, revenue: 30000, currency: "EGP", conversionRate: 25, spend: 20000, cpa: 20000 },
        ],
      };
    }
    if (route.endsWith("/visitors/governorates")) {
      return {
        from: "",
        to: "",
        minOrders: 10,
        governorates: [
          { governorate: "cairo", finished: 20, inProgress: 4, delivered: 14, returned: 4, cancelled: 2, enough: true, deliveryRate: 70, returnRate: 20, cancelRate: 10 },
          { governorate: "giza", finished: 3, inProgress: 1, delivered: 2, returned: 1, cancelled: 0, enough: false, deliveryRate: null, returnRate: null, cancelRate: null },
        ],
      };
    }
    throw new Error(`unexpected ${path}`);
  });
}

const requested = () => api.request.mock.calls.map(([path]) => String(path));

beforeEach(() => serve());

describe("VisitorsPage", () => {
  it("shows the numbers, the funnel with each step's drop, approximate governorates and time on page", async () => {
    renderWithProviders(<VisitorsPage />, { route: "/analytics/visitors", path: "/analytics/visitors" });

    expect(await screen.findByText("Unique visitors")).toBeInTheDocument();
    expect(screen.getAllByText("30").length).toBeGreaterThan(0);
    expect(screen.getAllByText("10%").length).toBeGreaterThan(0);
    expect(screen.getByText("1m 15s")).toBeInTheDocument();
    expect(screen.getByText("40% dropped")).toBeInTheDocument();
    expect(screen.getByText("Linen shirt")).toBeInTheDocument();
    expect(screen.getByText("1m 1s")).toBeInTheDocument();
    // Cairo was placed mostly by IP (approximate); Giza only by orders.
    expect(screen.getByText("18 approx.")).toBeInTheDocument();
    expect(screen.getByText("from order")).toBeInTheDocument();
    // Only this store's visitors are ever asked for.
    expect(requested().every((p) => p.startsWith("/workspaces/ws_1/analytics/visitors/"))).toBe(true);
  });

  it("turns a source into a filter that the next request carries", async () => {
    const { user } = renderWithProviders(<VisitorsPage />, { route: "/analytics/visitors", path: "/analytics/visitors" });
    await user.click(await screen.findByRole("button", { name: /facebook/ }));
    expect(currentPath()).toContain("source=facebook");
    await waitFor(() => expect(requested().at(-1)).toContain("source=facebook"));
  });

  it("lists visits by an anonymous label, never an IP, and opens one in order", async () => {
    const { user } = renderWithProviders(<VisitorsPage />, { route: "/analytics/visitors?tab=visits", path: "/analytics/visitors" });
    expect(await screen.findByText("V-1a2b3c4d")).toBeInTheDocument();
    expect(screen.getAllByText("approx.").length).toBeGreaterThan(0);
    expect(document.body.textContent ?? "").not.toMatch(/ipHash|\b\d{1,3}(\.\d{1,3}){3}\b/);

    const row = screen.getByText("V-1a2b3c4d").closest("tr") as HTMLElement;
    await user.click(within(row).getAllByRole("button")[0]);
    const sheet = await screen.findByRole("dialog");
    expect(await within(sheet).findByText("Viewed a product")).toBeInTheDocument();
    expect(within(sheet).getByText("Added to cart")).toBeInTheDocument();
    expect(within(sheet).getByText("Time on page: 1m 15s")).toBeInTheDocument();
    expect(within(sheet).getByText("facebook / cpc / eid")).toBeInTheDocument();
    expect(within(sheet).getByText("fbclid")).toBeInTheDocument();
    expect(requested().some((p) => p === "/workspaces/ws_1/analytics/visitors/sessions/session-aaaa-1")).toBe(true);
  });

  it("campaigns: cost per order only where spend is recorded, and the way to record it", async () => {
    renderWithProviders(<VisitorsPage />, { route: "/analytics/visitors?tab=campaigns", path: "/analytics/visitors" });
    const eid = (await screen.findByText("eid")).closest("tr") as HTMLElement;
    expect(within(eid).getAllByText("—")).toHaveLength(2);
    const brand = screen.getByText("brand").closest("tr") as HTMLElement;
    expect(within(brand).getAllByText(/200/).length).toBe(2);
    expect(screen.getByRole("link", { name: "Record ad spend" })).toHaveAttribute("href", "/ads");
  });

  it("governorates: rates from ten finished orders, none below", async () => {
    renderWithProviders(<VisitorsPage />, { route: "/analytics/visitors?tab=outcomes", path: "/analytics/visitors" });
    expect(await screen.findByText("70% (14)")).toBeInTheDocument();
    const giza = screen.getByText("Giza").closest("tr") as HTMLElement;
    expect(within(giza).getAllByText("Fewer than 10")).toHaveLength(3);
  });

  it("an empty period says so", async () => {
    serve({ summary: { ...summary, visits: 0, visitors: 0 } });
    renderWithProviders(<VisitorsPage />, { route: "/analytics/visitors", path: "/analytics/visitors" });
    expect(await screen.findByText("No visits in this period")).toBeInTheDocument();
  });
});
