import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "@store-builder/api-client";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";

vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  SHOPPER_ACCOUNTS_ENABLED: true,
  LOYALTY_ENABLED: true,
  STORE_CREDIT_ENABLED: true,
  VIP_TIERS_ENABLED: true,
  CUSTOMER_REFERRALS_ENABLED: true,
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/account", useRouter: () => ({ push: vi.fn() }) }));
const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/apiClient", () => ({ createStorefrontApiClient: () => ({ request }) }));

import { AccountWalletTabs } from "@/components/account/AccountWalletTabs";
import { AccountRewardsTabs } from "./AccountRewardsTabs";
import { CheckoutPerks, useCheckoutPerks, type CheckoutPerksState } from "./CheckoutPerks";
import { InviteBanner } from "./InviteBanner";
import { readInvite, writeInvite } from "./invite";

const TOKEN = "ws.c1.1.1999999999.c2lnbmF0dXJl";
const GOLD = { id: "t2", name: { ar: "ذهبي", en: "Gold" }, percentOff: 10, freeShipping: true, pointsMultiplier: 2 };

let n = 0;
function aStore(signedIn: boolean) {
  n += 1;
  const id = `reward${n}`;
  if (signedIn) window.localStorage.setItem(`zimos:shopper:${id}`, JSON.stringify({ token: TOKEN, expiresAt: Date.now() + 60_000 }));
  return { id, store: { workspaceId: id, id, slug: "shop", name: "Shop", currency: "EGP", logoUrl: null, phone: null, checkout: {}, orderBump: null } as unknown as StoreInfo };
}
const inStore = (store: StoreInfo, children: React.ReactNode) =>
  render(
    <StoreContextProvider locale="en" store={store}>
      {children}
    </StoreContextProvider>
  );

let latest: CheckoutPerksState;
function Perks() {
  const state = useCheckoutPerks();
  latest = state;
  return (
    <form onSubmit={(e) => e.preventDefault()}>
      <CheckoutPerks state={state} />
    </form>
  );
}

beforeEach(() => {
  request.mockReset();
  window.localStorage.clear();
  window.sessionStorage.clear();
  window.history.replaceState(null, "", "/");
});
afterEach(cleanup);

