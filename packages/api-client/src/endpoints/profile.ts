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
  /** `locale`: the dashboard language they use — their push, email and WhatsApp notifications are written in it. */
  input: { fullName?: string; avatarUrl?: string | null; locale?: "ar" | "en" | null },
): Promise<{ user: ProfileUser }> {
  return client.request<{ user: ProfileUser }>(`/auth/me/profile`, { method: "PATCH", body: input });
}

/** The dashboard language the server has for them (null: not sent yet). */
export function profileLocaleOf(user: AuthUser | null | undefined): "ar" | "en" | null {
  const value = (user as (AuthUser & { locale?: string | null }) | null | undefined)?.locale;
  return value === "ar" || value === "en" ? value : null;
}

/** The person's picture, or null to show their initial. */
export function profileAvatarOf(user: AuthUser | null | undefined): string | null {
  return (user as ProfileUser | null | undefined)?.avatarUrl ?? null;
}
