/**
 * The merchant's own phone number, confirmed by a code (backend:
 * auth/authService requestPhoneVerification / confirmPhoneVerification).
 *
 *   POST /auth/verify-phone/request   { phone, channel } — sends a 6-digit code
 *                                      by WhatsApp (SMS when WhatsApp cannot
 *                                      deliver it) or by SMS
 *   POST /auth/verify-phone/confirm   { phone, code } — saves the number as verified
 */
import type { ApiClient } from "../client";
import type { AuthUser } from "../types";

export type PhoneVerificationChannel = "whatsapp" | "sms";

export async function phoneVerificationRequest(
  client: ApiClient,
  payload: { phone: string; channel: PhoneVerificationChannel },
): Promise<{ sent: boolean; sentVia?: PhoneVerificationChannel }> {
  return client.request(`/auth/verify-phone/request`, { method: "POST", body: payload });
}

export async function phoneVerificationConfirm(client: ApiClient, payload: { phone: string; code: string }): Promise<{ user: AuthUser }> {
  return client.request(`/auth/verify-phone/confirm`, { method: "POST", body: payload });
}
