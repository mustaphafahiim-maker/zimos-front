/**
 * Team access and account security (backend: src/modules/team,
 * src/modules/auth/securityRoutes.js + twoFactorService.js,
 * src/modules/supportAccess, src/modules/audit).
 *
 * - Team: /workspaces/:id/team (users.manage) — the invite by sections.
 * - Devices and two-step sign-in: /auth/* — about the signed-in person, no
 *   workspace.
 * - Support access: /workspaces/:id/support-access (workspace.manage).
 * - Activity log: /workspaces/:id/audit-logs (audit_log.view).
 *
 * Sign-in: when the account has a second step and the browser is not
 * remembered, POST /auth/login answers a TwoFactorChallenge instead of
 * tokens; securityVerifyTwoFactor finishes the sign-in and keeps the tokens.
 *
 * Notable codes: PLAN_LIMIT_REACHED (402 — the plan's team size),
 * INVALID_TWO_FACTOR_CODE (401), TOO_MANY_ATTEMPTS / TOO_MANY_CODES (429),
 * VALIDATION_ERROR on `password` (422 — a wrong password in a settings form).
 */
import type { ApiClient } from "../client";
import type { AuthUser } from "../types";

// -------------------------------------------------------------------- team --

export interface TeamAccessSection {
  key: string;
  permissions: string[];
}

export interface TeamAccessOptions {
  sections: TeamAccessSection[];
  /** Every permission, for the "Advanced" view. */
  permissions: string[];
  ownerOnly: string[];
  /** `limit` null = the plan sets no team size. */
  seats: { used: number; members: number; invited: number; limit: number | null };
}

export interface TeamInvitePayload {
  email: string;
  access: "admin" | "partial";
  sections?: string[];
  permissions?: string[];
}

const teamBase = (workspaceId: string) => `/workspaces/${workspaceId}/team`;

export async function teamAccessOptions(client: ApiClient, workspaceId: string): Promise<TeamAccessOptions> {
  return client.request<TeamAccessOptions>(`${teamBase(workspaceId)}/access-options`);
}

export async function teamInvite(
  client: ApiClient,
  workspaceId: string,
  payload: TeamInvitePayload
): Promise<{ membership: { id: string; status: string }; role: { id: string; key: string; name: string; permissions: string[] } }> {
  return client.request(`${teamBase(workspaceId)}/invite`, { method: "POST", body: payload });
}

// ----------------------------------------------------------------- devices --

export interface SignedInDevice {
  id: string;
  browser: string | null;
  os: string | null;
  ipAddress: string | null;
  lastActiveAt: string;
  expiresAt: string;
  isCurrent: boolean;
}

export async function securityListDevices(client: ApiClient): Promise<SignedInDevice[]> {
  const { devices } = await client.request<{ devices: SignedInDevice[] }>("/auth/devices");
  return devices;
}

export async function securityEndSession(client: ApiClient, sessionId: string): Promise<void> {
  await client.request(`/auth/sessions/${sessionId}/revoke`, { method: "POST" });
}

/** Signs out everywhere, this browser included. */
export async function securityEndAllSessions(client: ApiClient): Promise<void> {
  await client.request("/auth/sessions/revoke-all", { method: "POST" });
}

// -------------------------------------------------------- two-step sign-in --

export type TwoFactorMode = "off" | "email" | "totp" | "whatsapp";

export interface TwoFactorStatus {
  mode: TwoFactorMode;
  enabledAt: string | null;
  rememberedDevices: number;
  /** False for an account that only signs in with Google: no password is asked. */
  hasPassword: boolean;
}

export interface TwoFactorChallenge {
  twoFactorRequired: true;
  challengeToken: string;
  /** whatsapp/sms: the code went to the verified phone (sms when WhatsApp could not deliver it). */
  channel: "email" | "totp" | "whatsapp" | "sms";
  /** Masked address the code went to (email channel). */
  sentTo?: string;
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
  const result = await client.request<{ user: AuthUser; accessToken: string; refreshToken?: string }>("/auth/two-factor/verify", {
    method: "POST",
    body: payload,
    auth: false,
  });
  client.setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken ?? null });
  return { user: result.user };
}

// ---------------------------------------------------------- support access --

export interface SupportAccessGrant {
  id: string;
  note: string | null;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  active: boolean;
}

export interface SupportAccessState {
  active: SupportAccessGrant | null;
  history: SupportAccessGrant[];
  /** The durations on offer, in hours. */
  durations: number[];
}

const supportBase = (workspaceId: string) => `/workspaces/${workspaceId}/support-access`;

export async function supportAccessGet(client: ApiClient, workspaceId: string): Promise<SupportAccessState> {
  return client.request<SupportAccessState>(supportBase(workspaceId));
}

export async function supportAccessGrant(client: ApiClient, workspaceId: string, hours: number, note?: string): Promise<SupportAccessGrant> {
  const { active } = await client.request<{ active: SupportAccessGrant }>(supportBase(workspaceId), { method: "POST", body: { hours, note: note ?? "" } });
  return active;
}

export async function supportAccessRevoke(client: ApiClient, workspaceId: string): Promise<void> {
  await client.request(supportBase(workspaceId), { method: "DELETE" });
}

// ------------------------------------------------------------ activity log --

export interface ActivityLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
  ipAddress: string | null;
  actor: { id: string; fullName: string | null; email: string } | null;
  before: unknown;
  after: unknown;
}

export interface ActivityLogParams {
  limit?: number;
  /** `nextCursor` of the previous page. */
  before?: string;
  /** Prefix of the action name: "order", "product", "membership"… */
  action?: string;
  actorUserId?: string;
  from?: string;
}

export async function activityLogList(
  client: ApiClient,
  workspaceId: string,
  params: ActivityLogParams = {}
): Promise<{ logs: ActivityLogEntry[]; nextCursor: string | null }> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return client.request(`/workspaces/${workspaceId}/audit-logs${suffix}`);
}
