import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { GiftCard, Workspace } from "@store-builder/api-client";
import { fake } from "@/test/mocks";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { GiftCardsPage } from "./GiftCardsPage";
import { GiftCardPaymentName, isGiftCardPayment } from "./GiftCardPaymentName";

const card: GiftCard = fake<GiftCard>({
  id: "gc_1",
  last4: "T6FK",
  initialAmount: "50000",
  balanceAmount: "20000",
  currency: "EGP",
  state: "active",
  status: "active",
  expiresAt: null,
  source: "manual",
  orderId: null,
  customerId: null,
  recipientName: "Laila",
  recipientEmail: "laila@example.com",
  message: null,
  note: null,
  createdAt: "2026-10-01T10:00:00.000Z",
});

const settings = { productIds: [], validityDays: null };
const store = { currentWorkspace: fake<Workspace>({ id: "ws_1", name: "Nile Store", slug: "nile", role: "owner", currency: "EGP" }) };

describe("GiftCardsPage", () => {
  it("lists the store's gift cards by their last four letters, never the code", async () => {
    const calls = fakeBackend({ "GET /gift-cards": { giftCards: [card], nextBefore: null }, "GET /gift-cards/settings": settings });
    renderWithProviders(<GiftCardsPage />, { workspace: store });
    expect((await screen.findAllByText(/T6FK/)).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/laila@example\.com|Laila/).length).toBeGreaterThan(0);
    expect(callsTo(calls, "GET", "/workspaces/ws_1/gift-cards").length).toBeGreaterThan(0);
  });

  it("says what gift cards are for when there are none", async () => {
    fakeBackend({ "GET /gift-cards": { giftCards: [], nextBefore: null }, "GET /gift-cards/settings": settings });
    renderWithProviders(<GiftCardsPage />, { workspace: store });
    expect(await screen.findByText("No gift cards yet")).toBeInTheDocument();
  });

  it("issues a card for a value in minor units and shows its code once", async () => {
    const calls = fakeBackend({
      "GET /gift-cards": { giftCards: [], nextBefore: null },
      "GET /gift-cards/settings": settings,
      "POST /gift-cards": { giftCard: { ...card, id: "gc_2", last4: "9XYZ" }, code: "9KVF-TKVD-7GWL-9XYZ" },
    });
    const { user } = renderWithProviders(<GiftCardsPage />, { workspace: store });
    await screen.findByText("No gift cards yet");
    await user.click(screen.getAllByRole("button", { name: "Issue gift card" })[0]);
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Value/), "250");
    await user.click(within(dialog).getByRole("button", { name: "Issue gift card" }));

    await waitFor(() => expect(callsTo(calls, "POST", "/workspaces/ws_1/gift-cards")).toHaveLength(1));
    expect(callsTo(calls, "POST", "/gift-cards")[0].body).toMatchObject({ amount: 25000, currency: "EGP" });
    expect(await screen.findByText("9KVF-TKVD-7GWL-9XYZ")).toBeInTheDocument();
    expect(screen.getByText("Save this code now — it won't be shown in full again")).toBeInTheDocument();
  });

  it("refuses a card with no value before anything is sent", async () => {
    const calls = fakeBackend({ "GET /gift-cards": { giftCards: [], nextBefore: null }, "GET /gift-cards/settings": settings });
    const { user } = renderWithProviders(<GiftCardsPage />, { workspace: store });
    await screen.findByText("No gift cards yet");
    await user.click(screen.getAllByRole("button", { name: "Issue gift card" })[0]);
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Issue gift card" }));
    expect(await within(dialog).findByText("Enter a value above zero.")).toBeInTheDocument();
    expect(callsTo(calls, "POST", "/gift-cards")).toHaveLength(0);
  });

  it("reads in formal Arabic", async () => {
    fakeBackend({ "GET /gift-cards": { giftCards: [], nextBefore: null }, "GET /gift-cards/settings": settings });
    renderWithProviders(<GiftCardsPage />, { workspace: store, locale: "ar" });
    expect(await screen.findByText("لا توجد بطاقات هدايا بعد")).toBeInTheDocument();
  });
});

describe("a gift card's part of an order", () => {
  it("is the payment the checkout records with the gift_card provider", () => {
    expect(isGiftCardPayment({ providerCode: "gift_card" })).toBe(true);
    expect(isGiftCardPayment({ providerCode: "fawaterak" })).toBe(false);
  });

  it("names the card by its last four letters and links to it", () => {
    renderWithProviders(<GiftCardPaymentName payment={{ providerReference: "gc_1:order_9", maskedDisplay: "Gift card •••• T6FK" }} />);
    const link = screen.getByRole("link", { name: /Gift card/ });
    expect(link).toHaveAttribute("href", "/gift-cards/gc_1");
    expect(link).toHaveTextContent("T6FK");
  });
});
