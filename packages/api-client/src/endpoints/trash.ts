/**
 * The trash for funnels, websites and pages (backend: frontend-handoff item 373).
 *
 * Deleting one of them moves it here for `retentionDays` (30): it stops serving at once and
 * leaves every list, but keeps everything hanging off it until it is restored or purged.
 *
 *   GET    /workspaces/:ws/trash?kind=                 → TrashListing (newest first; only the kinds
 *          the teammate may manage: funnels.manage / website.edit; 403 with neither)
 *   POST   /workspaces/:ws/trash/:kind/:id/restore     → { restored, kind, id, item }
 *          A published funnel or website comes back live, so it also needs funnels.publish /
 *          website.publish (403 FORBIDDEN), a confirmed account (403 EMAIL_NOT_VERIFIED) and a
 *          live store (403 SUBSCRIPTION_REQUIRED). 404 NOT_FOUND, 409 WEBSITE_IN_TRASH.
 *   DELETE /workspaces/:ws/trash/:kind/:id             → { purged, kind, id }, for good.
 *          409 WEBSITE_HAS_DOMAINS when it is the store's only website and domains point at it.
 *
 * The delete endpoints themselves are the same calls; they now answer
 * `{ deleted, trashed, purgeAt }` (`TrashedAnswer`).
 */
import type { ApiClient } from "../client";

export type TrashKind = "funnel" | "website" | "page";

export interface TrashItem {
  kind: TrashKind;
  id: string;
  name: string;
  /** Funnels and websites: the link it held (and still holds while in the trash). */
  subdomain?: string | null;
  /** Funnels and websites: "published" comes back live on restore. */
  status?: string | null;
  /** Pages only. */
  path?: string | null;
  websiteId?: string | null;
  websiteName?: string | null;
  /** The page's website is in the trash too: restore the website first. */
  websiteInTrash?: boolean;
  wasLive?: boolean;
  deletedAt: string;
  /** Null when the teammate was removed since. */
  deletedBy: { id: string; fullName: string } | null;
  /** When the backend deletes it for good on its own. */
  purgeAt: string;
}

export interface TrashListing {
  retentionDays: number;
  items: TrashItem[];
}

/** What a delete of a funnel, website or page answers now. */
export interface TrashedAnswer {
  deleted: boolean;
  trashed?: boolean;
  purgeAt?: string;
  wasLive?: boolean;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/trash`;

export function trashList(client: ApiClient, workspaceId: string, kind?: TrashKind): Promise<TrashListing> {
  return client.request<TrashListing>(kind ? `${base(workspaceId)}?kind=${kind}` : base(workspaceId));
}

export function trashRestore(client: ApiClient, workspaceId: string, kind: TrashKind, id: string) {
  return client.request<{ restored: boolean; kind: TrashKind; id: string; item: unknown }>(`${base(workspaceId)}/${kind}/${id}/restore`, { method: "POST" });
}

export function trashPurge(client: ApiClient, workspaceId: string, kind: TrashKind, id: string) {
  return client.request<{ purged: boolean; kind: TrashKind; id: string }>(`${base(workspaceId)}/${kind}/${id}`, { method: "DELETE" });
}
