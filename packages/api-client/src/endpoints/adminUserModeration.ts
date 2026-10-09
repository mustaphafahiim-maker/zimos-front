import type { ApiClient } from "../client";
import type { AdminUserDetail, AdminUserRow, AdminUserSearchPage, AdminUserStore } from "../types";

/**
 * Platform console: suspend, unsuspend and delete an account
 * (platformAdmin/userModerationService.js). All three need `workspaces.manage`
 * and `confirm: true`, which these functions send — the console asks first.
 *
 * Errors: 409 CANNOT_ACT_ON_SELF, 403 CREATOR_REQUIRED, 403 ADMINS_MANAGE_REQUIRED,
 * 409 LAST_CREATOR, 409 USER_ALREADY_SUSPENDED, 409 USER_NOT_SUSPENDED,
 * 409 USER_DELETED, 409 OWNS_STORES (delete without `stores`), 404 NOT_FOUND.
 */

/** The account after a moderation call. */
export interface AdminUserModerationResult {
  id: string;
  /** "active", "pending_verification" or "suspended" (a deleted account stays "suspended"). */
  status: string;
  suspendedAt: string | null;
  suspendedReason: string | null;
  deletedAt: string | null;
  /** Delete only: the stores this deletion suspended (already suspended ones are not listed). */
  suspendedStores?: string[];
}

/** What GET /admin/users/:id adds for moderation. */
export interface AdminUserModerationState {
  suspendedAt: string | null;
  suspendedReason: string | null;
  deletedAt: string | null;
  deleted: boolean;
}

/** A store row with `owner`: true only for the owner of record (not a member on the Owner role). */
export type AdminUserStoreWithOwner = AdminUserStore & { owner?: boolean };

/** A user search row with the `deleted` flag. */
export type AdminUserRowWithDeleted = Omit<AdminUserRow, "workspaces"> & {
  deleted?: boolean;
  workspaces: AdminUserStoreWithOwner[];
};

export interface AdminUserSearchPageWithDeleted extends Omit<AdminUserSearchPage, "users"> {
  users: AdminUserRowWithDeleted[];
}

/** The moderation fields of a console user, with safe defaults for an older server. */
export function adminUserModerationOf(user: AdminUserDetail | AdminUserRow | AdminUserRowWithDeleted): AdminUserModerationState {
  const u = user as Partial<AdminUserModerationState>;
  return {
    suspendedAt: u.suspendedAt ?? null,
    suspendedReason: u.suspendedReason ?? null,
    deletedAt: u.deletedAt ?? null,
    deleted: Boolean(u.deleted ?? u.deletedAt),
  };
}

/** The stores this account owns of record — what a deletion has to suspend. */
export function adminUserOwnedStores(user: { workspaces: AdminUserStore[] }): AdminUserStoreWithOwner[] {
  return (user.workspaces as AdminUserStoreWithOwner[]).filter((s) => s.owner === true);
}

/** GET /admin/users — deleted accounts are left out unless `includeDeleted`. */
export function adminSearchUsersWithDeleted(
  client: ApiClient,
  params: { q?: string; page?: number; limit?: number; includeDeleted?: boolean } = {}
): Promise<AdminUserSearchPageWithDeleted> {
  const query = new URLSearchParams();
  if (params.q) query.set("q", params.q);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.includeDeleted) query.set("includeDeleted", "true");
  const qs = query.toString();
  return client.request<AdminUserSearchPageWithDeleted>(`/admin/users${qs ? `?${qs}` : ""}`);
}

async function moderate(client: ApiClient, userId: string, action: string, body: Record<string, unknown>) {
  const { user } = await client.request<{ user: AdminUserModerationResult }>(`/admin/users/${userId}/${action}`, {
    method: "POST",
    body: { ...body, confirm: true },
  });
  return user;
}

/** POST /admin/users/:userId/suspend — `reason` 2–500 characters. Signs the account out everywhere. */
export function adminSuspendUser(client: ApiClient, userId: string, reason: string) {
  return moderate(client, userId, "suspend", { reason });
}

/** POST /admin/users/:userId/unsuspend — `reason` optional (up to 500). */
export function adminUnsuspendUser(client: ApiClient, userId: string, reason?: string) {
  return moderate(client, userId, "unsuspend", reason ? { reason } : {});
}

/** POST /admin/users/:userId/delete — `suspendStores` is required when the account owns any store. */
export function adminDeleteUser(client: ApiClient, userId: string, input: { reason?: string; suspendStores?: boolean } = {}) {
  return moderate(client, userId, "delete", {
    ...(input.reason ? { reason: input.reason } : {}),
    ...(input.suspendStores ? { stores: "suspend" } : {}),
  });
}
