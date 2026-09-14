import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type { ConfirmationTaskRow, Customer, Order } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { CallCenterPage } from "./CallCenterPage";

const created = "2026-09-14T08:00:00.000Z";

const order = fake<Order>({
  id: "ord_1",
  orderNumber: "#2001",
  customerId: "cus_1",
  funnelId: null,
  websiteId: null,
  contactSnapshot: { fullName: "Mona Adel", phone: "01098765432" },
  shippingAddressSnapshot: { country: "EG", province: "Cairo", city: "Maadi", addressLine: "Street 9" },
  riskFlags: [],
  totalAmount: "45000",
  shippingAmount: "5000",
  currency: "EGP",
  confirmationState: "pending",
  createdAt: created,
  items: [{ productNameSnapshot: "Classic Tee", variantOptionsSnapshot: { Size: "M" }, quantity: 1, unitPriceAmount: "40000" }],
});

const customer = fake<Customer>({
  id: "cus_1",
  fullName: "Mona Adel",
  phoneNormalized: "201098765432",
  totalOrders: 3,
  totalRejectedOrders: 0,
  reliabilityScore: 90,
});

const task = fake<ConfirmationTaskRow>({
  id: "task_1",
  orderId: "ord_1",
  status: "queued",
  attemptCount: 0,
  outcome: null,
  nextRetryAt: null,
  lockedByUserId: null,
  createdAt: created,
  updatedAt: created,
  order,
});

describe("CallCenterPage", () => {
  it("records 'confirmed' with the 1 shortcut once the agent has claimed the order", async () => {
    api.listConfirmationQueue.mockImplementation((async (_ws: string, query?: { status?: string }) =>
      query?.status === "queued" ? [task] : []) as typeof api.listConfirmationQueue);
    api.getOrder.mockResolvedValue(order);
    api.getCustomer.mockResolvedValue(customer);
    api.claimConfirmationTask.mockResolvedValue(
      fake<Awaited<ReturnType<typeof api.claimConfirmationTask>>>({ ...task, status: "in_progress", lockedByUserId: "user_1" })
    );
    api.recordConfirmationOutcome.mockResolvedValue(fake<Awaited<ReturnType<typeof api.recordConfirmationOutcome>>>({}));

    const { user } = renderWithProviders(<CallCenterPage />, { route: "/call-center" });

    // The row renders once the order/customer details loader resolves (async fan-out).
    await user.click(await screen.findByRole("button", { name: /#2001/ }, { timeout: 5000 }));
    expect(await screen.findByRole("heading", { name: "Mona Adel" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Claim this order" }));
    expect(await screen.findByText("Assigned to you")).toBeInTheDocument();
    expect(api.claimConfirmationTask).toHaveBeenCalledWith("ws_1", "task_1");

    await user.keyboard("1");

    await waitFor(() => expect(api.recordConfirmationOutcome).toHaveBeenCalledTimes(1));
    expect(api.recordConfirmationOutcome).toHaveBeenCalledWith("ws_1", "task_1", { outcome: "confirmed" });
    expect(await screen.findByText(/#2001 — .* recorded\./)).toBeInTheDocument();
  });
});
