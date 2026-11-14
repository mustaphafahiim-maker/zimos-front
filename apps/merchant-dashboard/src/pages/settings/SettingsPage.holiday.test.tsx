import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SettingsPage } from "./SettingsPage";

// The switch is a build constant; the tests turn it on and off.
const flags = vi.hoisted(() => ({ holiday: false }));
vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  get HOLIDAY_MODE_ENABLED() {
    return flags.holiday;
  },
}));

describe("Settings and holiday mode", () => {
  it("has no holiday section and never reads it while the switch is off", async () => {
    flags.holiday = false;
    const calls = fakeBackend({});
    // A link to the section of a switch that is off lands on the first section, and asks nothing.
    renderWithProviders(<SettingsPage />, { route: "/settings?tab=holiday" });
    expect(await screen.findByRole("heading", { name: "Store profile" })).toBeInTheDocument();
    expect(screen.queryByText("Holiday mode")).not.toBeInTheDocument();
    expect(callsTo(calls, "GET", "/holiday-mode")).toHaveLength(0);
  });

  it("shows the holiday section and reads it while the switch is on", async () => {
    flags.holiday = true;
    const calls = fakeBackend({
      "GET /holiday-mode": { enabled: false, mode: "pause", from: null, until: null, shipsFrom: null, message: null, activeNow: false },
    });
    renderWithProviders(<SettingsPage />, { route: "/settings?tab=holiday" });
    expect(screen.getByRole("button", { name: /Holiday mode/ })).toHaveAttribute("aria-current", "page");
    expect(await screen.findByRole("switch", { name: /Turn on holiday mode/ })).toBeInTheDocument();
    await waitFor(() => expect(callsTo(calls, "GET", "/workspaces/ws_1/holiday-mode")).toHaveLength(1));
  });
});
