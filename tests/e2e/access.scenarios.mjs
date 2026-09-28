// The subscription / suspension banner on every dashboard page, and the
// creation lock's message (GET /workspaces/:id/access, 402 / 403 on create).

import { WS, ok, apiError } from "./support/fixtures.mjs";
import { assertClean, check, openPage, settle } from "./support/harness.mjs";

const accessPath = `/workspaces/${WS}/access`;
const DAY = 24 * 60 * 60 * 1000;

function access({ phase, restricted = false, reasons = [], suspended = false, periodEndMs = 2 * DAY }) {
  const periodEnd = new Date(Date.now() + periodEndMs);
  return {
    access: {
      restricted,
      reasons,
      billing: {
        phase,
        status: phase === "ok" || phase === "expiring" ? "active" : "past_due",
        trialing: false,
        periodEnd: periodEnd.toISOString(),
        restrictsAt: new Date(periodEnd.getTime() + DAY).toISOString(),
        enforced: true,
      },
      suspension: { suspended, since: suspended ? new Date().toISOString() : null },
    },
  };
}

const banner = (page) => page.getByTestId("access-banner");

export async function expiringBannerDismissedForTheDay(browser, base) {
  console.log("\nV. Expiring subscription: banner on every page, dismissed for the day, back the next day");
  const session = await openPage(browser, base, {
    handler: (method, path) => (path === accessPath ? ok(access({ phase: "expiring" })) : undefined),
  });
  const { page } = session;
  await page.goto(`${base}/`);
  await settle(page);
  check(await banner(page).isVisible(), "banner shown on the home page");
  check(/Your subscription expires on/.test(await banner(page).innerText()), "says the subscription is about to expire");

  await page.goto(`${base}/orders`);
  await settle(page);
  check(await banner(page).isVisible(), "banner shown on another page too");

  await page.getByRole("button", { name: "Dismiss for today" }).click();
  check((await banner(page).count()) === 0, "dismissed");
  await page.goto(`${base}/catalog`);
  await settle(page);
  check((await banner(page).count()) === 0, "stays dismissed on the next page the same day");

  // The stamp is yesterday's: it comes back.
  await page.evaluate((ws) => localStorage.setItem(`zimos.accessBanner.${ws}.expiring`, "2000-1-1"), WS);
  await page.goto(`${base}/`);
  await settle(page);
  check(await banner(page).isVisible(), "back the next day while still unpaid");
  await assertClean(session, "V");
  return session;
}

export async function restrictedBannerAndCreationLock(browser, base) {
  console.log("\nW. Restricted: banner can't be dismissed; creating a funnel explains the lock");
  const funnelsPath = `/workspaces/${WS}/funnels`;
  const session = await openPage(browser, base, {
    handler: (method, path) => {
      if (path === accessPath) return ok(access({ phase: "restricted", restricted: true, reasons: ["billing"], periodEndMs: -3 * DAY }));
      if (method === "GET" && path.startsWith(funnelsPath)) return ok({ funnels: [] });
      if (method === "POST" && path === funnelsPath) {
        return apiError(402, "SUBSCRIPTION_REQUIRED", "Your subscription has expired", { reasons: ["billing"] });
      }
      return undefined;
    },
  });
  const { page, requests } = session;
  await page.goto(`${base}/funnels`);
  await settle(page);
  check(/store is unavailable to shoppers/.test(await banner(page).innerText()), "restricted wording");
  check((await page.getByRole("button", { name: "Dismiss for today" }).count()) === 0, "not dismissible");

  await page.getByRole("button", { name: "Create funnel" }).first().click();
  await page.locator("#funnel-name").fill("Blocked funnel");
  await page.getByRole("button", { name: "Create and open editor" }).click();
  await settle(page);
  const posted = requests.filter((r) => r.method === "POST" && r.path === funnelsPath).length;
  check(posted === 1, `the create request was sent (${posted})`);
  check(
    await page.getByText(/new funnels can't be created until it's renewed/).first().isVisible(),
    "the create form explains the subscription lock"
  );
  await assertClean(session, "W");
  return session;
}

export async function suspendedBanner(browser, base) {
  console.log("\nX. Suspended by Zimos: its own banner, in Arabic too");
  const session = await openPage(browser, base, {
    locale: "ar",
    handler: (method, path) =>
      path === accessPath ? ok(access({ phase: "ok", restricted: true, reasons: ["suspended"], suspended: true })) : undefined,
  });
  const { page } = session;
  await page.goto(`${base}/`);
  await settle(page);
  check(/أوقفت Zimos هذا المتجر/.test(await banner(page).innerText()), "Arabic suspension banner");
  await assertClean(session, "X");
  return session;
}
