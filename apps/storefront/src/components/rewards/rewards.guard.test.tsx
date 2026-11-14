import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import type { StorefrontPaymentMethod } from "@store-builder/api-client";
import type { GiftCardState } from "@/components/giftCards/GiftCardField";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";

// No switch is mocked here: this is the store as it ships, every reward off.
vi.mock("next/navigation", () => ({ usePathname: () => "/account", useRouter: () => ({ push: vi.fn() }) }));
const request = vi.hoisted(() => vi.fn());
vi.mock("@/lib/apiClient", () => ({ createStorefrontApiClient: () => ({ request }) }));

import { AccountWalletTabs } from "@/components/account/AccountWalletTabs";
import { CheckoutTenders, useCheckoutTenders, type CheckoutTendersState } from "@/components/tenders/CheckoutTenders";
import { EarnPointsNote } from "@/components/tenders/EarnPointsNote";
import { AccountRewardsTabs } from "./AccountRewardsTabs";
import { CheckoutPerks, useCheckoutPerks, type CheckoutPerksState } from "./CheckoutPerks";
import { writeInvite } from "./invite";

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");
const STORE = { workspaceId: "ws1", id: "ws1", slug: "shop", name: "Shop", currency: "EGP", logoUrl: null, phone: null, checkout: {}, orderBump: null } as unknown as StoreInfo;
const COD = { id: "cod", method: "cod", provider: "cod" } as unknown as StorefrontPaymentMethod;
const TOKEN = "ws.c1.1.1999999999.c2lnbmF0dXJl";

let tenders: CheckoutTendersState;
let perks: CheckoutPerksState;
function Everything() {
  tenders = useCheckoutTenders({ method: COD, total: 50000, currency: "EGP", giftCard: { off: 0 } as unknown as GiftCardState });
  perks = useCheckoutPerks();
  return (
    <ul>
      <CheckoutTenders state={tenders} />
      <CheckoutPerks state={perks} />
      <EarnPointsNote unitMinor={25000} />
      <AccountWalletTabs pathname="/account/points" />
      <AccountRewardsTabs pathname="/account/vip" />
    </ul>
  );
}

beforeEach(() => {
  request.mockReset();
  window.localStorage.clear();
  window.sessionStorage.clear();
});
afterEach(cleanup);

describe("rewards while every switch is off", () => {
  it("ask the API nothing and draw nothing, even for a signed-in shopper with an invite kept", async () => {
    window.localStorage.setItem("zimos:shopper:ws1", JSON.stringify({ token: TOKEN, expiresAt: Date.now() + 60_000 }));
    writeInvite("ws1", { code: "MONA77", friend: { percentOff: 10, freeShipping: false } });
    const { container } = render(
      <StoreContextProvider locale="en" store={STORE}>
        <Everything />
      </StoreContextProvider>
    );
    await new Promise((r) => setTimeout(r, 30));
    expect(request).not.toHaveBeenCalled();
    expect(container.querySelector("ul")?.children).toHaveLength(0);
    expect(tenders.payload).toEqual({});
    expect(tenders.shopperToken).toBeNull();
    expect(perks.payload).toEqual({});
    expect(perks.shopperToken).toBeNull();
  });
});

describe("where the rewards are mounted", () => {
  const ACCOUNT = "../../app/store/[workspaceId]/account/";

  it("gives each account page its own switch", () => {
    for (const [page, flag] of [
      ["points", "LOYALTY_ENABLED"],
      ["credit", "STORE_CREDIT_ENABLED"],
      ["vip", "VIP_TIERS_ENABLED"],
      ["invite", "CUSTOMER_REFERRALS_ENABLED"],
    ]) {
      const source = read(`${ACCOUNT}${page}/page.tsx`);
      expect(source, page).toContain(`import { ${flag} } from "@/lib/features";`);
      expect(source, page).toContain(`if (!${flag}) notFound();`);
    }
  });

  it("puts the checkout's parts, the banner and the earning note behind their switches", () => {
    const checkout = read(`${ACCOUNT}../checkout/page.tsx`);
    expect(checkout).toContain("const TENDERS_ON = SHOPPER_ACCOUNTS_ENABLED && (LOYALTY_ENABLED || STORE_CREDIT_ENABLED);");
    expect(checkout).toContain("const PERKS_ON = VIP_TIERS_ENABLED || CUSTOMER_REFERRALS_ENABLED;");
    expect(checkout).toContain("{TENDERS_ON && <CheckoutTenders state={tenders} />}");
    expect(checkout).toContain("{PERKS_ON && <CheckoutPerks state={perks} />}");
    // No shopper token rides on an order unless one of these is on.
    expect(checkout).toContain("const shopperToken = TENDERS_ON || PERKS_ON ? (tenders.shopperToken ?? perks.shopperToken ?? undefined) : undefined;");
    expect(read(`${ACCOUNT}../layout.tsx`)).toMatch(/\{CUSTOMER_REFERRALS_ENABLED && \(\s*<HideInFunnel>\s*<InviteBanner \/>/);
    expect(read("../product/ProductLanding.tsx")).toContain("{LOYALTY_ENABLED && <EarnPointsNote unitMinor={unit} />}");
  });

  it("writes no raw HTML or script for the invite banner", () => {
    expect(read("./InviteBanner.tsx")).not.toContain("dangerouslySetInnerHTML");
  });
});
