import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { PaymentMethodList, StoreManualPaymentMethod } from "@store-builder/api-client";
import { api, fake, testWorkspace } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { PoliciesTab } from "./PoliciesTab";
import { buildPolicyTemplate, findPlaceholders, paymentsFrom, type PolicyContext } from "./policyTemplates";

const ctx = (over: Partial<PolicyContext> = {}): PolicyContext => ({
  payments: { online: false, manual: false },
  hasPhone: false,
  hasEmail: false,
  ...over,
});

const methodList = (over: Partial<PaymentMethodList> = {}): PaymentMethodList => ({
  onlineEnabled: true,
  methods: [
    { id: "cod", provider: null, method: "cod", enabled: true, available: true, mode: null },
    { id: "paymob:card", provider: "paymob", method: "card", enabled: true, available: true, mode: "live" },
  ],
  ...over,
});

const manualMethod = (active: boolean) => fake<StoreManualPaymentMethod>({ id: "m1", kind: "instapay", active });

describe("policy templates", () => {
  it("keeps cash on delivery and leaves out the online and InstaPay blocks the store does not take", () => {
    for (const lang of ["en", "ar"] as const) {
      const terms = buildPolicyTemplate("terms_of_service", lang, ctx());
      expect(terms).toMatch(lang === "en" ? /Cash on delivery/ : /الدفع عند الاستلام/);
      expect(terms).not.toMatch(/licensed payment provider|مزود دفع مرخّص/);
      expect(terms).not.toMatch(/screenshot|صورة من التحويل/);
    }
    const privacy = buildPolicyTemplate("privacy_policy", "en", ctx());
    expect(privacy).toContain("We share it only with the shipping companies that deliver your order. We never sell");
    expect(buildPolicyTemplate("refund_policy", "en", ctx())).not.toMatch(/original payment method|number you paid from/);
  });

  it("adds the online block, then the InstaPay / wallet block, when each is on", () => {
    const online = ctx({ payments: { online: true, manual: false } });
    expect(buildPolicyTemplate("terms_of_service", "en", online)).toContain("processed by a licensed payment provider");
    expect(buildPolicyTemplate("refund_policy", "en", online)).toContain("original payment method within [7-14]");
    expect(buildPolicyTemplate("privacy_policy", "en", online)).toContain("and with the payment provider");
    expect(buildPolicyTemplate("terms_of_service", "en", online)).not.toContain("InstaPay / mobile wallet");

    const manual = ctx({ payments: { online: false, manual: true } });
    const terms = buildPolicyTemplate("terms_of_service", "en", manual);
    expect(terms).toContain("upload a screenshot");
    expect(terms).toContain("shipped after the payment is approved");
    expect(buildPolicyTemplate("refund_policy", "ar", manual)).toContain("إلى الرقم الذي دفعت منه");
    expect(buildPolicyTemplate("privacy_policy", "ar", manual)).toContain("صورة التحويل");
  });

  it("names the store by its variable and fills the contact from store information when set", () => {
    expect(buildPolicyTemplate("refund_policy", "en", ctx())).toContain("contact us on [phone/WhatsApp/email]");
    expect(buildPolicyTemplate("refund_policy", "ar", ctx())).toContain("[الهاتف/واتساب/البريد الإلكتروني]");
    const both = buildPolicyTemplate("refund_policy", "en", ctx({ hasPhone: true, hasEmail: true }));
    expect(both).toContain("contact us on {{store.phone}} or {{store.email}} with your order number");
    expect(findPlaceholders(both)).not.toContain("[phone/WhatsApp/email]");
    expect(buildPolicyTemplate("privacy_policy", "ar", ctx({ hasEmail: true }))).toContain("على {{store.email}}.");
    expect(buildPolicyTemplate("terms_of_service", "en", ctx()).split("\n")[0]).toBe("Terms of service — {{store.name}}");
  });

  it("finds each [placeholder] once and ignores {{variables}}", () => {
    expect(findPlaceholders("Within [14] days, [14] again, {{store.name}}, [المدة]\n[not\nclosed")).toEqual(["[14]", "[المدة]"]);
    expect(findPlaceholders("No placeholders here.")).toEqual([]);
    expect(findPlaceholders(buildPolicyTemplate("terms_of_service", "en", ctx()))).toEqual([
      "[including/excluding]",
      "[2-5]",
      "[regions]",
      "[phone/WhatsApp/email]",
    ]);
  });

  it("counts only live, enabled, available online methods and active manual ones", () => {
    expect(paymentsFrom(methodList(), [manualMethod(true)])).toEqual({ online: true, manual: true, known: true });
    expect(paymentsFrom(methodList({ onlineEnabled: false }), [manualMethod(false)])).toEqual({
      online: false,
      manual: false,
      known: true,
    });
    const test = methodList();
    test.methods[1] = { ...test.methods[1], mode: "test" };
    expect(paymentsFrom(test, []).online).toBe(false);
    expect(paymentsFrom(null, null)).toEqual({ online: false, manual: false, known: false });
  });
});

