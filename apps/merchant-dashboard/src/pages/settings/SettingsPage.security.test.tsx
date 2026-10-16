import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { api } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SettingsPage } from "./SettingsPage";

// The switch is a build constant; the tests turn it on and off.
const flags = vi.hoisted(() => ({ twoFactor: false }));
vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  get TWO_FACTOR_ENABLED() {
    return flags.twoFactor;
  },
}));

describe("Settings and the Security section", () => {
  it("has no Security section and asks the API nothing about it while the switch is off", async () => {
    flags.twoFactor = false;
    // A link to the section of a switch that is off lands on the first section.
    renderWithProviders(<SettingsPage />, { route: "/settings?tab=security" });
    expect(await screen.findByRole("heading", { name: "Store profile" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Security" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Security/ })).not.toBeInTheDocument();
    expect(api.request.mock.calls.filter(([path]) => String(path).startsWith("/auth/two-factor"))).toEqual([]);
  });

  it("shows the Security section and reads the second step while the switch is on", async () => {
    flags.twoFactor = true;
    renderWithProviders(<SettingsPage />, { route: "/settings?tab=security" });
    expect(await screen.findByRole("heading", { name: "Security" })).toBeInTheDocument();
    await waitFor(() => expect(api.request).toHaveBeenCalledWith("/auth/two-factor"));
  });
});
