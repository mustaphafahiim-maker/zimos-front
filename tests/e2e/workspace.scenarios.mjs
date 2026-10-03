// A store created from the picker gets its role-gated screens straight away,
// without a reload. POST /workspaces answers with the bare workspace (no role),
// so the dashboard has to take the new entry from GET /workspaces instead.

import { BOSTA, KASHIER, PAYMOB, WS, ok } from "./support/fixtures.mjs";
import { assertClean, bodiesOf, check, openPage, settle } from "./support/harness.mjs";

const NEW_WS = "66666666-6666-4666-8666-666666666666";

const workspace = (id, name, slug) => ({ id, name, slug, settings: {}, themeSettings: {} });

const pendingTask = {
  id: "88888888-8888-4888-8888-888888888888",
  workspaceId: NEW_WS,
  orderId: "99999999-9999-4999-8999-999999999999",
  status: "pending",
  lockedByUserId: null,
  lockedAt: null,
  lockedBy: null,
  lockExpiresAt: null,
  attemptCount: 0,
  nextRetryAt: null,
  outcome: null,
  rejectionReason: null,
  completedAt: null,
  createdAt: "2026-09-25T09:00:00Z",
  updatedAt: "2026-09-25T09:00:00Z",
  attempts: [],
  correctable: false,
  order: {
    id: "99999999-9999-4999-8999-999999999999",
    workspaceId: NEW_WS,
    orderNumber: "ZG-2001",
    confirmationState: "pending",
    financialState: "pending",
    fulfillmentState: "unfulfilled",
    paymentMethod: "cod",
    currency: "EGP",
    totalAmount: "50000",
    contactSnapshot: { fullName: "Sara", phone: "01000000000" },
    shippingAddressSnapshot: { country: "EG", province: "Cairo", city: "Nasr City", addressLine: "12 St" },
    items: [],
    riskFlags: [],
    createdAt: "2026-09-25T09:00:00Z",
    updatedAt: "2026-09-25T09:00:00Z",
  },
};

export async function newStoreRoleGatedScreens(browser, base) {
  console.log("\nN. New store from the picker: Shipping, Payments and the confirmation queue work without a reload");
  let created = null;
  const newPath = `/workspaces/${NEW_WS}`;
  const session = await openPage(browser, base, {
    handler: (method, path, body) => {
      if (method === "GET" && path === "/workspaces") {
        const entries = [{ workspace: workspace(WS, "Test store", "test"), role: { key: "owner", name: "Owner" } }];
        if (created) entries.push({ workspace: created, role: { key: "owner", name: "Owner" } });
        return ok({ workspaces: entries });
      }
      if (method === "GET" && path.startsWith("/workspaces/check-slug?")) return ok({ available: true });
      if (method === "POST" && path === "/workspaces") {
        // The real response: the workspace alone, no membership / role.
        created = workspace(NEW_WS, body.name, "new-shop-x1");
        return ok({ workspace: created }, 201);
      }
      if (method === "PATCH" && path === newPath) {
        created = { ...created, ...body };
        return ok({ workspace: created });
      }
      if (path === `${newPath}/carriers`) return ok({ configured: true, carriers: [BOSTA(false)] });
      if (path === `${newPath}/payments/gateways`) {
        return ok({ configured: true, onlineEnabled: true, gateways: [PAYMOB(false), KASHIER(false)] });
      }
      if (path === `${newPath}/payments/methods`) {
        return ok({
          onlineEnabled: true,
          methods: [{ id: "cod", provider: null, method: "cod", enabled: true, available: true, mode: null }],
        });
      }
      if (path === `${newPath}/confirmation-tasks/counts`) {
        return ok({ counts: { pending: 1, pendingDue: 1, inProgress: 0, inProgressMine: 0, done: 0 } });
      }
      if (method === "GET" && path.startsWith(`${newPath}/confirmation-tasks?`)) {
        return ok({ tasks: path.includes("status=pending") ? [pendingTask] : [], nextCursor: null });
      }
      return undefined;
    },
  });
  const { page, requests } = session;

  await page.goto(`${base}/workspaces`);
  await settle(page);

  // From here on the page is never reloaded: record every "Only the store
  // owner …" notice that enters the DOM, however briefly.
  await page.evaluate(() => {
    window.__ownerNotices = [];
    const seen = () => {
      const text = document.body.innerText;
      if (/Only the store owner/.test(text)) window.__ownerNotices.push(location.pathname);
    };
    new MutationObserver(seen).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
  const marker = await page.evaluate(() => (window.__docMarker = Math.random()));

  await page.getByLabel("Store name").fill("New shop");
  const submit = page.getByRole("button", { name: "Create store" });
  await submit.waitFor();
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll("button")].find((el) => el.textContent === "Create store");
    return b && !b.disabled;
  });
  await submit.click();
  await page.getByRole("button", { name: "Go to dashboard" }).click();
  await settle(page);

  check(bodiesOf(requests, "POST", "/workspaces").length === 1, "one POST /workspaces");
  const listsAfterCreate = requests.filter((r, i) => r.method === "GET" && r.path === "/workspaces" && i > requests.findIndex((q) => q.method === "POST" && q.path === "/workspaces"));
  check(listsAfterCreate.length >= 1, `workspace list re-read after creating (${listsAfterCreate.length})`);
  check(
    (await page.evaluate(() => localStorage.getItem("sb.currentWorkspaceId"))) === NEW_WS,
    "new store is the selected one"
  );

  const nav = (to) => page.locator(`a[href="${to}"]`).first().click();

  await nav("/shipping");
  await settle(page);
  check(await page.getByRole("heading", { name: "Bosta" }).isVisible(), "Shipping lists couriers for the new store");
  check(requests.some((r) => r.path === `${newPath}/carriers`), "GET /carriers asked for the new store");

  await nav("/payments");
  await settle(page);
  check(await page.getByText("Paymob", { exact: true }).first().isVisible(), "Payments lists gateways for the new store");
  check(requests.some((r) => r.path === `${newPath}/payments/gateways`), "GET /payments/gateways asked for the new store");

  await nav("/confirmation-queue");
  await settle(page);
  check(await page.getByText("ZG-2001").first().isVisible(), "confirmation queue lists the pending task");
  check(await page.getByRole("button", { name: "Claim & call" }).isVisible(), "owner can claim in the new store");

  check((await page.evaluate(() => window.__docMarker)) === marker, "no page reload happened");
  const notices = await page.evaluate(() => window.__ownerNotices);
  check(notices.length === 0, `no "only the store owner" notice ever shown${notices.length ? ` (on ${[...new Set(notices)].join(", ")})` : ""}`);
  check(!requests.some((r) => r.path.startsWith(`/workspaces/${WS}/`) && /carriers|payments|confirmation/.test(r.path)), "nothing asked of the old store");
  await assertClean(session, "N");
  return session;
}
