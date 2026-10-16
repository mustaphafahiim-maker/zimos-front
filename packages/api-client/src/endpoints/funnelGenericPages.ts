/**
 * A funnel's generic pages — contact, about, policies — off the map (backend
 * funnels/genericPages.js): a `custom` step no edge touches, served from the
 * published revision by its own address. Public, no login.
 */
import type { ApiClient } from "../client";
import type { FunnelOwnSettings } from "./funnelExtras";
import type { FunnelRuntimeStep } from "./funnelRuntime";

export interface FunnelGenericPageLink {
  key: string;
  name: string;
}

export interface FunnelGenericPage {
  funnel: { id: string; name: string; subdomain: string | null; settings?: FunnelOwnSettings };
  /** As a step on the path is served: its tree in the shopper's language, scripts and HTML blocks. */
  step: FunnelRuntimeStep & { id: string | null; scripts?: unknown; htmlBlocks?: unknown };
  /** Every generic page of the funnel, for a page's own links between them. */
  pages: FunnelGenericPageLink[];
}

const base = (workspaceId: string, funnelRef: string) => `/store/${encodeURIComponent(workspaceId)}/funnels/${encodeURIComponent(funnelRef)}/pages`;

/** `funnelRef` is the funnel's id or subdomain. */
export async function funnelGenericPageGet(client: ApiClient, workspaceId: string, funnelRef: string, key: string): Promise<FunnelGenericPage> {
  return client.request<FunnelGenericPage>(`${base(workspaceId, funnelRef)}/${encodeURIComponent(key)}`, { auth: false });
}

export async function funnelGenericPagesList(
  client: ApiClient,
  workspaceId: string,
  funnelRef: string
): Promise<{ funnel: FunnelGenericPage["funnel"]; pages: FunnelGenericPageLink[] }> {
  return client.request(`${base(workspaceId, funnelRef)}`, { auth: false });
}
