/**
 * The account's own sign-in details and what it was offered (backend: auth/, team/,
 * storeTransfer/ — frontend-handoff items 330, 331, 332, 358, 379).
 *
 *   POST  /auth/login                         { identifier, password, locale } — email or username
 *   GET   /auth/signup-options                + confirmByCode, phoneRequired
 *   GET   /auth/me                            + confirmed, account { hasPassword, phoneChange }
 *   POST  /auth/me/email/send-code            a 6-digit code to the account's email
 *   POST  /auth/me/email/confirm              { code } — no new tokens
 *   POST  /auth/password-reset/request        { email, locale }
 *   PATCH /auth/me/name                       { fullName }
 *   POST  /auth/me/reauth-code                a code to the current email (accounts without a password)
 *   POST  /auth/me/email-change (+/confirm)   a code to the new address; confirm answers new tokens
 *   POST  /auth/me/phone-change (+/confirm)   an SMS code to the new number
 *   GET   /me/invites, POST /me/invites/:id/accept|decline
 *   GET|DELETE /workspaces/:ws/ownership-transfer   the pending offer / withdraw it
 *   GET   /me/ownership-offers, POST /me/ownership-offers/:ws/accept|decline
 *
 * Code errors everywhere: 422 INVALID_CODE (details.attemptsLeft) / CODE_EXPIRED / NO_ACTIVE_CODE,
 * 429 TOO_MANY_ATTEMPTS / RESEND_TOO_SOON (details.retryAfterSeconds) / VERIFICATION_LIMIT_REACHED.
 */
import { ApiError, type ApiClient } from "../client";
import type { AuthTokens, AuthUser, LoginPayload, SignupOptions } from "../types";
import type { StoreTransferKeepAs, StoreTransferResult } from "./storeTransfer";

/** The error's code as the server sent it (codes newer than the typed list included). */
export function accountErrorCode(err: unknown): string | undefined {
  return err instanceof ApiError ? (err.code as string | undefined) : undefined;
}

// ------------------------------------------------------------------ sign-in --

/** The sign-in body: `identifier` is the email or the username, any case. */
export function accountLoginPayload(identifier: string, password: string, locale?: "ar" | "en"): LoginPayload {
  return { identifier: identifier.trim(), password, ...(locale ? { locale } : {}) } as unknown as LoginPayload;
}

export interface AccountSignupSwitches {
  /** A new account is signed in at once and confirms its email with a code in the dashboard. */
  confirmByCode: boolean;
  /** Sign-up must send a mobile number. */
  phoneRequired: boolean;
}

export function accountSignupSwitches(options: SignupOptions | null | undefined): AccountSignupSwitches {
  const raw = (options ?? {}) as Partial<AccountSignupSwitches>;
  return { confirmByCode: raw.confirmByCode === true, phoneRequired: raw.phoneRequired === true };
}

/** What a code request answers. `sent` false: no code could be sent (sign-up only). */
export interface AccountCodeSent {
  sent: boolean;
  channel?: "email" | "sms";
  /** Masked. Null while the phone change is switched off. */
  target?: string | null;
  expiresAt?: string;
  resendAvailableAt?: string;
}

/** The `emailCode` of a sign-up answered with `confirmByCode` on (null otherwise). */
export function accountSignupEmailCode(registerAnswer: unknown): AccountCodeSent | null {
  const code = (registerAnswer as { emailCode?: AccountCodeSent } | null)?.emailCode;
  return code && typeof code === "object" ? code : null;
}

// ---------------------------------------------------------------- /auth/me --

export interface AccountFlags {
  /** The email (or phone) is confirmed. Absent on an older server: treated as confirmed. */
  confirmed: boolean;
  /** False: an account made through Google — it proves itself with a code to its email. */
  hasPassword: boolean;
  /** The server lets a number be changed by SMS code. */
  phoneChange: boolean;
}

