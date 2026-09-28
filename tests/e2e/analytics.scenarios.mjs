// Analytics screens (GET /workspaces/:id/analytics/*): the Reports group in
// the sidebar, the upgraded home page, Analytics, Web analytics (+ a metric
// row narrowing the page), Realtime and one funnel's analytics — in English
// and Arabic — and the same screens for a role without analytics.view.

import { WS, apiError, ok, order } from "./support/fixtures.mjs";
import { assertClean, check, openPage, settle } from "./support/harness.mjs";

const FUNNEL = "77777777-7777-4777-8777-777777777777";
const base = `/workspaces/${WS}`;
const DAY = 24 * 60 * 60 * 1000;

function days(n, pick) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const date = new Date(Date.now() - i * DAY).toISOString().slice(0, 10);
    out.push({ date, ...pick(i) });
  }
  return out;
}

/** GET /analytics/summary — `current` for the window ending now, the smaller one before it. */
function summary(current) {
  const k = current ? 1 : 0.5;
  const now = Date.now();
  return {
    summary: {
      range: { from: new Date(now - 30 * DAY).toISOString(), to: new Date(now).toISOString(), timeZone: "Africa/Cairo" },
      currency: "EGP",
      orders: { placed: 10 * k, pending: 2, confirmed: 6, rejected: 1, unreachable: 0, postponed: 0, cancelled: 1, delivered: 4, returned: 1 },
      rates: { confirmation: 85.7, delivery: 66.7, return: 20 },
      revenue: {
        gross: 1234500 * k,
        delivered: 600000,
        collected: 400000 * k,
        refunded: 0,
        shippingCharged: 5000,
        discounts: 0,
        averageOrderValue: 123450,
      },
      profit: { deliveredItemsRevenue: 600000, discounts: 0, productCost: 200000, refunded: 0, grossProfit: 400000, costCoverage: 100 },
      series: days(30, (i) => ({ orders: i % 3, revenue: (i % 3) * 50000, delivered: i % 2, sessions: 4 })),
      topProducts: [{ productId: "p1", name: "Wool hat", quantity: 5, revenue: 250000 }],
      newCustomers: 7,
      traffic: {
        sessions: 120 * k,
        visitors: 100 * k,
        pageViews: 400,
        productViews: 150,
        addToCart: 30,
        checkouts: 15,
        purchases: 6,
        conversionRate: 5,
        addToCartRate: 25,
        checkoutRate: 12.5,
        byDevice: [
          { device: "mobile", sessions: 90 },
          { device: "desktop", sessions: 30 },
        ],
        bySource: [
          { source: "facebook", medium: "cpc", sessions: 70, orders: 4 },
          { source: "direct", medium: null, sessions: 50, orders: 2 },
        ],
        topPages: [
          { path: "/products/wool-hat", views: 200 },
          { path: "/", views: 150 },
        ],
      },
    },
  };
}

const webStats = {
  pageviews: 400,
  visitors: 42,
  visits: 60,
  bounces: 20,
  totaltime: 3600,
  bounceRate: 33.3,
  avgVisitTime: 60,
};

function webSeries() {
  const series = [];
  for (let h = 23; h >= 0; h--) {
    series.push({ t: new Date(Date.now() - h * 60 * 60 * 1000).toISOString(), pageviews: h % 5, visitors: h % 3 });
  }
  return { unit: "hour", series };
}

function metricRows(type) {
  if (type === "path" || type === "entry" || type === "exit") {
    return [
      { x: "/products/wool-hat", y: 30 },
      { x: "/", y: 20 },
    ];
  }
  if (type === "referrer") return [{ x: "google.com", y: 10 }];
  if (type === "browser") return [{ x: "chrome", y: 25 }];
  if (type === "country") return [{ x: "EG", y: 40 }];
  if (type === "event") return [{ x: "add_to_cart", y: 12 }];
  return [];
}

