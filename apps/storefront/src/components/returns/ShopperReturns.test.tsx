import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "@store-builder/api-client";
import { getDictionary } from "@/lib/i18n";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";

const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/apiClient", () => ({ createStorefrontApiClient: () => ({ request }) }));
vi.mock("@/lib/visitorId", () => ({ getVisitorId: () => "visitor-1" }));

import { ShopperReturns } from "./ShopperReturns";

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
const STORE = { workspaceId: "ws1", id: "ws1", slug: "shop", name: "Shop", currency: "EGP", logoUrl: null, phone: null, checkout: {}, orderBump: null } as unknown as StoreInfo;
const r = getDictionary("en").returns;
const TOKEN = "ws.c1.1.1999999999.c2lnbmF0dXJl";

const SHIRT = { orderItemId: "item_1", name: "Linen shirt", variantOptions: { Size: "M" }, quantity: 2, returnable: 2 };
const eligible = (extra: Record<string, unknown> = {}) => ({
  eligible: true,
  reason: null,
  deadline: "2026-10-20T00:00:00.000Z",
  windowDays: 14,
  reasons: ["damaged", "no_longer_wanted", "other"],
  photoRequiredFor: ["damaged"],
  items: [SHIRT],
  returns: [],
  ...extra,
});
const created = { id: "ret_1", status: "requested", reason: "no_longer_wanted", items: [{ orderItemId: "item_1", quantity: 1 }], source: "shopper", createdAt: "2026-10-10T10:00:00.000Z" };

function show(props: { token?: string; orderId?: string; shopperToken?: string }) {
  return render(
    <StoreContextProvider locale="en" store={STORE}>
      <ShopperReturns workspaceId="ws1" {...props} />
    </StoreContextProvider>
  );
}

/** The store's answers: what may be returned, then the new request. */
function answers(eligibility: unknown, post: unknown = { return: created }) {
  request.mockImplementation(async (path: string, options: { method?: string } = {}) => {
    if (options.method === "POST") {
      if (post instanceof Error) throw post;
      return post;
    }
    if (path.includes("/returns/eligibility")) return eligibility;
    throw new Error(`unexpected ${path}`);
  });
}