export async function accountFlags(client: ApiClient): Promise<AccountFlags> {
  const body = await client.request<{ confirmed?: boolean; account?: { hasPassword?: boolean; phoneChange?: boolean } }>(`/auth/me`);
  return {
    confirmed: body.confirmed !== false,
    hasPassword: body.account?.hasPassword !== false,
    phoneChange: body.account?.phoneChange === true,
  };
}

// ------------------------------------------------------ confirm the email --

export async function accountEmailCodeSend(client: ApiClient, locale: "ar" | "en"): Promise<AccountCodeSent> {
  return client.request<AccountCodeSent>(`/auth/me/email/send-code`, { method: "POST", body: { locale } });
}

export async function accountEmailCodeConfirm(client: ApiClient, code: string): Promise<{ user: AuthUser; confirmed: boolean }> {
  return client.request<{ user: AuthUser; confirmed: boolean }>(`/auth/me/email/confirm`, { method: "POST", body: { code } });
}

// ---------------------------------------------------------- password reset --

/** Always `{ success: true }`, whatever the address. 429 RATE_LIMITED, 503 PASSWORD_RESET_UNAVAILABLE. */
export async function accountPasswordResetRequest(client: ApiClient, email: string, locale: "ar" | "en"): Promise<{ success: boolean }> {
  return client.request<{ success: boolean }>(`/auth/password-reset/request`, { method: "POST", body: { email, locale }, auth: false });
}

// --------------------------------------------------- name, email and phone --

/** 422 INVALID_NAME (2 to 200 characters). */
export async function accountNameSave(client: ApiClient, fullName: string): Promise<{ user: AuthUser }> {
  return client.request<{ user: AuthUser }>(`/auth/me/name`, { method: "PATCH", body: { fullName } });
}

/** For an account without a password. 409 PASSWORD_REQUIRED, 503 EMAIL_UNAVAILABLE. */
export async function accountReauthCode(client: ApiClient, locale: "ar" | "en"): Promise<AccountCodeSent> {
  return client.request<AccountCodeSent>(`/auth/me/reauth-code`, { method: "POST", body: { locale } });
}

/** How the person proves it is them: the password, or the code sent to the current email. */
export type AccountProof = { currentPassword: string } | { reauthCode: string };

/** 422 SAME_EMAIL / INVALID_PASSWORD / REAUTH_CODE_REQUIRED, 503 EMAIL_UNAVAILABLE. */
export async function accountEmailChangeRequest(
  client: ApiClient,
  input: { newEmail: string; locale: "ar" | "en" } & AccountProof,
): Promise<AccountCodeSent> {
  return client.request<AccountCodeSent>(`/auth/me/email-change`, { method: "POST", body: input });
}

/**
 * Changes the email. Every other session has ended, the current access token
 * included: the new tokens are kept at once. 409 EMAIL_TAKEN.
 */
export async function accountEmailChangeConfirm(client: ApiClient, code: string): Promise<{ user: AuthUser }> {
  const result = await client.request<{ user: AuthUser } & Partial<AuthTokens>>(`/auth/me/email-change/confirm`, { method: "POST", body: { code } });
  if (result.accessToken) client.setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
  return { user: result.user };
}

/** 422 INVALID_PHONE / SAME_PHONE / PHONE_COUNTRY_NOT_SUPPORTED, 503 SMS_UNAVAILABLE. */
export async function accountPhoneChangeRequest(
  client: ApiClient,
  input: { newPhone: string; locale: "ar" | "en" } & AccountProof,
): Promise<AccountCodeSent> {
  return client.request<AccountCodeSent>(`/auth/me/phone-change`, { method: "POST", body: input });
}

export async function accountPhoneChangeConfirm(client: ApiClient, code: string): Promise<{ user: AuthUser }> {
  return client.request<{ user: AuthUser }>(`/auth/me/phone-change/confirm`, { method: "POST", body: { code } });
}

// ----------------------------------------------------------- team invites --

