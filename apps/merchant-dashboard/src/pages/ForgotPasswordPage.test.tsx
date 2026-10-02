import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { ApiError } from "@store-builder/api-client";
import { api } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { ForgotPasswordPage } from "./ForgotPasswordPage";

const render = (locale: "en" | "ar" = "en") =>
  renderWithProviders(<ForgotPasswordPage />, { route: "/forgot-password", path: "/forgot-password", locale, auth: { user: null, status: "guest" } });

describe("ForgotPasswordPage", () => {
  it("sends the email in the dashboard's language and shows the same notice whatever the address", async () => {
    api.requestPasswordReset.mockResolvedValue({ success: true });
    const { user } = render("ar");
    await user.type(screen.getByLabelText("البريد الإلكتروني"), " someone@example.com ");
    await user.click(screen.getByRole("button", { name: "إرسال رابط إعادة التعيين" }));
    await waitFor(() => expect(api.requestPasswordReset).toHaveBeenCalledWith("someone@example.com", "ar"));
    expect(await screen.findByRole("status")).toHaveTextContent("إذا كان هناك حساب بهذا البريد الإلكتروني");
    expect(screen.getByRole("link", { name: "العودة إلى تسجيل الدخول" })).toHaveAttribute("href", "/login");
  });

  it("explains the per-IP limit and an unavailable reset", async () => {
    api.requestPasswordReset.mockRejectedValueOnce(new ApiError("Too many", 429, "RATE_LIMITED", {}));
    const { user } = render();
    await user.type(screen.getByLabelText("Email"), "a@example.com");
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Try again in an hour");

    api.requestPasswordReset.mockRejectedValueOnce(new ApiError("No", 503, "PASSWORD_RESET_UNAVAILABLE", {}));
    await user.click(screen.getByRole("button", { name: "Send reset link" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("isn't available right now"));
  });
});