function weekly() {
  const rows = [];
  for (let dow = 0; dow < 7; dow++) for (let hour = 0; hour < 24; hour++) rows.push({ dow, hour, visitors: (dow + hour) % 4 });
  return { rows };
}

function realtime() {
  const now = Date.now();
  return {
    totals: { views: 12, visitors: 3, events: 2, countries: 1 },
    series: [],
    activity: [
      {
        sessionId: "s1",
        visitId: "v1",
        type: "pageview",
        eventName: "page_view",
        urlPath: "/about",
        referrerDomain: null,
        browser: "chrome",
        os: "Windows 10",
        device: "laptop",
        country: "EG",
        createdAt: new Date(now - 30_000).toISOString(),
      },
    ],
    urls: [{ x: "/about", y: 1 }],
    referrers: [],
    countries: [{ x: "EG", y: 1 }],
    activeVisitors: 3,
    timestamp: new Date(now).toISOString(),
  };
}

const funnelTotals = { sessions: 50, completed: 10, orders: 12, revenue: 600000, upsellOrders: 2, upsellRevenue: 100000, conversionRate: 20 };
const range = { from: new Date(Date.now() - 30 * DAY).toISOString(), to: new Date().toISOString(), timeZone: "Africa/Cairo" };

const funnelsOverview = {
  range,
  currency: "EGP",
  totals: funnelTotals,
  funnels: [{ id: FUNNEL, name: "Summer funnel", subdomain: "summer", status: "published", ...funnelTotals }],
};

const funnelDetail = {
  range,
  currency: "EGP",
  funnel: { id: FUNNEL, name: "Summer funnel", subdomain: "summer", status: "published" },
  ...funnelTotals,
  steps: [
    { key: "checkout", name: "Checkout", stepType: "checkout", reached: 50, dropped: 20, reachRate: 100 },
    { key: "thanks", name: "Thank you", stepType: "thank_you", reached: 10, dropped: 0, reachRate: 20 },
  ],
  sources: [{ source: "facebook", medium: "cpc", campaign: "summer", sessions: 40, completed: 8, orders: 10, revenue: 500000 }],
  series: days(30, () => ({ sessions: 2, orders: 1, revenue: 20000 })),
};

const funnelDto = {
  id: FUNNEL,
  workspaceId: WS,
  name: "Summer funnel",
  subdomain: "summer",
  status: "published",
  publishedRevisionId: null,
  seo: {},
  settings: {},
  createdAt: "2026-09-01T10:00:00Z",
  updatedAt: "2026-09-20T10:00:00Z",
};

/** Every analytics endpoint, plus what the home and funnels pages read around them. */
function analyticsHandler({ forbidAnalytics = false } = {}) {
  return (method, path) => {
    const url = new URL(path, "http://stub");
    const p = url.pathname;
    if (p.startsWith(`${base}/analytics/`)) {
      if (forbidAnalytics) return apiError(403, "FORBIDDEN", "Missing permission: analytics.view");
      if (p === `${base}/analytics/summary`) {
        const to = Date.parse(url.searchParams.get("to") ?? "");
        return ok(summary(Number.isFinite(to) && Date.now() - to < 5 * 60 * 1000));
      }
      if (p === `${base}/analytics/web/stats`) return ok(webStats);
      if (p === `${base}/analytics/web/series`) return ok(webSeries());
      if (p === `${base}/analytics/web/metrics`) {
        const type = url.searchParams.get("type");
        return ok({ type, rows: metricRows(type) });
      }
      if (p === `${base}/analytics/web/weekly`) return ok(weekly());
      if (p === `${base}/analytics/web/realtime`) return ok(realtime());
      if (p === `${base}/analytics/funnels`) return ok(funnelsOverview);
      if (p === `${base}/analytics/funnels/${FUNNEL}`) return ok(funnelDetail);
    }
    if (p === `${base}/confirmation-tasks/counts`) {
      return ok({ counts: { pending: 3, inProgress: 2, done: 0, callbacks: 0, total: 5 } });
    }
    if (method === "GET" && p === `${base}/orders`) return ok({ orders: [order()], nextCursor: null });
    if (method === "GET" && p === `${base}/funnels`) return ok({ funnels: [funnelDto] });
    if (method === "GET" && p === `${base}/funnels/${FUNNEL}/steps`) return ok({ steps: [] });
    return undefined;
  };
}