export interface AccountInvite {
  /** The membership id. */
  id: string;
  workspace: { id: string; name: string; slug: string };
  role: { id: string; key: string; name: string };
  invitedAt: string;
}

export interface AccountInvites {
  /** False: the account must confirm its email before it sees its invitations. */
  emailConfirmed: boolean;
  invites: AccountInvite[];
}

export async function accountInvites(client: ApiClient): Promise<AccountInvites> {
  const body = await client.request<Partial<AccountInvites>>(`/me/invites`);
  return { emailConfirmed: body.emailConfirmed !== false, invites: body.invites ?? [] };
}

/** 409 EMAIL_NOT_CONFIRMED / ALREADY_MEMBER, 404 when the invite is gone. */
export async function accountInviteAccept(client: ApiClient, membershipId: string): Promise<{ workspace: AccountInvite["workspace"] }> {
  return client.request<{ workspace: AccountInvite["workspace"] }>(`/me/invites/${membershipId}/accept`, { method: "POST" });
}

export async function accountInviteDecline(client: ApiClient, membershipId: string): Promise<void> {
  await client.request<unknown>(`/me/invites/${membershipId}/decline`, { method: "POST" });
}

// --------------------------------------------------- store transfer offers --

/** A transfer waiting for the new owner's yes (the store has not moved). */
export interface StoreTransferOffer {
  toUserId: string;
  fromUserId: string;
  keepAs: StoreTransferKeepAs;
  createdAt: string;
  expiresAt: string;
  toUser?: { userId: string; fullName: string | null; email: string } | null;
}

const transferBase = (workspaceId: string) => `/workspaces/${workspaceId}/ownership-transfer`;

/** The owner's pending offer for this store, or null. */
export async function storeTransferOfferGet(client: ApiClient, workspaceId: string): Promise<StoreTransferOffer | null> {
  const { offer } = await client.request<{ offer: StoreTransferOffer | null }>(transferBase(workspaceId));
  return offer ?? null;
}

/**
 * Sends the offer (201). The store moves when the person accepts it; a new offer
 * replaces the old one. 409 NEW_OWNER_NOT_CONFIRMED / PLAN_LIMIT_REACHED, 403 NOT_STORE_OWNER.
 */
export async function storeTransferOfferSend(
  client: ApiClient,
  workspaceId: string,
  payload: { newOwnerUserId: string; password: string; keepAs?: StoreTransferKeepAs },
): Promise<StoreTransferOffer | null> {
  const body = await client.request<{ offer?: StoreTransferOffer | null }>(transferBase(workspaceId), { method: "POST", body: payload });
  return body.offer ?? null;
}

export async function storeTransferOfferWithdraw(client: ApiClient, workspaceId: string): Promise<void> {
  await client.request<unknown>(transferBase(workspaceId), { method: "DELETE" });
}

/** A store someone wants to give to the signed-in person. */
export interface OwnershipOffer {
  workspaceId: string;
  workspaceName: string;
  from: { fullName: string | null; email: string };
  keepAs: StoreTransferKeepAs;
  expiresAt: string;
}

export async function ownershipOffers(client: ApiClient): Promise<OwnershipOffer[]> {
  const { offers } = await client.request<{ offers?: OwnershipOffer[] }>(`/me/ownership-offers`);
  return offers ?? [];
}

/** Every check runs again: 404 (gone or expired), 409 OFFER_NO_LONGER_VALID / PLAN_LIMIT_REACHED. */
export async function ownershipOfferAccept(client: ApiClient, workspaceId: string): Promise<StoreTransferResult> {
  return client.request<StoreTransferResult>(`/me/ownership-offers/${workspaceId}/accept`, { method: "POST" });
}

export async function ownershipOfferDecline(client: ApiClient, workspaceId: string): Promise<void> {
  await client.request<unknown>(`/me/ownership-offers/${workspaceId}/decline`, { method: "POST" });
}
