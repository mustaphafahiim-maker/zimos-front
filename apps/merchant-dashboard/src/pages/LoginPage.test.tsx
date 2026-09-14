import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { ApiError } from "@store-builder/api-client";
import type { Locale } from "@/i18n/LocaleContext";
import { authMock } from "@/test/mocks";
import { currentPath, renderWithProviders } from "@/test/renderWithProviders";
import { LoginPage } from "./LoginPage";

function renderLogin(locale: Locale = "en") {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<p>Dashboard home</p>} />
    </Routes>,
    { route: "/login", locale, auth: { user: null, status: "guest" } }
  );
}

describe("LoginPage", () => {
  it("renders in English, left-to-right", async () => {
    renderLogin("en");
    expect(screen.getByText("Welcome back")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.dir).toBe("ltr"));
    expect(document.documentElement.lang).toBe("en");
  });

  it("renders in Arabic and flips the document to RTL", async () => {
    renderLogin("ar");
    expect(screen.getByText("مرحبًا بعودتك")).toBeInTheDocument();
    expect(screen.getByLabelText("البريد الإلكتروني")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "تسجيل الدخول" })).toBeInTheDocument();
    await waitFor(() => expect(document.documentElement.dir).toBe("rtl"));
    expect(document.documentElement.lang).toBe("ar");
  });

  it("signs in with the typed credentials and shows a clear message on 401", async () => {
    authMock.login.mockRejectedValueOnce(new ApiError("Unauthorized", 401, "UNAUTHORIZED"));
    const { user } = renderLogin();

    await user.type(screen.getByLabelText("Email"), "owner@nile.test");
    await user.type(screen.getByLabelText("Password"), "wrong-pass-1");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Incorrect email or password.")).toBeInTheDocument();
    expect(authMock.login).toHaveBeenCalledWith({ email: "owner@nile.test", password: "wrong-pass-1" });
    expect(currentPath()).toBe("/login");
  });

  it("shows the Arabic error message in Arabic", async () => {
    authMock.login.mockRejectedValueOnce(new ApiError("Unauthorized", 401));
    const { user } = renderLogin("ar");
    await user.type(screen.getByLabelText("البريد الإلكتروني"), "owner@nile.test");
    await user.type(screen.getByLabelText("كلمة المرور"), "wrong-pass-1");
    await user.click(screen.getByRole("button", { name: "تسجيل الدخول" }));
    expect(await screen.findByText("البريد الإلكتروني أو كلمة المرور غير صحيحة.")).toBeInTheDocument();
  });

  it("goes to the dashboard after a successful sign-in", async () => {
    const { user } = renderLogin();
    await user.type(screen.getByLabelText("Email"), "owner@nile.test");
    await user.type(screen.getByLabelText("Password"), "Correct-pass-1");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Dashboard home")).toBeInTheDocument();
    expect(currentPath()).toBe("/");
  });
});
