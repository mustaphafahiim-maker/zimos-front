/**
 * Partner apps with OAuth (backend: frontend-handoff items 265–267, src/modules/partnerApps;
 * the developer's guide is its README.md).
 *
 * Developers — any signed-in account, no workspace, /partner-apps:
 *   GET    /                    → { apps: PartnerApp[], scopes: string[] } (every scope an app may ask for)
 *   POST   / PartnerAppPayload  → 201 { app: PartnerAppWithSecret } — the only time the secret comes
 *          409 PARTNER_APP_LIMIT (20 apps); 422 VALIDATION_ERROR on `redirectUris` (https, or
 *          http://localhost; no #) and on the other addresses (https only).
 *   PATCH  /:id                 → { app }
 *   POST   /:id/rotate-secret   → { app: PartnerAppWithSecret }
 *   GET    /:id/installs        → { installs: PartnerAppInstall[] }
 *   DELETE /:id                 → { deleted } — uninstalls it from every store.
 *
 * The merchant's approval — apps.manage, /workspaces/:ws/oauth/authorize (the dashboard route
 * /oauth/authorize?client_id&redirect_uri&scope&state):
 *   GET  ?client_id&redirect_uri&scope&state → OAuthAuthorizePreview
 *        404 unknown or suspended app; 422 VALIDATION_ERROR on `redirect_uri` / `scope`;
 *        403 APP_IN_DEVELOPMENT (only its developer's stores may install it); 403 FORBIDDEN
 *        without apps.manage.
 *   POST same fields + approve → { redirectTo } — the browser goes there, with the code or
 *        `error=access_denied`.
 *
 * The app's own page — any member of the store:
 *   GET /workspaces/:ws/apps/partner/:installId/embed → { url, name } — signed, good for 5
 *       minutes: ask again each time it opens. 404 when the app has no page.
 *
 * Platform console, /admin/partner-apps (providers.view / providers.manage):
 *   GET ?status= → { apps: AdminPartnerApp[] }; PATCH /:id { status } → { app } — suspending
 *   removes its installs.
 *
 * Webhooks (item 266): an endpoint an app made through the public API has `createdByApp`; it
 * goes off with `disabledReason: "api_key_revoked"` when the app is uninstalled, and switching
 * it back on answers 409 WEBHOOK_APP_REMOVED.
 */
import type { ApiClient } from "../client";

export type PartnerAppStatus = "development" | "published" | "suspended";

export interface PartnerApp {
  id: string;
  name: string;
  description: string | null;
  /** https. */
  iconUrl: string | null;
  /** The page shown inside the dashboard, in a frame (https); null = the app has no page. */
  appUrl: string | null;
  /** Called when a store removes the app (item 267; https, a public address). */
  uninstallUrl: string | null;
  redirectUris: string[];
  scopes: string[];
  clientId: string;
  status: PartnerAppStatus;
  createdAt: string;
  updatedAt: string;
}

/** A new or rotated app: `clientSecret` is in this one answer only. */
export interface PartnerAppWithSecret extends PartnerApp {
  clientSecret: string;
}

export interface PartnerAppPayload {
  name: string;
  description?: string | null;
  iconUrl?: string | null;
  appUrl?: string | null;
  uninstallUrl?: string | null;
  /** 1–10; https, or http://localhost while developing; no #fragment. */
  redirectUris: string[];
  /** At least one of the scopes the list call names. */
  scopes: string[];
}

export interface PartnerAppInstall {
  storeId: string;
  storeName: string | null;
  scopes: string[];
  installedAt: string;
}

export interface PartnerAppsList {
  apps: PartnerApp[];
  scopes: string[];
}

export async function partnerAppsList(client: ApiClient): Promise<PartnerAppsList> {
  return client.request<PartnerAppsList>("/partner-apps");
}

export async function partnerAppsCreate(client: ApiClient, payload: PartnerAppPayload): Promise<PartnerAppWithSecret> {
  const { app } = await client.request<{ app: PartnerAppWithSecret }>("/partner-apps", { method: "POST", body: payload });
  return app;
}

export async function partnerAppsUpdate(client: ApiClient, id: string, changes: Partial<PartnerAppPayload>): Promise<PartnerApp> {
  const { app } = await client.request<{ app: PartnerApp }>(`/partner-apps/${id}`, { method: "PATCH", body: changes });
  return app;
}

/** The old secret stops working at once. */
export async function partnerAppsRotateSecret(client: ApiClient, id: string): Promise<PartnerAppWithSecret> {
  const { app } = await client.request<{ app: PartnerAppWithSecret }>(`/partner-apps/${id}/rotate-secret`, { method: "POST" });
  return app;
}

