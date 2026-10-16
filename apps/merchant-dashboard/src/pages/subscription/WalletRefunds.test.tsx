import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { WalletRefundOverview, WalletRefundQuote, WalletRefundRequest, WalletSummary, Workspace, WorkspaceBilling } from "@store-builder/api-client";
import { ApiError } from "@store-builder/api-client";
import { api, fake, workspaceMock } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SubscriptionPage } from "./SubscriptionPage";

// Getting unused prepaid balance back, on the Usage tab: the rule, the most
// and the least, the request dialog, an open request with its status and
// cancel, a debt, and nothing for a store that isn't eligible.

const billing = fake<WorkspaceBilling>({
  subscription: { status: "active", billingCycle: "monthly", trialEndsAt: null, currentPeriodStart: "2030-01-01", currentPeriodEnd: "2130-01-01", plan: { id: "plan_ppo", name: "Pay per order", currency: "EGP", monthlyPrice: 0, yearlyPrice: 0 } },
  referralCode: null,
  nextCharge: null,
  limits: { stores: { used: 1, max: 2 }, funnelsThisMonth: { used: 0, max: 5, resetsAt: "2030-02-01" } },
  draft: false,
});

const wallet = fake<WalletSummary>({
  enabled: true,
  phase: "ok",
  balance: 150000,
  fee: 50,
  ordersLeft: 3020,
  ordersBeforeOverdraft: 3000,
  overdraft: 1000,
  currency: "EGP",
  onFeePlan: true,
  totalToppedUp: 150000,
  month: { fees: 0, orders: 0, timeZone: "Africa/Cairo" },
  limits: { minTopup: 10000, maxTopup: 2000000, maxOpenTopups: 3, lowOrders: 20 },
  hasEntries: true,
});

function quote(overrides: Partial<WalletRefundQuote> = {}): WalletRefundQuote {
  return { balance: 150000, debt: 0, refundableFromTopups: 112500, max: 112500, min: 5000, ceilingBp: 7500, allocation: "newest_first", currency: "EGP", open: false, canRequest: true, ...overrides };
}

const request = (overrides: Partial<WalletRefundRequest> = {}): WalletRefundRequest => ({
  id: "ref_1",
  amount: 40000,
  currency: "EGP",
  status: "requested",
  payoutMethod: "instapay",
  payoutAccount: "me@instapay",
  payoutReference: null,
  adminNote: null,
  createdAt: "2030-01-05T10:00:00Z",
  approvedAt: null,
  rejectedAt: null,
  cancelledAt: null,
  paidAt: null,
  ...overrides,
});

function setup(overview: WalletRefundOverview, locale: "en" | "ar" = "en") {
  workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role: "owner" });
  api.getWorkspaceBilling.mockResolvedValue(billing);
  api.getSubscriptionPlans.mockReturnValue(new Promise(() => undefined));
  api.getWallet.mockResolvedValue(wallet);
  api.getWalletLedger.mockResolvedValue({ entries: [], page: 1, pageSize: 10, total: 0 });
  api.listBillingPaymentProofs.mockResolvedValue({ proofs: [] });
  api.getWalletRefunds.mockResolvedValue(overview);
  return renderWithProviders(<SubscriptionPage />, { route: "/subscription?tab=usage", path: "/subscription", locale });
}

const section = async () => (await screen.findByRole("heading", { name: "Get unused balance back" })).closest("section")!;

