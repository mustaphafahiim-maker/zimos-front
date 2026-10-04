/**
 * Getting back into an account whose second step is out of reach (backend:
 * src/modules/auth/twoFactorRecovery.js). All exported names in this file are
 * prefixed with `twoFactorRecovery` / `TwoFactorRecovery`.
 *
 * A backup code is typed where the sign-in code goes (securityVerifyTwoFactor
 * takes it as `code`); each works once. Codes: 409 TWO_FACTOR_OFF (no codes
 * without a second step), 422 VALIDATION_ERROR on `password`, 403 without
 * the platform's support.manage.
 */
import type { ApiClient } from "../client";
import type { TwoFactorMode, TwoFactorStatus } from "./security";

/** What GET /auth/two-factor adds about the backup codes. */
export interface TwoFactorRecoveryStatus {
  backupCodesLeft: number;
  backupCodesCreatedAt: string | null;
}

export function twoFactorRecoveryStatus(status: TwoFactorStatus): TwoFactorRecoveryStatus {
  const s = status as TwoFactorStatus & Partial<TwoFactorRecoveryStatus>;
  return { backupCodesLeft: s.backupCodesLeft ?? 0, backupCodesCreatedAt: s.backupCodesCreatedAt ?? null };
}

export interface TwoFactorRecoveryCodes {
  /** Shown once: only their hashes are kept. */
  codes: string[];
  createdAt: string;
}

/** POST /auth/two-factor/backup-codes — ten new codes; the old ones stop working. */
export function twoFactorRecoveryCreateCodes(client: ApiClient, password: string) {
  return client.request<TwoFactorRecoveryCodes>("/auth/two-factor/backup-codes", { method: "POST", body: { password } });
}

/** The platform console's user detail carries the person's second step. */
export function twoFactorRecoveryOfUser(user: unknown): { mode: TwoFactorMode; enabledAt: string | null } {
  const tf = (user as { twoFactor?: { mode: TwoFactorMode; enabledAt: string | null } }).twoFactor;
  return tf ?? { mode: "off", enabledAt: null };
}

/** POST /admin/users/:userId/two-factor/reset — support.manage. Signs the person out everywhere. */
export function twoFactorRecoveryAdminReset(client: ApiClient, userId: string) {
  return client.request<{ mode: "off"; previousMode: TwoFactorMode }>(`/admin/users/${userId}/two-factor/reset`, { method: "POST", body: {} });
}
