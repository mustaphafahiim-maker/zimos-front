import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import type { Order, OrderTimelineEvent } from "@store-builder/api-client";
import { fake } from "@/test/mocks";
import { fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { OrderTimelineSection } from "./OrderTimelineSection";

// The switch is a build constant; the tests turn it on and off.
const flags = vi.hoisted(() => ({ messages: false }));
vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  get ORDER_MESSAGES_ENABLED() {
    return flags.messages;
  },
}));

const order = fake<Order>({ id: "order_1", updatedAt: "2026-10-09T10:00:00.000Z" });
const system = { type: "system", name: null } as OrderTimelineEvent["actor"];

const note: OrderTimelineEvent = {
  id: "ev_note",
  type: "note",
  at: "2026-10-09T09:00:00.000Z",
  actor: { type: "user", name: "Amr Hassan" } as OrderTimelineEvent["actor"],
  data: { body: "Called the customer.", visibility: "internal" },
};
const email: OrderTimelineEvent = {
  id: "ev_email",
  type: "message",
  at: "2026-10-09T09:05:00.000Z",
  actor: system,
  data: { channel: "email", template: "order_received", subject: "We got your order #1042", status: "sent", error: null, deliveryStatus: "delivered", statusAt: null, statusReason: null },
};
const sms: OrderTimelineEvent = {
  id: "ev_sms",
  type: "message",
  at: "2026-10-09T09:06:00.000Z",
  actor: system,
  data: { channel: "sms", template: null, subject: null, status: "failed", error: "Invalid number", deliveryStatus: null, statusAt: null, statusReason: null },
};
const bounced: OrderTimelineEvent = {
  id: "ev_bounce",
  type: "message_status",
  at: "2026-10-09T09:07:00.000Z",
  actor: system,
  data: { channel: "email", status: "bounced", reason: "Mailbox does not exist", subject: "Your order shipped" },
};

function show(events: OrderTimelineEvent[], locale: "en" | "ar" = "en") {
  fakeBackend({ "GET /timeline": { events } });
  return renderWithProviders(<OrderTimelineSection order={order} refreshKey="1" />, { locale });
}

describe("the customer's messages on an order's timeline", () => {
  it("leaves them out while the feature is off, and keeps everything else", async () => {
    flags.messages = false;
    show([note, email, sms, bounced]);
    expect(await screen.findByText("Called the customer.")).toBeInTheDocument();
    expect(screen.queryByText("Email to the customer")).not.toBeInTheDocument();
    expect(screen.queryByText("SMS to the customer")).not.toBeInTheDocument();
    expect(screen.queryByText("We got your order #1042")).not.toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(1);
  });

  it("shows each message with its subject and whether it arrived", async () => {
    flags.messages = true;
    show([note, email, sms, bounced]);
    expect(await screen.findByText("Email to the customer")).toBeInTheDocument();
    expect(screen.getByText("We got your order #1042")).toBeInTheDocument();
    // What the provider reported wins over "sent".
    expect(screen.getByText("Delivered")).toBeInTheDocument();
    expect(screen.getByText("SMS to the customer")).toBeInTheDocument();
    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.getByText("Invalid number")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(4);
  });

  it("says in words when an email bounced, with the provider's reason", async () => {
    flags.messages = true;
    show([bounced]);
    expect(await screen.findByText("Email bounced — the address doesn't work")).toBeInTheDocument();
    expect(screen.getByText("Your order shipped")).toBeInTheDocument();
    expect(screen.getByText(/Mailbox does not exist/)).toBeInTheDocument();
  });

  it("reads in formal Arabic", async () => {
    flags.messages = true;
    show([email, bounced], "ar");
    expect(await screen.findByText("بريد إلكتروني إلى العميل")).toBeInTheDocument();
    expect(screen.getByText("وصلت")).toBeInTheDocument();
    expect(screen.getByText("ارتدّ بريد الطلب — العنوان غير صالح")).toBeInTheDocument();
  });
});
