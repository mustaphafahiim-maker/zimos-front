import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { TranslationsOverview, Workspace } from "@store-builder/api-client";
import { api, fake, workspaceMock, type ListedWorkspace } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { LanguagesTab } from "./LanguagesTab";

/**
 * Languages → "Shoppers' language": the language the store opens in and the
 * language button, saved in themeSettings.shopperDisplay (read by the
 * storefront's lib/shopperDisplay and by the API).
 */

const OVERVIEW: TranslationsOverview = {
  defaultLocale: "ar",
  available: ["ar", "en"],
  totalFields: 0,
  languages: [{ locale: "ar", isDefault: true, translatedFields: 0, percent: 100 }],
};

/** The store as this tab loaded it, and as the server holds it when a save reads it again. */
function setup(loaded: Record<string, unknown>, onServer: Record<string, unknown> = loaded) {
  workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", themeSettings: loaded });
  api.request.mockImplementation(async (path: string) => {
    if (path.endsWith("/translations/overview")) return OVERVIEW;
    throw new Error(`Unexpected request ${path}`);
  });
  api.listWorkspaces.mockResolvedValue([fake<ListedWorkspace>({ id: "ws_1", themeSettings: onServer })]);
  api.updateWorkspace.mockImplementation(async (_id, payload) => fake<Workspace>({ id: "ws_1", ...payload }));
  return renderWithProviders(<LanguagesTab />);
}

const opensIn = () => screen.findByRole("radiogroup", { name: "Store opens in" });
const button = () => screen.getByRole("checkbox", { name: /Show the language button/ });

describe("Languages: shoppers' language", () => {
  it("reads a store that never chose as Arabic, with no button", async () => {
    setup({});
    expect(within(await opensIn()).getByRole("radio", { name: "Arabic" })).toHaveAttribute("aria-checked", "true");
    expect(button()).not.toBeChecked();
  });

  it("shows what the store saved", async () => {
    setup({ shopperDisplay: { locale: "en", localeSwitch: true } });
    expect(within(await opensIn()).getByRole("radio", { name: "English" })).toHaveAttribute("aria-checked", "true");
    expect(button()).toBeChecked();
  });

  it("switches the button on, on the server's latest settings", async () => {
    // Saved from another screen after this one loaded: it must survive.
    const { user } = setup({ xsLook: "01" }, { xsLook: "01", productCountdownHours: 6 });
    await opensIn();

    await user.click(button());

    await waitFor(() => expect(api.updateWorkspace).toHaveBeenCalledTimes(1));
    expect(api.updateWorkspace).toHaveBeenCalledWith("ws_1", {
      themeSettings: { xsLook: "01", productCountdownHours: 6, shopperDisplay: { locale: "ar", localeSwitch: true } },
    });
    expect(workspaceMock.applySavedWorkspace).toHaveBeenCalled();
  });

  it("opens the store in English, keeping the rest of the setting", async () => {
    const saved = { shopperDisplay: { localeSwitch: true, colorMode: "dark" } };
    const { user } = setup(saved);

    await user.click(within(await opensIn()).getByRole("radio", { name: "English" }));

    await waitFor(() => expect(api.updateWorkspace).toHaveBeenCalledTimes(1));
    expect(api.updateWorkspace).toHaveBeenCalledWith("ws_1", {
      themeSettings: { shopperDisplay: { localeSwitch: true, colorMode: "dark", locale: "en" } },
    });
  });

  it("says where the switch is for a store on its own header", async () => {
    setup({});
    await opensIn();
    expect(button()).toHaveAccessibleName(/website editor → Header/);
  });
});
