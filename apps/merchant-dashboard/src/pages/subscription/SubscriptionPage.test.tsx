import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { SubscriptionPlan, SubscriptionPlans, Workspace, WorkspaceBilling } from "@store-builder/api-client";
import { ApiError } from "@store-builder/api-client";
import { api, fake, workspaceMock } from "@/test/mocks";
import { currentPath, renderWithProviders } from "@/test/renderWithProviders";
import { NAV_ITEMS, isNavItemVisible } from "@/lib/navigation";
import { SettingsPage } from "@/pages/settings/SettingsPage";
import { SubscriptionPage } from "./SubscriptionPage";

const price = (gross: number, discount = 0) => ({ gross, discount, net: gross - discount });

function card(overrides: Partial<SubscriptionPlan> = {}): SubscriptionPlan {
  return fake<SubscriptionPlan>({
    id: "plan_basic",
    name: "Basic",
    currency: "EGP",
    monthlyPrice: 30000,
    yearlyPrice: 300000,
    trialDays: 14,
    maxStores: 1,
    maxFunnelsPerMonth: 5,
    softOrderQuota: null,
    features: [],
    isCurrent: false,
    isPublic: true,
    prices: { monthly: price(30000), yearly: price(300000) },
    ...overrides,
  });
}

function view(overrides: Partial<SubscriptionPlans> = {}): SubscriptionPlans {
  return fake<SubscriptionPlans>({
    subscription: { status: "trialing", billingCycle: "monthly", planId: "plan_basic", trialEndsAt: null, currentPeriodEnd: "2030-01-01", draft: false },
    trial: { available: false, used: true },
    planChange: "immediate",
    referralCode: null,
    plans: [card({ isCurrent: true }), card({ id: "plan_pro", name: "Pro", monthlyPrice: 80000, yearlyPrice: 800000, prices: { monthly: price(80000), yearly: price(800000) } })],
    ...overrides,
  });
}

const billing = (overrides: Partial<WorkspaceBilling> = {}) =>
  fake<WorkspaceBilling>({
    subscription: { status: "trialing", billingCycle: "monthly", trialEndsAt: "2030-01-01", currentPeriodStart: "2029-12-18", currentPeriodEnd: "2030-01-01", plan: { id: "plan_basic", name: "Basic", currency: "EGP", monthlyPrice: 30000, yearlyPrice: 300000 } },
    referralCode: null,
    nextCharge: null,
    limits: { stores: { used: 1, max: 2 }, funnelsThisMonth: { used: 5, max: 5, resetsAt: "2030-01-01" } },
    draft: false,
    ...overrides,
  });

function setup({ plans = view(), bill = billing(), role = "owner", route = "/subscription", locale = "en" as "en" | "ar" } = {}) {
  workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role });
  api.getWorkspaceBilling.mockResolvedValue(bill);
  api.getSubscriptionPlans.mockResolvedValue(plans);
  api.listBillingInvoices.mockResolvedValue({ invoices: [], page: 1, pageSize: 10, total: 0 });
  return renderWithProviders(<SubscriptionPage />, { route, path: "/subscription", locale });
}

