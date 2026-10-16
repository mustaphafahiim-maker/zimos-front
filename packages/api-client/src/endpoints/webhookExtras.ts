/**
 * Webhooks beyond the endpoint list (backend: src/modules/webhooks —
 * webhookExtraRoutes.js, webhookFilter.js, webhookHealth.js). All under
 * /workspaces/:workspaceId/webhooks, permission webhooks.manage.
 *
 * - An endpoint may carry a filter: only events about these funnels/products.
 * - An endpoint that only failed for three days is switched off by the server
 *   (`disabledAt`, `disabledReason`); resuming it clears that.
 * - The delivery log covers every endpoint of the store.
 * - "Resend order" sends orders again as `order.created` with `resent: true`.
 */
import type { ApiClient } from "../client";
import type { WebhookDeliveryStatus, WebhookEndpointDto } from "./developers";

export interface WebhookFilter {
  funnelIds: string[];
  productIds: string[];
}

/** The fields the server adds to every endpoint beyond WebhookEndpointDto. */
export interface WebhookEndpointHealth {
  filter: WebhookFilter | null;
  failingSince: string | null;
  disabledAt: string | null;
  disabledReason: string | null;
}

export type WebhookEndpointFull = WebhookEndpointDto & Partial<WebhookEndpointHealth>;

export interface WebhookLogEntry {
  id: string;
  endpointId: string;
  url: string | null;
  eventId: string;
  eventType: string;
  status: WebhookDeliveryStatus;
  attemptCount: number;
  nextAttemptAt: string | null;
  lastResponseStatus: number | null;
  lastError: string | null;
  payload: unknown;
  createdAt: string;
  updatedAt: string;
}

export type WebhookLogStatus = "all" | "succeeded" | "failed" | "pending";

export interface WebhookLogParams {
  status?: WebhookLogStatus;
  endpointId?: string;
  eventType?: string;
  /** `nextCursor` of the previous page. */
  before?: string;
  limit?: number;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/webhooks`;

export async function webhooksDeliveryLog(
  client: ApiClient,
  workspaceId: string,
  params: WebhookLogParams = {}
): Promise<{ deliveries: WebhookLogEntry[]; nextCursor: string | null }> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  }
  const suffix = query.toString() ? `?${query.toString()}` : "";
  return client.request(`${base(workspaceId)}/deliveries${suffix}`);
}

export async function webhooksResendDelivery(client: ApiClient, workspaceId: string, deliveryId: string): Promise<WebhookLogEntry> {
  const { delivery } = await client.request<{ delivery: WebhookLogEntry }>(`${base(workspaceId)}/deliveries/${deliveryId}/resend`, {
    method: "POST",
  });
  return delivery;
}

/** Sends the orders again to one endpoint, or to every endpoint listening to new orders. */
export async function webhooksResendOrders(
  client: ApiClient,
  workspaceId: string,
  orderIds: string[],
  endpointId?: string
): Promise<{ orders: number; deliveries: number; missing: string[] }> {
  return client.request(`${base(workspaceId)}/resend-orders`, {
    method: "POST",
    body: endpointId ? { orderIds, endpointId } : { orderIds },
  });
}

export async function webhooksCreateFiltered(
  client: ApiClient,
  workspaceId: string,
  payload: { url: string; events: string[]; filter?: WebhookFilter | null }
): Promise<{ endpoint: WebhookEndpointFull; signingSecret: string }> {
  return client.request(base(workspaceId), { method: "POST", body: payload });
}
