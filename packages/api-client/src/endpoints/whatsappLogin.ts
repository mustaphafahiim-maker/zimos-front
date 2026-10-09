/**
 * Merchant sign-in with a code sent to the phone (backend: frontend-handoff items 262 and 269,
 * src/modules/auth/whatsappLogin.js). Public, rate-limited like the other sign-in routes.
 *
 *   POST /auth/login/whatsapp/request { phone, locale } → { challengeToken, channel: "phone", sentTo }
 *        Always 200 with this one shape — a number with no account, one that is not verified,
 *        too many codes and a failed delivery all answer the same and send nothing, so the
 *        screen never says "no account". The code goes by WhatsApp, or SMS when WhatsApp
 *        cannot deliver it, and only to a phone verified on the account.
 *   POST /auth/login/whatsapp/verify { challengeToken, code, locale } → what POST /auth/login
 *        answers: the session, or a TwoFactorChallenge for an account with an authenticator
 *        app / email codes, or (channel "email") for a browser new to the account — finished
 *        with securityVerifyTwoFactor (endpoints/security.ts).
 *        401 INVALID_LOGIN_CODE (wrong or expired; also every code for a number with no
 *        account); 429 TOO_MANY_ATTEMPTS after 5 wrong codes — a new code is needed.
 *
 * The code lasts 10 minutes.
 */
import type { ApiClient } from "../client";
import type { AuthUser } from "../types";
import { isTwoFactorChallenge, type TwoFactorChallenge } from "./security";

export type WhatsappLoginLocale = "ar" | "en" | "fr";

export interface WhatsappLoginChallenge {
  challengeToken: string;
  /** "phone" since item 269 (WhatsApp, or SMS); older servers said which. */
  channel: "phone" | "whatsapp" | "sms";
  /** The typed number, masked: "2010*****621". */
  sentTo: string;
}

export async function whatsappLoginRequest(
  client: ApiClient,
  payload: { phone: string; locale?: WhatsappLoginLocale }
): Promise<WhatsappLoginChallenge> {
  return client.request<WhatsappLoginChallenge>("/auth/login/whatsapp/request", { method: "POST", body: payload, auth: false });
}

/**
 * Checks the code. Signed in: the session is kept, like a password sign-in, and the user comes
 * back. A second step still to pass: the challenge comes back and nothing is kept yet.
 */
export async function whatsappLoginVerify(
  client: ApiClient,
  payload: { challengeToken: string; code: string; locale?: WhatsappLoginLocale }
): Promise<{ user: AuthUser } | TwoFactorChallenge> {
  const result = await client.request<{ user: AuthUser; accessToken: string; refreshToken?: string | null } | TwoFactorChallenge>(
    "/auth/login/whatsapp/verify",
    { method: "POST", body: payload, auth: false }
  );
  if (isTwoFactorChallenge(result)) return result;
  client.setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken ?? null });
  return { user: result.user };
}