describe("SubscriptionPage", () => {
  it("is for the owner and the accountant only, and so is its sidebar entry", async () => {
    setup({ role: "order_operator" });
    expect(screen.getByText(/Only the store's owner or its accountant/)).toBeInTheDocument();
    expect(api.getSubscriptionPlans).not.toHaveBeenCalled();

    const item = NAV_ITEMS.find((i) => i.key === "subscription")!;
    expect(item.to).toBe("/subscription");
    expect(["owner", "accountant"].every((r) => isNavItemVisible(item, r))).toBe(true);
    expect(["workspace_manager", "editor", "order_operator", "confirmation_agent"].some((r) => isNavItemVisible(item, r))).toBe(false);
  });

  it("marks the current plan, shows what annual saves, and keeps pay-per-order as coming soon", async () => {
    const { user } = setup();
    const basic = await screen.findByRole("article", { name: "Basic" });
    expect(within(basic).getByText("Your current plan")).toBeInTheDocument();
    expect(within(basic).queryByRole("button", { name: "Choose this plan" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("radio", { name: /Yearly/ }));
    const pro = screen.getByRole("article", { name: "Pro" });
    // 12 × 800 − 8,000 = 1,600 a year.
    expect(within(pro).getByText(/Save .*1,600.* a year/)).toBeInTheDocument();

    const payPerOrder = screen.getByText("Pay per order").closest("article")!;
    expect(within(payPerOrder).getByText("Coming soon")).toBeInTheDocument();
    expect(within(payPerOrder).queryByRole("button")).not.toBeInTheDocument();
  });

  it("changes plan at once during a trial, with the chosen cycle", async () => {
    api.changeSubscriptionPlan.mockResolvedValue({ changed: true, plans: view() });
    const { user } = setup();
    await user.click(await screen.findByRole("radio", { name: /Yearly/ }));
    await user.click(within(screen.getByRole("article", { name: "Pro" })).getByRole("button", { name: "Choose this plan" }));
    await waitFor(() => expect(api.changeSubscriptionPlan).toHaveBeenCalledWith("ws_1", { planId: "plan_pro", billingCycle: "yearly" }));
  });

  it("offers the free trial on every plan of a draft store whose account hasn't had one", async () => {
    api.startTrial.mockResolvedValue(fake({ started: true }));
    const { user } = setup({
      plans: view({ subscription: { ...view().subscription, status: "draft", draft: true }, trial: { available: true, used: false } }),
    });
    expect(await screen.findByText(/Your store is a draft/)).toBeInTheDocument();
    await user.click(within(screen.getByRole("article", { name: "Pro" })).getByRole("button", { name: "Start the free trial (14 days)" }));
    await waitFor(() => expect(api.startTrial).toHaveBeenCalledWith("ws_1", "plan_pro"));
  });

  it("sends a paid subscription to support instead of changing plan", async () => {
    setup({ plans: view({ subscription: { ...view().subscription, status: "active" }, planChange: "support" }) });
    const pro = await screen.findByRole("article", { name: "Pro" });
    // The UI kit's Button asChild keeps role="button" on the link it renders.
    expect(within(pro).getByRole("button", { name: "Contact support to switch" })).toHaveAttribute("href", "/support");
    expect(within(pro).queryByRole("button", { name: "Choose this plan" })).not.toBeInTheDocument();
  });

  it("checks a code on a card, then applies it to the store", async () => {
    api.previewReferralCode.mockResolvedValue({
      code: { code: "SAVE10", discountType: "percentage", discountValue: 1000, discountCurrency: null, active: true },
      plans: [{ planId: "plan_pro", prices: { monthly: price(80000, 8000), yearly: price(800000, 80000) } }],
    });
    api.attachReferralCode.mockResolvedValue(billing());
    const { user } = setup();
    const pro = await screen.findByRole("article", { name: "Pro" });
    await user.type(within(pro).getByLabelText("Discount or voucher code"), "save10");
    await user.click(within(pro).getByRole("button", { name: "Check" }));
    await waitFor(() => expect(api.previewReferralCode).toHaveBeenCalledWith("ws_1", "SAVE10"));
    expect(await within(pro).findByText(/With SAVE10: .*720/)).toBeInTheDocument();
    await user.click(within(pro).getByRole("button", { name: "Apply to my store" }));
    await waitFor(() => expect(api.attachReferralCode).toHaveBeenCalledWith("ws_1", "SAVE10"));
  });

  it("explains a code that can't be used", async () => {
    api.previewReferralCode.mockRejectedValue(new ApiError("bad", 422, "REFERRAL_CODE_INVALID", {}));
    const { user } = setup();
    const pro = await screen.findByRole("article", { name: "Pro" });
    await user.type(within(pro).getByLabelText("Discount or voucher code"), "nope99");
    await user.click(within(pro).getByRole("button", { name: "Check" }));
    expect(await within(pro).findByRole("alert")).toHaveTextContent("isn't valid");
  });

  it("shows usage against the plan's limits", async () => {
    const { user } = setup();
    await user.click(await screen.findByRole("tab", { name: "Usage" }));
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
    expect(screen.getAllByRole("progressbar")).toHaveLength(2);
  });

  it("lists the invoices page by page", async () => {
    const { user } = setup();
    api.listBillingInvoices.mockResolvedValue({
      invoices: [
        fake({ id: "inv_1", status: "paid", periodStart: "2030-01-01", periodEnd: "2030-02-01", grossAmount: 30000, discountAmount: 0, amountDue: 30000, amountPaid: 30000, currency: "EGP", paidAt: "2030-01-01", paymentSource: "manual", createdAt: "2030-01-01" }),
      ],
      page: 1,
      pageSize: 10,
      total: 11,
    });
    await user.click(await screen.findByRole("tab", { name: "Invoices" }));
    expect(await screen.findByText("Paid")).toBeInTheDocument();
    expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(api.listBillingInvoices).toHaveBeenLastCalledWith("ws_1", { page: 2, pageSize: 10 }));
  });

  it("opens the invoices with the payment's outcome when Fawaterak sends the merchant back", async () => {
    api.getOnlinePayment.mockResolvedValue(fake({ payment: { id: "pay_1", status: "paid" } }));
    setup({ route: "/subscription?payment=pay_1&workspace=ws_1&result=success" });
    expect(await screen.findByRole("tab", { name: "Invoices", selected: true })).toBeInTheDocument();
    await waitFor(() => expect(api.getOnlinePayment).toHaveBeenCalledWith("ws_1", "pay_1"));
  });

  it("is in Arabic for an Arabic dashboard", async () => {
    setup({ locale: "ar" });
    expect(await screen.findByRole("tab", { name: "الخطط", selected: true })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "الفواتير" })).toBeInTheDocument();
    expect(await screen.findByText("خطتك الحالية")).toBeInTheDocument();
  });
});

describe("Settings and the old return link", () => {
  it("sends a payment return made for Settings to Subscription, with the same query", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role: "owner" });
    renderWithProviders(<SettingsPage />, { route: "/settings?payment=pay_1&workspace=ws_1&result=success", path: "/settings" });
    await waitFor(() => expect(currentPath()).toBe("/subscription?payment=pay_1&workspace=ws_1&result=success"));
  });
});
