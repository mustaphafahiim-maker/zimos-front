import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { ApiError, type UpdateWorkspacePayload, type Workspace } from "@store-builder/api-client";
import { api, fake, workspaceMock, type ListedWorkspace } from "@/test/mocks";
import { saveThemeSettingsPatch, useSaveThemeSettings } from "./themeSettingsSave";

/** This tab's copy, as the workspace context loaded it. */
function loadedInThisTab(themeSettings: Record<string, unknown>) {
  workspaceMock.currentWorkspace = fake<Workspace>({ id: "ws_1", name: "Nile Store", role: "owner", themeSettings });
}

/** What GET /workspaces returns now. */
function onServer(themeSettings: unknown) {
  api.listWorkspaces.mockResolvedValue([
    fake<ListedWorkspace>({ id: "ws_other", name: "Other Store", themeSettings: {} }),
    fake<ListedWorkspace>({ id: "ws_1", name: "Nile Store", role: "owner", themeSettings }),
  ]);
}

/**
 * The workspace endpoints as the backend behaves: GET /workspaces reads the
 * stored row, PATCH stores `themeSettings` exactly as sent and replies with
 * the row (no `role`).
 */
function fakeBackend(initial: Record<string, unknown>) {
  let row = { id: "ws_1", name: "Nile Store", themeSettings: initial };
  api.listWorkspaces.mockImplementation(async () => [
    fake<ListedWorkspace>({ ...row, role: "owner", themeSettings: structuredClone(row.themeSettings) }),
  ]);
  api.updateWorkspace.mockImplementation(async (_id: string, payload: UpdateWorkspacePayload) => {
    row = { ...row, ...payload, themeSettings: payload.themeSettings ?? row.themeSettings };
    return fake<Workspace>(structuredClone(row));
  });
  return { stored: () => row.themeSettings };
}

function renderSave() {
  return renderHook(() => useSaveThemeSettings()).result.current;
}

describe("useSaveThemeSettings", () => {
  it("builds the save on the server's copy, not the one this tab loaded", async () => {
    loadedInThisTab({ primaryColor: "#1E40AF" });
    onServer({ primaryColor: "#BE123C", storeTheme: "bold", productCountdownHours: 6 });
    api.updateWorkspace.mockResolvedValue(fake<Workspace>({ id: "ws_1" }));
    const build = vi.fn((current: Record<string, unknown>) => ({ themeSettings: { ...current, fontFamily: "modern" } }));

    await renderSave()(build);

    expect(build).toHaveBeenCalledWith({ primaryColor: "#BE123C", storeTheme: "bold", productCountdownHours: 6 });
    expect(api.updateWorkspace).toHaveBeenCalledWith("ws_1", {
      themeSettings: { primaryColor: "#BE123C", storeTheme: "bold", productCountdownHours: 6, fontFamily: "modern" },
    });
  });

  it("keeps what another tab saved after this one loaded", async () => {
    const backend = fakeBackend({ primaryColor: "#1F5D5B" });
    // Both tabs open on the same store.
    loadedInThisTab({ primaryColor: "#1F5D5B" });

    // The other tab (the theme gallery) saves a theme...
    await saveThemeSettingsPatch("ws_1", (current) => ({ themeSettings: { ...current, storeTheme: "glass" } }));
    expect(backend.stored()).toEqual({ primaryColor: "#1F5D5B", storeTheme: "glass" });

    // ...then this tab, still holding the old copy, saves its colours (Settings).
    await renderSave()((current) => ({
      name: "Nile Store",
      themeSettings: { ...current, primaryColor: "#6D28D9", secondaryColor: "#EC4899" },
    }));

    // Merged onto the stale copy, the theme would be gone.
    expect(backend.stored()).toEqual({ primaryColor: "#6D28D9", secondaryColor: "#EC4899", storeTheme: "glass" });
  });

  it("puts the server's reply into the context, not the payload it sent", async () => {
    loadedInThisTab({});
    onServer({});
    const reply = fake<Workspace>({
      id: "ws_1",
      name: "Nile Store",
      themeSettings: { storeTheme: "warm" },
      updatedAt: "2026-09-29T10:00:00.000Z",
    });
    api.updateWorkspace.mockResolvedValue(reply);

    const saved = await renderSave()((current) => ({ themeSettings: { ...current, storeTheme: "warm" } }));

    expect(saved).toBe(reply);
    expect(workspaceMock.applySavedWorkspace).toHaveBeenCalledTimes(1);
    expect(workspaceMock.applySavedWorkspace).toHaveBeenCalledWith(reply);
    expect(workspaceMock.refresh).not.toHaveBeenCalled();
  });

  it("sends nothing when, on the server's copy, there is nothing to save", async () => {
    loadedInThisTab({});
    onServer({ primaryColor: "#BE123C" });

    const saved = await renderSave()(() => null);

    expect(saved).toBeNull();
    expect(api.updateWorkspace).not.toHaveBeenCalled();
    expect(workspaceMock.applySavedWorkspace).not.toHaveBeenCalled();
  });

  describe("refuses, sending nothing, without the server's copy", () => {
    it("when it can't be loaded", async () => {
      loadedInThisTab({ primaryColor: "#1E40AF" });
      api.listWorkspaces.mockRejectedValue(new TypeError("Failed to fetch"));
      const build = vi.fn();

      await expect(renderSave()(build)).rejects.toThrow(
        "Couldn't load your store's latest settings, so nothing was saved. Check your connection and try again."
      );
      expect(build).not.toHaveBeenCalled();
      expect(api.updateWorkspace).not.toHaveBeenCalled();
      expect(workspaceMock.applySavedWorkspace).not.toHaveBeenCalled();
    });

    it("when the store is gone from the account", async () => {
      loadedInThisTab({ primaryColor: "#1E40AF" });
      api.listWorkspaces.mockResolvedValue([fake<ListedWorkspace>({ id: "ws_other", themeSettings: {} })]);

      await expect(renderSave()(vi.fn())).rejects.toThrow(
        "This store is no longer available to your account, so nothing was saved."
      );
      expect(api.updateWorkspace).not.toHaveBeenCalled();
    });

    it("when the store's settings don't come back as an object", async () => {
      loadedInThisTab({ primaryColor: "#1E40AF" });
      onServer(undefined);
      const build = vi.fn();

      await expect(renderSave()(build)).rejects.toThrow("Couldn't load your store's latest settings");
      expect(build).not.toHaveBeenCalled();
      expect(api.updateWorkspace).not.toHaveBeenCalled();
    });

    it("when this tab has no store loaded", async () => {
      workspaceMock.currentWorkspace = null;
      const build = vi.fn();

      await expect(renderSave()(build)).rejects.toThrow(
        "No store is selected, so nothing was saved. Reload the page and try again."
      );
      expect(api.listWorkspaces).not.toHaveBeenCalled();
      expect(api.updateWorkspace).not.toHaveBeenCalled();
    });

    it("when called with no store id", async () => {
      await expect(saveThemeSettingsPatch("", vi.fn())).rejects.toThrow("No store is selected");
      expect(api.listWorkspaces).not.toHaveBeenCalled();
    });
  });

  it("passes a refused save through untouched, so screens still show its field errors", async () => {
    loadedInThisTab({});
    onServer({});
    const tooLarge = new ApiError("themeSettings is too large", 422, "VALIDATION_ERROR");
    api.updateWorkspace.mockRejectedValue(tooLarge);

    await expect(renderSave()((current) => ({ themeSettings: current }))).rejects.toBe(tooLarge);
    expect(workspaceMock.applySavedWorkspace).not.toHaveBeenCalled();
  });
});