/**
 * The analytics pages are lazy chunks: the first visit fetches (and in Vite's
 * dev server, first transforms) the chunk, so wait for the page's heading
 * rather than for a quiet network alone.
 */
async function waitForHeading(page, name) {
  await page.getByRole("heading", { name }).first().waitFor({ state: "visible", timeout: 30_000 }).catch(() => {});
  await settle(page);
}

const analyticsCalls = (requests) => requests.filter((r) => r.path.startsWith(`${base}/analytics/`));
const nav = (page) => page.getByRole("navigation", { name: "Main navigation" });

export async function analyticsScreens(browser, baseUrl) {
  console.log("\nY. Analytics: home page numbers, Reports group, Analytics, Web analytics (filter), Realtime, funnel analytics");
  const session = await openPage(browser, baseUrl, { handler: analyticsHandler() });
  const { page, requests } = session;

  await page.goto(`${baseUrl}/`);
  await settle(page);
  const main = page.locator("main");
  check(await main.getByText("Gross sales").first().isVisible(), "home: gross sales tile");
  check((await main.innerText()).includes("12,345"), "home: gross sales from /analytics/summary");
  check(/Awaiting confirmation[\s\S]*5/i.test(await main.innerText()), "home: awaiting confirmation = queue pending + in progress");
  check(await main.getByText("ZG-1001").isVisible(), "home: recent order listed");
  check(await main.getByText("Summer funnel").isVisible(), "home: funnel with sessions listed");

  for (const label of ["Analytics", "Web analytics", "Realtime"]) {
    check((await nav(page).getByRole("link", { name: label, exact: true }).count()) === 1, `sidebar: ${label} under Reports`);
  }
  check(await nav(page).getByRole("button", { name: /Reports/ }).isVisible(), "sidebar: Reports heading");

  await nav(page).getByRole("link", { name: "Analytics", exact: true }).click();
  await waitForHeading(page, "Analytics");
  check(new URL(page.url()).pathname === "/analytics", "Analytics opens from the sidebar");
  check(await page.getByRole("heading", { name: "Analytics" }).isVisible(), "Analytics: heading");
  const analyticsText = await page.locator("main").innerText();
  check(/Sessions[\s\S]*120/.test(analyticsText), "Analytics: sessions tile");
  check(analyticsText.includes("/products/wool-hat"), "Analytics: top pages");
  check(analyticsText.includes("Wool hat"), "Analytics: top products");
  const summaryCalls = requests.filter((r) => r.path.startsWith(`${base}/analytics/summary?`));
  check(summaryCalls.length >= 2 && summaryCalls.every((r) => /from=/.test(r.path) && /to=/.test(r.path)), "Analytics: current and previous windows requested");

  await page.goto(`${baseUrl}/analytics/web`);
  await waitForHeading(page, "Web analytics");
  check(await page.getByRole("heading", { name: "Web analytics" }).isVisible(), "Web analytics: heading");
  check(/Visitors[\s\S]*42/.test(await page.locator("main").innerText()), "Web analytics: visitors");
  const row = page.getByRole("button", { name: /\/products\/wool-hat/ }).first();
  await row.click();
  await settle(page);
  check(new URL(page.url()).searchParams.get("url") === "/products/wool-hat", "Web analytics: a path row filters the page");
  check(
    requests.some((r) => r.path.startsWith(`${base}/analytics/web/stats?`) && r.path.includes("url=%2Fproducts%2Fwool-hat")),
    "Web analytics: stats re-read with the filter"
  );

  await page.goto(`${baseUrl}/analytics/realtime`);
  await waitForHeading(page, "Realtime");
  check(await page.getByRole("heading", { name: "Realtime" }).isVisible(), "Realtime: heading");
  check((await page.locator("main").innerText()).includes("viewed /about"), "Realtime: activity line");

  await page.goto(`${baseUrl}/analytics/funnels/${FUNNEL}`);
  await waitForHeading(page, "Summer funnel");
  check(await page.getByRole("heading", { name: "Summer funnel" }).isVisible(), "Funnel analytics: funnel name");
  check((await page.locator("main").innerText()).includes("Step by step"), "Funnel analytics: steps table");

  await page.goto(`${baseUrl}/funnels`);
  await settle(page);
  check(/Sessions[\s\S]*50/.test(await page.locator("main").innerText()), "Funnels: sessions from /analytics/funnels");
  await page.getByRole("button", { name: "Analytics" }).first().click();
  await settle(page);
  check(new URL(page.url()).pathname === `/analytics/funnels/${FUNNEL}`, "Funnels: row opens its analytics");

  await assertClean(session, "Y");
  return session;
}

