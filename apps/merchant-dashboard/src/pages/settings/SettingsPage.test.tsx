import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import type { Workspace } from "@store-builder/api-client";
import { api, fake, workspaceMock, type ListedWorkspace } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { SettingsPage } from "./SettingsPage";

function profileSection() {
  return screen.getByRole("heading", { name: "Store profile" }).closest("section")!;
}

describe("SettingsPage store profile", () => {
  it("saves the profile and colours onto the store's latest themeSettings", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({
      id: "ws_1",
      name: "Nile Store",
      tagline: null,
      logoUrl: null,
      themeSettings: { primaryColor: "#1F5D5B", secondaryColor: "#E2A33D" },
    });
    // A theme saved from another tab after this one loaded.
    api.listWorkspaces.mockResolvedValue([
      fake<ListedWorkspace>({ id: "ws_1", themeSettings: { primaryColor: "#1F5D5B", secondaryColor: "#E2A33D", storeTheme: "glass" } }),
    ]);
    const saved = fake<Workspace>({ id: "ws_1", name: "Nile Store" });
    api.updateWorkspace.mockResolvedValue(saved);
    const { user } = renderWithProviders(<SettingsPage />);

    await user.click(within(profileSection()).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.updateWorkspace).toHaveBeenCalledTimes(1));
    expect(api.updateWorkspace).toHaveBeenCalledWith("ws_1", {
      name: "Nile Store",
      tagline: null,
      logoUrl: null,
      themeSettings: { primaryColor: "#1F5D5B", secondaryColor: "#E2A33D", storeTheme: "glass" },
    });
    expect(workspaceMock.applySavedWorkspace).toHaveBeenCalledWith(saved);
    expect(await screen.findByText("Store profile saved.")).toBeInTheDocument();
  });

  it("never writes the default colours over a store theme when only the name changes", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({
      id: "ws_1",
      name: "Nile Store",
      tagline: null,
      logoUrl: null,
      themeSettings: { storeTheme: "warm" },
    });
    api.listWorkspaces.mockResolvedValue([fake<ListedWorkspace>({ id: "ws_1", themeSettings: { storeTheme: "warm" } })]);
    api.updateWorkspace.mockResolvedValue(fake<Workspace>({ id: "ws_1", name: "Nile Store" }));
    const { user } = renderWithProviders(<SettingsPage />);

    await user.click(within(profileSection()).getByRole("button", { name: "Save" }));

    await waitFor(() => expect(api.updateWorkspace).toHaveBeenCalledTimes(1));
    expect(api.updateWorkspace).toHaveBeenCalledWith("ws_1", {
      name: "Nile Store",
      tagline: null,
      logoUrl: null,
      themeSettings: { storeTheme: "warm" },
    });
  });

  it("saves nothing, and says why, when the store is gone from the account", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", themeSettings: {} });
    api.listWorkspaces.mockResolvedValue([]);
    const { user } = renderWithProviders(<SettingsPage />);

    await user.click(within(profileSection()).getByRole("button", { name: "Save" }));

    expect(
      await within(profileSection()).findByText("This store is no longer available to your account, so nothing was saved.")
    ).toBeInTheDocument();
    expect(api.updateWorkspace).not.toHaveBeenCalled();
  });
});
