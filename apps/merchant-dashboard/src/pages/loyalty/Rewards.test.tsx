import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { LoyaltyOverview, Order, PaymentTimeline, StoreCreditAccount, StoreCreditOverview } from "@store-builder/api-client";
import { invalidateCached } from "@/lib/useCachedAsync";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { CustomerStoreCreditCard } from "../storeCredit/CustomerStoreCreditCard";
import { RefundDestinationField, isStoreTenderPayment, useRefundDestination } from "../storeCredit/RefundDestination";
import { StoreCreditPage } from "../storeCredit/StoreCreditPage";
import { LoyaltyProgramPage } from "./LoyaltyProgramPage";
import { REWARDS_HOME } from "./RewardsTabs";

// The tabs, the refund's destinations and the menu are built once from the switches: this file runs with all of them on.
vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  LOYALTY_ENABLED: true,
  VIP_TIERS_ENABLED: true,
  CUSTOMER_REFERRALS_ENABLED: true,
  STORE_CREDIT_ENABLED: true,
  GIFT_CARDS_ENABLED: true,
}));

const loyalty: LoyaltyOverview = {
  settings: { enabled: true, earnPointsPerUnit: 1, pointValue: 10, minRedeemPoints: 100, maxRedeemPercent: 50, expiryDays: null },
  active: true,
  currency: "EGP",
  customersWithPoints: 12,
  outstandingPoints: 3400,
  outstandingWorth: "34000",
};
const accountsOn = { enabled: true, channels: ["sms"] };

describe("Loyalty & rewards with every programme switched on", () => {
  it("opens on loyalty points, with a tab for each programme", async () => {
    fakeBackend({ "GET /loyalty": loyalty, "GET /shopper-accounts": accountsOn });
    renderWithProviders(<LoyaltyProgramPage />);
    expect(REWARDS_HOME).toBe("/loyalty");
    expect(await screen.findByRole("heading", { name: "Loyalty programme" })).toBeInTheDocument();
    const tabs = within(screen.getByRole("tablist", { name: "Loyalty and rewards sections" })).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["Loyalty points", "VIP tiers", "Refer a friend", "Store credit"]);
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("Customers with points")).toBeInTheDocument();
  });

  it("switches the programme off and saves it", async () => {
    const calls = fakeBackend({
      "GET /loyalty": loyalty,
      "GET /shopper-accounts": accountsOn,
      "PUT /loyalty": { settings: { ...loyalty.settings, enabled: false }, active: false },
    });
    const { user } = renderWithProviders(<LoyaltyProgramPage />);
    await user.click(await screen.findByRole("switch", { name: /Turn on the loyalty programme/ }));
    await user.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => expect(callsTo(calls, "PUT", "/workspaces/ws_1/loyalty")).toHaveLength(1));
    expect(callsTo(calls, "PUT", "/loyalty")[0].body).toMatchObject({ enabled: false });
    expect(await screen.findByText("Saved. The loyalty programme is off.")).toBeInTheDocument();
  });

  it("says that points cannot be spent while customer accounts are off", async () => {
    fakeBackend({ "GET /loyalty": loyalty, "GET /shopper-accounts": { enabled: false, channels: ["sms"] } });
    renderWithProviders(<LoyaltyProgramPage />);
    expect(await screen.findByText(/Customer accounts are off, so customers can earn points but can't spend them/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Turn on customer accounts" })).toHaveAttribute("href", "/store-settings/customer-accounts");
  });

  it("reads in formal Arabic", async () => {
    fakeBackend({ "GET /loyalty": loyalty, "GET /shopper-accounts": accountsOn });
    renderWithProviders(<LoyaltyProgramPage />, { locale: "ar" });
    expect(await screen.findByRole("heading", { name: "برنامج الولاء" })).toBeInTheDocument();
    const tabs = within(screen.getByRole("tablist", { name: "أقسام الولاء والمكافآت" })).getAllByRole("tab");
    expect(tabs.map((tab) => tab.textContent)).toEqual(["نقاط الولاء", "مستويات VIP", "ادعُ صديقك", "أرصدة العملاء"]);
    expect(await screen.findByRole("switch", { name: /تفعيل برنامج الولاء/ })).toBeInTheDocument();
  });
});

