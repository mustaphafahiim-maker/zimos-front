import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ApiClient } from "@store-builder/api-client";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import { GiftOptionsField, GiftWrapRow, useGiftChoice, type GiftChoice } from "./GiftOptionsField";

// The switch is a build constant; the tests turn it on and off.
const flags = vi.hoisted(() => ({ gift: false }));
vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  get GIFT_OPTIONS_ENABLED() {
    return flags.gift;
  },
}));

const STORE = {
  workspaceId: "ws1",
  id: "ws1",
  slug: "shop",
  name: "Shop",
  currency: "EGP",
  logoUrl: null,
  phone: null,
  checkout: { email: "optional", postal_code: "hidden", notes: "optional" },
  orderBump: null,
} as unknown as StoreInfo;

const OFFER = {
  messageMaxLength: 300,
  wrap: { variantId: "var_wrap", name: "Gift wrap", priceAmount: "2500", currency: "EGP", imageUrl: null },
};

/** A store client that answers GET /store/:ws with the given gift block. */
function clientWith(giftOptions: unknown) {
  const getStorefrontMeta = vi.fn(async () => ({ id: "ws1", giftOptions }));
  return { client: { getStorefrontMeta } as unknown as ApiClient, getStorefrontMeta };
}

let latest: GiftChoice;
function Harness({ client }: { client: ApiClient }) {
  const gift = useGiftChoice({ client, workspaceId: "ws1" });
  latest = gift;
  return (
    <>
      <GiftOptionsField state={gift} />
      <dl>
        <GiftWrapRow state={gift} currency="EGP" />
      </dl>
    </>
  );
}

function show(client: ApiClient) {
  return render(
    <StoreContextProvider locale="en" store={STORE}>
      <Harness client={client} />
    </StoreContextProvider>
  );
}

afterEach(cleanup);

describe("the gift choice at checkout", () => {
  it("asks the store nothing, shows nothing and sends nothing while the feature is off", async () => {
    flags.gift = false;
    const { client, getStorefrontMeta } = clientWith(OFFER);
    show(client);
    await Promise.resolve();
    expect(getStorefrontMeta).not.toHaveBeenCalled();
    expect(screen.queryByText("Is this a gift?")).toBeNull();
    expect(latest.payload).toEqual({});
    expect(latest.wrapAmount).toBe(0);
    expect(latest.quoteLine).toBeNull();
  });

  it("shows nothing when the store does not offer gift options", async () => {
    flags.gift = true;
    const { client, getStorefrontMeta } = clientWith(null);
    show(client);
    await waitFor(() => expect(getStorefrontMeta).toHaveBeenCalledWith("ws1"));
    expect(screen.queryByText("Is this a gift?")).toBeNull();
    expect(latest.payload).toEqual({});
  });

  it("sends the wrap, the message and hidden prices once the shopper says it is a gift", async () => {
    flags.gift = true;
    const { client } = clientWith(OFFER);
    show(client);
    await screen.findByText("Is this a gift?");
    fireEvent.click(document.getElementById("checkout-gift")!);
    // Nothing chosen yet but hidden prices, which start ticked.
    expect(latest.payload).toEqual({ gift: { hidePrices: true } });

    fireEvent.click(screen.getByLabelText(/Gift-wrap it/));
    fireEvent.change(screen.getByLabelText("Gift message"), { target: { value: "  Happy birthday!  " } });

    expect(latest.payload).toEqual({ gift: { wrap: true, message: "Happy birthday!", hidePrices: true } });
    expect(latest.wrapAmount).toBe(2500);
    expect(latest.quoteLine).toEqual({ variantId: "var_wrap", offerId: null, quantity: 1 });
    // The wrap is a row of the summary while it is chosen.
    expect(screen.getByText("Gift wrap")).toBeTruthy();
  });

  it("sends nothing when the shopper unticks the gift again", async () => {
    flags.gift = true;
    const { client } = clientWith(OFFER);
    show(client);
    await screen.findByText("Is this a gift?");
    const toggle = document.getElementById("checkout-gift")!;
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(latest.payload).toEqual({});
    expect(latest.wrapAmount).toBe(0);
  });
});
