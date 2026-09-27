import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { authMock } from "@/test/mocks";
import { currentPath, renderWithProviders } from "@/test/renderWithProviders";
import AuthSwitch from "./auth-switch";

describe("AuthSwitch", () => {
  it("signs in with the real auth context and goes home", async () => {
    authMock.login.mockResolvedValue(undefined);
    const { user } = renderWithProviders(<AuthSwitch initialMode="signin" />, { route: "/login" });

    await user.type(screen.getByLabelText("Email", { selector: "#signin-email" }), "demo@zimos.test");
    await user.type(screen.getByLabelText("Password", { selector: "#signin-password" }), "Secret!123");
    // The panel has a "Sign in" switch button too; submit the form's own.
    await user.click(screen.getAllByRole("button", { name: "Sign in" }).find((b) => b.getAttribute("type") === "submit")!);

    await waitFor(() => expect(authMock.login).toHaveBeenCalledWith({ email: "demo@zimos.test", password: "Secret!123" }));
    // navigate() runs after login resolves — a tick later than the call itself.
    await waitFor(() => expect(currentPath()).toBe("/"));
  });

  it("switches to sign-up, keeps the URL truthful, and blocks a weak password before calling the API", async () => {
    const { user } = renderWithProviders(<AuthSwitch initialMode="signin" />, { route: "/login" });

    await user.click(screen.getByRole("button", { name: "Sign up" }));
    expect(currentPath()).toBe("/register");

    await user.type(screen.getByLabelText("Full name"), "Mona Ali");
    await user.type(screen.getByLabelText("Email", { selector: "#signup-email" }), "mona@zimos.test");
    await user.type(screen.getByLabelText("Password", { selector: "#signup-password" }), "weak");
    await user.type(screen.getByLabelText("Confirm password"), "weak");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(screen.getByText(/missing a few requirements/)).toBeInTheDocument();
    expect(authMock.register).not.toHaveBeenCalled();
  });

  it("speaks Arabic", async () => {
    renderWithProviders(<AuthSwitch initialMode="signup" />, { route: "/register", locale: "ar" });
    expect(screen.getByRole("heading", { name: "اعمل حسابك" })).toBeInTheDocument();
  });
});
