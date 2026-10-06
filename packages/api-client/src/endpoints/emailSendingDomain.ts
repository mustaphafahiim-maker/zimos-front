/**
 * A store's own sending domain for customer emails (backend
 * src/modules/emailDomains/sendingDomain.js, handoff item 173).
 *
 * Mounted on the order emails router (workspace.manage). The store adds a
 * domain, copies the DNS records to its domain provider and presses Verify;
 * once SPF, DKIM and return-path are found the order and cart-recovery emails
 * leave From `<localPart>@<domain>`. A verified domain that later fails a
 * check goes to `failed` and the emails go back to the platform's address.
 * All exported names are prefixed `sendingDomain` / `SendingDomain`.
 */
import type { ApiClient } from "../client";

export type SendingDomainStatus = "pending" | "verified" | "failed";

/** DMARC is advised only: it never blocks verification. */
export type SendingDomainRecordPurpose = "spf" | "dkim" | "return_path" | "dmarc";

export interface SendingDomainRecord {
  purpose: SendingDomainRecordPurpose;
  /** `TXT` or `CNAME`. */
  type: string;
  /** The host the record goes on. */
  name: string;
  value: string;
  /** Present after a check: whether DNS has the record. */
  ok?: boolean;
}

export interface SendingDomain {
  domain: string;
  localPart: string;
  /** `<localPart>@<domain>`. */
  fromAddress: string;
  status: SendingDomainStatus;
  /** The adapter that handed out the records (`sandbox` by default). */
  provider: string;
  lastCheckedAt: string | null;
  verifiedAt: string | null;
  records: SendingDomainRecord[];
}

const path = (workspaceId: string) => `/workspaces/${workspaceId}/order-emails/sending-domain`;

/** The store's sending domain, or null when it sends from the platform's address. */
export async function sendingDomainGet(client: ApiClient, workspaceId: string): Promise<SendingDomain | null> {
  const { sendingDomain } = await client.request<{ sendingDomain: SendingDomain | null }>(path(workspaceId));
  return sendingDomain;
}

/**
 * Adds the domain (or replaces the current one) → `pending`. 422 for a
 * malformed domain, 409 `EMAIL_DOMAIN_TAKEN` when another store sends from it.
 * `localPart` (letters, digits, `.` `_` `-`) defaults to `orders`.
 */
export async function sendingDomainAdd(
  client: ApiClient,
  workspaceId: string,
  input: { domain: string; localPart?: string }
): Promise<SendingDomain> {
  const { sendingDomain } = await client.request<{ sendingDomain: SendingDomain }>(path(workspaceId), { method: "PUT", body: input });
  return sendingDomain;
}

/** Changes only the address before the @. */
export async function sendingDomainSetLocalPart(client: ApiClient, workspaceId: string, localPart: string): Promise<SendingDomain> {
  const { sendingDomain } = await client.request<{ sendingDomain: SendingDomain }>(path(workspaceId), { method: "PATCH", body: { localPart } });
  return sendingDomain;
}

/** Checks DNS now; each record comes back with `ok`. */
export async function sendingDomainVerify(client: ApiClient, workspaceId: string): Promise<SendingDomain> {
  const { sendingDomain } = await client.request<{ sendingDomain: SendingDomain }>(`${path(workspaceId)}/verify`, { method: "POST" });
  return sendingDomain;
}

/** Removes the domain: emails go back to the platform's address. */
export async function sendingDomainRemove(client: ApiClient, workspaceId: string): Promise<void> {
  await client.request<{ sendingDomain: null }>(path(workspaceId), { method: "DELETE" });
}
