import type { ApiClient } from "../client";

/**
 * Google Sheets (backend modules/sheets, SPEC §16.4): a Google account, then
 * any number of sheets. Each one carries orders, lost orders or leads, keeps
 * its own columns and filter, and is written as things happen. Without the
 * real Google adapter the backend runs a sandbox (sheets kept as files).
 */
export type SheetDataType = "orders" | "lost_orders" | "leads";
export type SheetStatus = "active" | "paused" | "revoked" | "error";
export type SheetColumn = { header: string; key: string } | { header: string; fixed: string };

export interface SheetFilter {
  productIds?: string[];
  funnelIds?: string[];
  lang?: "ar" | "en";
  /** Phones are masked when the teammate who connected it could not see them. */
  maskPhones?: boolean;
}

export interface SheetConnection {
  id: string;
  name: string;
  dataType: SheetDataType;
  spreadsheetId: string;
  /** https://docs.google.com/… with the real adapter; sandbox://… in the sandbox. */
  spreadsheetUrl: string | null;
  sheetName: string;
  filter: SheetFilter;
  columns: SheetColumn[];
  /** One row per order (true) or one per product line. */
  groupByOrder: boolean;
  status: SheetStatus;
  lastError: string | null;
  lastSyncedAt: string | null;
  rowsWritten: number;
  createdAt: string;
}

export interface SheetColumnOption {
  key: string;
  label: { en: string; ar: string };
}

export interface GoogleSheetsOverview {
  adapter: { available: boolean; name: string | null; sandbox: boolean };
  /** `reconnect`: Google took the access away (revoked, a password change, a test app's 7-day token); connecting again resumes the stopped sheets (handoff 393). */
  account: { connected: boolean; email: string | null; reconnect?: boolean };
  connections: SheetConnection[];
  lostColumns: SheetColumnOption[];
  leadColumns: SheetColumnOption[];
  backfillDays: number;
}

export interface SheetConnectionInput {
  name: string;
  dataType: SheetDataType;
  filter?: { productIds?: string[]; funnelIds?: string[] };
  columns: SheetColumn[];
  groupByOrder?: boolean;
  lang?: "ar" | "en";
  /** Reuse a spreadsheet ZIMOS created: a pasted link (https://docs.google.com/spreadsheets/d/<id>/…) or the id. 404 SHEETS_NOT_FOUND, 403 SHEETS_PERMISSION_DENIED. */
  spreadsheetId?: string;
}

export type SheetConnectionPatch = Partial<Omit<SheetConnectionInput, "dataType">> & { status?: "active" | "paused" };

const base = (workspaceId: string) => `/workspaces/${workspaceId}/integrations/google-sheets`;

export function googleSheetsOverview(client: ApiClient, workspaceId: string) {
  return client.request<GoogleSheetsOverview>(base(workspaceId));
}

/** Where to send the merchant to allow access; Google comes back to `redirectUri` with ?code&state. */
export async function googleSheetsAuthorizeUrl(client: ApiClient, workspaceId: string, redirectUri: string): Promise<string> {
  const { url } = await client.request<{ url: string }>(`${base(workspaceId)}/authorize`, { method: "POST", body: { redirectUri } });
  return url;
}

export function googleSheetsConnectAccount(client: ApiClient, workspaceId: string, code: string, state: string) {
  return client.request<GoogleSheetsOverview>(`${base(workspaceId)}/account`, { method: "POST", body: { code, state } });
}

/** Forgets the account; every sheet stops until one is connected again. */
export function googleSheetsDisconnectAccount(client: ApiClient, workspaceId: string) {
  return client.request<GoogleSheetsOverview>(`${base(workspaceId)}/account`, { method: "DELETE" });
}

export async function googleSheetsCreate(client: ApiClient, workspaceId: string, input: SheetConnectionInput): Promise<SheetConnection> {
  const { connection } = await client.request<{ connection: SheetConnection }>(`${base(workspaceId)}/connections`, { method: "POST", body: input });
  return connection;
}

export async function googleSheetsUpdate(client: ApiClient, workspaceId: string, id: string, patch: SheetConnectionPatch): Promise<SheetConnection> {
  const { connection } = await client.request<{ connection: SheetConnection }>(`${base(workspaceId)}/connections/${id}`, { method: "PATCH", body: patch });
  return connection;
}

export async function googleSheetsDelete(client: ApiClient, workspaceId: string, id: string): Promise<void> {
  await client.request(`${base(workspaceId)}/connections/${id}`, { method: "DELETE" });
}

/** "Sync existing": the last `backfillDays` days, in the background. */
export function googleSheetsBackfill(client: ApiClient, workspaceId: string, id: string) {
  return client.request<{ queued: boolean; days: number }>(`${base(workspaceId)}/connections/${id}/backfill`, { method: "POST" });
}

/** The header and the newest rows (adapters that can read them back: the sandbox). */
export function googleSheetsRows(client: ApiClient, workspaceId: string, id: string) {
  return client.request<{ rows: (string | number)[][]; total: number }>(`${base(workspaceId)}/connections/${id}/rows`);
}
