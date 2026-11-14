import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { ApiError, type AuthUser } from "@store-builder/api-client";
import { api, authMock, fake } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { AccountSection } from "./AccountSection";

const user = fake<AuthUser>({ id: "user_1", email: "mona@example.com", fullName: "Mona Adel", username: "mona", phone: "201012345678", status: "active" });
const sent = (target: string, channel: "email" | "sms" = "email") => ({
  sent: true as const,
  channel,
  target,
  expiresAt: new Date(Date.now() + 600000).toISOString(),
  resendAvailableAt: new Date(Date.now() + 60000).toISOString(),
});

function setup({ hasPassword = true, phoneChange = false, locale = "en" as "en" | "ar" } = {}) {
  api.meDetails.mockResolvedValue({ user, needsPlan: false, confirmed: true, suggestedUsername: null, account: { hasPassword, phoneChange } });
  return renderWithProviders(<AccountSection />, { auth: { user }, locale });
}

async function typeCode(u: ReturnType<typeof setup>["user"], code: string) {
  const first = screen.getByLabelText("Digit 1 of 6");
  await u.click(first);
  await u.keyboard(code);
}

describe("the account settings", () => {
  it("save the name directly", async () => {
    api.changeName.mockResolvedValue(user);
    const { user: u } = setup();
    const field = screen.getByLabelText("Name");
    await u.clear(field);
    await u.type(field, "Mona Adel Hassan");
    await u.click(screen.getByRole("button", { name: "Save name" }));
    await waitFor(() => expect(api.changeName).toHaveBeenCalledWith("Mona Adel Hassan"));
    expect(authMock.refreshUser).toHaveBeenCalled();
    expect(await screen.findByText("Name saved.")).toBeInTheDocument();
  });

  it("change the email with the password, then the code sent to the new one", async () => {
    api.requestEmailChange.mockResolvedValue(sent("n***@example.com"));
    api.confirmEmailChange.mockResolvedValue(fake<AuthUser>({ ...user, email: "new@example.com" }));
    const { user: u } = setup();
    await u.click(screen.getByRole("button", { name: "Change email" }));
    const dialog = await screen.findByRole("dialog", { name: "Change your email" });
    await u.type(within(dialog).getByLabelText("New email"), "new@example.com");
    await u.type(within(dialog).getByLabelText("Your current password"), "Passw0rd!123");
    await u.click(within(dialog).getByRole("button", { name: "Send the code" }));
    await waitFor(() =>
      expect(api.requestEmailChange).toHaveBeenCalledWith({ newEmail: "new@example.com", currentPassword: "Passw0rd!123", locale: "en" })
    );
    expect(await within(dialog).findByText(/Enter the code we sent to n\*\*\*@example.com/)).toBeInTheDocument();

    await typeCode(u, "123456");
    await waitFor(() => expect(api.confirmEmailChange).toHaveBeenCalledWith("123456"));
    expect(await screen.findByText(/Your email is changed/)).toBeInTheDocument();
    expect(authMock.refreshUser).toHaveBeenCalled();
  });

  it("say when the password is wrong", async () => {
    api.requestEmailChange.mockRejectedValue(new ApiError("no", 422, "INVALID_PASSWORD"));
    const { user: u } = setup();
    await u.click(screen.getByRole("button", { name: "Change email" }));
    const dialog = await screen.findByRole("dialog");
    await u.type(within(dialog).getByLabelText("New email"), "new@example.com");
    await u.type(within(dialog).getByLabelText("Your current password"), "wrong");
    await u.click(within(dialog).getByRole("button", { name: "Send the code" }));
    expect(await within(dialog).findByText("That password isn't right.")).toBeInTheDocument();
  });

  it("an account made through Google proves itself with a code to its current email", async () => {
    api.sendReauthCode.mockResolvedValue(sent("m***@example.com"));
    api.requestEmailChange.mockResolvedValue(sent("n***@example.com"));
    const { user: u } = setup({ hasPassword: false });
    await u.click(screen.getByRole("button", { name: "Change email" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).queryByLabelText("Your current password")).not.toBeInTheDocument();
    await u.click(within(dialog).getByRole("button", { name: "Send me a code" }));
    expect(await within(dialog).findByText("Code sent to m***@example.com.")).toBeInTheDocument();
    await u.type(within(dialog).getByLabelText("New email"), "new@example.com");
    await u.type(within(dialog).getByLabelText("The code from your current email"), "654321");
    await u.click(within(dialog).getByRole("button", { name: "Send the code" }));
    await waitFor(() => expect(api.requestEmailChange).toHaveBeenCalledWith({ newEmail: "new@example.com", reauthCode: "654321", locale: "en" }));
  });

  it("offer the phone change only while it is switched on", async () => {
    setup({ phoneChange: false });
    await waitFor(() => expect(api.meDetails).toHaveBeenCalled());
    expect(screen.queryByRole("button", { name: "Change mobile number" })).not.toBeInTheDocument();
  });

  it("change the phone by an SMS code when switched on", async () => {
    api.requestPhoneChange.mockResolvedValue(sent("01******678", "sms"));
    api.confirmPhoneChange.mockResolvedValue(user);
    const { user: u } = setup({ phoneChange: true });
    await u.click(await screen.findByRole("button", { name: "Change mobile number" }));
    const dialog = await screen.findByRole("dialog", { name: "Change your mobile number" });
    await u.type(within(dialog).getByLabelText("New mobile number"), "01112345678");
    await u.type(within(dialog).getByLabelText("Your current password"), "Passw0rd!123");
    await u.click(within(dialog).getByRole("button", { name: "Send the code" }));
    await waitFor(() => expect(api.requestPhoneChange).toHaveBeenCalledWith({ newPhone: "01112345678", currentPassword: "Passw0rd!123", locale: "en" }));
    await typeCode(u, "123456");
    await waitFor(() => expect(api.confirmPhoneChange).toHaveBeenCalledWith("123456"));
  });

  it("are in Arabic", async () => {
    setup({ locale: "ar" });
    expect(screen.getByRole("button", { name: "حفظ الاسم" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تغيير البريد الإلكتروني" })).toBeInTheDocument();
    expect(screen.getByText("رقم الموبايل")).toBeInTheDocument();
  });
});