export async function partnerAppsInstalls(client: ApiClient, id: string): Promise<PartnerAppInstall[]> {
  const { installs } = await client.request<{ installs: PartnerAppInstall[] }>(`/partner-apps/${id}/installs`);
  return installs;
}

/** Removes the app and its install in every store. */
export async function partnerAppsDelete(client: ApiClient, id: string): Promise<{ deleted: boolean }> {
  return client.request<{ deleted: boolean }>(`/partner-apps/${id}`, { method: "DELETE" });
}

// ------------------------------------------------- the merchant's approval --

/** The link's own parameters, as they came (the server checks them against what the app registered). */
export interface OAuthAuthorizeRequest {
  client_id: string;
  redirect_uri: string;
  /** Scope names separated by commas or spaces. */
  scope: string;
  state?: string;
  response_type?: string;
}

export interface OAuthAuthorizePreview {
  app: {
    name: string;
    description: string | null;
    iconUrl: string | null;
    /** The developer's name. */
    developer: string | null;
    status: PartnerAppStatus;
    /** Where the browser goes back to. */
    redirectHost: string;
  };
  /** The scopes this request asks for. */
  scopes: string[];
  /** The store already has this app: approving replaces its access. */
  installed: boolean;
}

const oauthBase = (workspaceId: string) => `/workspaces/${workspaceId}/oauth/authorize`;

function authorizeFields(request: OAuthAuthorizeRequest): Record<string, string> {
  const out: Record<string, string> = { client_id: request.client_id, redirect_uri: request.redirect_uri, scope: request.scope };
  if (request.state) out.state = request.state;
  if (request.response_type) out.response_type = request.response_type;
  return out;
}

export async function oauthAuthorizePreview(client: ApiClient, workspaceId: string, request: OAuthAuthorizeRequest): Promise<OAuthAuthorizePreview> {
  const query = new URLSearchParams(authorizeFields(request));
  return client.request<OAuthAuthorizePreview>(`${oauthBase(workspaceId)}?${query.toString()}`);
}

/** Allow or deny: either way the answer is where to send the browser. */
export async function oauthAuthorizeDecide(
  client: ApiClient,
  workspaceId: string,
  request: OAuthAuthorizeRequest,
  approve: boolean
): Promise<{ redirectTo: string }> {
  return client.request<{ redirectTo: string }>(oauthBase(workspaceId), { method: "POST", body: { ...authorizeFields(request), approve } });
}

// --------------------------------------------------------- the app's page --

/** A signed address for the app's frame; it expires in 5 minutes, so it is asked for on every open. */
export async function partnerAppEmbed(client: ApiClient, workspaceId: string, installId: string): Promise<{ url: string; name: string }> {
  return client.request<{ url: string; name: string }>(`/workspaces/${workspaceId}/apps/partner/${installId}/embed`);
}

// ------------------------------------------------------- platform console --

export interface AdminPartnerApp extends PartnerApp {
  ownerUserId: string;
}

/** The newest 200, optionally one status. */
export async function adminPartnerApps(client: ApiClient, status?: PartnerAppStatus): Promise<AdminPartnerApp[]> {
  const { apps } = await client.request<{ apps: AdminPartnerApp[] }>(`/admin/partner-apps${status ? `?status=${status}` : ""}`);
  return apps;
}

/** Publishing lets every store install it; suspending also removes it from the stores that have it. */
export async function adminSetPartnerAppStatus(client: ApiClient, id: string, status: PartnerAppStatus): Promise<PartnerApp> {
  const { app } = await client.request<{ app: PartnerApp }>(`/admin/partner-apps/${id}`, { method: "PATCH", body: { status } });
  return app;
}

// ------------------------------------------- webhooks an app created (266) --

/** What GET /workspaces/:ws/webhooks adds to each endpoint (optional: an older server sends neither). */
export interface WebhookAppInfo {
  /** Made by an app through the public API. */
  createdByApp?: boolean;
  /** "api_key_revoked" once that app was uninstalled or its key revoked; "failing_for_3_days" after three days of failed deliveries. */
  disabledReason?: string | null;
}

export function webhookCreatedByApp(endpoint: object): boolean {
  return (endpoint as WebhookAppInfo).createdByApp === true;
}

/** Off because its app is gone: it cannot be switched back on (409 WEBHOOK_APP_REMOVED). */
export function webhookAppRemoved(endpoint: object): boolean {
  return (endpoint as WebhookAppInfo).disabledReason === "api_key_revoked";
}
