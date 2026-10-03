import { afterEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { BillingPaymentMethod, BillingPaymentProof, MerchantInvoice, Workspace, WorkspaceBilling } from "@store-builder/api-client";
import { ApiError } from "@store-builder/api-client";
import { api, fake, workspaceMock } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SubscriptionPage } from "./SubscriptionPage";

const billing = fake<WorkspaceBilling>({
  subscription: { status: "active", billingCycle: "monthly", trialEndsAt: null, currentPeriodStart: "2030-01-01", currentPeriodEnd: "2030-02-01", plan: { id: "plan_basic", name: "Basic", currency: "EGP", monthlyPrice: 29900, yearlyPrice: 299000 } },
  referralCode: null,
  nextCharge: { grossAmount: 29900, discountAmount: 0, amount: 29900, currency: "EGP" },
  limits: { stores: { used: 1, max: 2 }, funnelsThisMonth: { used: 0, max: 5, resetsAt: "2030-02-01" } },
  draft: false,
});

const instapay: BillingPaymentMethod = { code: "instapay", kind: "manual", label: { ar: "إنستا باي", en: "InstaPay" }, accountNumber: "zimos@instapay", note: { ar: "اكتب اسم متجرك", en: "Add your store name" } };
const wallet: BillingPaymentMethod = { code: "wallet", kind: "manual", label: { ar: "محفظة إلكترونية", en: "Mobile wallet" }, accountNumber: "01000000001", note: { ar: null, en: null } };
const fawaterak: BillingPaymentMethod = { code: "fawaterak", kind: "gateway", label: { ar: "فواتيرك", en: "Fawaterak" } };

const openInvoice = fake<MerchantInvoice>({ id: "inv_1", status: "pending", periodStart: "2030-02-01", periodEnd: "2030-03-01", grossAmount: 29900, discountAmount: 0, amountDue: 29900, amountPaid: null, currency: "EGP", paidAt: null, paymentSource: null, createdAt: "2030-02-01" });

function proof(overrides: Partial<BillingPaymentProof> = {}): BillingPaymentProof {
  return { id: "proof_1", purpose: "invoice", invoiceId: "inv_1", method: { code: "instapay", label: { ar: "إنستا باي", en: "InstaPay" } }, senderPhone: "201012345678", amount: 29900, currency: "EGP", status: "pending", reviewNote: null, createdAt: "2030-02-02", reviewedAt: null, ...overrides };
}

function setup({ methods = [instapay, wallet], proofs = [] as BillingPaymentProof[], invoices = [openInvoice], locale = "en" as "en" | "ar" } = {}) {
  workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role: "owner" });
  api.getWorkspaceBilling.mockResolvedValue(billing);
  api.getSubscriptionPlans.mockReturnValue(new Promise(() => undefined));
  api.listBillingInvoices.mockResolvedValue({ invoices, page: 1, pageSize: 10, total: invoices.length });
  api.getPaymentMethods.mockResolvedValue({ methods, currency: "EGP", contactSupport: methods.length === 0 });
  api.listBillingPaymentProofs.mockResolvedValue({ proofs });
  api.openBillingInvoice.mockResolvedValue({ invoice: openInvoice, created: false });
  return renderWithProviders(<SubscriptionPage />, { route: "/subscription?tab=invoices", path: "/subscription", locale });
}

afterEach(() => vi.unstubAllGlobals());

