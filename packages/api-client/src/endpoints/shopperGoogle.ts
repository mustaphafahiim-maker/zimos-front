/**
 * Sign in with Google for shopper accounts, and verified emails (backend:
 * frontend-handoff items 217, 278 and 279; src/modules/shopperAccounts/google
 * and shopperAuth.js).
 *
 * The storefront shows Google's own button (Google Identity Services); Google
 * hands the browser an ID token, and the API signs the shopper in to the
 * store's existing contact with that verified email. It never creates one —
 * a contact needs a phone — and only an email the shopper has verified on
 * their account counts (278).
 *
 * Dashboard (permission workspace.manage), /workspaces/:ws/shopper-accounts/google:
 *   GET → ShopperGoogleSettings
 *   PUT { enabled, clientId? } → the same. `clientId` is the store's own web
 *       client id (…apps.googleusercontent.com), needed on a custom domain;
 *       empty uses the platform's when `platformClientAvailable`. 422 on
 *       `clientId` when switched on with neither.
 *
 * Storefront, /store/:ws/account/google:
 *   GET  → ShopperGoogleConfig. `nonce` (279) goes to
 *          google.accounts.id.initialize({ client_id, nonce, callback }); it
 *          lasts 10 minutes, so the config is read again each time the button
 *          is shown.
 *   POST { idToken } → ShopperGoogleSession: the same X-Shopper-Token as a code
 *          sign-in. With the X-Shopper-Token header (already signed in) it
 *          links Google instead: the Google email becomes the shopper's
 *          verified email, and the answer carries `linked: true`.
 *          404 GOOGLE_SIGN_IN_OFF · 401 GOOGLE_TOKEN_INVALID (also a stale
 *          nonce: read the config again) · 422 GOOGLE_EMAIL_UNVERIFIED ·
 *          404 ACCOUNT_NOT_FOUND (no account with that verified email).
 *
 * Verifying an email (278), signed in, /store/:ws/account/email:
 *   POST /code   { email, locale } → ShopperEmailCodeSent
 *   POST /verify { email, code }   → the account, with customer.emailVerified true
 *          422 INVALID_CODE (details.attemptsLeft) / CODE_EXPIRED,
 *          429 TOO_MANY_ATTEMPTS / TOO_MANY_CODES.
 */
import { ApiError, type ApiClient } from "../client";
import type { ShopperMe, ShopperProfile } from "./shopperAccounts";

// ---------------------------------------------------------------- staff --

export interface ShopperGoogleSettings {
  /** On, and with a client id to run on (the store's or the platform's). */
  enabled: boolean;
  /** The store's own web client id; null when it uses the platform's. */
  clientId: string | null;
  /** The platform has a Google client of its own for stores without one. */
  platformClientAvailable: boolean;
}

/** The shape the API takes for a web client id. */
export const GOOGLE_CLIENT_ID_PATTERN = /^[0-9]+-[a-z0-9]+\.apps\.googleusercontent\.com$/;

export function shopperGoogleGet(client: ApiClient, workspaceId: string): Promise<ShopperGoogleSettings> {
  return client.request<ShopperGoogleSettings>(`/workspaces/${workspaceId}/shopper-accounts/google`);
}

export function shopperGoogleSave(
  client: ApiClient,
  workspaceId: string,
  body: { enabled: boolean; clientId?: string | null }
): Promise<ShopperGoogleSettings> {
  return client.request<ShopperGoogleSettings>(`/workspaces/${workspaceId}/shopper-accounts/google`, { method: "PUT", body });
}

// -------------------------------------------------------------- shopper --

export interface ShopperGoogleConfig {
  /** Shopper accounts are on and so is Google sign-in: show the button. */
  enabled: boolean;
  clientId: string | null;
  /** This store's sign-in nonce for Google's button, good for 10 minutes; null while off. */
  nonce: string | null;
}

export interface ShopperGoogleSession {
  token: string;
  expiresInSeconds: number;
  /** Present (true) when Google was linked to the signed-in shopper. */
  linked?: boolean;
  customer: { id: string; fullName: string | null; email: string | null };
}

/** How long a nonce is good for; the button's config is read again before that. */
export const SHOPPER_GOOGLE_NONCE_SECONDS = 10 * 60;

const base = (workspaceRef: string) => `/store/${workspaceRef}/account`;

export function shopperGoogleConfig(client: ApiClient, workspaceRef: string): Promise<ShopperGoogleConfig> {
  return client.request<ShopperGoogleConfig>(`${base(workspaceRef)}/google`, { auth: false });
}

/**
 * Signs in with Google's ID token — or, with the signed-in shopper's token,
 * links Google to their account.
 */
export function shopperGoogleSignIn(
  client: ApiClient,
  workspaceRef: string,
  idToken: string,
  shopperToken?: string | null
): Promise<ShopperGoogleSession> {
  return client.request<ShopperGoogleSession>(`${base(workspaceRef)}/google`, {
    method: "POST",
    body: { idToken },
    auth: false,
    ...(shopperToken ? { headers: { "X-Shopper-Token": shopperToken } } : {}),
  });
}

/**
 * Why Google sign-in was refused: "off" (the store no longer offers it),
 * "token" (Google's answer was not accepted, or its nonce went stale — read
 * the config again), "unverified" (the Google account's email is not
 * verified), "no_account" (no account here with that verified email),
 * "busy" (too many tries). Null for any other error.
 */
export type ShopperGoogleRefusal = "off" | "token" | "unverified" | "no_account" | "busy";

export function shopperGoogleRefusalOf(err: unknown): ShopperGoogleRefusal | null {
  if (!(err instanceof ApiError)) return null;
  if (err.code === "GOOGLE_SIGN_IN_OFF" || err.code === "SHOPPER_ACCOUNTS_OFF") return "off";
  if (err.code === "GOOGLE_TOKEN_INVALID") return "token";
  if (err.code === "GOOGLE_EMAIL_UNVERIFIED") return "unverified";
  if (err.code === "ACCOUNT_NOT_FOUND") return "no_account";
  if (err.status === 429) return "busy";
  return null;
}

// ------------------------------------------------- verified email (278) --

export interface ShopperEmailCodeSent {
  sent: true;
  /** Masked: "a***@mail.com". */
  target: string;
  expiresInSeconds: number;
  resendAfterSeconds: number;
}

/** `customer.emailVerified` of GET /account/me, read defensively (an older API has no such field). */
export function shopperEmailVerified(customer: ShopperProfile | null | undefined): boolean {
  return (customer as { emailVerified?: unknown } | null | undefined)?.emailVerified === true;
}

const signed = (token: string) => ({ auth: false, headers: { "X-Shopper-Token": token } }) as const;

/** Sends a 6-digit code to `email`, to make it the signed-in shopper's verified email. */
export function shopperEmailCode(
  client: ApiClient,
  workspaceRef: string,
  token: string,
  body: { email: string; locale?: "ar" | "en" | "fr" }
): Promise<ShopperEmailCodeSent> {
  return client.request<ShopperEmailCodeSent>(`${base(workspaceRef)}/email/code`, { ...signed(token), method: "POST", body });
}

/** The code from that email: the account comes back with the email saved and verified. */
export function shopperEmailVerify(client: ApiClient, workspaceRef: string, token: string, body: { email: string; code: string }): Promise<ShopperMe> {
  return client.request<ShopperMe>(`${base(workspaceRef)}/email/verify`, { ...signed(token), method: "POST", body });
}
