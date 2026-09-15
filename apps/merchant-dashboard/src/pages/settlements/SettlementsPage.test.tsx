import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import type { SettlementDetail, SettlementSummary, UnsettledOrder } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SettlementsPage } from "./SettlementsPage";

const summary = fake<SettlementSummary>({ unsettledOrders: 1, dueFromCouriers: 25000, received: 0, courierFees: 0, draftSettlements: 0 });

const order = fake<UnsettledOrder>({
  orderId: "ord_1",
  orderNumber: "#1001",
  customerName: "Mona Adel",
  carrierCode: "bosta",
  shipmentId: "shp_1",
  waybillNumber: "WB123",
  deliveredAt: "2026-09-10T10:00:00.000Z",
  currency: "EGP",
  totalAmount: 25000,
  amountPaid: 0,
  dueAmount: 25000,
});

const draft = fake<SettlementDetail>({
  id: "set_1",
  carrierCode: "bosta",
  reference: null,
  periodStart: null,
  periodEnd: null,
  status: "draft",
  collectedAmount: 25000,
  feesAmount: 3500,
  netAmount: 21500,
  notes: null,
  confirmedAt: null,
  createdAt: "2026-09-14T10:00:00.000Z",
  lines: [{ orderId: "ord_1", orderNumber: "#1001", customerName: "Mona Adel", orderTotal: 25000, financialState: "pending", collectedAmount: 25000, feeAmount: 3500 }],
});

describe("SettlementsPage", () => {
  it("shows empty states when nothing is due and nothing was settled", async () => {
    api.getSettlementSummary.mockResolvedValue(fake({ unsettledOrders: 0, dueFromCouriers: 0, received: 0, courierFees: 0, draftSettlements: 0 }));
    api.listUnsettledOrders.mockResolvedValue({ orders: [], carriers: [] });
    api.listSettlements.mockResolvedValue({ settlements: [], nextCursor: null });

    renderWithProviders(<SettlementsPage />, { route: "/settlements" });

    expect(await screen.findByText("No unsettled COD orders")).toBeInTheDocument();
    expect(screen.getByText("No settlements yet")).toBeInTheDocument();
    expect(screen.getByText("Unsettled orders")).toBeInTheDocument();
  });

  it("creates a draft from selected orders with the fee quick-fill, then confirms it", async () => {
    api.getSettlementSummary.mockResolvedValue(summary);
    api.listUnsettledOrders.mockResolvedValue({ orders: [order], carriers: [{ carrierCode: "bosta", orders: 1, dueAmount: 25000 }] });
    api.listSettlements.mockResolvedValue({ settlements: [], nextCursor: null });
    api.createSettlement.mockResolvedValue(draft);
    api.getSettlement.mockResolvedValue(draft);
    api.confirmSettlement.mockResolvedValue(fake({ ...draft, status: "confirmed" }));

    const { user } = renderWithProviders(<SettlementsPage />, { route: "/settlements" });

    await user.click(await screen.findByRole("checkbox", { name: "Select order #1001" }));
    await user.type(screen.getByRole("textbox", { name: "Fee per order (bosta)" }), "35");
    await user.click(screen.getByRole("button", { name: "Apply to selected" }));
    expect(screen.getByRole("textbox", { name: "Courier fee #1001" })).toHaveValue("35");
    await user.click(screen.getByRole("button", { name: "Create draft settlement" }));

    expect(api.createSettlement).toHaveBeenCalledWith("ws_1", {
      carrierCode: "bosta",
      lines: [{ orderId: "ord_1", collectedAmount: 25000, feeAmount: 3500 }],
    });

    const dialog = await screen.findByRole("dialog");
    await user.click(await within(dialog).findByRole("button", { name: "Confirm settlement" }));
    expect(await screen.findByText(/marks them paid/)).toBeInTheDocument();
    const confirmButtons = screen.getAllByRole("button", { name: "Confirm settlement" });
    await user.click(confirmButtons[confirmButtons.length - 1]);
    expect(api.confirmSettlement).toHaveBeenCalledWith("ws_1", "set_1");
  });
});
