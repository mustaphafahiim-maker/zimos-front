import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import type { WhatsappConversation, WhatsappMessage } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { currentPath, renderWithProviders } from "@/test/renderWithProviders";
import { InboxPage } from "./InboxPage";

const conversation = fake<WhatsappConversation>({
  id: "conv_1",
  phone: "201098765432",
  customerName: "Mona Adel",
  customerId: "cus_1",
  status: "open",
  unreadCount: 2,
  lastMessageAt: "2026-09-14T08:00:00.000Z",
  lastMessagePreview: "Is my order on the way?",
  canReply: false,
});

const message = fake<WhatsappMessage>({
  id: "msg_1",
  direction: "in",
  type: "text",
  body: "Is my order on the way?",
  templateName: null,
  status: "received",
  error: null,
  createdAt: "2026-09-14T08:00:00.000Z",
});

describe("InboxPage", () => {
  it("sends the merchant to the WhatsApp settings card when WhatsApp isn't connected", async () => {
    api.getWhatsappIntegration.mockResolvedValue({ connected: false });

    const { user } = renderWithProviders(<InboxPage />, { route: "/inbox" });

    expect(await screen.findByText("WhatsApp isn't connected yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Connect WhatsApp" }));
    expect(currentPath()).toBe("/settings");
    // Nothing is fetched until the integration exists.
    expect(api.listWhatsappConversations).not.toHaveBeenCalled();
  });

  it("lists conversations and opens a thread with the closed-window notice", async () => {
    api.getWhatsappIntegration.mockResolvedValue(
      fake({ connected: true, status: "connected", phoneNumberId: "123", webhook: { url: "", verifyToken: "" } })
    );
    api.listWhatsappConversations.mockResolvedValue({ conversations: [conversation], nextCursor: null });
    api.listWhatsappMessages.mockResolvedValue({ messages: [message], nextCursor: null });

    const { user } = renderWithProviders(<InboxPage />, { route: "/inbox" });

    await user.click(await screen.findByRole("button", { name: /Mona Adel/ }));
    expect(api.listWhatsappConversations).toHaveBeenCalledWith(
      "ws_1",
      expect.objectContaining({ status: "open" })
    );
    expect(await screen.findByRole("heading", { name: "Mona Adel" })).toBeInTheDocument();
    expect(api.listWhatsappMessages).toHaveBeenCalledWith("ws_1", "conv_1", expect.anything());
    expect(screen.getAllByText("Is my order on the way?").length).toBeGreaterThan(1);
    expect(screen.getByText(/24-hour window is closed/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Customer profile" })).toHaveAttribute(
      "href",
      "/customers/cus_1"
    );
  });
});
