/**
 * "Redirect to the primary domain" per domain (backend
 * domains/domainSettings.js). Each of a store's domains has a switch, on by
 * default: on, a visit to it moves to the primary domain; off, the store
 * opens on that domain too (useful for a domain dedicated to a funnel).
 *
 *   PATCH /workspaces/:workspaceId/domains/:domainId  { redirectToPrimary }  → { domain }   (domain.manage)
 *   GET   /workspaces/:workspaceId/domains/overview   → each domain carries `redirectToPrimary`
 *
 * The platform subdomain always moves to the primary domain.
 */
import type { ApiClient } from "../client";
import type { StoreDomain } from "./storeDesign";

/** A domain as the overview sends it. Absent (older server) means on. */
export type StoreDomainWithRedirect = StoreDomain & { redirectToPrimary?: boolean };

/** Whether visits to this domain move to the primary domain (true unless the merchant turned it off). */
export function domainRedirectsToPrimary(domain: StoreDomain): boolean {
  return (domain as StoreDomainWithRedirect).redirectToPrimary !== false;
}

export async function domainSetRedirectToPrimary(
  client: ApiClient,
  workspaceId: string,
  domainId: string,
  redirectToPrimary: boolean
): Promise<StoreDomainWithRedirect> {
  const { domain } = await client.request<{ domain: StoreDomainWithRedirect }>(
    "/workspaces/" + workspaceId + "/domains/" + domainId,
    { method: "PATCH", body: { redirectToPrimary } }
  );
  return domain;
}
