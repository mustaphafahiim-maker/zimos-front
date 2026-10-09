/**
 * The sending domain on Brevo (handoff item 395; backend
 * src/modules/emailDomains/sendingDomain.js). Same endpoints as
 * emailSendingDomain.ts; what the answers add:
 *
 * - GET also says `available`: false = no email provider on this server, the
 *   form gives way to a note (PUT / verify answer 503 EMAIL_DOMAIN_UNAVAILABLE).
 * - 502 EMAIL_DOMAIN_PROVIDER_UNREACHABLE: the provider did not answer (keep the form).
 * - record purposes `brevo_code` (TXT on the domain itself) and `ownership`
 *   (TXT on _zimos-mail.<domain>, required); `dkim` may be two CNAME rows.
 * - `providerChanged: true` on a domain set up before the switch: status
 *   `pending`, no records until Verify hands out the new ones.
 */
import type { ApiClient } from "../client";
import type { SendingDomain } from "./emailSendingDomain";

export interface SendingDomainState {
  sendingDomain: SendingDomain | null;
  /** Absent on an older server, which always had the sandbox: taken as true. */
  available: boolean;
}

export async function sendingDomainGetState(client: ApiClient, workspaceId: string): Promise<SendingDomainState> {
  const res = await client.request<{ sendingDomain: SendingDomain | null; available?: boolean }>(
    `/workspaces/${workspaceId}/order-emails/sending-domain`
  );
  return { sendingDomain: res.sendingDomain ?? null, available: res.available !== false };
}

/** Set up before the switch to Brevo: Verify hands out the new records. */
export function sendingDomainProviderChanged(domain: SendingDomain): boolean {
  return (domain as SendingDomain & { providerChanged?: boolean }).providerChanged === true;
}
