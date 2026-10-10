import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ApiClient, StorefrontPaymentMethod } from "@store-builder/api-client";
import { StoreContextProvider, type StoreInfo } from "@/lib/StoreContext";
import { GiftCardField, useGiftCard, type GiftCardState } from "./GiftCardField";

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

const COD = { id: "cod", method: "cod", provider: "cod" } as unknown as StorefrontPaymentMethod;
const CARD = { id: "card", method: "card", provider: "fawaterak" } as unknown as StorefrontPaymentMethod;
const CODE = "9KVF-TKVD-7GWL-T6FK";

/** A store client whose POST /gift-cards/check answers with a card of the given balance (minor units). */
function clientWith(balanceAmount: string) {
  const request = vi.fn(async () => ({ giftCard: { last4: "T6FK", balanceAmount, currency: "EGP", state: "active", expiresAt: null } }));
  return { client: { request } as unknown as ApiClient, request };
}

let latest: GiftCardState;
function Harness({ client, method, total }: { client: ApiClient; method: StorefrontPaymentMethod | undefined; total: number }) {
  const state = useGiftCard({ client, workspaceId: "ws1", method, total, currency: "EGP" });
  latest = state;
  return <GiftCardField state={state} />;
}

function show(client: ApiClient, method: StorefrontPaymentMethod | undefined, total = 50000) {
  return render(
    <StoreContextProvider locale="en" store={STORE}>
      <Harness client={client} method={method} total={total} />
    </StoreContextProvider>
  );
}

async function apply(code = CODE) {
  fireEvent.click(screen.getByText("Have a gift card?"));
  fireEvent.change(screen.getByLabelText("Gift card code"), { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: "Apply" }));
}

afterEach(cleanup);

describe("a gift card at checkout", () => {
  it("takes its balance off a cash-on-delivery order and sends its code with the order", async () => {
    const { client, request } = clientWith("20000");
    show(client, COD);
    await apply();
    await waitFor(() => expect(latest.card).not.toBeNull());
    expect(request).toHaveBeenCalledWith("/store/ws1/gift-cards/check", { method: "POST", body: { code: "9KVFTKVD7GWLT6FK" }, auth: false });
    expect(latest.off).toBe(20000);
    expect(latest.payload).toEqual({ giftCardCode: "9KVFTKVD7GWLT6FK" });
  });

  it("never takes more than the order is worth", async () => {
    const { client } = clientWith("90000");
    show(client, COD, 50000);
    await apply();
    await waitFor(() => expect(latest.card).not.toBeNull());
    expect(latest.off).toBe(50000);
  });

  it("does not go with an online payment: nothing comes off and no code is sent", async () => {
    const { client } = clientWith("20000");
    show(client, CARD);
    await apply();
    await waitFor(() => expect(latest.card).not.toBeNull());
    expect(latest.usable).toBe(false);
    expect(latest.off).toBe(0);
    expect(latest.payload).toEqual({});
  });

  it("is inert with no way to pay (the feature switched off, or a bank transfer chosen)", async () => {
    const { client } = clientWith("20000");
    show(client, undefined);
    expect(latest.usable).toBe(false);
    expect(latest.payload).toEqual({});
    expect(latest.off).toBe(0);
  });

  it("asks for a whole code before it checks anything", async () => {
    const { client, request } = clientWith("20000");
    show(client, COD);
    await apply("ABCD");
    expect(await screen.findByText("This gift card code is not valid.")).toBeTruthy();
    expect(request).not.toHaveBeenCalled();
    expect(latest.payload).toEqual({});
  });
});
