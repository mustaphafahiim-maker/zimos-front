import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { ApiError, type Order } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { OrdersListPage } from "./OrdersListPage";

function order(id: string, orderNumber: string, fullName: string): Order {
  return fake<Order>({
    id,
    orderNumber,
    contactSnapshot: { fullName, phone: "01012345678" },
    totalAmount: "30000",
    currency: "EGP",
    confirmationState: "pending",
    financialState: "pending",
    fulfillmentState: "unfulfilled",
    createdAt: "2026-09-01T10:00:00.000Z",
  });
}

const orders = [order("ord_1", "#1001", "Sara Ali"), order("ord_2", "#1002", "Omar Nabil"), order("ord_3", "#1003", "Hana Samir")];

describe("OrdersListPage bulk actions", () => {
  it("cancels the selected orders one by one after asking for a reason and reports the results", async () => {
    api.listOrders.mockResolvedValue({ orders, nextCursor: null } as Awaited<ReturnType<typeof api.listOrders>>);
    api.cancelOrder.mockImplementation(async (_ws, orderId) => {
      if (orderId === "ord_2") throw new ApiError("Order already shipped", 409, "INVALID_STATE");
      return fake<Order>({ id: orderId });
    });
    const { user } = renderWithProviders(<OrdersListPage />, { route: "/orders" });

    await user.click(await screen.findByRole("checkbox", { name: "Select order #1001" }));
    await user.click(screen.getByRole("checkbox", { name: "Select order #1002" }));

    const bar = screen.getByRole("region", { name: "2 selected" });
    expect(within(bar).getByText("2 selected")).toBeInTheDocument();

    await user.click(within(bar).getByRole("button", { name: "Cancel" }));
    const dialog = screen.getByRole("dialog", { name: "Cancel 2 orders?" });

    // A reason is required before anything is sent.
    await user.click(within(dialog).getByRole("button", { name: "Cancel orders" }));
    expect(await within(dialog).findByText("Enter a reason for the cancellation.")).toBeInTheDocument();
    expect(api.cancelOrder).not.toHaveBeenCalled();

    await user.type(within(dialog).getByLabelText(/^Reason/), "Customer changed their mind");
    await user.click(within(dialog).getByRole("button", { name: "Cancel orders" }));

    const results = await screen.findByRole("dialog", { name: "Cancel: results" });
    expect(within(results).getByText("1 succeeded")).toBeInTheDocument();
    expect(within(results).getByText("1 failed")).toBeInTheDocument();
    expect(within(results).getByText(/Order already shipped/)).toBeInTheDocument();

    expect(api.cancelOrder).toHaveBeenCalledTimes(2);
    expect(api.cancelOrder).toHaveBeenCalledWith("ws_1", "ord_1", "Customer changed their mind");
    expect(api.cancelOrder).toHaveBeenCalledWith("ws_1", "ord_2", "Customer changed their mind");
    expect(api.cancelOrder).not.toHaveBeenCalledWith("ws_1", "ord_3", expect.anything());
  });
});
