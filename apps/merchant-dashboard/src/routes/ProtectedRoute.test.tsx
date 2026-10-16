import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { currentPath, renderWithProviders } from "@/test/renderWithProviders";
import { authMock } from "@/test/mocks";
import { ProtectedRoute } from "./ProtectedRoute";

describe("a page load that couldn't read the account", () => {
  it("offers to try again instead of signing out", async () => {
    const { user } = renderWithProviders(<ProtectedRoute />, { auth: { status: "unavailable", user: null } });

    expect(screen.getByRole("alert")).toHaveTextContent("We couldn't load your account");
    expect(screen.getByText(/You're still signed in/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Try again" }));

    expect(authMock.retry).toHaveBeenCalledTimes(1);
    expect(authMock.logout).not.toHaveBeenCalled();
  });

  it("in Arabic, with signing out still behind the confirmation", async () => {
    const { user } = renderWithProviders(<ProtectedRoute />, { auth: { status: "unavailable", user: null }, locale: "ar" });

    expect(screen.getByRole("alert")).toHaveTextContent("تعذّر تحميل حسابك");
    await user.click(screen.getByRole("button", { name: "تسجيل الخروج" }));

    expect(screen.getByRole("alertdialog", { name: "تسجيل الخروج؟" })).toBeInTheDocument();
    expect(authMock.logout).not.toHaveBeenCalled();
  });

  it("a guest still goes to the sign-in page", () => {
    renderWithProviders(<ProtectedRoute />, { auth: { status: "guest", user: null }, route: "/orders", path: "/orders" });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(currentPath()).toBe("/login");
  });
});
