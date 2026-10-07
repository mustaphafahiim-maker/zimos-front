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

describe("behind the Cloudflare Worker (X-Forwarded-Host + X-Zimos-Edge)", () => {
  const SECRET = "edge-secret-for-tests-0123456789abcdef";
  const ORIGIN = "storefront-production.up.railway.app";
  const resolved = (body: object) => vi.fn().mockResolvedValue(new Response(JSON.stringify({ store: body }), { status: 200 }));
  function viaWorker(visitor: string, path = "/", edge: string | null = SECRET) {
    const headers: Record<string, string> = { host: ORIGIN, "x-forwarded-host": visitor, "x-forwarded-proto": "https" };
    if (edge !== null) headers["x-zimos-edge"] = edge;
    return new NextRequest(`https://${ORIGIN}${path}`, { headers });
  }
  const lookedUp = (fetchSpy: ReturnType<typeof vi.fn>) => new URL(String(fetchSpy.mock.calls[0][0])).searchParams.get("host");

  it("serves the visitor's merchant domain when the secret matches", async () => {
    vi.stubEnv("CUSTOM_DOMAINS_ENABLED", "true");
    vi.stubEnv("CUSTOM_DOMAIN_EDGE_SECRET", SECRET);
    const fetchSpy = resolved({ slug: "shop", homeFunnel: null, primaryHost: null });
    vi.stubGlobal("fetch", fetchSpy);
    const res = await proxy(viaWorker("www.example.com", "/products/x"));
    expect(lookedUp(fetchSpy)).toBe("www.example.com");
    expect(new URL(rewriteOf(res)!).pathname).toBe("/store/shop/products/x");
  });

  it("ignores X-Forwarded-Host with a wrong, missing or unset secret", async () => {
    vi.stubEnv("CUSTOM_DOMAINS_ENABLED", "true");
    vi.stubEnv("CUSTOM_DOMAIN_EDGE_SECRET", SECRET);
    // One spy for every attempt: lib/customDomains caches a host's answer,
    // so only the first lookup of the origin host reaches fetch.
    const fetchSpy = resolved({ slug: "shop", homeFunnel: null, primaryHost: null });
    vi.stubGlobal("fetch", fetchSpy);
    for (const edge of [`${SECRET}x`, SECRET.slice(0, -1), "", null]) {
      await proxy(viaWorker("www.example.com", "/", edge));
    }
    // No secret configured: never trusted, whatever the request sends.
    vi.stubEnv("CUSTOM_DOMAIN_EDGE_SECRET", "");
    await proxy(viaWorker("www.example.com", "/", ""));
    const hosts = fetchSpy.mock.calls.map((call) => new URL(String(call[0])).searchParams.get("host"));
    expect(hosts.length).toBeGreaterThan(0);
    expect(hosts.every((h) => h === ORIGIN)).toBe(true);
  });

  it("never reads X-Forwarded-Host while merchant domains are off", async () => {
    vi.stubEnv("CUSTOM_DOMAIN_EDGE_SECRET", SECRET);
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const res = await proxy(viaWorker("shop.zimos.co", "/cart"));
    expect(isNext(res)).toBe(true);
    expect(rewriteOf(res)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("a redirect keeps the visitor on their own host, never the Railway one", async () => {
    vi.stubEnv("CUSTOM_DOMAINS_ENABLED", "true");
    vi.stubEnv("CUSTOM_DOMAIN_EDGE_SECRET", SECRET);
    vi.stubGlobal("fetch", resolved({ slug: "shop", homeFunnel: null, primaryHost: null }));
    const res = await proxy(viaWorker("www.example.com", "/store/shop/products/x?ref=1"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("https://www.example.com/products/x?ref=1");
  });

  it("does not pass the secret on to the app", async () => {
    vi.stubEnv("CUSTOM_DOMAINS_ENABLED", "true");
    vi.stubEnv("CUSTOM_DOMAIN_EDGE_SECRET", SECRET);
    vi.stubGlobal("fetch", resolved({ slug: "shop", homeFunnel: null, primaryHost: null }));
    const res = await proxy(viaWorker("www.example.com", "/"));
    expect(res.headers.get("x-middleware-request-x-zimos-edge")).toBeNull();
    expect(res.headers.get("x-middleware-override-headers") ?? "").not.toContain("x-zimos-edge");
  });

  it("passes the shopper's IP from the Worker as x-real-ip, only with the secret", async () => {
    vi.stubEnv("CUSTOM_DOMAINS_ENABLED", "true");
    vi.stubEnv("CUSTOM_DOMAIN_EDGE_SECRET", SECRET);
    vi.stubGlobal("fetch", resolved({ slug: "shop", homeFunnel: null, primaryHost: null }));
    const proven = viaWorker("www.example.com", "/");
    proven.headers.set("x-zimos-client-ip", "203.0.113.7");
    expect((await proxy(proven)).headers.get("x-middleware-request-x-real-ip")).toBe("203.0.113.7");

    const forged = viaWorker("www.example.com", "/", "wrong");
    forged.headers.set("x-zimos-client-ip", "203.0.113.7");
    expect((await proxy(forged)).headers.get("x-middleware-request-x-real-ip")).not.toBe("203.0.113.7");
  });
});
