/**
 * Two-step sign-in with a code on WhatsApp to the verified phone (backend:
 * auth/twoFactorWhatsapp.js). Needs a verified phone (endpoints/phoneVerification);
 * SMS, then email, take over when WhatsApp cannot deliver the code.
 */
import type { ApiClient } from "../client";
import type { TwoFactorStatus } from "./security";

export async function twoFactorEnableWhatsapp(client: ApiClient, password: string): Promise<TwoFactorStatus> {
  return client.request<TwoFactorStatus>(`/auth/two-factor/whatsapp/enable`, { method: "POST", body: { password } });
}
