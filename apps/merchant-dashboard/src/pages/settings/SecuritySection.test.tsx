import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { ApiError, type AuthUser, type TwoFactorStatus } from "@store-builder/api-client";
import { api, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SecuritySection } from "./SecuritySection";

const off: TwoFactorStatus = { mode: "off", enabledAt: null, rememberedDevices: 0, hasPassword: true, backupCodesLeft: 0, backupCodesCreatedAt: null };
const byEmail: TwoFactorStatus = { ...off, mode: "email", enabledAt: "2026-10-01T10:00:00.000Z", rememberedDevices: 2 };

/** Answers the section's calls by path; anything else never settles. */
function serve(routes: Record<string, unknown>) {
  api.request.mockImplementation(((path: string) => {
    if (!(path in routes)) return new Promise<never>(() => undefined);
    const answer = routes[path];
    return answer instanceof Error ? Promise.reject(answer) : Promise.resolve(answer);
  }) as never);
}

/** A settings row is a group named by its label. */
function row(label: string) {
  return screen.getByRole("group", { name: label });
}

describe("SecuritySection", () => {
  it("shows the second step as off, with a button on each method", async () => {
    serve({ "/auth/two-factor": off });
    renderWithProviders(<SecuritySection />);
    expect(await screen.findByRole("heading", { name: "Security" })).toBeInTheDocument();
    expect(await screen.findByText("Code by email")).toBeInTheDocument();
    expect(within(row("Now")).getByText("Off")).toBeInTheDocument();
    expect(within(row("Code by email")).getByRole("button", { name: "Use this" })).toBeEnabled();
    expect(within(row("Authenticator app")).getByRole("button", { name: "Use this" })).toBeEnabled();
    // No verified phone: the WhatsApp method is held, and its hint says why.
    expect(within(row("Code on WhatsApp")).getByRole("button", { name: "Use this" })).toBeDisabled();
    expect(screen.getByText("Verify your phone number in your account to get codes on WhatsApp.")).toBeInTheDocument();
    expect(screen.queryByText("Backup codes")).not.toBeInTheDocument();
    expect(screen.queryByText("Turn off two-step sign-in")).not.toBeInTheDocument();
  });

  it("turns on the email code after the password", async () => {
    serve({ "/auth/two-factor": off, "/auth/two-factor/email/enable": { ...byEmail, rememberedDevices: 0 } });
    const { user } = renderWithProviders(<SecuritySection />);
    await user.click(within(await screen.findByText("Code by email").then(() => row("Code by email"))).getByRole("button", { name: "Use this" }));
    await user.type(screen.getByLabelText(/Your password/), "Passw0rd!123");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("Two-step sign-in by email is on.")).toBeInTheDocument();
    expect(api.request).toHaveBeenCalledWith("/auth/two-factor/email/enable", { method: "POST", body: { password: "Passw0rd!123" } });
    expect(within(row("Code by email")).getByText("On")).toBeInTheDocument();
    expect(screen.getByText("Backup codes")).toBeInTheDocument();
  });

  it("keeps the dialog open with the reason when the password is wrong", async () => {
    serve({
      "/auth/two-factor": off,
      "/auth/two-factor/email/enable": new ApiError("The password is not correct", 422, "VALIDATION_ERROR", {}),
    });
    const { user } = renderWithProviders(<SecuritySection />);
    await screen.findByText("Code by email");
    await user.click(within(row("Code by email")).getByRole("button", { name: "Use this" }));
    await user.type(screen.getByLabelText(/Your password/), "nope");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByLabelText(/Your password/)).toBeInTheDocument();
    expect(within(row("Now")).getByText("Off")).toBeInTheDocument();
  });

  it("offers WhatsApp to an account with a verified phone", async () => {
    serve({ "/auth/two-factor": off });
    renderWithProviders(<SecuritySection />, {
      auth: { user: fake<AuthUser>({ id: "user_1", email: "a@zimos.test", status: "active", phone: "+201000000000", phoneVerifiedAt: "2026-09-01T00:00:00.000Z" }) },
    });
    await screen.findByText("Code on WhatsApp");
    expect(within(row("Code on WhatsApp")).getByRole("button", { name: "Use this" })).toBeEnabled();
    expect(screen.getByText("A code is sent to your verified phone.")).toBeInTheDocument();
  });

  it("forgets the remembered devices", async () => {
    serve({ "/auth/two-factor": byEmail, "/auth/two-factor/forget-devices": { ...byEmail, rememberedDevices: 0 } });
    const { user } = renderWithProviders(<SecuritySection />);
    expect(await screen.findByText("2 remembered device(s) are not asked for a code.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Forget them" }));
    expect(await screen.findByText("Remembered devices were forgotten.")).toBeInTheDocument();
    expect(api.request).toHaveBeenCalledWith("/auth/two-factor/forget-devices", { method: "POST" });
    expect(screen.queryByRole("button", { name: "Forget them" })).not.toBeInTheDocument();
  });

  it("makes backup codes and shows them once", async () => {
    serve({
      "/auth/two-factor": byEmail,
      "/auth/two-factor/backup-codes": { codes: ["ABCD-EFGH", "JKLM-NPQR"], createdAt: "2026-10-10T08:00:00.000Z" },
    });
    const { user } = renderWithProviders(<SecuritySection />);
    await screen.findByText("Backup codes");
    expect(screen.getByText(/No backup codes yet\./)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Make backup codes" }));
    await user.type(screen.getByLabelText(/Your password/), "Passw0rd!123");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("ABCD-EFGH")).toBeInTheDocument();
    expect(screen.getByText("JKLM-NPQR")).toBeInTheDocument();
    expect(screen.getByText("Save these codes now. They won't be shown again, and each one works once.")).toBeInTheDocument();
    expect(api.request).toHaveBeenCalledWith("/auth/two-factor/backup-codes", { method: "POST", body: { password: "Passw0rd!123" } });
    await user.click(screen.getByRole("button", { name: "I saved them" }));
    await waitFor(() => expect(screen.queryByText("ABCD-EFGH")).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Make new codes" })).toBeInTheDocument();
  });

  it("turns the second step off after the password", async () => {
    serve({ "/auth/two-factor": byEmail, "/auth/two-factor/disable": off });
    const { user } = renderWithProviders(<SecuritySection />);
    await screen.findByText("Turn off two-step sign-in");
    await user.click(screen.getByRole("button", { name: "Turn off" }));
    await user.type(screen.getByLabelText(/Your password/), "Passw0rd!123");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByText("Two-step sign-in is off.")).toBeInTheDocument();
    expect(api.request).toHaveBeenCalledWith("/auth/two-factor/disable", { method: "POST", body: { password: "Passw0rd!123" } });
  });

  it("shows only the password row while the API runs without two-step sign-in", async () => {
    serve({ "/auth/two-factor": new ApiError("Two-step sign-in is not available", 404, "TWO_FACTOR_UNAVAILABLE" as never, {}) });
    renderWithProviders(<SecuritySection />);
    await waitFor(() => expect(api.request).toHaveBeenCalledWith("/auth/two-factor"));
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
    expect(screen.queryByText("Two-step sign-in")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Change your password/ })).toHaveAttribute("href", "/forgot-password");
  });

  it("reads in formal Arabic", async () => {
    serve({ "/auth/two-factor": off });
    renderWithProviders(<SecuritySection />, { locale: "ar" });
    expect(await screen.findByRole("heading", { name: "الأمان" })).toBeInTheDocument();
    expect(await screen.findByText("رمز بالبريد الإلكتروني")).toBeInTheDocument();
    expect(screen.getByText("تغيير كلمة المرور")).toBeInTheDocument();
  });
});