export async function analyticsScreensArabic(browser, baseUrl) {
  console.log("\nY2. Analytics in Arabic: right-to-left, translated headings");
  const session = await openPage(browser, baseUrl, { handler: analyticsHandler(), locale: "ar" });
  const { page } = session;
  await page.goto(`${baseUrl}/analytics`);
  await waitForHeading(page, "التحليلات");
  check((await page.evaluate(() => document.documentElement.dir)) === "rtl", "document is right-to-left");
  check(await page.getByRole("heading", { name: "التحليلات" }).isVisible(), "Analytics heading in Arabic");
  check((await page.locator("main").innerText()).includes("الجلسات"), "sessions tile in Arabic");
  await page.goto(`${baseUrl}/analytics/web`);
  await waitForHeading(page, "زيارات الموقع");
  check(await page.getByRole("heading", { name: "زيارات الموقع" }).isVisible(), "Web analytics heading in Arabic");
  await page.goto(`${baseUrl}/analytics/realtime`);
  await waitForHeading(page, "مباشر الآن");
  check(await page.getByRole("heading", { name: "مباشر الآن" }).isVisible(), "Realtime heading in Arabic");
  await assertClean(session, "Y2");
  return session;
}

export async function analyticsHiddenWithoutPermission(browser, baseUrl) {
  console.log("\nZ. A role without analytics.view: no Reports group, no analytics requests, the old home page");
  const session = await openPage(browser, baseUrl, { handler: analyticsHandler({ forbidAnalytics: true }), role: "editor" });
  const { page, requests } = session;

  await page.goto(`${baseUrl}/`);
  await settle(page);
  check((await nav(page).getByRole("link", { name: "Web analytics" }).count()) === 0, "sidebar: no analytics entries");
  check((await nav(page).getByRole("button", { name: /Reports/ }).count()) === 0, "sidebar: no Reports heading");
  check(/Total orders/i.test(await page.locator("main").innerText()), "home: falls back to the order roll-up");

  await page.goto(`${baseUrl}/funnels`);
  await settle(page);
  check(await page.getByText("Summer funnel").first().isVisible(), "funnels: list still shown");
  check((await page.getByRole("button", { name: "Analytics" }).count()) === 0, "funnels: no analytics button");
  check(analyticsCalls(requests).length === 0, "no analytics request made for this role");

  // Typed straight in, the server's 403 is explained, not crashed on.
  await page.goto(`${baseUrl}/analytics`);
  await page.getByText("You don't have permission to view this", { exact: false }).waitFor({ timeout: 30_000 }).catch(() => {});
  check((await page.locator("main").innerText()).includes("You don't have permission to view this"), "direct URL: permission message");
  await assertClean(session, "Z");
  return session;
}
