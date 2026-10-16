import { describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { OrderEmailsSection } from "./OrderEmailsSection";

// The switch is a build constant; the tests turn it on and off.
const flags = vi.hoisted(() => ({ design: false }));
vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  get ORDER_EMAIL_DESIGN_ENABLED() {
    return flags.design;
  },
}));

const RECEIVED = {
  key: "order_confirmation",
  event: "order.created",
  isEnabled: true,
  subject: "We got your order {{order_number}}",
  body: "Thank you, {{customer_name}}.",
  isCustomised: false,
  defaults: { subject: "We got your order {{order_number}}", body: "Thank you, {{customer_name}}." },
  updatedAt: null,
};

function serve(template: Record<string, unknown> = RECEIVED) {
  return fakeBackend({
    "GET /order-emails": { templates: [template], tokens: ["order_number", "customer_name"] },
    "POST /order-emails/order_confirmation/preview": { subject: "We got your order #1042", html: "<p>Thank you</p>", text: "Thank you" },
    "PUT /order-emails/order_confirmation": (call: { body?: unknown }) => ({ template: { ...template, ...(call.body as object), isCustomised: true } }),
  });
}

async function openEditor(user: ReturnType<typeof renderWithProviders>["user"]) {
  await screen.findByText("Order received");
  await user.click(screen.getByRole("button", { name: /Edit/ }));
  return screen.findByRole("dialog");
}

describe("editing an order email", () => {
  it("opens the plain editor, with no designer, while the block designer is off", async () => {
    flags.design = false;
    serve();
    const { user } = renderWithProviders(<OrderEmailsSection />);
    const dialog = await openEditor(user);
    expect(within(dialog).queryByRole("button", { name: "Designer" })).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Add block")).not.toBeInTheDocument();
  });

  it("offers plain text or the designer while it is on, starting on plain text for an email with no blocks", async () => {
    flags.design = true;
    serve();
    const { user } = renderWithProviders(<OrderEmailsSection />);
    const dialog = await openEditor(user);
    expect(within(dialog).getByRole("button", { name: "Simple text" })).toHaveAttribute("aria-pressed", "true");
    expect(within(dialog).getByRole("button", { name: "Designer" })).toHaveAttribute("aria-pressed", "false");
  });

  it("saves plain text with no blocks, so the design is not kept behind it", async () => {
    flags.design = true;
    const calls = serve();
    const { user } = renderWithProviders(<OrderEmailsSection />);
    const dialog = await openEditor(user);
    const subject = within(dialog).getByLabelText(/Subject/);
    await user.clear(subject);
    await user.type(subject, "Order received");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(callsTo(calls, "PUT", "/order-emails/order_confirmation")).toHaveLength(1));
    expect(callsTo(calls, "PUT", "/order-emails/order_confirmation")[0].body).toMatchObject({ subject: "Order received", blocks: null });
  });

  it("opens on the designer for an email that was built from blocks", async () => {
    flags.design = true;
    serve({ ...RECEIVED, blocks: [{ type: "heading", text: "Thank you!", size: "large", align: "center" }] });
    const { user } = renderWithProviders(<OrderEmailsSection />);
    const dialog = await openEditor(user);
    expect(within(dialog).getByRole("button", { name: "Designer" })).toHaveAttribute("aria-pressed", "true");
    expect(within(dialog).getAllByText(/Thank you!/).length).toBeGreaterThan(0);
  });
});
