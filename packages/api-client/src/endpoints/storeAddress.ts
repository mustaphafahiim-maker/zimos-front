/**
 * The store's address, <slug>.<root domain> (SPEC §17.3: the subdomain can be
 * changed in account settings). Backend: workspaces/workspaceService.js
 * (PATCH /workspaces/:id { slug }, needs workspace.manage) and
 * workspaces/slugHistory.js — a previous address keeps sending visitors to
 * the current one and stays the store's.
 */
import type { ApiClient } from "../client";
import type { SlugCheckResult } from "../types";

/** Whether `slug` may be this store's address: its own current and previous ones read as available. */
export function storeAddressCheck(client: ApiClient, slug: string, workspaceId: string, signal?: AbortSignal): Promise<SlugCheckResult> {
  const q = new URLSearchParams({ slug, workspaceId });
  return client.request<SlugCheckResult>(`/workspaces/check-slug?${q.toString()}`, { signal });
}

/** Moves the store to `slug`. 409 SLUG_TAKEN, 422 for a reserved or malformed one, 403 without workspace.manage. */
export async function storeAddressChange(client: ApiClient, workspaceId: string, slug: string): Promise<{ slug: string }> {
  const body = await client.request<{ workspace?: { slug?: string }; slug?: string }>(`/workspaces/${workspaceId}`, {
    method: "PATCH",
    body: { slug },
  });
  return { slug: body.workspace?.slug ?? body.slug ?? slug };
}

export interface PreviousStoreAddress {
  slug: string;
  retiredAt: string;
}

/** The store's previous addresses (the last three), newest first. */
export async function storeAddressPrevious(client: ApiClient, workspaceId: string): Promise<PreviousStoreAddress[]> {
  const { addresses } = await client.request<{ addresses: PreviousStoreAddress[] }>(`/workspaces/${workspaceId}/account-settings/previous-addresses`);
  return addresses;
}