describe("Store credit", () => {
  const overview: StoreCreditOverview = {
    spendingEnabled: true,
    customers: [{ customerId: "cus_1", fullName: "Mona Ali", phone: "01012345003", email: null, balance: "15000" }],
    outstanding: "15000",
    currency: "EGP",
  };
  const account: StoreCreditAccount = {
    balance: "15000",
    currency: "EGP",
    history: [{ id: "t1", kind: "grant", amount: "15000", balanceAfter: "15000", currency: "EGP", orderId: null, note: "Goodwill", createdAt: "2026-10-01T10:00:00.000Z" }],
  };

  // The holders are kept for the session: each test reads them afresh.
  beforeEach(() => invalidateCached("store-credit:"));

  it("lists who holds credit and stops checkout from taking it", async () => {
    const calls = fakeBackend({
      "GET /store-credit": overview,
      "GET /shopper-accounts": accountsOn,
      "PUT /store-credit/settings": { spendingEnabled: false },
    });
    const { user } = renderWithProviders(<StoreCreditPage />);
    expect(await screen.findByRole("heading", { name: "Store credit balances" })).toBeInTheDocument();
    expect((await screen.findAllByText("Mona Ali")).length).toBeGreaterThan(0);
    expect(screen.getByText("A signed-in customer can pay with their credit, with cash on delivery.")).toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: /Customers can spend credit at checkout/ }));
    await waitFor(() => expect(callsTo(calls, "PUT", "/workspaces/ws_1/store-credit/settings")).toHaveLength(1));
    expect(callsTo(calls, "PUT", "/store-credit/settings")[0].body).toEqual({ enabled: false });
    expect(await screen.findByText("Checkout no longer takes store credit.")).toBeInTheDocument();
  });

  it("adds credit to a customer from their page, in minor units and with the reason", async () => {
    const calls = fakeBackend({
      "GET /store-credit/customers/cus_1": account,
      "POST /store-credit/customers/cus_1/adjust": { balance: "20000", applied: "5000" },
    });
    const { user } = renderWithProviders(<CustomerStoreCreditCard customerId="cus_1" />);
    await user.click(await screen.findByRole("button", { name: "Add credit" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Amount/), "50");
    await user.type(within(dialog).getByLabelText(/Reason/), "Late delivery");
    await user.click(within(dialog).getByRole("button", { name: "Add credit" }));

    await waitFor(() => expect(callsTo(calls, "POST", "/workspaces/ws_1/store-credit/customers/cus_1/adjust")).toHaveLength(1));
    expect(callsTo(calls, "POST", "/adjust")[0].body).toEqual({ amount: 5000, note: "Late delivery" });
  });

  it("asks for the reason before it changes a balance", async () => {
    const calls = fakeBackend({ "GET /store-credit/customers/cus_1": account });
    const { user } = renderWithProviders(<CustomerStoreCreditCard customerId="cus_1" />);
    await user.click(await screen.findByRole("button", { name: "Add credit" }));
    const dialog = await screen.findByRole("dialog");
    await user.type(within(dialog).getByLabelText(/Amount/), "50");
    await user.click(within(dialog).getByRole("button", { name: "Add credit" }));
    expect(await within(dialog).findByText("Write the reason for this change.")).toBeInTheDocument();
    expect(callsTo(calls, "POST", "/adjust")).toHaveLength(0);
  });
});

describe("where a refund goes", () => {
  const order = fake<Order>({ id: "ord_1", customerId: "cus_1", currency: "EGP" });
  const points = { id: "pay_points", providerCode: "loyalty", status: "captured", amount: "4000", maskedDisplay: "400 points" };
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
    attempts: [points, { id: "pay_cod", providerCode: "cod", status: "captured", amount: "16000", maskedDisplay: null }],
    refunds: [],
  });

  function Dialog() {
    const destination = useRefundDestination(order, timeline);
    return (
      <>
        <RefundDestinationField state={destination} viaGateway={false} currency="EGP" onPick={() => {}} />
        <output data-testid="max">{String(destination.max)}</output>
        <button type="button" onClick={() => void destination.send({ amount: 3000, reason: "Damaged", notifyCustomer: false })}>
          send
        </button>
        <p>{destination.problem("") ?? "no problem"}</p>
      </>
    );
  }

  it("offers money first, the customer's store credit, and the points that paid", async () => {
    renderWithProviders(<Dialog />);
    const options = within(screen.getByRole("group", { name: "Where does the refund go?" })).getAllByRole("radio");
    expect(options).toHaveLength(3);
    expect(screen.getByRole("radio", { name: /Refund money/ })).toBeChecked();
    expect(screen.getByRole("radio", { name: /Refund as store credit/ })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /Back as loyalty points/ })).toBeInTheDocument();
    expect(screen.getByTestId("max")).toHaveTextContent("null");
    expect(isStoreTenderPayment({ providerCode: "loyalty" })).toBe(true);
  });

  it("puts a refund on the customer's credit, and needs its reason", async () => {
    const calls = fakeBackend({ "POST /store-credit/orders/ord_1/refund": { refund: { id: "ref_1", amount: "3000", status: "processed", reason: "Store credit: Damaged" }, balance: "3000" } });
    const { user } = renderWithProviders(<Dialog />);
    await user.click(screen.getByRole("radio", { name: /Refund as store credit/ }));
    expect(screen.getByTestId("max")).toHaveTextContent("20000");
    expect(screen.getByText("Write the reason: a refund to store credit is saved with it.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "send" }));
    await waitFor(() => expect(callsTo(calls, "POST", "/workspaces/ws_1/store-credit/orders/ord_1/refund")).toHaveLength(1));
    expect(callsTo(calls, "POST", "/store-credit/orders/ord_1/refund")[0].body).toEqual({ amount: 3000, reason: "Damaged" });
  });

  it("gives points back by naming the payment they made, at most what is left on it", async () => {
    const calls = fakeBackend({ "POST /orders/ord_1/refunds": { refund: { id: "ref_2", amount: "3000", status: "processed" } } });
    const { user } = renderWithProviders(<Dialog />);
    await user.click(screen.getByRole("radio", { name: /Back as loyalty points/ }));
    expect(screen.getByTestId("max")).toHaveTextContent("4000");
    await user.click(screen.getByRole("button", { name: "send" }));
    await waitFor(() => expect(callsTo(calls, "POST", "/workspaces/ws_1/orders/ord_1/refunds")).toHaveLength(1));
    expect(callsTo(calls, "POST", "/orders/ord_1/refunds")[0].body).toEqual({ amount: 3000, notifyCustomer: false, paymentId: "pay_points", reason: "Damaged" });
  });

  it("names the choices in formal Arabic", async () => {
    renderWithProviders(<Dialog />, { locale: "ar" });
    expect(screen.getByRole("group", { name: "إلى أين يذهب الاسترداد؟" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: /استرداد في صورة رصيد في المتجر/ })).toBeInTheDocument();
  });
});
