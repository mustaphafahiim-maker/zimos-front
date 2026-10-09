/**
 * The store's email suppression list (backend: frontend-handoff item 386,
 * notifications/deliveryStatus). An address goes on it when an email to it
 * hard-bounces or the customer marks one as spam; nothing is emailed to it
 * (except account and security codes) until the merchant lifts it.
 *
 *   GET    /workspaces/:ws/email-suppressions?email=&reason=&limit=&cursor=   (customers.view)
 *          → { suppressions, next } — `next` goes back as `cursor`; null is the end.
 *   DELETE /workspaces/:ws/email-suppressions/:id                             (customers.manage)
 *          → { lifted: true, suppression }; 404 when it is not there.
 */
import type { ApiClient } from "../client";

export type EmailSuppressionReason = "hard_bounce" | "complaint";

export interface EmailSuppression {
  id: string;
  email: string;
  reason: EmailSuppressionReason | (string & {});
  /** Who reported it: "brevo"… */
  source: string | null;
  /** The provider's own words: "hard_bounce: 550 5.1.1 user unknown". */
  detail: string | null;
  notificationLogId: string | null;
  createdAt: string;
}

export interface EmailSuppressionQuery {
  /** One address, any case. */
  email?: string;
  reason?: EmailSuppressionReason;
  /** 1–100, default 50. */
  limit?: number;
  cursor?: string;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/email-suppressions`;

export function emailSuppressionsList(client: ApiClient, workspaceId: string, query: EmailSuppressionQuery = {}): Promise<{ suppressions: EmailSuppression[]; next: string | null }> {
  const params = new URLSearchParams();
  if (query.email) params.set("email", query.email);
  if (query.reason) params.set("reason", query.reason);
  if (query.limit) params.set("limit", String(query.limit));
  if (query.cursor) params.set("cursor", query.cursor);
  const search = params.toString();
  return client.request<{ suppressions: EmailSuppression[]; next: string | null }>(`${base(workspaceId)}${search ? `?${search}` : ""}`);
}

/** Lifts a suppression: emails go to the address again. */
export async function emailSuppressionsLift(client: ApiClient, workspaceId: string, id: string): Promise<EmailSuppression> {
  const { suppression } = await client.request<{ lifted: boolean; suppression: EmailSuppression }>(`${base(workspaceId)}/${id}`, { method: "DELETE" });
  return suppression;
}
