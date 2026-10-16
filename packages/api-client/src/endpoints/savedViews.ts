/**
 * Saved views (backend: workspaces/savedViews.js), mounted at
 * /workspaces/:workspaceId/saved-views — each teammate's own named filters
 * for a list. Saving a name again replaces its query.
 */
import type { ApiClient } from "../client";

export type SavedViewScope = "orders" | "lost_orders" | "customers" | "products";

export interface SavedListView {
  id: string;
  scope: SavedViewScope;
  name: string;
  /** The list's URL query string, without "?". */
  query: string;
  updatedAt: string;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/saved-views`;

export async function savedViewsList(client: ApiClient, workspaceId: string, scope: SavedViewScope): Promise<SavedListView[]> {
  const { views } = await client.request<{ views: SavedListView[] }>(`${base(workspaceId)}?scope=${scope}`);
  return views;
}

export async function savedViewsSave(client: ApiClient, workspaceId: string, view: { scope: SavedViewScope; name: string; query: string }): Promise<SavedListView> {
  const { view: saved } = await client.request<{ view: SavedListView }>(base(workspaceId), { method: "POST", body: view });
  return saved;
}

export async function savedViewsRemove(client: ApiClient, workspaceId: string, viewId: string): Promise<void> {
  await client.request(`${base(workspaceId)}/${viewId}`, { method: "DELETE" });
}
