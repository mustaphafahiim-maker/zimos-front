import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { BillingPaymentMethod, SubscriptionPlan, SubscriptionPlans, WalletSummary, Workspace, WorkspaceAccess, WorkspaceBilling } from "@store-builder/api-client";
import { ApiError } from "@store-builder/api-client";
import { api, fake, workspaceMock } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AccessBanner } from "@/components/AccessBanner";
import { SubscriptionPage } from "./SubscriptionPage";

const billing = fake<WorkspaceBilling>({
  subscription: { status: "active", billingCycle: "monthly", trialEndsAt: null, currentPeriodStart: "2030-01-01", currentPeriodEnd: "2130-01-01", plan: { id: "plan_ppo", name: "Pay per order", currency: "EGP", monthlyPrice: 0, yearlyPrice: 0 } },
  referralCode: null,
  nextCharge: null,
  limits: { stores: { used: 1, max: 2 }, funnelsThisMonth: { used: 0, max: 5, resetsAt: "2030-02-01" } },
  draft: false,
});

function wallet(overrides: Partial<WalletSummary> = {}): WalletSummary {
  return {
    enabled: true,
    phase: "ok",
    balance: 50000,
    fee: 50,
    ordersLeft: 1020,
    ordersBeforeOverdraft: 1000,
    overdraft: 1000,
    currency: "EGP",
    onFeePlan: true,
    totalToppedUp: 50000,
    month: { fees: 1500, orders: 30, timeZone: "Africa/Cairo" },
    limits: { minTopup: 10000, maxTopup: 2000000, maxOpenTopups: 3, lowOrders: 20 },
    ...overrides,
  };
}

const instapay: BillingPaymentMethod = { code: "instapay", kind: "manual", label: { ar: "إنستا باي", en: "InstaPay" }, accountNumber: "zimos@instapay", note: { ar: null, en: null } };

function setupUsage({ w = wallet(), locale = "en" as "en" | "ar" } = {}) {
  workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role: "owner" });
  api.getWorkspaceBilling.mockResolvedValue(billing);
  api.getSubscriptionPlans.mockReturnValue(new Promise(() => undefined));
  api.getWallet.mockResolvedValue(w);
  api.getWalletLedger.mockResolvedValue({
    entries: [
      { id: "e2", type: "order_fee", amount: -50, balanceAfter: 50000, currency: "EGP", orderId: "o1", orderNumber: "ZM-1001", paymentProofId: null, note: null, createdAt: "2030-01-02T10:00:00Z" },
      { id: "e1", type: "topup", amount: 50050, balanceAfter: 50050, currency: "EGP", orderId: null, paymentProofId: "p1", note: null, createdAt: "2030-01-01T10:00:00Z" },
    ],
    page: 1,
    pageSize: 10,
    total: 2,
  });
  api.listBillingPaymentProofs.mockResolvedValue({ proofs: [] });
  api.getPaymentMethods.mockResolvedValue({ methods: [instapay], currency: "EGP", contactSupport: false });
  return renderWithProviders(<SubscriptionPage />, { route: "/subscription?tab=usage", path: "/subscription", locale });
}

describe("the prepaid balance on the Usage tab", () => {
  it("is not there while it is switched off", async () => {
    setupUsage({ w: wallet({ enabled: false }) });
    expect(await screen.findByText("Stores")).toBeInTheDocument();
    await waitFor(() => expect(api.getWallet).toHaveBeenCalled());
    expect(screen.queryByText("Prepaid balance")).not.toBeInTheDocument();
  });

  it("shows the balance, the fee, the orders left, this month in Cairo, and the history", async () => {
    setupUsage();
    expect(await screen.findByRole("heading", { name: "Prepaid balance" })).toBeInTheDocument();
    expect(screen.getByText("1020 (1000 before the overdraft)")).toBeInTheDocument();
    expect(screen.getByText("Cairo time")).toBeInTheDocument();
    expect(await screen.findByText("Order fee")).toBeInTheDocument();
    expect(screen.getByText(/Order ZM-1001/)).toBeInTheDocument();
    expect(screen.getByText("Top-up")).toBeInTheDocument();
  });

  it.each([
    ["low", "fewer than 20 orders are left before the overdraft"],
    ["overdraft", "at or below zero"],
    ["exhausted", "stopped taking orders"],
  ] as const)("warns when the balance is %s", async (phase, text) => {
    setupUsage({ w: wallet({ phase, balance: phase === "low" ? 900 : -500 }) });
    expect(await screen.findByText(new RegExp(text))).toBeInTheDocument();
  });

  it("tops up: an amount within the limits, then the transfer's proof with that amount", async () => {
    api.submitWalletTopup.mockResolvedValue(fake({ proof: { id: "p2", purpose: "topup", status: "pending" } }));
    const { user } = setupUsage();
    await user.click(await screen.findByRole("button", { name: "Top up" }));
    const dialog = await screen.findByRole("dialog", { name: "Top up your balance" });

    await user.type(within(dialog).getByLabelText("Amount you'll send (EGP)"), "50");
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    expect(within(dialog).getByText(/Enter an amount between/)).toBeInTheDocument();

    await user.clear(within(dialog).getByLabelText("Amount you'll send (EGP)"));
    await user.type(within(dialog).getByLabelText("Amount you'll send (EGP)"), "250.50");
    await user.click(within(dialog).getByRole("button", { name: "Continue" }));
    expect(await within(dialog).findByText("zimos@instapay")).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText("The mobile number you sent from"), "01012345678");
    const file = new File([new Uint8Array([0x89, 0x50])], "t.png", { type: "image/png" });
    await user.upload(within(dialog).getByLabelText("Screenshot of the transfer"), file);
    await user.click(within(dialog).getByRole("button", { name: "Send for review" }));

    await waitFor(() =>
      expect(api.submitWalletTopup).toHaveBeenCalledWith("ws_1", { requestedAmount: 25050, methodCode: "instapay", senderPhone: "01012345678", file })
    );
    expect(await screen.findByText("Sent. Your balance goes up once the Zimos team checks the transfer.")).toBeInTheDocument();
  });

  it("is in Arabic", async () => {
    setupUsage({ locale: "ar" });
    expect(await screen.findByRole("heading", { name: "الرصيد المدفوع مسبقًا" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "اشحن الرصيد" })).toBeInTheDocument();
    expect(await screen.findByText("رسم طلب")).toBeInTheDocument();
  });
});

