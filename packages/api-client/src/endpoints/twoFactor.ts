/**
 * Two-step sign-in (backend: src/modules/auth/securityRoutes.js,
 * twoFactorService.js, twoFactorRecovery.js). About the signed-in person, no
 * workspace.
 *
 * Sign-in: when the account has a second step and the browser is not
 * remembered, POST /auth/login answers a TwoFactorChallenge instead of
 * tokens; securityVerifyTwoFactor finishes the sign-in and keeps the tokens.
 * A backup code is typed where the sign-in code goes; each works once.
 *
 * The settings answer 404 TWO_FACTOR_UNAVAILABLE while the API runs without
 * TWO_FACTOR_ENABLED. Other codes: INVALID_TWO_FACTOR_CODE (401),
 * TOO_MANY_ATTEMPTS / TOO_MANY_CODES / TWO_FACTOR_LOCKED (429),
 * VALIDATION_ERROR on `password` (422, a wrong password in a settings form),
 * TWO_FACTOR_OFF (409, no backup codes without a second step).
 */
import type { ApiClient } from "../client";
import type { AuthUser } from "../types";

export type TwoFactorMode = "off" | "email" | "totp" | "whatsapp";

export interface TwoFactorStatus {
  mode: TwoFactorMode;
  enabledAt: string | null;
  rememberedDevices: number;
  /** False for an account that only signs in with Google: no password is asked. */
  hasPassword: boolean;
  backupCodesLeft?: number;
  backupCodesCreatedAt?: string | null;
}

export interface TwoFactorChallenge {
  twoFactorRequired: true;
  challengeToken: string;
  /** whatsapp/sms: the code went to the verified phone (sms when WhatsApp could not deliver it). */
  channel: "email" | "totp" | "whatsapp" | "sms";
  /** Masked address the code went to. */
  sentTo?: string;
  /** Too many codes were sent lately, so none went out this time. */
  codeNotSent?: boolean;
  /** The code is for a browser new to an account without two-step sign-in. */
  newDevice?: boolean;
}

/** Thrown by a sign-in that needs its second step; carries what the code screen needs. */
export class TwoFactorRequiredError extends Error {
  challenge: TwoFactorChallenge;

  constructor(challenge: TwoFactorChallenge) {
    super("Two-step sign-in required");
    this.name = "TwoFactorRequiredError";
    this.challenge = challenge;
  }
}

export function isTwoFactorChallenge(value: unknown): value is TwoFactorChallenge {
  return Boolean(value) && typeof value === "object" && (value as { twoFactorRequired?: unknown }).twoFactorRequired === true;
}

export async function securityTwoFactorStatus(client: ApiClient): Promise<TwoFactorStatus> {
  return client.request<TwoFactorStatus>("/auth/two-factor");
}

export async function securityEnableEmailCode(client: ApiClient, password: string): Promise<TwoFactorStatus> {
  return client.request<TwoFactorStatus>("/auth/two-factor/email/enable", { method: "POST", body: { password } });
}

/** The code on WhatsApp to the verified phone; SMS, then email, take over when WhatsApp cannot deliver it. */
export async function twoFactorEnableWhatsapp(client: ApiClient, password: string): Promise<TwoFactorStatus> {
  return client.request<TwoFactorStatus>("/auth/two-factor/whatsapp/enable", { method: "POST", body: { password } });
}

export async function securitySetupAuthenticator(
  client: ApiClient,
  password: string
): Promise<{ secret: string; otpauthUrl: string; qrDataUrl: string | null }> {
  return client.request("/auth/two-factor/totp/setup", { method: "POST", body: { password } });
}

export async function securityConfirmAuthenticator(client: ApiClient, code: string): Promise<TwoFactorStatus> {
  return client.request<TwoFactorStatus>("/auth/two-factor/totp/confirm", { method: "POST", body: { code } });
}

export async function securityDisableTwoFactor(client: ApiClient, password: string): Promise<TwoFactorStatus> {
  return client.request<TwoFactorStatus>("/auth/two-factor/disable", { method: "POST", body: { password } });
}

export async function securityForgetDevices(client: ApiClient): Promise<TwoFactorStatus> {
  return client.request<TwoFactorStatus>("/auth/two-factor/forget-devices", { method: "POST" });
}

/** The second step of a sign-in. On success the session is kept, like a normal login. */
export async function securityVerifyTwoFactor(
  client: ApiClient,
  payload: { challengeToken: string; code: string; rememberDevice?: boolean }
): Promise<{ user: AuthUser }> {
  const result = await client.request<{ user: AuthUser; accessToken: string; refreshToken: string }>("/auth/two-factor/verify", {
    method: "POST",
    body: payload,
    auth: false,
  });
  client.setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
  return { user: result.user };
}

// ------------------------------------------------------------ backup codes --

/** What GET /auth/two-factor says about the backup codes. */
export interface TwoFactorRecoveryStatus {
  backupCodesLeft: number;
  backupCodesCreatedAt: string | null;
}

export function twoFactorRecoveryStatus(status: TwoFactorStatus): TwoFactorRecoveryStatus {
  return { backupCodesLeft: status.backupCodesLeft ?? 0, backupCodesCreatedAt: status.backupCodesCreatedAt ?? null };
}

export interface TwoFactorRecoveryCodes {
  /** Shown once: only their hashes are kept. */
  codes: string[];
  createdAt: string;
}

/** POST /auth/two-factor/backup-codes: ten new codes; the old ones stop working. */
export function twoFactorRecoveryCreateCodes(client: ApiClient, password: string) {
  return client.request<TwoFactorRecoveryCodes>("/auth/two-factor/backup-codes", { method: "POST", body: { password } });
}

/**
 * The second step of a person as the platform console's user detail carries
 * it, or null when the answer does not say (an API that does not report it).
 */
export function twoFactorRecoveryOfUser(user: unknown): { mode: TwoFactorMode; enabledAt: string | null } | null {
  return (user as { twoFactor?: { mode: TwoFactorMode; enabledAt: string | null } } | null)?.twoFactor ?? null;
}

/** POST /admin/users/:userId/two-factor/reset (support.manage). Signs the person out everywhere. */
export function twoFactorRecoveryAdminReset(client: ApiClient, userId: string) {
  return client.request<{ mode: "off"; previousMode: TwoFactorMode }>(`/admin/users/${userId}/two-factor/reset`, { method: "POST", body: {} });
}
