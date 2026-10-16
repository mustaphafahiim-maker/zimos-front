import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { ApiError, type TwoFactorChallenge } from "@store-builder/api-client";
import { api } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { TwoFactorStep } from "./TwoFactorStep";

const emailChallenge: TwoFactorChallenge = { twoFactorRequired: true, challengeToken: "c1", channel: "email", sentTo: "o***@zimos.test" };

function renderStep(challenge: TwoFactorChallenge = emailChallenge, locale: "en" | "ar" = "en") {
  const onVerified = vi.fn();
  const onBack = vi.fn();
  const view = renderWithProviders(<TwoFactorStep challenge={challenge} onVerified={onVerified} onBack={onBack} />, { locale });
  return { ...view, onVerified, onBack };
}

describe("TwoFactorStep", () => {
  it("finishes the sign-in with the six digits and keeps the tokens", async () => {
    api.request.mockResolvedValue({ user: { id: "user_1" }, accessToken: "a", refreshToken: "r" });
    const { user, onVerified } = renderStep();
    expect(screen.getByText("We sent a 6-digit code to o***@zimos.test. Enter it to finish signing in.")).toBeInTheDocument();
    const submit = screen.getByRole("button", { name: "Sign in" });
    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText("Code"), "12a34 56");
    expect(screen.getByLabelText("Code")).toHaveValue("123456");
    await user.click(submit);

    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
    expect(api.request).toHaveBeenCalledWith("/auth/two-factor/verify", {
      method: "POST",
      body: { challengeToken: "c1", code: "123456", rememberDevice: true },
      auth: false,
    });
    expect(api.setTokens).toHaveBeenCalledWith({ accessToken: "a", refreshToken: "r" });
  });

  it("does not remember the device when the box is cleared", async () => {
    api.request.mockResolvedValue({ user: { id: "user_1" }, accessToken: "a", refreshToken: "r" });
    const { user } = renderStep();
    await user.click(screen.getByLabelText("Remember this device for 60 days"));
    await user.type(screen.getByLabelText("Code"), "123456");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(api.request).toHaveBeenCalledTimes(1));
    expect(api.request.mock.calls[0][1]).toMatchObject({ body: { rememberDevice: false } });
  });

  it("says a wrong code is wrong, in formal Arabic too", async () => {
    api.request.mockRejectedValue(new ApiError("Invalid code", 401, "INVALID_TWO_FACTOR_CODE", {}));
    const { user, onVerified } = renderStep(emailChallenge, "ar");
    await user.type(screen.getByLabelText("الرمز"), "000000");
    await user.click(screen.getByRole("button", { name: "تسجيل الدخول" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("الرمز غير صحيح أو انتهت صلاحيته.");
    expect(onVerified).not.toHaveBeenCalled();
  });

  it("sends the person back for a new code after too many wrong ones", async () => {
    api.request.mockRejectedValue(new ApiError("Too many attempts", 429, "TOO_MANY_ATTEMPTS", {}));
    const { user } = renderStep();
    await user.type(screen.getByLabelText("Code"), "000000");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many wrong codes. Go back and sign in again to get a new one.");
  });

  it("locks the form and offers the password reset when the account is locked", async () => {
    api.request.mockRejectedValue(new ApiError("Locked", 429, "TWO_FACTOR_LOCKED" as never, {}));
    const { user } = renderStep();
    await user.type(screen.getByLabelText("Code"), "000000");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Too many wrong codes were entered for this account.");
    expect(screen.getByRole("link", { name: "Forgot your password?" })).toHaveAttribute("href", "/forgot-password");
    expect(screen.getByLabelText("Code")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeDisabled();
  });

  it("takes a backup code in place of the sign-in code", async () => {
    api.request.mockResolvedValue({ user: { id: "user_1" }, accessToken: "a", refreshToken: "r" });
    const { user, onVerified } = renderStep({ twoFactorRequired: true, challengeToken: "c2", channel: "totp" });
    expect(screen.getByText("Enter the 6-digit code from your authenticator app.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Can't get the code? Use a backup code" }));
    const field = screen.getByLabelText("Backup code");
    await user.type(field, "abcd-efgh");
    expect(field).toHaveValue("ABCD-EFGH");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(onVerified).toHaveBeenCalledTimes(1));
    expect(api.request.mock.calls[0][1]).toMatchObject({ body: { challengeToken: "c2", code: "ABCD-EFGH" } });
  });

  it("starts on the backup code when no new code was sent", () => {
    renderStep({ ...emailChallenge, codeNotSent: true });
    expect(screen.getByLabelText("Backup code")).toBeInTheDocument();
    expect(screen.getByText(/no new one was sent\. Use a backup code/)).toBeInTheDocument();
  });

  it("offers no backup code for a new-device code", () => {
    renderStep({ ...emailChallenge, newDevice: true });
    expect(screen.getByText("You are signing in from a device we don't know yet.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Can't get the code? Use a backup code" })).not.toBeInTheDocument();
  });

  it("goes back to the sign-in form", async () => {
    const { user, onBack } = renderStep();
    await user.click(screen.getByRole("button", { name: "Back to sign in" }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });
});