describe("what the checkout says of a shopper's level and a friend's invite", () => {
  it("names the level's discount and free shipping, which the API takes off the order", async () => {
    const { store, id } = aStore(true);
    request.mockImplementation(async (path: string) =>
      path.endsWith("/account/config") ? { enabled: true, channels: ["sms"] } : { enabled: true, tier: GOLD, next: null, tiers: [] }
    );
    inStore(store, <Perks />);
    expect(await screen.findByText("VIP 10% off")).toBeTruthy();
    expect(screen.getByText("Your level: Gold")).toBeTruthy();
    expect(screen.getByText("Free shipping for VIP")).toBeTruthy();
    expect(request).toHaveBeenCalledWith(`/store/${id}/account/vip`, { auth: false, headers: { "X-Shopper-Token": TOKEN } });
    expect(latest.shopperToken).toBe(TOKEN);
    expect(latest.payload).toEqual({});
  });

  it("sends a kept invite with the order, and forgets it once the order is placed", async () => {
    const { store, id } = aStore(false);
    writeInvite(id, { code: "MONA77", friend: { percentOff: 10, freeShipping: false } });
    request.mockImplementation(async (path: string) =>
      path.endsWith("/account/config") ? { enabled: true, channels: ["sms"] } : { valid: true, code: "MONA77", friend: { percentOff: 15, freeShipping: false } }
    );
    inStore(store, <Perks />);
    // The offer is today's, as the API has it now.
    expect(await screen.findByText("Invite applied: 15% off your first order")).toBeTruthy();
    expect(request).toHaveBeenCalledWith(`/store/${id}/referrals/MONA77`, { auth: false });
    expect(latest.payload).toEqual({ referralCode: "MONA77" });

    latest.onPlaced();
    await waitFor(() => expect(readInvite(id)).toBeNull());
  });

  it("says why an invite was refused, and offers the order without it", async () => {
    const { store, id } = aStore(false);
    writeInvite(id, { code: "MONA77", friend: { percentOff: 10, freeShipping: false } });
    request.mockImplementation(async (path: string) =>
      path.endsWith("/account/config") ? { enabled: true, channels: ["sms"] } : { valid: true, code: "MONA77", friend: { percentOff: 10, freeShipping: false } }
    );
    inStore(store, <Perks />);
    await screen.findByText(/Invite applied/);

    const refusal = new ApiError("Invalid body", 422, "VALIDATION_ERROR", { error: { details: [{ field: "referralCode", message: "You can't use your own invite" }] } });
    let said: string | null = null;
    await waitFor(() => {
      said = latest.onError(refusal);
      expect(said).toBe("You can't use your own invite. You can still place your order without the invite.");
    });
    expect(await screen.findByRole("button", { name: "Place the order without the invite" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Place the order without the invite" }));
    await waitFor(() => expect(latest.payload).toEqual({}));
    expect(readInvite(id)).toBeNull();
  });
});

describe("a friend's invite link", () => {
  it("is checked with the store, kept for the checkout and announced above the store", async () => {
    const { store, id } = aStore(false);
    window.history.replaceState(null, "", "/?ref=mona77");
    request.mockResolvedValue({ valid: true, code: "MONA77", friend: { percentOff: 10, freeShipping: false } });
    const { container } = inStore(store, <InviteBanner />);
    expect(await screen.findByText("You've been invited! 10% off your first order")).toBeTruthy();
    expect(request).toHaveBeenCalledWith(`/store/${id}/referrals/MONA77`, { auth: false });
    expect(readInvite(id)).toMatchObject({ code: "MONA77", friend: { percentOff: 10, freeShipping: false } });
    // Nothing is written into the page as raw HTML or script.
    expect(container.querySelector("script")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Hide this" }));
    await waitFor(() => expect(screen.queryByText(/You've been invited/)).toBeNull());
    // Closing the banner keeps the invite for the checkout.
    expect(readInvite(id)?.code).toBe("MONA77");
  });

  it("does nothing for a code that is not a running invite", async () => {
    const { store, id } = aStore(false);
    window.history.replaceState(null, "", "/?ref=NOPE12");
    request.mockResolvedValue({ valid: false });
    inStore(store, <InviteBanner />);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(readInvite(id)).toBeNull();
    expect(screen.queryByRole("status")).toBeNull();
  });

  it("offers a signed-in shopper nothing for their own link", async () => {
    const { store, id } = aStore(true);
    window.history.replaceState(null, "", "/?ref=MONA77");
    request.mockImplementation(async (path: string) =>
      path.endsWith("/account/referral")
        ? { enabled: true, code: "MONA77", path: "/?ref=MONA77", offer: {}, stats: { pending: 0, rewarded: 0 }, referrals: [] }
        : { valid: true, code: "MONA77", friend: { percentOff: 10, freeShipping: false } }
    );
    inStore(store, <InviteBanner />);
    await waitFor(() => expect(request).toHaveBeenCalledWith(`/store/${id}/account/referral`, { auth: false, headers: { "X-Shopper-Token": TOKEN } }));
    expect(readInvite(id)).toBeNull();
  });

  it("asks nothing on a page without a link", async () => {
    const { store } = aStore(false);
    inStore(store, <InviteBanner />);
    await new Promise((r) => setTimeout(r, 20));
    expect(request).not.toHaveBeenCalled();
  });
});

describe("the account's extra tabs", () => {
  it("show points and credit only when the shopper has something there", async () => {
    const { store } = aStore(true);
    request.mockImplementation(async (path: string) => {
      if (path.endsWith("/account/loyalty")) return { balance: 0, worth: "0", currency: "EGP", expiresAt: null, history: [], program: null };
      return { balance: "15000", currency: "EGP", history: [], spendingEnabled: true };
    });
    inStore(store, <ul><AccountWalletTabs pathname="/account" /></ul>);
    expect(await screen.findByRole("link", { name: "My credit" })).toBeTruthy();
    expect(screen.queryByRole("link", { name: "My points" })).toBeNull();
  });

  it("show the level and the invite on a store that runs them", async () => {
    const { store } = aStore(true);
    request.mockImplementation(async (path: string) =>
      path.endsWith("/account/vip") ? { enabled: true, tier: GOLD, next: null, tiers: [] } : { enabled: false }
    );
    inStore(store, <ul><AccountRewardsTabs pathname="/account" /></ul>);
    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(1));
    expect(screen.getByRole("link").getAttribute("href")).toBe("/account/vip");
  });
});
