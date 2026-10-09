import type { ApiClient } from "../client";

/**
 * Platform console notifications (platformAdmin/platformNotificationRoutes.js).
 * Every call needs `overview.view`. Every admin sees the same rows — only the
 * types their permissions open — with their own read state and settings.
 */

export const ADMIN_NOTIFICATION_TYPES = [
  "user_signup",
  "workspace_created",
  "user_suspended",
  "subscription_activated",
  "subscription_expiring",
  "subscription_expired",
  "referral_signup",
  "payment_failed",
  "payment_proof_submitted",
  "support_ticket",
] as const;

export type AdminNotificationType = (typeof ADMIN_NOTIFICATION_TYPES)[number];

export interface AdminNotification {
  id: string;
  type: AdminNotificationType | string;
  /** English, and only a fallback: the console writes its own line per type. */
  title: string;
  /** Free text: a manual activation's note, a suspension's reason, a charge's failure reason. */
  body: string | null;
  /** The console page it is about: /users/{id}, /workspaces/{id}, /payment-proofs/{id} or /tickets/{id}. */
  link: string | null;
  /** Per type; amounts are minor units. */
  data: Record<string, unknown> | null;
  actorUserId: string | null;
  subjectUserId: string | null;
  subjectUserName: string | null;
  workspaceId: string | null;
  workspaceName: string | null;
  createdAt: string;
  readAt: string | null;
}

export interface AdminNotificationPage {
  notifications: AdminNotification[];
  nextCursor: string | null;
  unread: number;
}

export interface AdminNotificationPref {
  type: AdminNotificationType | string;
  /** Shown in the console. */
  enabled: boolean;
  /** Stored for later: nothing is emailed while `emailDelivery` is false. */
  email: boolean;
}

export interface AdminNotificationPrefs {
  prefs: AdminNotificationPref[];
  emailDelivery: boolean;
}

/** GET /admin/notifications — newest first; `limit` 1–50 (default 20); `cursor` is the previous page's `nextCursor`. */
export function adminListNotifications(
  client: ApiClient,
  params: { type?: string; unread?: boolean; cursor?: string | null; limit?: number } = {}
): Promise<AdminNotificationPage> {
  const query = new URLSearchParams();
  if (params.type) query.set("type", params.type);
  if (params.unread !== undefined) query.set("unread", String(params.unread));
  if (params.cursor) query.set("cursor", params.cursor);
  if (params.limit) query.set("limit", String(params.limit));
  const qs = query.toString();
  return client.request<AdminNotificationPage>(`/admin/notifications${qs ? `?${qs}` : ""}`);
}

/** GET /admin/notifications/unread-count — for the bell's badge. */
export async function adminUnreadNotificationCount(client: ApiClient): Promise<number> {
  const { unread } = await client.request<{ unread: number }>("/admin/notifications/unread-count");
  return unread;
}

/** POST /admin/notifications/read — up to 200 ids, or every unread one this admin can see. Answers the new unread count. */
export async function adminMarkNotificationsRead(client: ApiClient, target: { ids: string[] } | { all: true }): Promise<number> {
  const { unread } = await client.request<{ unread: number }>("/admin/notifications/read", { method: "POST", body: target });
  return unread;
}

/** GET /admin/notification-prefs — one row per type this admin can see. */
export function adminNotificationPrefs(client: ApiClient): Promise<AdminNotificationPrefs> {
  return client.request<AdminNotificationPrefs>("/admin/notification-prefs");
}

/** PUT /admin/notification-prefs — 1–10 rows; only the types sent change. */
export function adminSaveNotificationPrefs(client: ApiClient, prefs: AdminNotificationPref[]): Promise<AdminNotificationPrefs> {
  return client.request<AdminNotificationPrefs>("/admin/notification-prefs", { method: "PUT", body: { prefs } });
}
