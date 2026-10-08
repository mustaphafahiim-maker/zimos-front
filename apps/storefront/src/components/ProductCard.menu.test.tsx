import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { ApiError, type StorefrontProduct } from "@store-builder/api-client";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import { getDictionary } from "@/lib/i18n";
import { needsProductPage } from "@/lib/product";
import { cartErrorMessage, orderErrorMessage } from "@/lib/placeOrder";
import { ProductCard } from "./ProductCard";

const STORE: StoreInfo = {
  workspaceId: "ws1",
  id: "ws1",
  slug: "shop",
  name: "Shop",
  currency: "EGP",
  logoUrl: null,
  phone: null,
  checkout: { email: "optional", postal_code: "hidden", notes: "optional" },
  orderBump: null,
};

const burger: StorefrontProduct = {
  id: "p1",
  name: "برجر",
  slug: "burger",
  description: null,
  productType: "physical",
  media: [],
  tags: [],
  seo: null,
  variants: [{ id: "v1", sku: "B1", optionValues: {}, priceAmount: "10000", compareAtAmount: null, currency: "EGP", inStock: true } as unknown as StorefrontProduct["variants"][number]],
  offers: [],
  customFields: [],
  hasOptionGroups: true,
};

afterEach(cleanup);

// A product with menu options is never added from its card: the card opens its page.
describe("menu options on product cards", () => {
  const ar = getDictionary("ar");

  it("shows no one-tap add for a product with option groups; the card links to its page", () => {
    render(
      <StoreContextProvider locale="ar" store={STORE}>
        <ProductCard product={burger} currency="EGP" locale="ar" />
      </StoreContextProvider>
    );
    expect(screen.queryByRole("button", { name: ar.product.addToCart })).toBeNull();
    expect(screen.getByText(ar.shop.chooseOptions)).toBeTruthy();
    expect(screen.getByRole("link", { name: "برجر" }).getAttribute("href")).toContain("/products/burger");
  });

  it("needs the product page for option groups (list flag or detail groups) or custom fields only", () => {
    expect(needsProductPage({ hasOptionGroups: true })).toBe(true);
    expect(needsProductPage({ optionGroups: [{ id: "g", name: "Size", required: true, minSelect: 1, maxSelect: 1, choices: [] }] })).toBe(true);
    expect(needsProductPage({ customFields: [{ key: "x" } as never] })).toBe(true);
    expect(needsProductPage({ hasOptionGroups: false, optionGroups: [], customFields: [] })).toBe(false);
    // An older API without the flag: quick add as before.
    expect(needsProductPage({})).toBe(false);
  });
});

describe("self delivery and menu refusals in the shopper's language", () => {
  const codes: Array<[string, keyof ReturnType<typeof getDictionary>["form"]["errors"]]> = [
    ["OPTIONS_INVALID", "optionsInvalid"],
    ["PICKUP_NOT_AVAILABLE", "pickupUnavailable"],
    ["STORE_CLOSED", "storeClosed"],
    ["MIN_ORDER_NOT_MET", "minOrder"],
    ["AREA_NOT_SERVED", "areaNotServed"],
    ["DELIVERY_ZONE_REQUIRED", "zone"],
  ];

  it.each(["ar", "en", "fr"] as const)("maps every code on orders and on the cart (%s), never the server's English", (locale) => {
    const copy = getDictionary(locale).form.errors;
    for (const [code, key] of codes) {
      const err = new ApiError("Raw English from the server", 422, code, { error: { code, details: [] } });
      expect(orderErrorMessage(err, copy)).toBe(copy[key]);
      expect(cartErrorMessage(err, copy, "fallback")).toBe(copy[key]);
    }
  });

  it("leaves other cart errors as before", () => {
    const copy = getDictionary("en").form.errors;
    expect(cartErrorMessage(new ApiError("Not enough stock", 409, "INSUFFICIENT_STOCK"), copy, "fallback")).toBe("Not enough stock");
    expect(cartErrorMessage("boom", copy, "fallback")).toBe("fallback");
  });
});
