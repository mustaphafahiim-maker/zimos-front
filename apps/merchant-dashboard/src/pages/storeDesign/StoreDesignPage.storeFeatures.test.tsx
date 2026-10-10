import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { StoreDesignPage } from "./StoreDesignPage";

describe("Store settings while the ported features are off", () => {
  it("has no Gift options or Redirects tab", async () => {
    fakeBackend({});
    renderWithProviders(<StoreDesignPage />, { route: "/store-settings", path: "/store-settings" });
    const tabs = await screen.findByRole("group", { name: "Store settings sections" });
    expect(tabs).toHaveTextContent("General");
    expect(tabs).not.toHaveTextContent("Gift options");
    expect(tabs).not.toHaveTextContent("Redirects");
  });

  it("opens General for a tab that is switched off, and asks the API nothing about it", async () => {
    const calls = fakeBackend({});
    renderWithProviders(<StoreDesignPage />, { route: "/store-settings/redirects", path: "/store-settings/:tab" });
    const general = (await screen.findAllByRole("button", { name: "General" }))[0];
    expect(general).toHaveAttribute("aria-pressed", "true");
    expect(callsTo(calls, "GET", "/redirects")).toHaveLength(0);
    expect(callsTo(calls, "GET", "/gift-options")).toHaveLength(0);
  });
});
