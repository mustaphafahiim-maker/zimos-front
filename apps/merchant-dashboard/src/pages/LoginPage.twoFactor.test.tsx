import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { TwoFactorRequiredError, type TwoFactorChallenge } from "@store-builder/api-client";
import { api, authMock } from "@/test/mocks";
import { currentPath, renderWithProviders } from "@/test/renderWithProviders";
import { LoginPage } from "./LoginPage";

// The switch is a build constant; the tests turn it on and off.
const flags = vi.hoisted(() => ({ twoFactor: false }));
vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  get TWO_FACTOR_ENABLED() {
    return flags.twoFactor;
  },
}));

const challenge: TwoFactorChallenge = { twoFactorRequired: true, challengeToken: "c1", channel: "email", sentTo: "o***@zimos.test" };

async function signIn(user: ReturnType<typeof renderWithProviders>["user"]) {
  await user.type(screen.getByLabelText("Email or username"), "owner@zimos.test");
  await user.type(screen.getByLabelText("Password"), "Passw0rd!123");
  await user.click(screen.getByRole("button", { name: "Sign in" }));
}

describe("LoginPage and two-step sign-in", () => {
  it("asks for the code when the account has a second step, then goes on", async () => {
    flags.twoFactor = true;
    authMock.login.mockRejectedValue(new TwoFactorRequiredError(challenge));
    api.request.mockResolvedValue({ user: { id: "user_1" }, accessToken: "a", refreshToken: "r" });
    const { user } = renderWithProviders(<LoginPage />, { route: "/login", path: "/login", auth: { user: null, status: "guest" } });
    await signIn(user);

    expect(await screen.findByRole("heading", { name: "One more step" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Password")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Code"), "123456");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => expect(authMock.refreshUser).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(currentPath()).toBe("/"));
  });

  it("comes back to an empty password from the code step", async () => {
    flags.twoFactor = true;
    authMock.login.mockRejectedValue(new TwoFactorRequiredError(challenge));
    const { user } = renderWithProviders(<LoginPage />, { route: "/login", path: "/login", auth: { user: null, status: "guest" } });
    await signIn(user);
    await user.click(await screen.findByRole("button", { name: "Back to sign in" }));
    expect(screen.getByLabelText("Password")).toHaveValue("");
    expect(screen.getByLabelText("Email or username")).toHaveValue("owner@zimos.test");
  });

  it("shows no code step while the switch is off", async () => {
    flags.twoFactor = false;
    authMock.login.mockRejectedValue(new TwoFactorRequiredError(challenge));
    const { user } = renderWithProviders(<LoginPage />, { route: "/login", path: "/login", auth: { user: null, status: "guest" } });
    await signIn(user);
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong. Please try again.");
    expect(screen.queryByRole("heading", { name: "One more step" })).not.toBeInTheDocument();
    expect(api.request).not.toHaveBeenCalled();
  });
});
