import { describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { callsTo, fakeBackend } from "@/test/fakeBackend";
import { renderWithProviders } from "@/test/renderWithProviders";
import { StoreDesignPage } from "./StoreDesignPage";

// The page builds its tab list once from the switches: this file runs with both on.
vi.mock("@/lib/features", async (original) => ({
  ...(await original<typeof import("@/lib/features")>()),
  GIFT_OPTIONS_ENABLED: true,
  URL_REDIRECTS_ENABLED: true,
}));

describe("Store settings with gift options and redirects switched on", () => {
  it("opens the Redirects tab and reads the redirects of the store", async () => {
    const calls = fakeBackend({ "GET /redirects": { redirects: [], total: 0 } });
    renderWithProviders(<StoreDesignPage />, { route: "/store-settings/redirects", path: "/store-settings/:tab" });
    const tab = (await screen.findAllByRole("button", { name: "Redirects" }))[0];
    expect(tab).toHaveAttribute("aria-pressed", "true");
    await waitFor(() => expect(callsTo(calls, "GET", "/workspaces/ws_1/redirects").length).toBeGreaterThan(0));
    expect(await screen.findByText("No redirects yet")).toBeInTheDocument();
  });

  it("opens the Gift options tab and reads the gift options of the store", async () => {
    const calls = fakeBackend({ "GET /gift-options": { enabled: false, wrapVariantId: null, messageMaxLength: 300 } });
    renderWithProviders(<StoreDesignPage />, { route: "/store-settings/gift-options", path: "/store-settings/:tab" });
    expect(await screen.findByRole("switch", { name: /Offer gift options at checkout/ })).toBeInTheDocument();
    expect(callsTo(calls, "GET", "/workspaces/ws_1/gift-options")).toHaveLength(1);
  });

  it("names both tabs in formal Arabic", async () => {
    fakeBackend({});
    renderWithProviders(<StoreDesignPage />, { route: "/store-settings", path: "/store-settings", locale: "ar" });
    const tabs = await screen.findByRole("group", { name: "أقسام إعدادات المتجر" });
    expect(tabs).toHaveTextContent("خيارات الهدايا");
    expect(tabs).toHaveTextContent("تحويل الروابط");
  });
});
