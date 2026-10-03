/**
 * Protection against fake orders (backend: src/modules/fraud, src/modules/risk).
 *
 * Mounted at /workspaces/:workspaceId/fraud. The blocklist reads need
 * customers.view and its writes customers.manage. All exported names in this
 * file are prefixed with `protection` / `Protection`, or name a blocked entry.
 *
 * Notable codes: VALIDATION_ERROR (422 — `details[0].field` is `value`,
 * `name` or `csv`, with a message that says what is wrong with it).
 */
import type { ApiClient } from "../client";

// -------------------------------------------------------------- blocklist --

export const BLOCKED_ENTRY_TYPES = ["phone", "ip", "email", "device", "name_address"] as const;
export type BlockedEntryType = (typeof BLOCKED_ENTRY_TYPES)[number];

/** `orders`: may not order. `otp`: is not sent a code. `visit`: does not see the store. */
export const BLOCKED_ENTRY_SCOPES = ["orders", "otp", "visit"] as const;
export type BlockedEntryScope = (typeof BLOCKED_ENTRY_SCOPES)[number];

export interface BlockedEntry {
  id: string;
  type: BlockedEntryType;
  /** Normalized form (a name + address entry holds a hash here; show `label`). */
  value: string;
  /** What the merchant blocked, as they typed it. */
  label: string;
  scope: BlockedEntryScope;
  reason: string | null;
  createdById: string | null;
  createdBy: string | null;
  createdAt: string;
  /** The customer a phone entry belongs to, when that phone has ordered. */
  customerId: string | null;
}

export interface BlockedEntryListParams {
  type?: BlockedEntryType;
  scope?: BlockedEntryScope;
  q?: string;
  limit?: number;
  /** `nextCursor` of the previous page. */
  cursor?: string;
}

export interface BlockedEntryList {
  entries: BlockedEntry[];
  nextCursor: string | null;
  /** Entries per type, under the same scope filter. */
  counts: Record<BlockedEntryType, number>;
}

export interface BlockedEntryCreatePayload {
  type: BlockedEntryType;
  /** Every type except `name_address`. */
  value?: string;
  /** `name_address` only. */
  name?: string;
  address?: string;
  scopes: BlockedEntryScope[];
  reason?: string;
}

export interface BlockedEntryImportPayload {
  /** The file's text. Columns by header name: type, value, scope, reason, name, address. */
  csv: string;
  /** Used for rows that do not say. */
  type?: BlockedEntryType;
  scope?: BlockedEntryScope;
  reason?: string;
}

export interface BlockedEntryImportResult {
  imported: number;
  updated: number;
  skipped: number;
  errors: { line: number; message: string }[];
}

const fraudBase = (workspaceId: string) => `/workspaces/${workspaceId}/fraud`;

function query(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

export async function protectionListBlocked(
  client: ApiClient,
  workspaceId: string,
  params: BlockedEntryListParams = {}
): Promise<BlockedEntryList> {
  return client.request<BlockedEntryList>(`${fraudBase(workspaceId)}/blocklist${query(params)}`);
}

/** One entry per scope. Blocking something already blocked only updates its reason. */
export async function protectionAddBlocked(
  client: ApiClient,
  workspaceId: string,
  payload: BlockedEntryCreatePayload
): Promise<BlockedEntry[]> {
  const { entries } = await client.request<{ entries: BlockedEntry[] }>(`${fraudBase(workspaceId)}/blocklist`, {
    method: "POST",
    body: payload,
  });
  return entries;
}

/** Deleting a phone entry of scope `orders` also un-blacklists that customer. */
export async function protectionRemoveBlocked(client: ApiClient, workspaceId: string, entryId: string): Promise<void> {
  await client.request<unknown>(`${fraudBase(workspaceId)}/blocklist/${entryId}`, { method: "DELETE" });
}

export async function protectionImportBlocked(
  client: ApiClient,
  workspaceId: string,
  payload: BlockedEntryImportPayload
): Promise<BlockedEntryImportResult> {
  return client.request<BlockedEntryImportResult>(`${fraudBase(workspaceId)}/blocklist/import`, {
    method: "POST",
    body: payload,
  });
}
