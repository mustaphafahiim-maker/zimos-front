// @vitest-environment node
import { describe, expect, it } from "vitest";
import { frameAncestorsPolicy } from "./frameAncestors";

describe("frameAncestorsPolicy", () => {
  it("sends nothing when unset or empty, as before", () => {
    expect(frameAncestorsPolicy(undefined)).toBeNull();
    expect(frameAncestorsPolicy("")).toBeNull();
    expect(frameAncestorsPolicy(" , ")).toBeNull();
  });

  it("allows the store itself and each listed origin by name", () => {
    expect(frameAncestorsPolicy("https://app.zimos.co")).toBe("frame-ancestors 'self' https://app.zimos.co");
    expect(frameAncestorsPolicy(" https://app.zimos.co/some/path , http://localhost:5173 ")).toBe(
      "frame-ancestors 'self' https://app.zimos.co http://localhost:5173",
    );
  });

  it("allows the store's own pages only when set to self", () => {
    expect(frameAncestorsPolicy("self")).toBe("frame-ancestors 'self'");
    expect(frameAncestorsPolicy("'self'")).toBe("frame-ancestors 'self'");
  });

  it("drops wildcards, other schemes and junk instead of opening the list", () => {
    expect(frameAncestorsPolicy("*")).toBe("frame-ancestors 'self'");
    expect(frameAncestorsPolicy("https://*.zimos.co")).toBe("frame-ancestors 'self'");
    expect(frameAncestorsPolicy("javascript:alert(1), data:text/html,x, not a url")).toBe("frame-ancestors 'self'");
  });

  it("lists an origin once", () => {
    expect(frameAncestorsPolicy("https://app.zimos.co, https://app.zimos.co/")).toBe(
      "frame-ancestors 'self' https://app.zimos.co",
    );
  });
});
