import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import type { Order, PaymentTimeline } from "@store-builder/api-client";
import { fakeBackend } from "@/test/fakeBackend";
import { fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { RefundDestinationField, isStoreTenderPayment, useRefundDestination } from "../storeCredit/RefundDestination";
import { REWARDS_HOME } from "./RewardsTabs";

// No switch is mocked here: this is the dashboard as it ships, every programme off.
describe("Loyalty & rewards while every programme is switched off", () => {
  const order = fake<Order>({ id: "ord_1", customerId: "cus_1", currency: "EGP" });
  const timeline = fake<PaymentTimeline>({
    orderId: "ord_1",
    currency: "EGP",
    totalAmount: 20000,
    amountPaid: 20000,
    amountRefunded: 0,
    pendingRefunds: 0,
    refundable: 16000,
    refundVia: "manual",
    perPayment: [],
    attempts: [
      { id: "pay_points", providerCode: "loyalty", status: "captured", amount: "2000", maskedDisplay: "200 points" },
      { id: "pay_credit", providerCode: "store_credit", status: "captured", amount: "2000", maskedDisplay: null },
      { id: "pay_card", providerCode: "gift_card", status: "captured", amount: "2000", maskedDisplay: "•••• T6FK" },
    ],
    refunds: [],
  });

  function Dialog() {
    const destination = useRefundDestination(order, timeline);
    return (
      <>
        <RefundDestinationField state={destination} viaGateway={false} currency="EGP" onPick={() => {}} />
        <output data-testid="state">{`${destination.options.length}|${destination.isMoney}|${destination.max}|${destination.reasonRequired}|${destination.notifiable}`}</output>
      </>
    );
  }

  it("has no page to open", () => {
    expect(REWARDS_HOME).toBeNull();
  });

  it("leaves the refund dialog as it was: money only, nothing to choose", () => {
    const calls = fakeBackend({});
    renderWithProviders(<Dialog />);
    expect(screen.queryByText("Where does the refund go?")).not.toBeInTheDocument();
    expect(screen.queryByRole("radio")).not.toBeInTheDocument();
    expect(screen.getByTestId("state")).toHaveTextContent("1|true|null|false|true");
    expect(calls).toHaveLength(0);
  });

  it("names no payment as points or store credit", () => {
    expect(isStoreTenderPayment({ providerCode: "loyalty" })).toBe(false);
    expect(isStoreTenderPayment({ providerCode: "store_credit" })).toBe(false);
  });
});
