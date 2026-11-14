// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import { visitorHost } from "./edgeHost";

// A made-up value for these tests only, never a real secret.
const SECRET = "test-only-edge-secret-0123456789abcdef";
const ORIGIN = "storefront-production.up.railway.app";

function fromWorker(sent: Record<string, string>, edge: string | null = SECRET) {
  const headers = new Headers({ host: ORIGIN, ...sent });
  if (edge !== null) headers.set("x-zimos-edge", edge);
  return headers;
}

const notForwarded = { host: ORIGIN, forwarded: false, clientIp: null };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("visitorHost: X-Zimos-Host", () => {
  it("is the visitor's host when the Worker's secret matches", () => {
    vi.stubEnv("CUSTOM_DOMAIN_EDGE_SECRET", SECRET);
    const headers = fromWorker({ "x-zimos-host": "WWW.Example.com", "x-zimos-client-ip": "203.0.113.7" });
    expect(visitorHost(headers)).toEqual({ host: "www.example.com", forwarded: true, clientIp: "203.0.113.7" });
  });

  it("wins over X-Forwarded-Host, which Railway sets to its own host", () => {
    vi.stubEnv("CUSTOM_DOMAIN_EDGE_SECRET", SECRET);
    const headers = fromWorker({ "x-zimos-host": "www.example.com", "x-forwarded-host": ORIGIN });
    expect(visitorHost(headers).host).toBe("www.example.com");
  });

  it("keeps a port", () => {
    vi.stubEnv("CUSTOM_DOMAIN_EDGE_SECRET", SECRET);
    expect(visitorHost(fromWorker({ "x-zimos-host": "shop.example.com:8443" })).host).toBe("shop.example.com:8443");
  });

  it("is ignored with a wrong or missing secret", () => {
    vi.stubEnv("CUSTOM_DOMAIN_EDGE_SECRET", SECRET);
    const sameLength = `${SECRET.slice(0, -1)}${SECRET.endsWith("x") ? "y" : "x"}`;
    for (const edge of [`${SECRET}x`, SECRET.slice(0, -1), sameLength, "", null]) {
      const headers = fromWorker({ "x-zimos-host": "www.example.com", "x-zimos-client-ip": "203.0.113.7" }, edge);
      expect(visitorHost(headers)).toEqual(notForwarded);
    }
  });

  it("is ignored while the server's secret is unset or shorter than 32 characters", () => {
    const short = SECRET.slice(0, 31);
    for (const configured of ["", "   ", short]) {
      vi.stubEnv("CUSTOM_DOMAIN_EDGE_SECRET", configured);
      // The request sends the very value the server holds: still not trusted.
      expect(visitorHost(fromWorker({ "x-zimos-host": "www.example.com" }, configured))).toEqual(notForwarded);
    }
  });

  it("accepts the server's secret with spaces around it, as it does today", () => {
    vi.stubEnv("CUSTOM_DOMAIN_EDGE_SECRET", ` ${SECRET} `);
    expect(visitorHost(fromWorker({ "x-zimos-host": "www.example.com" })).forwarded).toBe(true);
  });

  it("is refused when it is not a host, and then X-Forwarded-Host is not read either", () => {
    vi.stubEnv("CUSTOM_DOMAIN_EDGE_SECRET", SECRET);
    for (const bad of ["", "www.example.com/path", "www.example.com, evil.example", "user@www.example.com", "www.exämple.com", "www.example.com:123456", "a b.com"]) {
      const headers = fromWorker({ "x-zimos-host": bad, "x-forwarded-host": "www.example.com", "x-zimos-client-ip": "203.0.113.7" });
      expect(visitorHost(headers)).toEqual(notForwarded);
    }
  });
});

describe("visitorHost: X-Forwarded-Host, when X-Zimos-Host is absent", () => {
  it("is read with the secret (a Worker from before X-Zimos-Host)", () => {
    vi.stubEnv("CUSTOM_DOMAIN_EDGE_SECRET", SECRET);
    expect(visitorHost(fromWorker({ "x-forwarded-host": "www.example.com, proxy.example" }))).toEqual({
      host: "www.example.com",
      forwarded: true,
      clientIp: null,
    });
  });

  it("is ignored with a wrong secret, an unset one or a bad shape", () => {
    vi.stubEnv("CUSTOM_DOMAIN_EDGE_SECRET", SECRET);
    expect(visitorHost(fromWorker({ "x-forwarded-host": "www.example.com" }, "wrong"))).toEqual(notForwarded);
    expect(visitorHost(fromWorker({ "x-forwarded-host": "www.example.com/x" }))).toEqual(notForwarded);
    vi.stubEnv("CUSTOM_DOMAIN_EDGE_SECRET", "");
    expect(visitorHost(fromWorker({ "x-forwarded-host": "www.example.com" }, ""))).toEqual(notForwarded);
  });

  it("leaves Host when neither header is sent", () => {
    vi.stubEnv("CUSTOM_DOMAIN_EDGE_SECRET", SECRET);
    expect(visitorHost(fromWorker({}))).toEqual(notForwarded);
  });
});
