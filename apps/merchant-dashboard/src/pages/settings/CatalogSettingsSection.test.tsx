import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import type { Workspace } from "@store-builder/api-client";
import { api, fake, workspaceMock } from "@/test/mocks";
import { renderWithProviders } from "@/test/renderWithProviders";
import { CatalogSettingsSection } from "./CatalogSettingsSection";

describe("CatalogSettingsSection", () => {
  it("saves the sidebar, the default sort and the chosen filters in their order", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", role: "owner", settings: {} });
    api.listCatalogOptionNames.mockResolvedValue([{ name: "Size", productCount: 4 }]);
    api.updateWorkspace.mockImplementation(async (_id, payload) =>
      fake<Workspace>({ id: "ws_1", settings: { storefront_catalog: payload.settings?.storefront_catalog } })
    );
    const { user } = renderWithProviders(<CatalogSettingsSection />);

    // Defaults: collections, price, all options, tags — shown in that order.
    const size = await screen.findByRole("checkbox", { name: "Option: Size" });
    expect(size).not.toBeChecked();
    await user.click(size);
    await user.click(screen.getByRole("checkbox", { name: "Tags" }));
    await user.click(screen.getByRole("button", { name: "Move Price up" }));
    await user.selectOptions(screen.getByLabelText("Sort products by default by"), "price_asc");
    await user.click(screen.getByRole("button", { name: "Save listing settings" }));

    await waitFor(() =>
      expect(api.updateWorkspace).toHaveBeenCalledWith("ws_1", {
        settings: {
          storefront_catalog: {
            sidebar_enabled: true,
            default_sort: "price_asc",
            filters: [{ key: "price" }, { key: "collections" }, { key: "options" }, { key: "option", name: "Size" }],
          },
        },
      })
    );
  });

  it("is read-only for a role that cannot edit the website", async () => {
    workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", role: "confirmation_agent", settings: {} });
    api.listCatalogOptionNames.mockResolvedValue([]);
    renderWithProviders(<CatalogSettingsSection />);
    expect(await screen.findByText(/Only the store owner/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save listing settings" })).not.toBeInTheDocument();
  });
});
