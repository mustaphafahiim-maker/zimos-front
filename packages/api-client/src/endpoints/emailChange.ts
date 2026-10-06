/**
 * Changing the sign-in email (backend: auth/emailChange.js, SPEC §17.3).
 *
 *   GET    /auth/me/email                  { email, pending }
 *   POST   /auth/me/email                  { newEmail, password? } → { pending }
 *   DELETE /auth/me/email                  cancel the pending change
 *   POST   /auth/email-change/confirm      { token } — the link sent to the new
 *                                          address (/account/email-change?token=…)
 *
 * Nothing changes until the link is opened; the old email still signs in until
 * then. Codes: EMAIL_UNCHANGED (400), EMAIL_TAKEN (409), INVALID_PASSWORD (400),
 * INVALID_EMAIL_CHANGE_TOKEN (400).
 */
import type { ApiClient } from "../client";
import type { AuthUser } from "../types";

export interface EmailChangePending {
  newEmail: string;
  expiresAt: string;
}

export async function emailChangeGet(client: ApiClient): Promise<{ email: string; pending: EmailChangePending | null }> {
  return client.request<{ email: string; pending: EmailChangePending | null }>(`/auth/me/email`);
}

/** `password` is required when the account has one (not for a Google-only account). */
export async function emailChangeRequest(client: ApiClient, newEmail: string, password?: string): Promise<{ pending: EmailChangePending | null }> {
  return client.request<{ pending: EmailChangePending | null }>(`/auth/me/email`, { method: "POST", body: { newEmail, ...(password ? { password } : {}) } });
}

export async function emailChangeCancel(client: ApiClient): Promise<void> {
  await client.request<unknown>(`/auth/me/email`, { method: "DELETE" });
}

export async function emailChangeConfirm(client: ApiClient, token: string): Promise<{ user: AuthUser }> {
  return client.request<{ user: AuthUser }>(`/auth/email-change/confirm`, { method: "POST", body: { token }, auth: false });
}
