/**
 * The store as an installable app for its shoppers (backend storefront/storeApp.js).
 *
 *   GET/PUT /workspaces/:ws/store-app   (website.publish)
 *   GET /store/:ws → `storeApp`         null while the app is off
 */
import type { ApiClient } from "../client";

export interface StoreAppSettings {
  enabled: boolean;
  name: string | null;
  /** Under the icon; at most 12 characters. */
  shortName: string | null;
  /** A square image, 512×512 or more. Null: the store's logo. */
  iconUrl: string | null;
  /** `#rrggbb`. Null: the store's main colour. */
  themeColor: string | null;
}

/** What the storefront gets on GET /store/:ws, already resolved. */
export interface StorefrontStoreApp {
  name: string;
  shortName: string;
  iconUrl: string | null;
  themeColor: string | null;
}

export function storefrontStoreApp(store: unknown): StorefrontStoreApp | null {
  return ((store as { storeApp?: StorefrontStoreApp | null } | null)?.storeApp ?? null) as StorefrontStoreApp | null;
}

export async function storeAppGet(client: ApiClient, workspaceId: string): Promise<StoreAppSettings> {
  const { storeApp } = await client.request<{ storeApp: StoreAppSettings }>(`/workspaces/${workspaceId}/store-app`);
  return storeApp;
}

export async function storeAppSave(client: ApiClient, workspaceId: string, body: StoreAppSettings): Promise<StoreAppSettings> {
  const { storeApp } = await client.request<{ storeApp: StoreAppSettings }>(`/workspaces/${workspaceId}/store-app`, { method: "PUT", body });
  return storeApp;
}
