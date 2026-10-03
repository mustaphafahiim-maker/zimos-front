import type { UpdateWorkspacePayload, Workspace } from "@store-builder/api-client";
import { useWorkspace } from "@/context/WorkspaceContext";
import { apiClient } from "@/lib/apiClient";

/**
 * `themeSettings` is one JSON blob that several screens write to (the site
 * editor's Store look, the theme gallery, Settings, the template picker), and
 * the API stores exactly what a PATCH sends. So every save sends the whole
 * blob — and building it on the copy this tab loaded would put back, stale,
 * anything another tab or device saved since. Every save therefore reads the
 * server's copy first and builds on that.
 *
 * There is no GET /workspaces/:id: the list is the only read that carries a
 * workspace's themeSettings.
 */

/** A workspace PATCH carrying the whole themeSettings blob, plus anything a screen saves beside it. */
export type ThemeSettingsPayload = Omit<UpdateWorkspacePayload, "themeSettings"> & {
  themeSettings: Record<string, unknown>;
};

/** Builds a save on the server's current themeSettings; null when, against those, there is nothing to save. */
export type BuildThemeSettingsPayload = (current: Record<string, unknown>) => ThemeSettingsPayload | null;

const NO_STORE = "No store is selected, so nothing was saved. Reload the page and try again.";
const LOAD_FAILED =
  "Couldn't load your store's latest settings, so nothing was saved. Check your connection and try again.";
const STORE_GONE = "This store is no longer available to your account, so nothing was saved.";

/**
 * Reads the workspace's themeSettings fresh, builds the save on them and sends
 * it. Returns the workspace as the server now holds it, or null when `build`
 * found nothing to save. Refuses — throws, having sent nothing — whenever the
 * server's copy can't be had: a blob built on a guess could wipe other keys.
 */
export async function saveThemeSettingsPatch(
  workspaceId: string,
  build: BuildThemeSettingsPayload
): Promise<Workspace | null> {
  if (!workspaceId) throw new Error(NO_STORE);

  let workspaces: Workspace[];
  try {
    workspaces = await apiClient.listWorkspaces();
  } catch (err) {
    throw new Error(LOAD_FAILED, { cause: err });
  }
  const latest = workspaces.find((w) => w.id === workspaceId);
  if (!latest) throw new Error(STORE_GONE);
  // The column is NOT NULL with a {} default, so anything else is a response
  // this code doesn't understand — not an empty blob to build on.
  const current = latest.themeSettings;
  if (!current || typeof current !== "object" || Array.isArray(current)) throw new Error(LOAD_FAILED);

  const payload = build(current);
  if (!payload) return null;
  return apiClient.updateWorkspace(workspaceId, payload);
}

/**
 * `saveThemeSettingsPatch` for the current store, putting the server's reply
 * into the workspace context so this tab's copy is current again.
 */
export function useSaveThemeSettings() {
  const { currentWorkspace, applySavedWorkspace } = useWorkspace();
  return async (build: BuildThemeSettingsPayload): Promise<Workspace | null> => {
    if (!currentWorkspace) throw new Error(NO_STORE);
    const saved = await saveThemeSettingsPatch(currentWorkspace.id, build);
    if (saved) applySavedWorkspace(saved);
    return saved;
  };
}
