// @vitest-environment node
import { describe, expect, it } from "vitest";
import { EDGE_CACHE_CONTROL, edgeCacheControl, storePathOf } from "./edgeCache";
import { LOCALE_COOKIE } from "./i18n";
import { STORE_PREVIEW_COOKIE } from "./storePreview";

const page = (pathname: string, over: Partial<Parameters<typeof edgeCacheControl>[0]> = {}) =>
  edgeCacheControl({
    enabled: true,
    method: "GET",
    pathname,
    cookieNames: [],
    previewLink: false,
    status: 200,
    redirected: false,
    ...over,
  });

describe("storePathOf", () => {
  it("strips the internal /store/<workspace> prefix and keeps a host-routed path", () => {
    expect(storePathOf("/store/ws1")).toBe("/");
    expect(storePathOf("/store/ws1/products/x")).toBe("/products/x");
    expect(storePathOf("/products/x")).toBe("/products/x");
  });
});

describe("edgeCacheControl", () => {
  it("is off unless switched on", () => {
    expect(page("/", { enabled: false })).toBeNull();
  });

  it("lets the CDN keep the public pages", () => {
    for (const path of ["/", "/products", "/products/shirt", "/policies/refund", "/learn", "/learn/a", "/looks/summer", "/store/ws1", "/store/ws1/products/shirt"]) {
      expect(page(path)).toBe(EDGE_CACHE_CONTROL);
    }
    expect(page("/", { method: "HEAD" })).toBe(EDGE_CACHE_CONTROL);
  });

  it("never caches a page with a shopper or an order in it", () => {
    for (const path of ["/cart", "/checkout", "/orders/o1", "/pay/o1", "/offer/o1", "/downloads/t", "/track", "/unsubscribe", "/r/t", "/f/ref", "/preview/t", "/store/ws1/checkout", "/about"]) {
      expect(page(path)).toBeNull();
    }
  });

  it("stays private for a chosen language, a preview, a redirect or a non-GET", () => {
    expect(page("/", { cookieNames: [LOCALE_COOKIE] })).toBeNull();
    expect(page("/", { cookieNames: ["other", STORE_PREVIEW_COOKIE] })).toBeNull();
    expect(page("/", { cookieNames: ["zimos_touch"] })).toBe(EDGE_CACHE_CONTROL);
    expect(page("/", { previewLink: true })).toBeNull();
    expect(page("/", { status: 307, redirected: true })).toBeNull();
    expect(page("/", { method: "POST" })).toBeNull();
  });
});
