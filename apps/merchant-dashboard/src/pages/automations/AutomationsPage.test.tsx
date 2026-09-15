import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import type { AutomationRule, AutomationRun } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AutomationsPage } from "./AutomationsPage";

const TRIGGERS = ["order.created", "order.confirmed", "order.rejected", "order.cancelled", "order.shipped", "order.out_for_delivery", "order.delivered"];
const TOKENS = ["customer_name", "order_number", "order_total", "store_name", "tracking_url", "city"];

const rule = fake<AutomationRule>({
  id: "rule_1",
  name: "Shipped notice",
  trigger: "order.shipped",
  isActive: true,
  conditions: {},
  actions: [{ type: "whatsapp_template", template: "order_shipped", language: "ar", params: ["{{customer_name}}"] }],
  stats: { sent: 3, skipped: 0, failed: 1, lastRunAt: "2026-09-14T09:00:00.000Z" },
});

const run = fake<AutomationRun>({
  id: "run_1",
  ruleId: "rule_1",
  trigger: "order.shipped",
  status: "failed",
  detail: "Template not approved",
  createdAt: "2026-09-14T09:00:00.000Z",
  order: { id: "ord_1", orderNumber: "#1001" },
});

describe("AutomationsPage", () => {
  it("warns when WhatsApp isn't connected and lists rules and runs", async () => {
    api.getWhatsappIntegration.mockResolvedValue({ connected: false });
    api.listAutomations.mockResolvedValue({ rules: [rule], triggers: TRIGGERS as never, tokens: TOKENS });
    api.listAutomationRuns.mockResolvedValue({ runs: [run], nextCursor: null });

    renderWithProviders(<AutomationsPage />, { route: "/automations" });

    expect(await screen.findByRole("link", { name: "Connect WhatsApp" })).toHaveAttribute("href", "/settings?tab=integrations");
    expect((await screen.findAllByText("Shipped notice")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Template not approved")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "#1001" })).toHaveAttribute("href", "/orders/ord_1");
  });

  it("creates a rule with a token inserted into a template variable", async () => {
    api.getWhatsappIntegration.mockResolvedValue(fake({ connected: true, status: "connected" }));
    api.listAutomations.mockResolvedValue({ rules: [], triggers: TRIGGERS as never, tokens: TOKENS });
    api.listAutomationRuns.mockResolvedValue({ runs: [], nextCursor: null });
    api.createAutomation.mockResolvedValue(rule);

    const { user } = renderWithProviders(<AutomationsPage />, { route: "/automations" });

    expect(await screen.findByText("No automations yet")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Connect WhatsApp" })).not.toBeInTheDocument();
    await user.click(screen.getAllByRole("button", { name: /New automation/ })[0]);
    await user.type(await screen.findByLabelText(/^Name/), "Confirmed thanks");
    await user.type(screen.getByLabelText(/WhatsApp template name/), "order_confirmed");
    await user.click(screen.getByRole("textbox", { name: "Variable 1" }));
    await user.click(screen.getByRole("button", { name: "customer_name" }));
    expect(screen.getByRole("textbox", { name: "Variable 1" })).toHaveValue("{{customer_name}}");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(api.createAutomation).toHaveBeenCalledWith("ws_1", {
      name: "Confirmed thanks",
      trigger: "order.confirmed",
      isActive: true,
      conditions: { paymentMethod: null, minTotalAmount: null },
      actions: [{ type: "whatsapp_template", template: "order_confirmed", language: "ar", params: ["{{customer_name}}"] }],
    });
  });
});
