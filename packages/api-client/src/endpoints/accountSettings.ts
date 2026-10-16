/**
 * Account settings (backend: workspaces/accountSettings.js), mounted at
 * /workspaces/:workspaceId/account-settings (workspace.manage).
 *
 *   timezone          the store's clock: reports and exports count days on it
 *   contactFormEmail  where each contact-form message is emailed (null = none)
 *   legal             the business printed on invoices
 */
import type { ApiClient } from "../client";

export interface AccountSettingsLegal {
  name: string | null;
  company: string | null;
  phone: string | null;
  address: string | null;
  /** ISO 3166 code, e.g. EG. */
  country: string | null;
}

export interface AccountSettings {
  timezone: string;
  contactFormEmail: string | null;
  legal: AccountSettingsLegal;
}

export type AccountSettingsInput = Partial<{
  timezone: string;
  contactFormEmail: string | null;
  legal: Partial<AccountSettingsLegal>;
}>;

const base = (workspaceId: string) => `/workspaces/${workspaceId}/account-settings`;

export async function accountSettingsGet(client: ApiClient, workspaceId: string): Promise<AccountSettings> {
  const { account } = await client.request<{ account: AccountSettings }>(base(workspaceId));
  return account;
}

export async function accountSettingsSave(client: ApiClient, workspaceId: string, input: AccountSettingsInput): Promise<AccountSettings> {
  const { account } = await client.request<{ account: AccountSettings }>(base(workspaceId), { method: "PUT", body: input });
  return account;
}