describe("paying an invoice", () => {
  it("offers no Pay button when no method is offered, only support", async () => {
    setup({ methods: [] });
    expect(await screen.findByText(/To pay this, contact Zimos support/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Contact support" })).toHaveAttribute("href", "/support");
    expect(screen.queryByRole("button", { name: "Pay" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Pay this invoice" })).not.toBeInTheDocument();
  });

  it("shows the server's amount, the number to send to, and sends the proof without any amount", async () => {
    api.submitBillingPaymentProof.mockResolvedValue({ proof: proof() });
    const { user } = setup();
    await user.click(await screen.findByRole("button", { name: "Pay" }));

    const dialog = await screen.findByRole("dialog", { name: "Pay your invoice" });
    await waitFor(() => expect(api.openBillingInvoice).toHaveBeenCalledWith("ws_1"));
    expect(within(dialog).getByText("Amount due")).toBeInTheDocument();
    expect(within(dialog).getByText("zimos@instapay")).toBeInTheDocument();
    expect(within(dialog).getByText("Add your store name")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Copy" })).toBeInTheDocument();
    // There is no field for the amount.
    expect(within(dialog).queryByRole("spinbutton")).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Send for review" }));
    expect(within(dialog).getByText("Enter the number you sent from.")).toBeInTheDocument();
    expect(within(dialog).getByText("Attach the screenshot of the transfer.")).toBeInTheDocument();
    expect(api.submitBillingPaymentProof).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("radio", { name: "Mobile wallet" }));
    expect(within(dialog).getByText("01000000001")).toBeInTheDocument();
    await user.type(within(dialog).getByLabelText("The mobile number you sent from"), "01012345678");
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], "shot.png", { type: "image/png" });
    await user.upload(within(dialog).getByLabelText("Screenshot of the transfer"), file);
    await user.click(within(dialog).getByRole("button", { name: "Send for review" }));

    await waitFor(() =>
      expect(api.submitBillingPaymentProof).toHaveBeenCalledWith("ws_1", "inv_1", { methodCode: "wallet", senderPhone: "01012345678", file })
    );
    expect(await screen.findByText("Sent. We'll review your transfer and update this invoice.")).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("explains a refused proof in place", async () => {
    api.submitBillingPaymentProof.mockRejectedValue(new ApiError("dup", 409, "PROOF_IMAGE_DUPLICATE"));
    const { user } = setup();
    await user.click(await screen.findByRole("button", { name: "Pay this invoice" }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("zimos@instapay");
    await user.type(within(dialog).getByLabelText("The mobile number you sent from"), "01012345678");
    await user.upload(within(dialog).getByLabelText("Screenshot of the transfer"), new File([new Uint8Array([1])], "a.jpg", { type: "image/jpeg" }));
    await user.click(within(dialog).getByRole("button", { name: "Send for review" }));
    expect(await within(dialog).findByText("This screenshot was already sent. Attach the screenshot of this transfer.")).toBeInTheDocument();
  });

  it("sends a gateway straight to its payment page, with no proof form", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { ...window.location, assign });
    api.startOnlinePayment.mockResolvedValue(fake({ payment: { id: "pay_1", status: "open", checkoutUrl: "https://staging.fawaterk.com/link/x" }, reused: false }));
    const { user } = setup({ methods: [fawaterak, instapay] });
    await user.click(await screen.findByRole("button", { name: "Pay" }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("Amount due");
    expect(within(dialog).queryByLabelText("Screenshot of the transfer")).not.toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Continue to the payment page" }));
    await waitFor(() => expect(api.startOnlinePayment).toHaveBeenCalledWith("ws_1", "en", "fawaterak"));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("https://staging.fawaterk.com/link/x"));
  });

  it("shows a transfer under review instead of Pay, and a rejection with its reason", async () => {
    setup({ proofs: [proof()] });
    expect(await screen.findAllByText("Transfer under review")).not.toHaveLength(0);
    expect(screen.queryByRole("button", { name: "Pay" })).not.toBeInTheDocument();
    expect(screen.getByText("Under review")).toBeInTheDocument();
  });

  it("lets the merchant pay again after a rejection, which says why", async () => {
    setup({ proofs: [proof({ status: "rejected", reviewNote: "Nothing arrived from this number." })] });
    expect(await screen.findByText("Reason: Nothing arrived from this number.")).toBeInTheDocument();
    expect(screen.getByText(/was rejected\. Reason: Nothing arrived from this number\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Pay" })).toBeInTheDocument();
  });

  it("is in Arabic", async () => {
    const { user } = setup({ locale: "ar" });
    await user.click(await screen.findByRole("button", { name: "ادفع" }));
    const dialog = await screen.findByRole("dialog", { name: "ادفع فاتورتك" });
    expect(await within(dialog).findByText("المبلغ المستحق")).toBeInTheDocument();
    expect(within(dialog).getByRole("radio", { name: "إنستا باي" })).toBeChecked();
    expect(within(dialog).getByText("اكتب اسم متجرك")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "أرسل للمراجعة" })).toBeInTheDocument();
  });
});
