import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getDictionary } from "@/lib/i18n";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";

vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  SHOPPER_ACCOUNTS_ENABLED: true,
}));
vi.mock("next/navigation", () => ({ usePathname: () => "/products/mug" }));
const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/apiClient", () => ({ createStorefrontApiClient: () => ({ request }) }));

import { WishlistHeart } from "./WishlistHeart";

const t = getDictionary("en");
const TOKEN = "ws.c1.1.1999999999.c2lnbmF0dXJl";
const item = (id: string, productId: string) => ({
  id,
  productId,
  variantId: null,
  addedAt: "2026-10-01T10:00:00.000Z",
  product: { name: "Mug", slug: "mug", imageUrl: null },
  price: { amount: "15000", compareAt: null, currency: "EGP" },
  available: true,
});

// The store's setting and the list are remembered per store for the page's life: a store per test.
let n = 0;
function aStore() {
  n += 1;
  const id = `heart${n}`;
  return { id, store: { workspaceId: id, id, slug: "shop", name: "Shop", currency: "EGP", logoUrl: null, phone: null, checkout: {}, orderBump: null } as unknown as StoreInfo };
}

function show(store: StoreInfo, productId = "p1") {
  return render(
    <StoreContextProvider locale="en" store={store}>
      <WishlistHeart productId={productId} />
    </StoreContextProvider>
  );
}

/** Answers the store's calls: its accounts setting, and the wishlist's four. */
function api(enabled: boolean, start: ReturnType<typeof item>[] = []) {
  let items = start;
  request.mockImplementation(async (path: string, options: { method?: string; body?: { productId: string } } = {}) => {
    if (path.endsWith("/account/config")) return { enabled, channels: ["sms"] };
    if (path.endsWith("/account/wishlist") && options.method === "POST") items = [item("w-new", options.body!.productId), ...items];
    else if (path.includes("/account/wishlist/") && options.method === "DELETE") items = items.filter((i) => !path.endsWith(`/${i.id}`));
    return { items, count: items.length };
  });
}

beforeEach(() => {
  request.mockReset();
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterEach(cleanup);

describe("the wishlist heart", () => {
  it("is not drawn on a store without shopper accounts", async () => {
    const { store, id } = aStore();
    api(false);
    const { container } = show(store);
    await waitFor(() => expect(request).toHaveBeenCalledWith(`/store/${id}/account/config`, { auth: false }));
    expect(container.querySelector("button")).toBeNull();
  });

  it("keeps a guest's heart in this browser and offers the sign-in, asking the API nothing", async () => {
    const { store, id } = aStore();
    api(true);
    show(store);
    fireEvent.click(await screen.findByRole("button", { name: t.wishlist.add }));

    expect(await screen.findByText(t.wishlist.signInToKeep)).toBeTruthy();
    expect(screen.getByRole("button", { name: t.wishlist.remove })).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(`zimos_wishlist_${id}`) ?? "[]")).toEqual([{ productId: "p1", variantId: null }]);
    // The sign-in comes back to this page.
    expect(screen.getByRole("link", { name: t.account.signIn }).getAttribute("href")).toBe(`/account?next=${encodeURIComponent("/products/mug")}`);
    expect(request.mock.calls.filter(([path]) => String(path).includes("/wishlist"))).toEqual([]);
  });

  it("saves and removes on the signed-in shopper's own list, with their token", async () => {
    const { store, id } = aStore();
    window.localStorage.setItem(`zimos:shopper:${id}`, JSON.stringify({ token: TOKEN, expiresAt: Date.now() + 60_000 }));
    api(true);
    show(store);
    const signed = { auth: false, headers: { "X-Shopper-Token": TOKEN } };

    const heart = await screen.findByRole("button", { name: t.wishlist.add });
    await waitFor(() => expect(request).toHaveBeenCalledWith(`/store/${id}/account/wishlist`, signed));
    fireEvent.click(heart);
    await waitFor(() => expect(request).toHaveBeenCalledWith(`/store/${id}/account/wishlist`, { ...signed, method: "POST", body: { productId: "p1" } }));
    fireEvent.click(await screen.findByRole("button", { name: t.wishlist.remove }));
    await waitFor(() => expect(request).toHaveBeenCalledWith(`/store/${id}/account/wishlist/w-new`, { ...signed, method: "DELETE" }));
    expect(await screen.findByRole("button", { name: t.wishlist.add })).toBeTruthy();
  });

  it("hands a guest's hearts to the account on the first signed-in page, then forgets them here", async () => {
    const { store, id } = aStore();
    window.localStorage.setItem(`zimos_wishlist_${id}`, JSON.stringify([{ productId: "p1", variantId: null }]));
    window.localStorage.setItem(`zimos:shopper:${id}`, JSON.stringify({ token: TOKEN, expiresAt: Date.now() + 60_000 }));
    request.mockImplementation(async (path: string) =>
      path.endsWith("/account/config") ? { enabled: true, channels: ["sms"] } : { items: [item("w1", "p1")], count: 1 }
    );
    show(store);
    expect(await screen.findByRole("button", { name: t.wishlist.remove })).toBeTruthy();
    expect(request).toHaveBeenCalledWith(`/store/${id}/account/wishlist/merge`, {
      auth: false,
      headers: { "X-Shopper-Token": TOKEN },
      method: "POST",
      body: { items: [{ productId: "p1", variantId: null }] },
    });
    expect(window.localStorage.getItem(`zimos_wishlist_${id}`)).toBeNull();
  });
});
