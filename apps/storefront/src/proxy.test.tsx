// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

function request(host: string, path = "/") {
  return new NextRequest(`http://${host}${path}`, { headers: { host } });
}

const rewriteOf = (res: Response) => res.headers.get("x-middleware-rewrite");
const isNext = (res: Response) => res.headers.get("x-middleware-next") === "1";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("proxy with merchant domains off (the default)", () => {
  it("routes a store subdomain, a platform host and an unknown host as before, with no lookup", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const store = await proxy(request("shop.zimos.co", "/products/x"));
    expect(new URL(rewriteOf(store)!).pathname).toBe("/store/shop/products/x");

    const platform = await proxy(request("zimos.co"));
    expect(platform.status).toBe(307);
    expect(platform.headers.get("location")).toBe("https://zimos.co/");

    const unknown = await proxy(request("shop.example.com"));
    expect(isNext(unknown)).toBe(true);
    expect(rewriteOf(unknown)).toBeNull();

    // Off means off: the store files are left to the app as before.
    const robots = await proxy(request("shop.example.com", "/robots.txt"));
    expect(isNext(robots)).toBe(true);

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("stays off for any value but exactly \"true\"", async () => {
    vi.stubEnv("CUSTOM_DOMAINS_ENABLED", "1");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(isNext(await proxy(request("other.example.com")))).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("proxy with merchant domains on", () => {
  it("falls back to the platform routing when the lookup fails", async () => {
    vi.stubEnv("CUSTOM_DOMAINS_ENABLED", "true");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("down")));
    const res = await proxy(request("failing.example.com"));
    expect(isNext(res)).toBe(true);
    expect(res.status).toBe(200);
  });

  it("gives up on a lookup after 1.5 seconds and falls back", async () => {
    vi.stubEnv("CUSTOM_DOMAINS_ENABLED", "true");
    vi.useFakeTimers();
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => undefined)));
    const pending = proxy(request("slow.example.com"));
    await vi.advanceTimersByTimeAsync(1500);
    const res = await pending;
    expect(isNext(res)).toBe(true);
  });

  it("never looks up the platform's own hosts", async () => {
    vi.stubEnv("CUSTOM_DOMAINS_ENABLED", "true");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(new URL(rewriteOf(await proxy(request("shop.zimos.co", "/cart")))!).pathname).toBe("/store/shop/cart");
    expect((await proxy(request("zimos.co"))).status).toBe(307);
    expect((await proxy(request("www.zimos.co"))).status).toBe(307);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("routes a connected merchant domain to its store", async () => {
    vi.stubEnv("CUSTOM_DOMAINS_ENABLED", "true");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(JSON.stringify({ store: { slug: "shop", homeFunnel: null, primaryHost: null } }), { status: 200 })),
    );
    const res = await proxy(request("mine.example.com", "/products/x"));
    expect(new URL(rewriteOf(res)!).pathname).toBe("/store/shop/products/x");
  });
});