beforeEach(() => {
  request.mockReset();
  // jsdom has no layout: the form's "bring the first problem into view" has nothing to scroll.
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

describe("a shopper asking for a return", () => {
  it("names the order by its tracking token, picks a reason and sends the request", async () => {
    answers(eligible());
    show({ token: "track-token-1" });
    fireEvent.click(await screen.findByRole("button", { name: r.start }));
    expect(request).toHaveBeenCalledWith("/store/ws1/returns/eligibility?token=track-token-1", { auth: false, headers: {} });

    // One line to return starts at one of it: the shopper only picks why.
    fireEvent.change(screen.getByLabelText(new RegExp(r.reason)), { target: { value: "no_longer_wanted" } });
    fireEvent.click(screen.getByRole("button", { name: r.send }));

    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("/store/ws1/returns", {
        method: "POST",
        body: { token: "track-token-1", reasonCode: "no_longer_wanted", items: [{ orderItemId: "item_1", quantity: 1 }] },
        auth: false,
        headers: { "X-Visitor-Id": "visitor-1" },
      })
    );
    expect(await screen.findByText(r.sent)).toBeTruthy();
  });

  it("asks for the reason, and for a photo when the store needs one, before anything is sent", async () => {
    answers(eligible());
    show({ token: "track-token-1" });
    fireEvent.click(await screen.findByRole("button", { name: r.start }));
    fireEvent.click(screen.getByRole("button", { name: r.send }));
    expect(await screen.findByText(r.chooseReason)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(new RegExp(r.reason)), { target: { value: "damaged" } });
    fireEvent.click(screen.getByRole("button", { name: r.send }));
    expect((await screen.findAllByText(r.needPhoto)).length).toBeGreaterThan(0);
    expect(request.mock.calls.filter(([, options]) => (options as { method?: string })?.method === "POST")).toHaveLength(0);
  });

  it("names a signed-in shopper's order by its id, with their token", async () => {
    answers(eligible());
    show({ orderId: "ord_1", shopperToken: TOKEN });
    await screen.findByRole("button", { name: r.start });
    expect(request).toHaveBeenCalledWith("/store/ws1/returns/eligibility?orderId=ord_1", { auth: false, headers: { "X-Shopper-Token": TOKEN } });
  });

  it("offers another size instead of a refund when the store takes exchanges", async () => {
    const options = [
      { variantId: "var_L", options: { Size: "L" }, inStock: true },
      { variantId: "var_S", options: { Size: "S" }, inStock: false },
    ];
    answers(eligible({ exchanges: true, items: [{ ...SHIRT, exchangeOptions: options }] }), { return: { ...created, resolution: "exchange" } });
    show({ token: "track-token-1" });
    fireEvent.click(await screen.findByRole("button", { name: r.start }));
    fireEvent.click(screen.getByRole("radio", { name: /Exchange for another size or colour/ }));
    fireEvent.change(screen.getByLabelText(new RegExp(r.reason)), { target: { value: "other" } });

    // Without the size wanted, nothing goes out.
    fireEvent.click(screen.getByRole("button", { name: "Request exchange" }));
    expect(await screen.findByText("Choose what you want instead.")).toBeTruthy();

    // The line's own picker ("Exchange for"), not the choice above it ("Exchange for another size or colour").
    fireEvent.change(screen.getByRole("combobox", { name: /^Exchange for/ }), { target: { value: "var_L" } });
    fireEvent.click(screen.getByRole("button", { name: "Request exchange" }));
    await waitFor(() =>
      expect(request).toHaveBeenCalledWith("/store/ws1/returns", {
        method: "POST",
        body: { token: "track-token-1", reasonCode: "other", resolution: "exchange", items: [{ orderItemId: "item_1", quantity: 1, exchangeVariantId: "var_L" }] },
        auth: false,
        headers: { "X-Visitor-Id": "visitor-1" },
      })
    );
  });

  it("has no exchange to choose on a store that takes returns only", async () => {
    answers(eligible());
    show({ token: "track-token-1" });
    fireEvent.click(await screen.findByRole("button", { name: r.start }));
    expect(screen.queryByRole("radio")).toBeNull();
  });

  it("says why a return is not possible, and shows nothing when the store takes returns by contact only", async () => {
    answers({ ...eligible(), eligible: false, reason: "window_closed", items: [] });
    const first = show({ token: "track-token-1" });
    expect(await screen.findByText(r.windowClosed)).toBeTruthy();
    expect(screen.queryByRole("button", { name: r.start })).toBeNull();
    first.unmount();

    answers({ ...eligible(), eligible: false, reason: "off", deadline: null, items: [] });
    const { container } = show({ token: "track-token-2" });
    await waitFor(() => expect(request).toHaveBeenCalledWith("/store/ws1/returns/eligibility?token=track-token-2", expect.anything()));
    await waitFor(() => expect(container.querySelector("[aria-busy]")).toBeNull());
    expect(screen.queryByRole("button", { name: r.start })).toBeNull();
  });

  it("lists the returns already asked for, with the store's message", async () => {
    answers(
      eligible({
        returns: [{ ...created, status: "approved", decisionNote: "Hand it to the courier on Sunday", decidedAt: "2026-10-11T10:00:00.000Z" }],
      })
    );
    show({ token: "track-token-1" });
    expect(await screen.findByText(r.yours)).toBeTruthy();
    expect(screen.getByText("Message from the store: Hand it to the courier on Sunday")).toBeTruthy();
  });

  it("draws nothing for an order the API does not know", async () => {
    request.mockRejectedValue(new ApiError("Not found", 404, "NOT_FOUND"));
    const { container } = show({ token: "gone" });
    await waitFor(() => expect(container.querySelector("section")).toBeNull());
  });
});

describe("where a shopper can ask for a return", () => {
  it("is on the tracking page and the account's order, each only with the switch", () => {
    const track = read("../TrackOrder.tsx");
    expect(track).toContain("const trackingToken = SHOPPER_RETURNS_ENABLED && result ? (orderTrackingExtras(result).trackingToken ?? null) : null;");
    expect(track).toContain("{trackingToken && <ShopperReturns key={trackingToken} token={trackingToken} workspaceId={workspaceId} />}");
    expect(read("../account/AccountOrder.tsx")).toContain(
      "{SHOPPER_RETURNS_ENABLED && api.token && orderId && <ShopperReturns orderId={orderId} shopperToken={api.token} workspaceId={workspaceId} />}"
    );
  });

  it("knows no courier pickup: there is no backend for one", () => {
    expect(read("./ShopperReturnCase.tsx")).not.toMatch(/pickup/i);
  });
});
