/**
 * Email marketing: contacts who agreed to marketing go to a Mailchimp
 * audience or a Klaviyo list (frontend-handoff 182; backend
 * emailMarketing/emailMarketing.js).
 *
 *   GET    /workspaces/:ws/email-marketing/providers                 → { providers }
 *   PUT    /workspaces/:ws/email-marketing/providers/:code           { credentials: { apiKey } } → provider view
 *   DELETE /workspaces/:ws/email-marketing/providers/:code           → { code, connected: false }
 *   GET    /workspaces/:ws/email-marketing/providers/:code/lists     → { lists }
 *   PATCH  /workspaces/:ws/email-marketing/providers/:code/settings  { listId?, tags?, sources? } → provider view
 *   POST   /workspaces/:ws/email-marketing/providers/:code/sync      → 202 { queued: true }
 *
 * All need `apps.manage`. Mailchimp and Klaviyo are app-store apps: until
 * installed (POST /apps/:key/install) connecting answers 403 APP_NOT_INSTALLED.
 * The `sandbox` provider ("Test email list", isTest) exists outside
 * production and needs no install.
 *
 * Codes: EMAIL_MARKETING_INVALID_CREDENTIALS (422), EMAIL_MARKETING_NOT_CONNECTED
 * (409), EMAIL_MARKETING_LIST_NOT_FOUND (404), EMAIL_MARKETING_NO_LIST (409),
 * EMAIL_MARKETING_REJECTED (409), EMAIL_MARKETING_UNAVAILABLE (502).
 */
import type { ApiClient } from "../client";
import type { AppText } from "./apps";

/** Which contacts are sent: `leads` have no order yet, `buyers` have one. */
export type EmailMarketingSource = "leads" | "buyers";

export const EMAIL_MARKETING_MAX_TAGS = 10;
export const EMAIL_MARKETING_TAG_MAX_LENGTH = 60;

export interface EmailMarketingProvider {
  code: string;
  name: string;
  isTest: boolean;
  credentialFields: Array<{ key: string; label: AppText; secret?: boolean; required?: boolean }>;
  connected: boolean;
  accountName: string | null;
  listId: string | null;
  listName: string | null;
  tags: string[];
  sources: EmailMarketingSource[];
  lastSyncAt: string | null;
  syncedCount: number;
  /** True from "Sync now" until that run finishes. */
  syncing: boolean;
  /** The service's last refusal (key revoked, list deleted…); cleared on the next success. */
  lastError: string | null;
}

export interface EmailMarketingList {
  id: string;
  name: string;
  /** Null when the service does not say (Klaviyo). */
  memberCount: number | null;
}

export interface EmailMarketingSettings {
  listId?: string;
  tags?: string[];
  sources?: EmailMarketingSource[];
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/email-marketing/providers`;

export function emailMarketingProviders(client: ApiClient, workspaceId: string): Promise<{ providers: EmailMarketingProvider[] }> {
  return client.request<{ providers: EmailMarketingProvider[] }>(base(workspaceId));
}

/** Checks the key with the service and keeps it sealed (never shown again). Reconnecting keeps the list and tags. */
export function emailMarketingConnect(
  client: ApiClient,
  workspaceId: string,
  code: string,
  credentials: Record<string, string>
): Promise<EmailMarketingProvider> {
  return client.request<EmailMarketingProvider>(`${base(workspaceId)}/${encodeURIComponent(code)}`, { method: "PUT", body: { credentials } });
}

export function emailMarketingDisconnect(client: ApiClient, workspaceId: string, code: string): Promise<{ code: string; connected: false }> {
  return client.request(`${base(workspaceId)}/${encodeURIComponent(code)}`, { method: "DELETE" });
}

export async function emailMarketingLists(client: ApiClient, workspaceId: string, code: string): Promise<EmailMarketingList[]> {
  const { lists } = await client.request<{ lists: EmailMarketingList[] }>(`${base(workspaceId)}/${encodeURIComponent(code)}/lists`);
  return lists;
}

export function emailMarketingSaveSettings(
  client: ApiClient,
  workspaceId: string,
  code: string,
  settings: EmailMarketingSettings
): Promise<EmailMarketingProvider> {
  return client.request<EmailMarketingProvider>(`${base(workspaceId)}/${encodeURIComponent(code)}/settings`, { method: "PATCH", body: settings });
}

/** Sends everyone already in the store (up to 20,000 a run); `syncing` stays true on the provider until it is done. */
export function emailMarketingSync(client: ApiClient, workspaceId: string, code: string): Promise<{ queued: boolean }> {
  return client.request<{ queued: boolean }>(`${base(workspaceId)}/${encodeURIComponent(code)}/sync`, { method: "POST" });
}
