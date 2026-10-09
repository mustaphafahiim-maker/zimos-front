/**
 * Ad accounts and campaign controls (backend handoff item 261;
 * src/modules/profit/adAccounts.js and adapters/README.md).
 *
 * All under /workspaces/:ws/profit/ads — reads need financial_reports.view,
 * changes need profit.manage:
 *   GET    /adapters                      → { adapters: AdsAdapter[] } (only `sandbox` today)
 *   GET    /connections                   → { connections: AdsConnection[] }
 *   POST   /connections { adapter, credentials } → 201 { connection }
 *          422 ADS_CREDENTIALS_REJECTED. Credentials are sealed and never returned.
 *   PUT    /connections/:adapter/accounts { accountIds } → { connection }
 *          The merchant's pick: only picked accounts are synced and can be
 *          controlled. 422 (field `accountIds`) for an id that is not one of
 *          the connection's accounts.
 *   DELETE /connections/:adapter          → { disconnected: true } (recorded spend stays)
 *   POST   /campaigns/:campaignId/status { adapter, accountId, status: "paused" | "active" }
 *   PUT    /campaigns/:campaignId/budget { adapter, accountId, dailyBudgetAmount }
 *          → { campaign: AdsCampaignChange }. 422 (field `accountId`) when the
 *          account is not picked, 422 ADS_CHANGE_REFUSED when the platform says
 *          no, 502 ADS_PLATFORM_UNREACHABLE when it cannot be reached.
 *   POST   /sync                          → { sync: AdsSyncResult } — pulls the picked accounts' spend now
 *
 * A campaign's last state set from here is kept on its connection under
 * "<accountId>:<campaignId>" (`adsCampaignKey`); the ad platform stays the
 * source of truth. `dailyBudgetAmount` is integer minor units of the ad
 * account's currency: a number on the way in, a string on the way out.
 * All exported names start with `ads` / `Ads`.
 */
import type { ApiClient } from "../client";

export interface AdsAdapter {
  code: string;
  name: string;
  /** The ad platforms this adapter reaches, e.g. ["meta", "tiktok"]. */
  platforms: string[];
  supportsOAuth: boolean;
}

export interface AdsAccount {
  accountId: string;
  name: string;
  platform: string;
  currency: string | null;
  /** Picked by the merchant: synced, and its campaigns can be controlled. */
  selected: boolean;
}

export type AdsCampaignStatus = "paused" | "active";

/** The last status / budget set from the dashboard for one campaign. */
export interface AdsCampaignState {
  status?: AdsCampaignStatus;
  dailyBudgetAmount?: string;
  updatedAt?: string;
}

export interface AdsConnection {
  adapter: string;
  /** connected | error | disconnected */
  status: string;
  accounts: AdsAccount[];
  /** Keyed "<accountId>:<campaignId>" (adsCampaignKey). */
  campaigns: Record<string, AdsCampaignState>;
  lastVerifiedAt: string | null;
  lastError: string | null;
}

export interface AdsCampaignChange extends AdsCampaignState {
  campaignId: string;
  accountId: string;
}

export interface AdsSyncResult {
  /** Connections asked. */
  accounts: number;
  /** Spend rows written (a day, platform and campaign each). */
  written: number;
  failed: number;
}

export const adsCampaignKey = (accountId: string, campaignId: string) => `${accountId}:${campaignId}`;

/**
 * The key fields each adapter's `credentials` take. The API does not describe
 * them: the sandbox takes none, and a real adapter is added here with it.
 */
export const ADS_ADAPTER_FIELDS: Record<string, readonly { key: string; secret: boolean }[]> = {
  sandbox: [],
};

/** For an adapter this client does not know yet: one access token. */
export const ADS_DEFAULT_FIELDS: readonly { key: string; secret: boolean }[] = [{ key: "accessToken", secret: true }];

export const adsAdapterFields = (code: string) => ADS_ADAPTER_FIELDS[code] ?? ADS_DEFAULT_FIELDS;

const base = (workspaceId: string) => `/workspaces/${workspaceId}/profit/ads`;

export async function adsAdaptersList(client: ApiClient, workspaceId: string): Promise<AdsAdapter[]> {
  return (await client.request<{ adapters: AdsAdapter[] }>(`${base(workspaceId)}/adapters`)).adapters;
}

export async function adsConnectionsList(client: ApiClient, workspaceId: string): Promise<AdsConnection[]> {
  return (await client.request<{ connections: AdsConnection[] }>(`${base(workspaceId)}/connections`)).connections;
}

export async function adsConnect(
  client: ApiClient,
  workspaceId: string,
  payload: { adapter: string; credentials: Record<string, string> }
): Promise<AdsConnection> {
  const { connection } = await client.request<{ connection: AdsConnection }>(`${base(workspaceId)}/connections`, {
    method: "POST",
    body: payload,
  });
  return connection;
}

export async function adsSelectAccounts(
  client: ApiClient,
  workspaceId: string,
  adapter: string,
  accountIds: string[]
): Promise<AdsConnection> {
  const { connection } = await client.request<{ connection: AdsConnection }>(
    `${base(workspaceId)}/connections/${encodeURIComponent(adapter)}/accounts`,
    { method: "PUT", body: { accountIds } }
  );
  return connection;
}

export async function adsDisconnect(client: ApiClient, workspaceId: string, adapter: string): Promise<void> {
  await client.request(`${base(workspaceId)}/connections/${encodeURIComponent(adapter)}`, { method: "DELETE" });
}

export async function adsSetCampaignStatus(
  client: ApiClient,
  workspaceId: string,
  campaignId: string,
  payload: { adapter: string; accountId: string; status: AdsCampaignStatus }
): Promise<AdsCampaignChange> {
  const { campaign } = await client.request<{ campaign: AdsCampaignChange }>(
    `${base(workspaceId)}/campaigns/${encodeURIComponent(campaignId)}/status`,
    { method: "POST", body: payload }
  );
  return campaign;
}

export async function adsSetCampaignBudget(
  client: ApiClient,
  workspaceId: string,
  campaignId: string,
  payload: { adapter: string; accountId: string; dailyBudgetAmount: number }
): Promise<AdsCampaignChange> {
  const { campaign } = await client.request<{ campaign: AdsCampaignChange }>(
    `${base(workspaceId)}/campaigns/${encodeURIComponent(campaignId)}/budget`,
    { method: "PUT", body: payload }
  );
  return campaign;
}

export async function adsSyncNow(client: ApiClient, workspaceId: string): Promise<AdsSyncResult> {
  return (await client.request<{ sync: AdsSyncResult }>(`${base(workspaceId)}/sync`, { method: "POST" })).sync;
}
