import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ApiError } from "@store-builder/api-client";
import { getDictionary } from "@/lib/i18n";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";

vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  SHOPPER_ACCOUNTS_ENABLED: true,
}));
const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/apiClient", () => ({ createStorefrontApiClient: () => ({ request }) }));

import { ShopperSignIn } from "./ShopperSignIn";

const STORE = { workspaceId: "ws1", id: "ws1", slug: "shop", name: "Shop", currency: "EGP", logoUrl: null, phone: null, checkout: {}, orderBump: null } as unknown as StoreInfo;
const t = getDictionary("en");
const a = t.account;
const TOKEN = "ws1.c1.1.1999999999.c2lnbmF0dXJl";
const SENT = { sent: true, channel: "sms", target: "01******003", expiresInSeconds: 600, resendAfterSeconds: 60 };
const SESSION = {
  token: TOKEN,
  expiresInSeconds: 30 * 24 * 60 * 60,
  customer: { id: "c1", fullName: "Mona", phone: "+201012345003", email: null, emailVerified: false, marketingConsent: false, ordersCount: 2 },
  addresses: [],
};

function show(onSignedIn = vi.fn(), channels: Array<"sms" | "email"> = ["sms"]) {
  render(
    <StoreContextProvider locale="en" store={STORE}>
      <ShopperSignIn channels={channels} onSignedIn={onSignedIn} />
    </StoreContextProvider>
  );
  return onSignedIn;
}

async function askForCode(phone = "0101 234 5003") {
  fireEvent.change(screen.getByLabelText(t.form.phone), { target: { value: phone } });
  fireEvent.click(screen.getByRole("button", { name: a.sendCode }));
  return screen.findByLabelText(a.code);
}

beforeEach(() => {
  request.mockReset();
  window.localStorage.clear();
});
afterEach(cleanup);

describe("signing in to a store with a code", () => {
  it("sends the code to the phone, then six digits sign in and the token is kept", async () => {
    request.mockImplementation(async (path: string) => (path.endsWith("/code") ? SENT : SESSION));
    const onSignedIn = show();

    const code = await askForCode();
    expect(request).toHaveBeenCalledWith("/store/ws1/account/code", { method: "POST", body: { phone: "01012345003", locale: "en" }, auth: false });
    expect(screen.getByText(SENT.target)).toBeTruthy();

    // Arabic-Indic digits from an Arabic keyboard count too.
    fireEvent.change(code, { target: { value: "١٢٣٤٥٦" } });
    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith(SESSION));
    expect(request).toHaveBeenCalledWith("/store/ws1/account/verify", { method: "POST", body: { phone: "01012345003", code: "123456" }, auth: false });

    const kept = JSON.parse(window.localStorage.getItem("zimos:shopper:ws1") ?? "{}") as { token: string; expiresAt: number };
    expect(kept.token).toBe(TOKEN);
    // 7 days here, though the API granted 30.
    expect(kept.expiresAt).toBeLessThanOrEqual(Date.now() + 7 * 24 * 60 * 60 * 1000);
  });

  it("asks nothing for a number that is not a mobile number", async () => {
    show();
    fireEvent.change(screen.getByLabelText(t.form.phone), { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: a.sendCode }));
    expect(await screen.findByText(a.errors.invalidPhone)).toBeTruthy();
    expect(request).not.toHaveBeenCalled();
  });

  it("says how many tries are left after a wrong code, and keeps no token", async () => {
    request.mockImplementation(async (path: string) => {
      if (path.endsWith("/code")) return SENT;
      throw new ApiError("That code is not valid", 422, "INVALID_CODE", { error: { code: "INVALID_CODE", details: { attemptsLeft: 2 } } });
    });
    const onSignedIn = show();
    fireEvent.change(await askForCode(), { target: { value: "000000" } });
    expect(await screen.findByText(a.errors.invalidCode(2))).toBeTruthy();
    expect(onSignedIn).not.toHaveBeenCalled();
    expect(window.localStorage.getItem("zimos:shopper:ws1")).toBeNull();
  });

  it("offers the email only when the store allows it, and signs in by it", async () => {
    request.mockImplementation(async (path: string) => (path.endsWith("/code") ? { ...SENT, channel: "email", target: "m***@mail.com" } : SESSION));
    show(vi.fn(), ["sms", "email"]);
    fireEvent.click(screen.getByRole("radio", { name: a.byEmail }));
    fireEvent.change(screen.getByLabelText(a.email), { target: { value: "mona@mail.com" } });
    fireEvent.click(screen.getByRole("button", { name: a.sendCode }));
    await screen.findByLabelText(a.code);
    expect(request).toHaveBeenCalledWith("/store/ws1/account/code", { method: "POST", body: { email: "mona@mail.com", locale: "en" }, auth: false });
  });

  it("has no email tab on a store that signs in by phone only, and no other way in", () => {
    show();
    expect(screen.queryByRole("radio", { name: a.byEmail })).toBeNull();
    expect(screen.queryByText(/google/i)).toBeNull();
  });
});
