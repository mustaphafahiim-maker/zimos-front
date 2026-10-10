import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type { HolidayModeSettings, Workspace } from "@store-builder/api-client";
import { fake } from "@/test/mocks";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { HolidayModeSection } from "./HolidayModeSection";

const off: HolidayModeSettings = { enabled: false, mode: "pause", from: null, until: null, shipsFrom: null, message: null, activeNow: false };

describe("HolidayModeSection", () => {
  it("shows holiday mode off, as the store has it", async () => {
    const calls = fakeBackend({ "GET /holiday-mode": off });
    renderWithProviders(<HolidayModeSection />);
    const toggle = await screen.findByRole("switch", { name: /Turn on holiday mode/ });
    expect(toggle).toHaveAttribute("aria-checked", "false");
    expect(screen.getByText("Off: the store takes orders as usual.")).toBeInTheDocument();
    expect(callsTo(calls, "GET", "/workspaces/ws_1/holiday-mode")).toHaveLength(1);
    expect(callsTo(calls, "PUT", "/holiday-mode")).toHaveLength(0);
  });

  it("turns it on to pause orders and saves", async () => {
    const calls = fakeBackend({
      "GET /holiday-mode": off,
      "PUT /holiday-mode": { ...off, enabled: true, activeNow: true },
    });
    const { user } = renderWithProviders(<HolidayModeSection />);
    await user.click(await screen.findByRole("switch", { name: /Turn on holiday mode/ }));
    await user.click(await screen.findByRole("button", { name: "Save" }));

    await waitFor(() => expect(callsTo(calls, "PUT", "/workspaces/ws_1/holiday-mode")).toHaveLength(1));
    expect(callsTo(calls, "PUT", "/holiday-mode")[0].body).toMatchObject({ enabled: true, mode: "pause", from: null, until: null, shipsFrom: null, message: null });
    expect(await screen.findByText("Saved. The store shows the change right away.")).toBeInTheDocument();
  });

  it("shows a running holiday that takes orders and ships later", async () => {
    fakeBackend({
      "GET /holiday-mode": { ...off, enabled: true, mode: "delay", activeNow: true, message: { en: "Back on 11 October." } },
    });
    renderWithProviders(<HolidayModeSection />);
    expect(await screen.findByRole("switch", { name: /Turn on holiday mode/ })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("On now")).toBeInTheDocument();
    expect(screen.getByLabelText(/Take orders, ship later/)).toBeChecked();
    expect(screen.getByDisplayValue("Back on 11 October.")).toBeInTheDocument();
  });

  it("is read-only for a role without the store settings permission", async () => {
    fakeBackend({ "GET /holiday-mode": off });
    renderWithProviders(<HolidayModeSection />, {
      workspace: { currentWorkspace: fake<Workspace>({ id: "ws_1", name: "Nile Store", role: "order_operator" }) },
    });
    expect(await screen.findByText("Changing holiday mode needs the store settings permission. Ask the store owner.")).toBeInTheDocument();
  });

  it("reads in formal Arabic", async () => {
    fakeBackend({ "GET /holiday-mode": off });
    renderWithProviders(<HolidayModeSection />, { locale: "ar" });
    expect(await screen.findByRole("switch", { name: /تفعيل وضع الإجازة/ })).toBeInTheDocument();
    expect(screen.getByText("متوقف: يستقبل المتجر الطلبات كالمعتاد.")).toBeInTheDocument();
  });
});