describe("the pay-per-order card", () => {
  const card = (overrides: Partial<SubscriptionPlan> = {}) =>
    fake<SubscriptionPlan>({ id: "plan_basic", name: "Basic", currency: "EGP", monthlyPrice: 30000, yearlyPrice: 300000, trialDays: 14, maxStores: 1, maxFunnelsPerMonth: 5, softOrderQuota: null, features: [], isCurrent: true, isPublic: true, prices: { monthly: { gross: 30000, discount: 0, net: 30000 }, yearly: { gross: 300000, discount: 0, net: 300000 } }, ...overrides });

  function setupPlans(payPerOrder: SubscriptionPlans["payPerOrder"], planChange: "immediate" | "support" = "immediate") {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role: "owner" });
    const view = fake<SubscriptionPlans>({
      subscription: { status: "trialing", billingCycle: "monthly", planId: "plan_basic", trialEndsAt: null, currentPeriodEnd: "2030-01-01", draft: false },
      trial: { available: false, used: true },
      planChange,
      referralCode: null,
      plans: [card()],
      payPerOrder,
    });
    api.getWorkspaceBilling.mockResolvedValue(fake<WorkspaceBilling>({ ...billing, subscription: { ...billing.subscription, status: "trialing" } }));
    api.getSubscriptionPlans.mockResolvedValue(view);
    api.listBillingInvoices.mockResolvedValue({ invoices: [], page: 1, pageSize: 10, total: 0 });
    return renderWithProviders(<SubscriptionPage />, { route: "/subscription", path: "/subscription" });
  }

  it("is coming soon while it can't be chosen", async () => {
    setupPlans({ available: false, current: false, plan: null });
    expect(await screen.findByText("Coming soon")).toBeInTheDocument();
  });

  it("shows the fee and is chosen at once during a trial", async () => {
    api.choosePayPerOrder.mockResolvedValue({ changed: true });
    const { user } = setupPlans({ available: true, current: false, plan: { id: "plan_ppo", name: "Pay per order", fee: 50, currency: "EGP" } });
    const article = (await screen.findByRole("button", { name: "Choose pay per order" })).closest("article")!;
    expect(article.querySelector(".tabular")).toHaveTextContent(/0[.,٫]50.*per order/);
    await user.click(within(article).getByRole("button", { name: "Choose pay per order" }));
    await waitFor(() => expect(api.choosePayPerOrder).toHaveBeenCalledWith("ws_1"));
    expect(await screen.findByText(/Your store is now on pay per order/)).toBeInTheDocument();
  });

  it("sends a paid subscription to support", async () => {
    setupPlans({ available: true, current: false, plan: { id: "plan_ppo", name: "Pay per order", fee: 50, currency: "EGP" } }, "support");
    const heading = (await screen.findAllByRole("heading", { name: "Pay per order" })).find((h) => h.closest("article"))!;
    const article = heading.closest("article")!;
    expect(within(article).queryByRole("button", { name: "Choose pay per order" })).not.toBeInTheDocument();
    expect(within(article).getByText("Contact support to switch").closest("a")).toHaveAttribute("href", "/support");
  });

  it("explains an open charge", async () => {
    api.choosePayPerOrder.mockRejectedValue(new ApiError("open", 409, "OPEN_CHARGE_EXISTS"));
    const { user } = setupPlans({ available: true, current: false, plan: { id: "plan_ppo", name: "Pay per order", fee: 50, currency: "EGP" } });
    await user.click(await screen.findByRole("button", { name: "Choose pay per order" }));
    expect(await screen.findByText(/A payment is open for your current plan/)).toBeInTheDocument();
  });
});

describe("the banner", () => {
  const access = (phase: "low" | "overdraft" | "exhausted") =>
    fake<WorkspaceAccess>({
      restricted: phase === "exhausted",
      reasons: phase === "exhausted" ? ["balance"] : [],
      billing: { phase: "ok", status: "active", trialing: false, periodEnd: "2130-01-01", restrictsAt: null, enforced: true },
      suspension: { suspended: false, since: null },
      wallet: { phase, balance: -500, fee: 50, ordersLeft: 10, ordersBeforeOverdraft: 0, overdraft: 1000, currency: "EGP" },
    });

  it("says the store stopped selling, and links to the balance", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role: "owner" });
    api.getWorkspaceAccess.mockResolvedValue(access("exhausted"));
    renderWithProviders(<AccessBanner />);
    const banner = await screen.findByRole("alert");
    expect(banner).toHaveTextContent("Your prepaid balance has run out");
    expect(within(banner).getByRole("link", { name: "Subscription" })).toHaveAttribute("href", "/subscription?tab=usage");
  });

  it("warns, dismissibly, when it runs low", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_2", name: "Nile Store", role: "owner" });
    api.getWorkspaceAccess.mockResolvedValue(access("low"));
    renderWithProviders(<AccessBanner />);
    const banner = await screen.findByRole("status");
    expect(banner).toHaveTextContent("running low");
    expect(within(banner).getByRole("button", { name: "Dismiss for today" })).toBeInTheDocument();
  });
});
