import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { ApiError } from "@store-builder/api-client";
import { api } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { VisitorsPage } from "./VisitorsPage";

/**
 * Analytics → Visitors by plan (PLAN_FEATURE_ENFORCEMENT): the summary needs
 * advanced_analytics; the visits, campaigns and governorates need
 * visitor_insights as well. A locked tab is the dashboard's one upgrade
 * prompt (DataState on 403 PLAN_FEATURE_REQUIRED) — nothing else is drawn —
 * in both languages, right to left in Arabic, and only with the theme's
 * colours, so the dark look draws it too.
 */

const LABELS = {
  advanced_analytics: { en: "Advanced analytics", ar: "تحليلات متقدمة" },
  visitor_insights: { en: "Visitor insights", ar: "تحليلات الزوار المفصّلة" },
} as const;

const locked = (feature: keyof typeof LABELS) =>
  new ApiError(`Your plan doesn't include ${LABELS[feature].en}. Upgrade your plan to use it.`, 403, "PLAN_FEATURE_REQUIRED", {
    error: { code: "PLAN_FEATURE_REQUIRED", details: { feature, label: LABELS[feature] } },
  });

const summary = {
  from: "2026-10-16T00:00:00.000Z",
  to: "2026-10-23T00:00:00.000Z",
  timeZone: "Africa/Cairo",
  visits: 12,
  visitors: 9,
  pageViews: 30,
  orders: 1,
  conversionRate: 11.1,
  funnel: [
    { key: "visit", visitors: 9, dropRate: null },
    { key: "product", visitors: 5, dropRate: 44.4 },
    { key: "cart", visitors: 2, dropRate: 60 },
    { key: "checkout", visitors: 1, dropRate: 50 },
    { key: "order", visitors: 1, dropRate: 0 },
  ],
  daily: [{ day: "2026-10-22", visits: 12, visitors: 9 }],
  sources: [{ source: "facebook", visits: 12, visitors: 9, conversionRate: 11.1 }],
  countries: [{ country: "EG", visits: 12 }],
  governorates: [{ governorate: "giza", visits: 4, fromOrders: 0, approximate: 4 }],
  devices: [{ device: "mobile", visits: 12 }],
  browsers: [{ browser: "Chrome", visits: 12 }],
  pages: { avgDwellMs: 30000, timedPageViews: 20, topPages: [], topProducts: [] },
  overCap: { events: 0, pageViews: 0 },
};

/** A store whose plan has advanced_analytics but not visitor_insights (or neither). */
function serve({ advanced = true }: { advanced?: boolean } = {}) {
  api.request.mockImplementation(async (path: string) => {
    const route = path.split("?")[0];
    if (!advanced) throw locked("advanced_analytics");
    if (route.endsWith("/visitors/summary")) return summary;
    throw locked("visitor_insights");
  });
}

const FIXED_COLOURS = /\b(?:bg|text|border|ring|fill|stroke)-(?:white|black|(?:gray|slate|zinc|neutral|stone|red|green|blue|yellow)-\d{2,3})\b|#[0-9a-f]{3,8}\b/i;

beforeEach(() => document.documentElement.classList.remove("dark"));
afterEach(() => document.documentElement.classList.remove("dark"));

describe("VisitorsPage by plan", () => {
  it("advanced_analytics alone: the overview opens", async () => {
    serve();
    renderWithProviders(<VisitorsPage />, { route: "/analytics/visitors", path: "/analytics/visitors" });
    expect(await screen.findByText("Unique visitors")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "See the plans" })).toBeNull();
  });

  it.each(["visits", "campaigns", "outcomes"])("without visitor_insights the %s tab is the upgrade prompt naming it", async (tab) => {
    serve();
    renderWithProviders(<VisitorsPage />, { route: `/analytics/visitors?tab=${tab}`, path: "/analytics/visitors" });
    expect(await screen.findByText("Your plan doesn't include Visitor insights. Upgrade your plan from My Plan to use it.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "See the plans" }).getAttribute("href")).toBe("/subscription");
  });

  it("without advanced_analytics the whole section is the prompt, as Web analytics is", async () => {
    serve({ advanced: false });
    renderWithProviders(<VisitorsPage />, { route: "/analytics/visitors", path: "/analytics/visitors" });
    expect(await screen.findByText("Your plan doesn't include Advanced analytics. Upgrade your plan from My Plan to use it.")).toBeInTheDocument();
  });

  it("in Arabic: right to left, the tabs and the prompt in Arabic", async () => {
    serve();
    renderWithProviders(<VisitorsPage />, { route: "/analytics/visitors?tab=visits", path: "/analytics/visitors", locale: "ar" });
    expect(await screen.findByText("خطتك الحالية لا تشمل «تحليلات الزوار المفصّلة». رقِّ خطتك من قسم خطتي لاستخدامها.")).toBeInTheDocument();
    expect(document.documentElement.dir).toBe("rtl");
    expect(screen.getByRole("heading", { name: "الزوار" })).toBeInTheDocument();
    // The open tab's name is also its section's title.
    for (const label of ["نظرة عامة", "الزيارات", "الحملات", "المحافظات"]) expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "عرض الخطط" }).getAttribute("href")).toBe("/subscription");
  });

  it("dark look: only the theme's colours, in the overview and in a locked tab", async () => {
    document.documentElement.classList.add("dark");
    serve();
    const { unmount } = renderWithProviders(<VisitorsPage />, { route: "/analytics/visitors", path: "/analytics/visitors" });
    await screen.findByText("Unique visitors");
    expect(document.body.innerHTML).not.toMatch(FIXED_COLOURS);
    unmount();
    renderWithProviders(<VisitorsPage />, { route: "/analytics/visitors?tab=campaigns", path: "/analytics/visitors" });
    await screen.findByRole("button", { name: "See the plans" });
    expect(document.body.innerHTML).not.toMatch(FIXED_COLOURS);
  });
});
