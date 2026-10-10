// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));
const read = (relative: string) => readFileSync(path(relative), "utf8");
const ACCOUNT = "../../app/store/[workspaceId]/account/";

describe("the shopper's account pages", () => {
  it("are not there while shopper accounts are switched off", () => {
    // One layout frames every account page, so its check covers them all.
    const layout = read(`${ACCOUNT}layout.tsx`);
    expect(layout).toContain('import { SHOPPER_ACCOUNTS_ENABLED } from "@/lib/features";');
    expect(layout).toMatch(/if \(!SHOPPER_ACCOUNTS_ENABLED\) notFound\(\);/);
    expect(layout).toMatch(/if \(!SHOPPER_ACCOUNTS_ENABLED\) return \{\};/);
    expect(layout).toContain("robots: { index: false, follow: false }");
  });

  it("are the four tabs and an order, and nothing the API does not have yet", () => {
    const pages = ["page.tsx", "addresses/page.tsx", "profile/page.tsx", "wishlist/page.tsx", "orders/[orderId]/page.tsx"];
    for (const page of pages) expect(existsSync(path(`${ACCOUNT}${page}`))).toBe(true);
    const folders = readdirSync(path(ACCOUNT), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();
    expect(folders).toEqual(["addresses", "orders", "profile", "wishlist"]);
  });
});

describe("what the rest of the store shows of the account", () => {
  it("is behind the same switch on the product card, the product page and the checkout", () => {
    expect(read("../ProductCard.tsx")).toMatch(/\{SHOPPER_ACCOUNTS_ENABLED && <WishlistHeart /);
    const landing = read("../product/ProductLanding.tsx");
    expect(landing).toMatch(/\{SHOPPER_ACCOUNTS_ENABLED && \(\s*<div className="absolute end-0[^>]*>\s*<WishlistHeart /);
    // The title keeps today's classes while the switch is off.
    expect(landing).toContain('className={`zt-pdp-title${SHOPPER_ACCOUNTS_ENABLED ? " pe-14" : ""} text-2xl font-bold leading-tight text-ink sm:text-3xl`}');
    expect(read(`${ACCOUNT}../checkout/page.tsx`)).toMatch(/\{SHOPPER_ACCOUNTS_ENABLED && !pickingUp && <CheckoutSavedAddresses /);
  });

  it("keeps the token in one place: the session never writes storage for it itself", () => {
    const session = read("../../lib/shopperSession.ts");
    expect(session).toContain('from "./shopperToken"');
    expect(session).not.toContain("localStorage");
    // The store's setting is the only thing it keeps, and only for the tab.
    expect(session.match(/sessionStorage\.setItem/g) ?? []).toHaveLength(1);
  });

  it("signs in by a code only", () => {
    for (const file of readdirSync(path("./"))) {
      if (!/\.tsx?$/.test(file) || /\.test\./.test(file)) continue;
      expect(read(`./${file}`), file).not.toMatch(/google/i);
    }
  });
});
