import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type { GiftOptionsSettings } from "@store-builder/api-client";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { GiftOptionsTab } from "./GiftOptionsTab";
import { OrderGiftCard } from "../orders/components/OrderGiftCard";
import { PreorderLineNote } from "../orders/components/PreorderLineNote";

const off: GiftOptionsSettings = { enabled: false, wrapVariantId: null, messageMaxLength: 300 };

describe("GiftOptionsTab", () => {
  it("shows gift options off, as the store has them", async () => {
    const calls = fakeBackend({ "GET /gift-options": off });
    renderWithProviders(<GiftOptionsTab />);
    expect(await screen.findByRole("switch", { name: /Offer gift options at checkout/ })).toHaveAttribute("aria-checked", "false");
    expect(callsTo(calls, "GET", "/workspaces/ws_1/gift-options")).toHaveLength(1);
    expect(callsTo(calls, "PUT", "/gift-options")).toHaveLength(0);
  });

  it("turns them on and saves, message only", async () => {
    const calls = fakeBackend({ "GET /gift-options": off, "PUT /gift-options": { ...off, enabled: true } });
    const { user } = renderWithProviders(<GiftOptionsTab />);
    await user.click(await screen.findByRole("switch", { name: /Offer gift options at checkout/ }));
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(callsTo(calls, "PUT", "/workspaces/ws_1/gift-options")).toHaveLength(1));
    expect(callsTo(calls, "PUT", "/gift-options")[0].body).toEqual({ enabled: true, wrapVariantId: null, messageMaxLength: 300 });
    expect(await screen.findByText("Saved.")).toBeInTheDocument();
  });

  it("reads in formal Arabic", async () => {
    fakeBackend({ "GET /gift-options": off });
    renderWithProviders(<GiftOptionsTab />, { locale: "ar" });
    expect(await screen.findByRole("switch", { name: /عرض خيارات الهدايا في صفحة الدفع/ })).toBeInTheDocument();
  });
});

describe("OrderGiftCard", () => {
  it("tells whoever packs that the order is a gift, with its message", () => {
    renderWithProviders(<OrderGiftCard order={{ giftOptions: { wrapped: true, message: "Happy birthday, Laila!", hidePrices: true } }} />);
    expect(screen.getByRole("heading", { name: "This order is a gift" })).toBeInTheDocument();
    expect(screen.getByText("Happy birthday, Laila!")).toBeInTheDocument();
    expect(screen.getByText("Gift-wrap it before it ships — the wrap is a line in the items.")).toBeInTheDocument();
    expect(screen.getByText("Hide prices: no invoice or price tag in the parcel.")).toBeInTheDocument();
  });

  it("shows nothing for an order that is not a gift", () => {
    const { container } = renderWithProviders(<OrderGiftCard order={{ giftOptions: null }} />);
    expect(container.querySelector("section")).toBeNull();
    expect(screen.queryByText("This order is a gift")).not.toBeInTheDocument();
  });
});

describe("PreorderLineNote", () => {
  it("says when a pre-ordered line ships", () => {
    renderWithProviders(<PreorderLineNote item={{ preorderShipsAt: "2026-11-15" }} />);
    expect(screen.getByText(/Pre-order — ships by/)).toBeInTheDocument();
  });

  it("shows nothing on an ordinary line", () => {
    renderWithProviders(<PreorderLineNote item={{ preorderShipsAt: null }} />);
    expect(screen.queryByText(/Pre-order/)).not.toBeInTheDocument();
  });
});
