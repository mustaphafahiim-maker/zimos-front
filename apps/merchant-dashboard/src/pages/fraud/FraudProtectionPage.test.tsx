import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import type { BlocklistEntry, FlaggedOrder, Workspace } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { FraudProtectionPage } from "./FraudProtectionPage";

const workspace = fake<Workspace>({
  id: "ws_1",
  name: "Nile Store",
  slug: "nile-store",
  settings: {
    fraud_rules: {
      action: "flag",
      block_blacklisted: false,
      duplicate_window_minutes: 30,
      max_orders_per_phone_per_day: null,
      high_rejection_threshold: null,
    },
  },
});

const flagged = fake<FlaggedOrder>({
  id: "ord_1",
  orderNumber: "#1001",
  createdAt: "2026-09-14T08:00:00.000Z",
  riskFlags: ["duplicate_order", "phone_daily_limit"],
  customerName: "Mona Adel",
  phone: "01098765432",
  totalAmount: 25000,
  currency: "EGP",
  confirmationState: "pending",
  cancelled: false,
});

const blocked = fake<BlocklistEntry>({
  customerId: "cus_1",
  fullName: "Sayed Farid",
  phone: "01111111111",
  reason: "Refused three deliveries",
  totalOrders: 4,
  totalRejectedOrders: 3,
  blockedAt: "2026-09-10T10:00:00.000Z",
});

const withWorkspace = { currentWorkspace: workspace, workspaces: [workspace] };

describe("FraudProtectionPage", () => {
  it("seeds the rules from the workspace and saves the whole blob", async () => {
    api.updateWorkspaceSettings.mockResolvedValue(workspace);

    const { user } = renderWithProviders(<FraudProtectionPage />, {
      route: "/fraud",
      workspace: withWorkspace,
    });

    // The one stored rule is on with its value; the other two are off.
    const duplicate = await screen.findByRole("spinbutton", { name: "Value for Duplicate orders" });
    expect(duplicate).toHaveValue(30);
    expect(
      screen.getByRole("spinbutton", { name: "Value for Too many orders from one phone" })
    ).toBeDisabled();
    // Nothing changed yet, so there is nothing to save.
    expect(screen.getByRole("button", { name: "Save rules" })).toBeDisabled();

    await user.click(screen.getByRole("checkbox", { name: "Turn on: Too many orders from one phone" }));
    await user.click(screen.getByRole("radio", { name: /Block the order/ }));
    await user.click(screen.getByRole("button", { name: "Save rules" }));

    expect(api.updateWorkspaceSettings).toHaveBeenCalledWith("ws_1", {
      fraud_rules: {
        action: "block",
        block_blacklisted: false,
        duplicate_window_minutes: 30,
        max_orders_per_phone_per_day: 3,
        high_rejection_threshold: null,
      },
    });
    expect(await screen.findByText("Fraud rules saved.")).toBeInTheDocument();
  });

  it("refuses a number outside the range the backend accepts", async () => {
    const { user } = renderWithProviders(<FraudProtectionPage />, {
      route: "/fraud",
      workspace: withWorkspace,
    });

    const duplicate = await screen.findByRole("spinbutton", { name: "Value for Duplicate orders" });
    await user.clear(duplicate);
    await user.type(duplicate, "99999");
    await user.click(screen.getByRole("button", { name: "Save rules" }));

    expect(
      screen.getByText("Duplicate orders: enter a whole number between 1 and 10080.")
    ).toBeInTheDocument();
    expect(api.updateWorkspaceSettings).not.toHaveBeenCalled();
  });

  it("approves a flagged order and drops it out of the open list", async () => {
    api.listFlaggedOrders.mockResolvedValue({ orders: [flagged], nextCursor: null });
    api.approveFlaggedOrder.mockResolvedValue({ id: "ord_1", riskFlags: [] });

    const { user } = renderWithProviders(<FraudProtectionPage />, {
      route: "/fraud",
      workspace: withWorkspace,
    });

    await user.click(screen.getByRole("button", { name: "Flagged orders" }));
    expect(await screen.findByText("Duplicate order")).toBeInTheDocument();
    expect(screen.getByText("Over the daily phone limit")).toBeInTheDocument();
    expect(api.listFlaggedOrders).toHaveBeenCalledWith(
      "ws_1",
      expect.objectContaining({ includeResolved: false })
    );

    await user.click(screen.getByRole("button", { name: /Approve/ }));
    expect(api.approveFlaggedOrder).toHaveBeenCalledWith("ws_1", "ord_1");
    expect(await screen.findByText("No flagged orders")).toBeInTheDocument();
  });

  it("blocks a number, rejecting a reason that is too short first", async () => {
    api.listBlocklist.mockResolvedValue([blocked]);
    api.addToBlocklist.mockResolvedValue({ customerId: "cus_2", phone: "01222222222", reason: "Fake orders" });

    const { user } = renderWithProviders(<FraudProtectionPage />, {
      route: "/fraud",
      workspace: withWorkspace,
    });

    await user.click(screen.getByRole("button", { name: "Blocklist" }));
    expect(await screen.findByText("Refused three deliveries")).toBeInTheDocument();

    await user.type(screen.getByRole("textbox", { name: /^Phone/ }), "01222222222");
    await user.click(screen.getByRole("button", { name: "Block this number" }));
    expect(screen.getByText("The reason has to be 2 to 300 characters.")).toBeInTheDocument();
    expect(api.addToBlocklist).not.toHaveBeenCalled();

    await user.type(screen.getByRole("textbox", { name: /^Reason/ }), "Fake orders");
    await user.click(screen.getByRole("button", { name: "Block this number" }));
    expect(api.addToBlocklist).toHaveBeenCalledWith("ws_1", {
      phone: "01222222222",
      reason: "Fake orders",
    });
    expect(await screen.findByText("Number added to the blocklist.")).toBeInTheDocument();
  });
});
