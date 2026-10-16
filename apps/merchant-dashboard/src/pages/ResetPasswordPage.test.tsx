import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { ApiError } from "@store-builder/api-client";
import { api } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ResetPasswordPage } from "./ResetPasswordPage";

const render = (route: string, locale: "en" | "ar" = "en") =>
  renderWithProviders(<ResetPasswordPage />, { route, path: "/reset-password", locale, auth: { user: null, status: "guest" } });

describe("ResetPasswordPage", () => {
  it("sets the new password with the link's token", async () => {
    api.resetPassword.mockResolvedValue({ success: true });
    const { user } = render("/reset-password?token=abc123");
    await user.type(screen.getByLabelText("New password"), "FreshPass!2026");
    await user.type(screen.getByLabelText("Confirm password"), "FreshPass!2026");
    await user.click(screen.getByRole("button", { name: "Save new password" }));
    await waitFor(() => expect(api.resetPassword).toHaveBeenCalledWith("abc123", "FreshPass!2026"));
    expect(await screen.findByRole("status")).toHaveTextContent("Your password has been changed");
  });

  it("lists the unmet rules in Arabic and refuses a weak password before asking the server", async () => {
    const { user } = render("/reset-password?token=abc123", "ar");
    await user.type(screen.getByLabelText("كلمة المرور الجديدة"), "short");
    expect(screen.getByText("حرف كبير واحد على الأقل (A–Z)")).toBeInTheDocument();
    await user.type(screen.getByLabelText("تأكيد كلمة المرور"), "short");
    await user.click(screen.getByRole("button", { name: "حفظ كلمة المرور الجديدة" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("لا تستوفي");
    expect(api.resetPassword).not.toHaveBeenCalled();
  });

  it("sends an expired or used link back to ask for a new one", async () => {
    api.resetPassword.mockRejectedValue(new ApiError("Invalid", 400, "INVALID_RESET_TOKEN", {}));
    const { user } = render("/reset-password?token=old");
    await user.type(screen.getByLabelText("New password"), "FreshPass!2026");
    await user.type(screen.getByLabelText("Confirm password"), "FreshPass!2026");
    await user.click(screen.getByRole("button", { name: "Save new password" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("expired or was already used");
    expect(screen.getByRole("link", { name: "Ask for a new link" })).toHaveAttribute("href", "/forgot-password");
  });

  it("says a link without a token isn't valid", () => {
    render("/reset-password");
    expect(screen.getByRole("alert")).toHaveTextContent("isn't valid");
  });
});
