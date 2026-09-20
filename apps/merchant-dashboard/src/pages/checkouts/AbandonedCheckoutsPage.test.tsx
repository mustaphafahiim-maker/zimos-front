import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import type { CheckoutSession } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AbandonedCheckoutsPage } from "./AbandonedCheckoutsPage";

const session = fake<CheckoutSession>({
  id: "cs_1",
  status: "abandoned",
  recoveryStatus: "not_contacted",
  customerName: "Mona Adel",
  phone: "01098765432",
  email: null,
  items: [
    {
      productId: "prd_1",
      variantId: "var_1",
      productName: "Linen shirt",
      options: null,
      offerName: null,
      quantity: 2,
      lineTotalAmount: 40000,
    },
    {
      productId: "prd_2",
      variantId: "var_2",
      productName: "Cotton scarf",
      options: null,
      offerName: null,
      quantity: 1,
      lineTotalAmount: 9000,
    },
  ],
  subtotalAmount: 49000,
  currency: "EGP",
  source: "store",
  lastActivityAt: "2026-09-14T08:00:00.000Z",
  contactedAt: null,
  createdAt: "2026-09-14T07:30:00.000Z",
  convertedOrder: null,
});

describe("AbandonedCheckoutsPage", () => {
  it("shows an empty state and asks the API for abandoned carts by default", async () => {
    api.listCheckoutSessions.mockResolvedValue({ sessions: [], nextCursor: null });

    renderWithProviders(<AbandonedCheckoutsPage />, { route: "/abandoned-checkouts" });

    expect(await screen.findByText("No abandoned checkouts")).toBeInTheDocument();
    expect(api.listCheckoutSessions).toHaveBeenCalledWith(
      "ws_1",
      expect.objectContaining({ view: "abandoned", limit: 50 })
    );
  });

  it("lists a cart and marks it lost through the API", async () => {
    api.listCheckoutSessions.mockResolvedValue({ sessions: [session], nextCursor: null });
    api.setCheckoutSessionRecovery.mockResolvedValue(fake({ ...session, recoveryStatus: "lost" }));

    const { user } = renderWithProviders(<AbandonedCheckoutsPage />, {
      route: "/abandoned-checkouts",
    });

    expect(await screen.findByText("Mona Adel")).toBeInTheDocument();
    expect(screen.getByText("2 × Linen shirt +1 more")).toBeInTheDocument();
    expect(screen.getByText("Left the checkout")).toBeInTheDocument();
    // Once as the follow-up badge, once as an option in the filter.
    expect(screen.getAllByText("Not contacted")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Lost" }));
    expect(api.setCheckoutSessionRecovery).toHaveBeenCalledWith("ws_1", "cs_1", "lost");
    expect(await screen.findByText("Marked as lost.")).toBeInTheDocument();
  });

  it("re-queries when the follow-up filter changes", async () => {
    api.listCheckoutSessions.mockResolvedValue({ sessions: [], nextCursor: null });

    const { user } = renderWithProviders(<AbandonedCheckoutsPage />, {
      route: "/abandoned-checkouts",
    });

    await screen.findByText("No abandoned checkouts");
    await user.selectOptions(
      screen.getByRole("combobox", { name: "Filter by follow-up status" }),
      "contacted"
    );
    expect(api.listCheckoutSessions).toHaveBeenLastCalledWith(
      "ws_1",
      expect.objectContaining({ view: "abandoned", recoveryStatus: "contacted" })
    );
  });

  it("opens WhatsApp with an editable draft and records the contact", async () => {
    api.listCheckoutSessions.mockResolvedValue({ sessions: [session], nextCursor: null });
    api.setCheckoutSessionRecovery.mockResolvedValue(
      fake({ ...session, recoveryStatus: "contacted" })
    );
    const open = vi.spyOn(window, "open").mockReturnValue(null);

    const { user } = renderWithProviders(<AbandonedCheckoutsPage />, {
      route: "/abandoned-checkouts",
    });

    await user.click(await screen.findByRole("button", { name: "Message Mona Adel on WhatsApp" }));
    const draft = (await screen.findByRole("textbox", {
      name: "Send a WhatsApp message",
    })) as HTMLTextAreaElement;
    // Written to the shopper, so it is Arabic whatever the dashboard language is.
    expect(draft.value).toContain("أهلاً Mona");

    await user.click(screen.getByRole("button", { name: "Open WhatsApp" }));
    // Local number, country code added, punctuation stripped.
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining("https://wa.me/201098765432?text="),
      "_blank",
      "noopener,noreferrer"
    );
    expect(api.setCheckoutSessionRecovery).toHaveBeenCalledWith("ws_1", "cs_1", "contacted");
    open.mockRestore();
  });
});
