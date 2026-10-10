/**
 * A signed-in shopper's verified email (backend src/modules/shopperAccounts
 * and shopperAuth.js). Only a verified email signs a shopper in by email.
 *
 * Signed in, under /store/:ws/account/email:
 *   POST /code   { email, locale } → ShopperEmailCodeSent
 *   POST /verify { email, code }   → the account, with customer.emailVerified true
 *          422 INVALID_CODE (details.attemptsLeft) / CODE_EXPIRED,
 *          429 TOO_MANY_ATTEMPTS / TOO_MANY_CODES.
 */
import type { ApiClient } from "../client";
import { shopperTokenHeaders } from "../shopperToken";
import type { ShopperMe, ShopperProfile } from "./shopperAccounts";

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

const base = (workspaceRef: string) => `/store/${workspaceRef}/account`;
const signed = (token: string) => ({ auth: false, headers: shopperTokenHeaders(token) }) as const;

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
