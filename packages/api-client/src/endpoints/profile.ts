/**
 * The signed-in person's own name and picture (backend: auth/profileRoutes.js).
 *
 *   PATCH /auth/me/profile   { fullName?, avatarUrl? } — avatarUrl is a public
 *                            image URL (upload it to the media library first);
 *                            null removes the picture
 */
import type { ApiClient } from "../client";
import type { AuthUser } from "../types";

/** AuthUser as /auth/me returns it since the picture was added. */
export type ProfileUser = AuthUser & { avatarUrl?: string | null };

export async function profileUpdate(
  client: ApiClient,
  input: { fullName?: string; avatarUrl?: string | null },
): Promise<{ user: ProfileUser }> {
  return client.request<{ user: ProfileUser }>(`/auth/me/profile`, { method: "PATCH", body: input });
}

/** The person's picture, or null to show their initial. */
export function profileAvatarOf(user: AuthUser | null | undefined): string | null {
  return (user as ProfileUser | null | undefined)?.avatarUrl ?? null;
}
