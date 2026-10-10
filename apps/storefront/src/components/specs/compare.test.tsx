import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";

vi.mock("next/navigation", () => ({ usePathname: () => "/products/mug", useParams: () => ({ workspaceId: "shop" }) }));

import { CompareButton } from "./CompareButton";

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

// The list is remembered per store for the page's life: a store per test.
let n = 0;
function aStore() {
  n += 1;
  const id = `compare${n}`;
  return { workspaceId: id, id, slug: "shop", name: "Shop", currency: "EGP", logoUrl: null, phone: null, checkout: {}, orderBump: null } as unknown as StoreInfo;
}

function show(store: StoreInfo, product: { id: string; name: string; slug: string }, locale: "en" | "ar" = "en") {
  return render(
    <StoreContextProvider locale={locale} store={store}>
      <CompareButton product={product} />
    </StoreContextProvider>
  );
}

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe("Compare on the product page", () => {
  it("adds the product to this browser's list and asks for one more", () => {
    const store = aStore();
    show(store, { id: "p1", name: "Mug", slug: "mug" });
    const button = screen.getByRole("button", { name: "Compare" });
    expect(button.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(button);
    expect(screen.getByRole("button", { pressed: true })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Mug" }).getAttribute("href")).toContain("/products/mug");
    expect(screen.getByText("Add one more product to compare.")).toBeTruthy();
    expect(JSON.parse(window.localStorage.getItem(`zimos_compare_${store.id}`) ?? "[]")).toEqual([{ id: "p1", name: "Mug", slug: "mug" }]);
  });

  it("links to the compare page once there are two, and takes one out again", () => {
    const store = aStore();
    window.localStorage.setItem(`zimos_compare_${store.id}`, JSON.stringify([{ id: "p0", name: "Cup", slug: "cup" }]));
    show(store, { id: "p1", name: "Mug", slug: "mug" });
    fireEvent.click(screen.getByRole("button", { name: "Compare" }));
    expect(screen.getByRole("link", { name: /Compare/ }).getAttribute("href")).toContain("/compare");

    fireEvent.click(screen.getByRole("button", { name: /Cup/ }));
    expect(screen.queryByRole("link", { name: "Cup" })).toBeNull();
    expect(screen.getByText("Add one more product to compare.")).toBeTruthy();
  });

  it("holds four at most, and says so", () => {
    const store = aStore();
    const four = ["a", "b", "c", "d"].map((id) => ({ id, name: `Item ${id}`, slug: id }));
    window.localStorage.setItem(`zimos_compare_${store.id}`, JSON.stringify(four));
    show(store, { id: "p1", name: "Mug", slug: "mug" });
    fireEvent.click(screen.getByRole("button", { name: "Compare" }));
    expect(screen.getByRole("alert").textContent).toBe("You can compare up to 4 products. Remove one to add this.");
    expect(JSON.parse(window.localStorage.getItem(`zimos_compare_${store.id}`) ?? "[]")).toHaveLength(4);
  });

  it("speaks to the shopper in Egyptian Arabic", () => {
    show(aStore(), { id: "p1", name: "مج", slug: "mug" }, "ar");
    expect(screen.getByRole("button", { name: "قارن" })).toBeTruthy();
  });
});

describe("what the switches leave out", () => {
  it("has no compare page while specifications are off", () => {
    const page = read("../../app/store/[workspaceId]/compare/page.tsx");
    expect(page).toContain('import { PRODUCT_SPECS_ENABLED } from "@/lib/features";');
    expect(page).toMatch(/if \(!PRODUCT_SPECS_ENABLED\) notFound\(\);/);
    expect(page).toMatch(/if \(!PRODUCT_SPECS_ENABLED\) return \{\};/);
  });

  it("lists products as before, with no specification filters asked for, while specifications are off", () => {
    const page = read("../../app/store/[workspaceId]/products/page.tsx");
    expect(page).toMatch(/\{PRODUCT_SPECS_ENABLED \? \(\s*<SpecFilteredResults[\s\S]*?\{results\}\s*<\/SpecFilteredResults>\s*\) : \(\s*results\s*\)\}/);
    expect(page.match(/<SpecFilteredResults/g)).toHaveLength(1);
  });

  it("shows the blog strip on the home page only while the blog is on", () => {
    const home = read("../../app/store/[workspaceId]/page.tsx");
    expect(home).toContain("{BLOG_ENABLED && <LatestPosts workspaceId={workspaceId} t={t} locale={locale} />}");
    expect(home.match(/<LatestPosts/g)).toHaveLength(1);
  });

  it("shows the gift-card line on the thank-you page only while gift cards are on", () => {
    const thanks = read("../../app/store/[workspaceId]/orders/[orderId]/page.tsx");
    expect(thanks).toContain("{GIFT_CARDS_ENABLED && <GiftCardPaidNote workspaceId={workspaceId} orderId={orderId} />}");
    expect(thanks.match(/<GiftCardPaidNote/g)).toHaveLength(1);
  });
});
