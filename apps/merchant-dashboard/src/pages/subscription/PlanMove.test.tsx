import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { MerchantInvoice, PlanMove, SubscriptionPlan, SubscriptionPlans, Workspace, WorkspaceBilling } from "@store-builder/api-client";
import { ApiError } from "@store-builder/api-client";
import { api, fake, workspaceMock } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SubscriptionPage } from "./SubscriptionPage";

// A store on pay per order moving to a monthly plan by itself: the plans with
// "Move to this plan", no free trial, the balance (and a debt to clear
// first), the move waiting for its payment, and the Pay dialog after asking.

const plan = (id: string, name: string, monthly: number) =>
  fake<SubscriptionPlan>({
    id,
    name,
    currency: "EGP",
    monthlyPrice: monthly,
    yearlyPrice: monthly * 10,
    trialDays: 14,
    maxStores: 1,
    maxFunnelsPerMonth: 5,
    softOrderQuota: null,
    features: [],
    isCurrent: false,
    isPublic: true,
    prices: { monthly: { gross: monthly, discount: 0, net: monthly }, yearly: { gross: monthly * 10, discount: 0, net: monthly * 10 } },
  });

const billing = fake<WorkspaceBilling>({
  subscription: { status: "active", billingCycle: "monthly", trialEndsAt: null, currentPeriodStart: "2030-01-01", currentPeriodEnd: "2130-01-01", plan: { id: "plan_ppo", name: "Pay per order", currency: "EGP", monthlyPrice: 0, yearlyPrice: 0 } },
  referralCode: null,
  nextCharge: null,
  limits: { stores: { used: 1, max: 2 }, funnelsThisMonth: { used: 0, max: 5, resetsAt: "2030-02-01" } },
  draft: false,
});

function move(overrides: Partial<PlanMove> = {}): PlanMove {
  return { available: true, trial: false, balance: 12000, debt: 0, currency: "EGP", pending: null, otherChargeOpen: false, ...overrides };
}

function setup(m: PlanMove | null) {
  workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role: "owner" });
  const view = fake<SubscriptionPlans>({
    subscription: { status: "active", billingCycle: "monthly", planId: "plan_ppo", trialEndsAt: null, currentPeriodEnd: "2130-01-01", draft: false },
    trial: { available: false, used: true },
    planChange: "support",
    referralCode: null,
    plans: [plan("plan_starter", "Starter", 30000), plan("plan_pro", "Pro", 60000)],
    payPerOrder: { available: true, current: true, plan: { id: "plan_ppo", name: "Pay per order", fee: 50, currency: "EGP" } },
    move: m,
  });
  api.getWorkspaceBilling.mockResolvedValue(billing);
  api.getSubscriptionPlans.mockResolvedValue(view);
  api.listBillingInvoices.mockResolvedValue({ invoices: [], page: 1, pageSize: 10, total: 0 });
  return { ...renderWithProviders(<SubscriptionPage />, { route: "/subscription", path: "/subscription" }), view };
}

const cardOf = async (name: string) => (await screen.findByRole("heading", { name })).closest("article")!;

describe("moving off pay per order", () => {
  it("offers each plan with no trial, says the balance stays, and never sends to support", async () => {
    setup(move());
    expect(await screen.findByRole("heading", { name: "Move from pay per order to a monthly plan" })).toBeInTheDocument();
    expect(screen.getByText(/There's no free trial when switching/)).toBeInTheDocument();
    expect(screen.getByText(/It stays in your wallet/)).toBeInTheDocument();
    const starter = await cardOf("Starter");
    // A plan's own trial isn't offered on a move.
    expect(within(starter).queryByText(/Free trial/)).not.toBeInTheDocument();
    expect(within(starter).getByRole("button", { name: "Move to this plan" })).toBeEnabled();
    expect(within(starter).queryByText("Contact support")).not.toBeInTheDocument();
    expect(screen.queryByText(/contact Zimos support/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /free trial/i })).not.toBeInTheDocument();
  });

  it("asks for the move with the chosen plan and cycle, then opens the Pay dialog", async () => {
    const { user, view } = setup(move());
    const invoice = fake<MerchantInvoice>({ id: "inv_1", status: "pending", amountDue: 30000, currency: "EGP", targetPlanId: "plan_starter", targetBillingCycle: "monthly" });
    api.requestPlanMove.mockImplementation(async () => {
      // From here the Invoices tab lists the move's charge, with a way to pay it.
      api.listBillingInvoices.mockResolvedValue({ invoices: [invoice], page: 1, pageSize: 10, total: 1 });
      return { created: true, invoice, plans: view };
    });
    api.getPaymentMethods.mockResolvedValue({ methods: [fake({ code: "instapay", kind: "manual", label: { ar: "إنستا باي", en: "InstaPay" } })], currency: "EGP", contactSupport: false });
    api.listBillingPaymentProofs.mockResolvedValue({ proofs: [] });
    await user.click(within(await cardOf("Starter")).getByRole("button", { name: "Move to this plan" }));
    await waitFor(() => expect(api.requestPlanMove).toHaveBeenCalledWith("ws_1", { planId: "plan_starter", billingCycle: "monthly" }));
    await waitFor(() => expect(api.openBillingInvoice).toHaveBeenCalled());
  });

  it("asks for a debt to be cleared first, with the way to top up, and won't move", async () => {
    setup(move({ balance: -2000, debt: 2000 }));
    const alert = await screen.findByText(/You owe .* on your prepaid balance/);
    expect(within(alert.closest("[role=alert]")!).getByRole("link", { name: "Top up the balance" })).toHaveAttribute("href", "/subscription?tab=usage");
    expect(within(await cardOf("Pro")).getByRole("button", { name: "Move to this plan" })).toBeDisabled();
  });

  it("explains the server's refusal for a debt", async () => {
    const { user } = setup(move());
    api.requestPlanMove.mockRejectedValue(new ApiError("debt", 422, "WALLET_DEBT_OUTSTANDING"));
    await user.click(within(await cardOf("Pro")).getByRole("button", { name: "Move to this plan" }));
    expect(await screen.findByText("You owe money on your prepaid balance. Top it up first, then choose a plan.")).toBeInTheDocument();
  });

  it("shows the move waiting for its payment, and only its plan leads to paying", async () => {
    setup(move({ pending: { invoiceId: "inv_1", planId: "plan_pro", planName: "Pro", billingCycle: "yearly", amountDue: 600000, currency: "EGP", createdAt: "2030-01-02T10:00:00Z" } }));
    expect(await screen.findByText(/Your move to Pro \(annual\) is waiting for its payment/)).toBeInTheDocument();
    expect(within(await cardOf("Pro")).getByText("Pay to switch").closest("a")).toHaveAttribute("href", "/subscription?tab=invoices&pay=1");
    expect(within(await cardOf("Starter")).queryByRole("button", { name: "Move to this plan" })).not.toBeInTheDocument();
  });

  it("is in Arabic", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role: "owner" });
    const { view } = setup(move());
    api.getSubscriptionPlans.mockResolvedValue(view);
    renderWithProviders(<SubscriptionPage />, { route: "/subscription", path: "/subscription", locale: "ar" });
    expect((await screen.findAllByText(/لا توجد فترة تجريبية مجانية عند الانتقال/)).length).toBeGreaterThan(0);
  });
});

describe("a store not on pay per order", () => {
  it("sees today's plans tab: no move, support once paid", async () => {
    setup(null);
    expect(await screen.findByText(/contact Zimos support/)).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Move from pay per order to a monthly plan" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Move to this plan" })).not.toBeInTheDocument();
  });
});