describe("PoliciesTab", () => {
  function setup(legal: Record<string, string>, opts: { manual?: boolean; locale?: "en" | "ar" } = {}) {
    api.listPaymentMethods.mockResolvedValue(methodList({ onlineEnabled: false }));
    const patches: unknown[] = [];
    api.request.mockImplementation(async (path: string, init: { method?: string; body?: unknown } = {}) => {
      if (path.endsWith("/manual-payments/methods")) return { methods: [manualMethod(opts.manual ?? false)] };
      if (init.method === "PATCH") {
        patches.push(init.body);
        return { workspace: { ...testWorkspace, settings: init.body && (init.body as { settings: unknown }).settings } };
      }
      throw new Error(`Unexpected request ${path}`);
    });
    const workspace = fake<typeof testWorkspace>({
      ...testWorkspace,
      role: "owner",
      settings: { legal, store_info: { enabled: true, phone: "01000000000" } },
    });
    const view = renderWithProviders(<PoliciesTab />, {
      locale: opts.locale,
      workspace: { currentWorkspace: workspace, workspaces: [workspace] },
    });
    return { ...view, patches };
  }

  const textareas = () => screen.getAllByRole("textbox") as HTMLTextAreaElement[];

  it("fills an empty policy at once and lists the placeholders left", async () => {
    const { user } = setup({}, { manual: true });
    expect(await screen.findByText(/Templates follow your payment options: cash on delivery, InstaPay \/ wallet\./)).toBeInTheDocument();
    expect(screen.getByText(/not legal advice/)).toBeInTheDocument();

    const [refundButton] = screen.getAllByRole("button", { name: "Use a template (English)" });
    await waitFor(() => expect(refundButton).toBeEnabled());
    await user.click(refundButton);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const refund = textareas()[0];
    expect(refund.value).toContain("Returns and refunds — {{store.name}}");
    expect(refund.value).toContain("refunded to the number you paid from");
    expect(refund.value).toContain("contact us on {{store.phone}} with your order number");
    expect(screen.getByText("Still to fill in:")).toBeInTheDocument();
    expect(screen.getByText("[14]")).toBeInTheDocument();
  });

  it("asks before replacing a written policy, showing the current text", async () => {
    const { user } = setup({ privacy_policy: "Our own privacy text." });
    const privacyButton = (await screen.findAllByRole("button", { name: "Use a template (Arabic)" }))[1];
    await waitFor(() => expect(privacyButton).toBeEnabled());
    await user.click(privacyButton);

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Replace the current text?")).toBeInTheDocument();
    expect(within(dialog).getByText("Our own privacy text.")).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(textareas()[1].value).toBe("Our own privacy text.");

    await user.click(privacyButton);
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Replace" }));
    expect(textareas()[1].value).toContain("سياسة الخصوصية — {{store.name}}");
  });

  it("warns before saving with placeholders left, and saves on confirm", async () => {
    const { user, patches } = setup({});
    const [refundButton] = await screen.findAllByRole("button", { name: "Use a template (English)" });
    await waitFor(() => expect(refundButton).toBeEnabled());
    await user.click(refundButton);
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Save with empty placeholders?")).toBeInTheDocument();
    expect(within(dialog).getByText("[14]")).toBeInTheDocument();
    expect(patches).toHaveLength(0);

    await user.click(within(dialog).getByRole("button", { name: "Save anyway" }));
    await waitFor(() => expect(patches).toHaveLength(1));
    const legal = (patches[0] as { settings: { legal: Record<string, string> } }).settings.legal;
    expect(legal.refund_policy).toContain("Returns and refunds");
  });

  it("saves at once when no placeholder is left", async () => {
    const { user, patches } = setup({ refund_policy: "Returns within 14 days." });
    const refund = (await screen.findAllByRole("textbox"))[0];
    await user.type(refund, " Thanks.");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(patches).toHaveLength(1));
    expect(screen.queryByText("Save with empty placeholders?")).not.toBeInTheDocument();
  });

  it("speaks Arabic in an Arabic dashboard", async () => {
    setup({}, { locale: "ar" });
    expect(await screen.findAllByRole("button", { name: "استخدام قالب (عربي)" })).toHaveLength(3);
    expect(screen.getByText(/ليست استشارة قانونية/)).toBeInTheDocument();
    expect(await screen.findByText(/تتبع القوالب طرق الدفع في متجرك: الدفع عند الاستلام\./)).toBeInTheDocument();
  });
});
