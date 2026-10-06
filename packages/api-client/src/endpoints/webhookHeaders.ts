/**
 * Webhook custom headers (backend: src/modules/webhooks/customHeaders.js,
 * handoff item 178) — what a receiver asks for (an API key, an Authorization
 * token, a tenant id), sent with every delivery and every "Send test" of that
 * endpoint. Permission as for webhooks: webhooks.manage.
 *
 *   POST  /workspaces/:workspaceId/webhooks               { url, events, filter?, customHeaders? }
 *   PATCH /workspaces/:workspaceId/webhooks/:endpointId   { url?, events?, isActive?, filter?, customHeaders? }
 *
 * - Up to 10; `name` is an HTTP header token (≤64), `value` ≤1000 characters
 *   with no line breaks; names are unique, ignoring case.
 * - PATCH replaces the whole list. `{ name, keep: true }` keeps the value
 *   already stored under that name, so the dashboard never needs to know it
 *   (422 when nothing is stored under that name).
 * - Zimos' own headers (X-Zimos-*, Content-Type, User-Agent…) and transport
 *   headers are refused: 422 "… is set by Zimos and cannot be changed".
 * - Values are sealed and never returned: an endpoint carries
 *   `customHeaders: [{ name, valueMask }]`.
 *
 * Errors: VALIDATION_ERROR (422, details [{ field: "customHeaders.<i>.name"
 * | "customHeaders.<i>.value", message }]).
 */
import type { ApiClient } from "../client";
import type { WebhookEndpointFull, WebhookFilter } from "./webhookExtras";

export const WEBHOOK_MAX_CUSTOM_HEADERS = 10;
export const WEBHOOK_HEADER_NAME_MAX = 64;
export const WEBHOOK_HEADER_VALUE_MAX = 1000;

/** An HTTP header token, as the server checks it. */
export const WEBHOOK_HEADER_NAME_PATTERN = /^[A-Za-z0-9!#$%&'*+.^_`|~-]{1,64}$/;

/** Headers Zimos sets itself, or that belong to the transport: never accepted. */
export const WEBHOOK_RESERVED_HEADER =
  /^(x-zimos-.*|content-type|content-length|user-agent|host|connection|transfer-encoding|keep-alive|upgrade|te|trailer|proxy-.*|expect)$/i;

/** A stored header as the API shows it: the name, and its value masked. */
export interface WebhookCustomHeaderView {
  name: string;
  valueMask: string;
}

/** A header to send: a new value, or keep the one stored under that name. */
export type WebhookCustomHeaderInput = { name: string; value: string } | { name: string; keep: true };

export type WebhookEndpointWithHeaders = WebhookEndpointFull & { customHeaders?: WebhookCustomHeaderView[] };

export interface WebhookEndpointCreatePayload {
  url: string;
  events: string[];
  filter?: WebhookFilter | null;
  customHeaders?: WebhookCustomHeaderInput[];
}

export interface WebhookEndpointUpdatePayload {
  url?: string;
  events?: string[];
  isActive?: boolean;
  filter?: WebhookFilter | null;
  /** The whole list; omit to leave the stored headers as they are. */
  customHeaders?: WebhookCustomHeaderInput[];
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/webhooks`;

/** Creates an endpoint; the signing secret is in this answer only. */
export async function webhooksCreateEndpoint(
  client: ApiClient,
  workspaceId: string,
  payload: WebhookEndpointCreatePayload
): Promise<{ endpoint: WebhookEndpointWithHeaders; signingSecret: string }> {
  return client.request(base(workspaceId), { method: "POST", body: payload });
}

export async function webhooksUpdateEndpoint(
  client: ApiClient,
  workspaceId: string,
  endpointId: string,
  payload: WebhookEndpointUpdatePayload
): Promise<WebhookEndpointWithHeaders> {
  const { endpoint } = await client.request<{ endpoint: WebhookEndpointWithHeaders }>(`${base(workspaceId)}/${endpointId}`, {
    method: "PATCH",
    body: payload,
  });
  return endpoint;
}