describe("getting unused balance back", () => {
  it("says the rule, the most and the least, and asks with the amount and where to send it", async () => {
    const { user } = setup({ eligible: true, quote: quote(), requests: [] });
    const box = await section();
    expect(within(box).getByText(/up to 75% of each top-up you paid/)).toBeInTheDocument();
    expect(within(box).getByText(/Gifts and corrections from Zimos aren't refundable/)).toBeInTheDocument();
    expect(within(box).getByText(/Up to .*1,125/)).toBeInTheDocument();
    expect(within(box).getByText(/At least .*50/)).toBeInTheDocument();

    api.requestWalletRefund.mockResolvedValue({ request: request(), created: true });
    await user.click(within(box).getByRole("button", { name: "Request a refund" }));
    const dialog = await screen.findByRole("dialog", { name: "Request a refund" });
    await user.type(within(dialog).getByLabelText("Amount (EGP)"), "2000");
    await user.type(within(dialog).getByLabelText("InstaPay address or wallet number"), "me@instapay");
    await user.click(within(dialog).getByRole("button", { name: "Send the request" }));
    expect(await within(dialog).findByText(/Enter an amount between/)).toBeInTheDocument();
    await user.clear(within(dialog).getByLabelText("Amount (EGP)"));
    await user.type(within(dialog).getByLabelText("Amount (EGP)"), "400");
    await user.click(within(dialog).getByRole("button", { name: "Send the request" }));
    await waitFor(() =>
      expect(api.requestWalletRefund).toHaveBeenCalledWith("ws_1", expect.objectContaining({ amount: 40000, payoutMethod: "instapay", payoutAccount: "me@instapay", requestId: expect.any(String) }))
    );
  });

  it("explains a refusal from the server", async () => {
    const { user } = setup({ eligible: true, quote: quote(), requests: [] });
    api.requestWalletRefund.mockRejectedValue(new ApiError("open", 422, "REFUND_REQUEST_OPEN"));
    await user.click(within(await section()).getByRole("button", { name: "Request a refund" }));
    const dialog = await screen.findByRole("dialog", { name: "Request a refund" });
    await user.type(within(dialog).getByLabelText("Amount (EGP)"), "100");
    await user.type(within(dialog).getByLabelText("InstaPay address or wallet number"), "01012345678");
    await user.click(within(dialog).getByRole("button", { name: "Send the request" }));
    expect(await within(dialog).findByText(/You already have a refund request open/)).toBeInTheDocument();
  });

  it("shows an open request with its status, and cancels it while it waits", async () => {
    const { user } = setup({ eligible: true, quote: quote({ open: true, canRequest: false }), requests: [request()] });
    const box = await section();
    expect(within(box).getByText(/Your refund of .*400.* is waiting for review/)).toBeInTheDocument();
    expect(within(box).queryByRole("button", { name: "Request a refund" })).not.toBeInTheDocument();
    api.cancelWalletRefund.mockResolvedValue({ request: request({ status: "cancelled" }), changed: true });
    await user.click(within(box).getByRole("button", { name: "Cancel the request" }));
    await waitFor(() => expect(api.cancelWalletRefund).toHaveBeenCalledWith("ws_1", "ref_1"));
  });

  it("an approved one can't be cancelled; a rejected one shows its reason", async () => {
    setup({
      eligible: true,
      quote: quote({ open: true, canRequest: false }),
      requests: [request({ status: "approved" }), request({ id: "ref_0", status: "rejected", adminNote: "Top-up under dispute" })],
    });
    const box = await section();
    expect(within(box).getByText(/was approved/)).toBeInTheDocument();
    expect(within(box).queryByRole("button", { name: "Cancel the request" })).not.toBeInTheDocument();
    expect(within(box).getByText("Reason: Top-up under dispute")).toBeInTheDocument();
  });

  it("asks for a debt to be cleared first, and says when too little can come back", async () => {
    setup({ eligible: true, quote: quote({ balance: -500, debt: 500, max: 0, canRequest: false }), requests: [] });
    const box = await section();
    expect(within(box).getByText(/Your balance is below zero/)).toBeInTheDocument();
    expect(within(box).getByRole("button", { name: "Request a refund" })).toBeDisabled();
  });

  it("says when less than the minimum can come back", async () => {
    setup({ eligible: true, quote: quote({ max: 3000, canRequest: false }), requests: [] });
    const box = await section();
    expect(within(box).getByText(/There's less than .*50.* you can get back right now/)).toBeInTheDocument();
    expect(within(box).getByRole("button", { name: "Request a refund" })).toBeDisabled();
  });

  it("is not there for a store that isn't eligible", async () => {
    setup({ eligible: false, quote: quote({ canRequest: false }), requests: [] });
    expect(await screen.findByRole("heading", { name: "Prepaid balance" })).toBeInTheDocument();
    await waitFor(() => expect(api.getWalletRefunds).toHaveBeenCalled());
    expect(screen.queryByRole("heading", { name: "Get unused balance back" })).not.toBeInTheDocument();
  });

  it("is in Arabic", async () => {
    setup({ eligible: true, quote: quote(), requests: [] }, "ar");
    expect(await screen.findByRole("heading", { name: "استرداد الرصيد غير المستخدم" })).toBeInTheDocument();
    expect(screen.getByText(/الهدايا والتصحيحات من Zimos لا تُسترد/)).toBeInTheDocument();
  });
});
