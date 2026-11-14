import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { ApiError } from "@store-builder/api-client";
import { authMock } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { LoginPage } from "./LoginPage";

describe("LoginPage", () => {
  it("signs in with an email or a username in one field", async () => {
    const { user } = renderWithProviders(<LoginPage />, { route: "/login", path: "/login", auth: { user: null, status: "guest" } });
    const field = screen.getByLabelText("Email or username");
    expect(field).toHaveAttribute("type", "text");
    expect(field).toHaveAttribute("autocomplete", "username");
    await user.type(field, "  shop.owner ");
    await user.type(screen.getByLabelText("Password"), "Passw0rd!123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() =>
      expect(authMock.login).toHaveBeenCalledWith({ identifier: "shop.owner", password: "Passw0rd!123", locale: "en" })
    );
  });

  it("gives one message for any wrong sign-in, in Arabic too", async () => {
    authMock.login.mockRejectedValue(new ApiError("Invalid sign-in details", 401, "INVALID_CREDENTIALS", {}));
    const { user } = renderWithProviders(<LoginPage />, { route: "/login", path: "/login", locale: "ar", auth: { user: null, status: "guest" } });
    await user.type(screen.getByLabelText("البريد الإلكتروني أو اسم المستخدم"), "nobody");
    await user.type(screen.getByLabelText("كلمة المرور"), "x");
    await user.click(screen.getByRole("button", { name: "تسجيل الدخول" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("البريد الإلكتروني أو اسم المستخدم أو كلمة المرور غير صحيحة.");
  });
});
