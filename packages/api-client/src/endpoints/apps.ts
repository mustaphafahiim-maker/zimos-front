/**
 * The app store, the app install link and dropshipping providers (backend:
 * src/modules/apps and src/modules/dropship).
 *
 * Mounted at /workspaces/:workspaceId/apps and /workspaces/:workspaceId/dropship.
 * Reading the catalogue needs no special permission; every change needs
 * `apps.manage`.
 *
 * Notable codes: APP_NOT_AVAILABLE (409 — a "coming soon" app),
 * APP_CALLBACK_FAILED (502 — the outside app refused the connection; nothing
 * was installed), DROPSHIP_NOT_CONNECTED (409), DROPSHIP_ALREADY_IMPORTED
 * (409), DROPSHIP_PRODUCT_NOT_FOUND (404), DROPSHIP_UNAVAILABLE (502).
 */
import type { ApiClient } from "../client";

export interface AppText {
  en: string;
  ar: string;
}

export interface AppCategory {
  key: string;
  name: AppText;
}

export interface AppDto {
  key: string;
  category: string;
  kind: "feature" | "integration";
  name: AppText;
  description: AppText;
  availability: "available" | "coming_soon";
  /** A test integration: only where test integrations are allowed. */
  isTest: boolean;
  /** Dashboard path "Open" goes to. */
  openPath: string | null;
  /** Null = free. Amount is minor units as a string. */
  price: { amount: string; currency: string | null; billing: "once" | "monthly" | null } | null;
  installed: boolean;
  installedAt: string | null;
  renewsAt: string | null;
}

export interface ExternalAppDto {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  scopes: string[];
  webhooks: number;
  installedAt: string;
}

export interface AppsList {
  categories: AppCategory[];
  apps: AppDto[];
  external: ExternalAppDto[];
}

/** The install link's query parameters, as they came. */
export interface AppInstallLink {
  app_name?: string;
  app_description?: string;
  app_icon?: string;
  callback_url?: string;
  orders_webhook?: string;
  order_status_webhook?: string;
  permissions?: string;
  redirect_url?: string;
}

export interface AppInstallPreview {
  app: { name: string; description: string | null; icon: string | null; callbackHost: string };
  scopes: string[];
  webhooks: Array<{ event: string; url: string }>;
  redirectUrl: string | null;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/apps`;

export async function appsList(client: ApiClient, workspaceId: string): Promise<AppsList> {
  return client.request<AppsList>(base(workspaceId));
}

export async function appsInstall(client: ApiClient, workspaceId: string, key: string): Promise<{ key: string; installed: boolean; openPath: string | null }> {
  return client.request(`${base(workspaceId)}/${key}/install`, { method: "POST" });
}

export async function appsUninstall(client: ApiClient, workspaceId: string, key: string): Promise<{ key: string; installed: boolean }> {
  return client.request(`${base(workspaceId)}/${key}/uninstall`, { method: "POST" });
}

export async function appsPreviewExternal(client: ApiClient, workspaceId: string, link: AppInstallLink): Promise<AppInstallPreview> {
  return client.request(`${base(workspaceId)}/external/preview`, { method: "POST", body: link });
}

export async function appsInstallExternal(
  client: ApiClient,
  workspaceId: string,
  link: AppInstallLink
): Promise<{ app: ExternalAppDto; redirectUrl: string | null }> {
  return client.request(`${base(workspaceId)}/external/install`, { method: "POST", body: link });
}

export async function appsUninstallExternal(client: ApiClient, workspaceId: string, installId: string): Promise<{ uninstalled: boolean }> {
  return client.request(`${base(workspaceId)}/external/${installId}/uninstall`, { method: "POST" });
}

// ---------------------------------------------------------------- dropship --

export interface DropshipProviderDto {
  code: string;
  name: string;
  isTest: boolean;
  credentialFields: Array<{ key: string; label: AppText; secret?: boolean; required?: boolean }>;
  connected: boolean;
  accountName: string | null;
  lastVerifiedAt: string | null;
}

export interface DropshipProviders {
  providers: DropshipProviderDto[];
  /** Named but not built yet: shown as "Coming soon". */
  planned: Array<{ code: string; name: string }>;
}

const dropBase = (workspaceId: string) => `/workspaces/${workspaceId}/dropship`;

export async function dropshipProviders(client: ApiClient, workspaceId: string): Promise<DropshipProviders> {
  return client.request<DropshipProviders>(`${dropBase(workspaceId)}/providers`);
}

export async function dropshipConnect(
  client: ApiClient,
  workspaceId: string,
  code: string,
  credentials: Record<string, string>
): Promise<{ code: string; connected: boolean; accountName: string | null }> {
  return client.request(`${dropBase(workspaceId)}/providers/${code}`, { method: "PUT", body: { credentials } });
}

export async function dropshipDisconnect(client: ApiClient, workspaceId: string, code: string): Promise<{ code: string; connected: boolean }> {
  return client.request(`${dropBase(workspaceId)}/providers/${code}`, { method: "DELETE" });
}

export async function dropshipImport(
  client: ApiClient,
  workspaceId: string,
  code: string,
  productCode: string
): Promise<{ product: { id: string; name: string } }> {
  return client.request(`${dropBase(workspaceId)}/providers/${code}/import`, { method: "POST", body: { code: productCode } });
}

export async function dropshipSyncStock(client: ApiClient, workspaceId: string, code: string): Promise<{ products: number; updated: number }> {
  return client.request(`${dropBase(workspaceId)}/providers/${code}/sync-stock`, { method: "POST" });
}

export async function dropshipPushOrder(
  client: ApiClient,
  workspaceId: string,
  code: string,
  orderId: string
): Promise<{ orderId: string; provider: string; externalOrderId: string; externalStatus: string | null }> {
  return client.request(`${dropBase(workspaceId)}/providers/${code}/orders/${orderId}/push`, { method: "POST" });
}
