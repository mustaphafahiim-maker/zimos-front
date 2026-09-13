/**
 * Custom domains endpoints (backend: src/modules/domains). Owned by the reviews/returns/domains/templates wiring task.
 * All exported names in this file are prefixed with `domains`.
 *
 * Staff routes, mounted at /workspaces/:workspaceId/domains, permission `domain.manage`.
 */
import type { ApiClient } from "../client";

/** Exact enum from db/models/Domain.js. */
export type DomainStatus = "pending_verification" | "verified" | "active" | "failed";

/** The DNS TXT record proving control: value is `zimos-verify=<token>`. */
export interface DomainVerificationRecord {
  type: "TXT";
  name: string;
  value: string;
}

export interface DomainDTO {
  id: string;
  hostname: string;
  status: DomainStatus;
  verifiedAt: string | null;
  /** Present on list and add responses; not on verify. */
  record?: DomainVerificationRecord;
}

export interface DomainsAddResult {
  domain: DomainDTO;
  record: DomainVerificationRecord;
  next?: string;
}

export async function domainsList(client: ApiClient, workspaceId: string) {
  const { domains } = await client.request<{ domains: DomainDTO[] }>(`/workspaces/${workspaceId}/domains`);
  return domains;
}

export async function domainsAdd(client: ApiClient, workspaceId: string, hostname: string) {
  return client.request<DomainsAddResult>(`/workspaces/${workspaceId}/domains`, {
    method: "POST",
    body: { hostname },
  });
}

/** Resolves with the verified domain; rejects with ApiError code DOMAIN_NOT_VERIFIED (400) when the TXT record is missing. */
export async function domainsVerify(client: ApiClient, workspaceId: string, domainId: string) {
  const { domain } = await client.request<{ domain: DomainDTO }>(
    `/workspaces/${workspaceId}/domains/${domainId}/verify`,
    { method: "POST" }
  );
  return domain;
}

export async function domainsRemove(client: ApiClient, workspaceId: string, domainId: string) {
  return client.request<{ deleted: boolean; id: string }>(`/workspaces/${workspaceId}/domains/${domainId}`, {
    method: "DELETE",
  });
}
