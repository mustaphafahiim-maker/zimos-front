import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { ApiError } from "@store-builder/api-client";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import { SHOPPER_TOKEN_MAX_AGE_MS } from "@/lib/shopperToken";

const flags = vi.hoisted(() => ({ accounts: true }));
vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  get SHOPPER_ACCOUNTS_ENABLED() {
    return flags.accounts;
  },
}));
const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/apiClient", () => ({ createStorefrontApiClient: () => ({ request }) }));

import { takeSignedOutByServer, useShopperApi, useShopperConfig } from "./shopperSession";

const TOKEN = "ws.c1.1.1999999999.c2lnbmF0dXJl";
const DAY = 24 * 60 * 60;

// The store's setting is remembered per store for the page's life, so each test has a store of its own.
let n = 0;
function aStore() {
  n += 1;
  const id = `store${n}`;
  const store = { workspaceId: id, id, slug: "shop", name: "Shop", currency: "EGP", logoUrl: null, phone: null, checkout: {}, orderBump: null } as unknown as StoreInfo;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <StoreContextProvider locale="en" store={store}>
      {children}
    </StoreContextProvider>
  );
  return { id, wrapper, key: `zimos:shopper:${id}` };
}

beforeEach(() => {
  flags.accounts = true;
  request.mockReset();
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterEach(cleanup);

describe("the signed-in shopper's token", () => {
  it("is kept for 7 days at most, whatever the API grants, and read back", () => {
    const { wrapper, key } = aStore();
    const { result } = renderHook(() => useShopperApi(), { wrapper });
    expect(result.current.token).toBeNull();

    const before = Date.now();
    act(() => result.current.signIn(TOKEN, 30 * DAY));
    expect(result.current.token).toBe(TOKEN);
    const kept = JSON.parse(window.localStorage.getItem(key) ?? "{}") as { token: string; expiresAt: number };
    expect(kept.token).toBe(TOKEN);
    expect(kept.expiresAt).toBeLessThanOrEqual(Date.now() + SHOPPER_TOKEN_MAX_AGE_MS);
    expect(kept.expiresAt).toBeGreaterThanOrEqual(before + SHOPPER_TOKEN_MAX_AGE_MS - 1000);

    act(() => result.current.signOut());
    expect(result.current.token).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it("reads as signed out once it is past its time", () => {
    const { wrapper, key } = aStore();
    window.localStorage.setItem(key, JSON.stringify({ token: TOKEN, expiresAt: Date.now() - 1000 }));
    const { result } = renderHook(() => useShopperApi(), { wrapper });
    expect(result.current.token).toBeNull();
    expect(window.localStorage.getItem(key)).toBeNull();
  });

  it("is dropped when the API answers 401, and the sign-in is told once", async () => {
    const { wrapper } = aStore();
    const { result } = renderHook(() => useShopperApi(), { wrapper });
    act(() => result.current.signIn(TOKEN, DAY));

    const refusal = new ApiError("Sign in again", 401, "SHOPPER_NOT_SIGNED_IN");
    await act(async () => {
      await expect(result.current.call(async () => Promise.reject(refusal))).rejects.toBe(refusal);
    });
    expect(result.current.token).toBeNull();
    expect(takeSignedOutByServer()).toBe(true);
    expect(takeSignedOutByServer()).toBe(false);
  });

  it("goes to a signed-in call, and a call with no token never reaches the API", async () => {
    const { wrapper, id } = aStore();
    const { result } = renderHook(() => useShopperApi(), { wrapper });
    const read = vi.fn(async () => "ok");
    await expect(result.current.call(read)).rejects.toMatchObject({ code: "SHOPPER_NOT_SIGNED_IN" });
    expect(read).not.toHaveBeenCalled();

    act(() => result.current.signIn(TOKEN, DAY));
    await expect(result.current.call(read)).resolves.toBe("ok");
    expect(read).toHaveBeenCalledWith(expect.anything(), id, TOKEN);
  });
});

describe("the store's accounts setting", () => {
  it("is asked once for the header, the account and the checkout together", async () => {
    const { wrapper, id } = aStore();
    request.mockResolvedValue({ enabled: true, channels: ["sms"] });
    const first = renderHook(() => useShopperConfig(), { wrapper });
    const second = renderHook(() => useShopperConfig(), { wrapper });
    await waitFor(() => expect(first.result.current.status).toBe("ready"));
    await waitFor(() => expect(second.result.current.status).toBe("ready"));
    expect(first.result.current.config).toEqual({ enabled: true, channels: ["sms"] });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(`/store/${id}/account/config`, { auth: false });
  });

  it("says so when it could not be read", async () => {
    const { wrapper } = aStore();
    request.mockRejectedValue(new ApiError("Not found", 404, "NOT_FOUND"));
    const { result } = renderHook(() => useShopperConfig(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("error"));
  });
});

describe("with shopper accounts switched off for this deploy", () => {
  it("asks nothing, and no store has accounts", async () => {
    flags.accounts = false;
    const { wrapper } = aStore();
    const { result } = renderHook(() => useShopperConfig(), { wrapper });
    expect(result.current.status).toBe("ready");
    expect(result.current.config).toEqual({ enabled: false, channels: [] });
    await new Promise((r) => setTimeout(r, 20));
    expect(request).not.toHaveBeenCalled();
  });

  it("keeps no token and reads none", () => {
    flags.accounts = false;
    const { wrapper, key } = aStore();
    window.localStorage.setItem(key, JSON.stringify({ token: TOKEN, expiresAt: Date.now() + 60_000 }));
    const { result } = renderHook(() => useShopperApi(), { wrapper });
    expect(result.current.token).toBeNull();
    act(() => result.current.signIn(TOKEN, DAY));
    expect(result.current.token).toBeNull();
  });
});
