/**
 * Order emails — the emails a store's customers get about their orders
 * (backend: src/modules/notifications/orderEmail*.js).
 *
 * Mounted at /workspaces/:workspaceId/order-emails (workspace.manage). Each
 * template has a fixed key and the event that sends it; a store switches it
 * on and may rewrite its subject and body with `{{tokens}}`. Templates start
 * switched off, and an order without an email address is skipped. All
 * exported names are prefixed `orderEmails` / `OrderEmail`.
 */
import type { ApiClient } from "../client";

export type OrderEmailKey =
  | "order_confirmation"
  | "order_shipped"
  | "order_cancelled"
  | "order_refunded"
  | "abandoned_cart"
  | "transfer_rejected"
  | "digital_delivery";

export interface OrderEmailTemplateDto {
  key: OrderEmailKey;
  /** The event that sends it, e.g. `order.created`. */
  event: string;
  isEnabled: boolean;
  /** The store's text, or the built-in one when it has not been changed. */
  subject: string;
  body: string;
  isCustomised: boolean;
  defaults: { subject: string; body: string };
  updatedAt: string | null;
}

export interface OrderEmailList {
  templates: OrderEmailTemplateDto[];
  /** The `{{token}}` names a subject or body may use. */
  tokens: string[];
}

export interface OrderEmailPreview {
  subject: string;
  /** A complete, self-contained HTML fragment: show it in a sandboxed iframe. */
  html: string;
  text: string;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/order-emails`;

export async function orderEmailsList(client: ApiClient, workspaceId: string): Promise<OrderEmailList> {
  return client.request<OrderEmailList>(base(workspaceId));
}

/** `subject` / `body` null restore the built-in text. */
export async function orderEmailsUpdate(
  client: ApiClient,
  workspaceId: string,
  key: OrderEmailKey,
  patch: { isEnabled?: boolean; subject?: string | null; body?: string | null }
): Promise<OrderEmailTemplateDto> {
  const { template } = await client.request<{ template: OrderEmailTemplateDto }>(`${base(workspaceId)}/${key}`, { method: "PUT", body: patch });
  return template;
}

/** Renders the template with sample values. Pass the unsaved text to preview it before saving. */
export async function orderEmailsPreview(
  client: ApiClient,
  workspaceId: string,
  key: OrderEmailKey,
  draft: { subject?: string; body?: string } = {}
): Promise<OrderEmailPreview> {
  return client.request<OrderEmailPreview>(`${base(workspaceId)}/${key}/preview`, { method: "POST", body: draft });
}

/** Sends the template with sample values — to the caller's own address unless `to` is given. */
export async function orderEmailsSendTest(
  client: ApiClient,
  workspaceId: string,
  key: OrderEmailKey,
  options: { to?: string; subject?: string; body?: string } = {}
): Promise<{ ok: boolean; error: string | null; to: string }> {
  return client.request(`${base(workspaceId)}/${key}/test`, { method: "POST", body: options });
}

/**
 * Who the order emails are from (backend notifications/orderEmailSender.js):
 * the sender name customers see (null = the store's name) and a Reply-To
 * (null = none). The sending address stays the platform's.
 */
export interface OrderEmailSender {
  fromName: string | null;
  replyTo: string | null;
}

export async function orderEmailsSenderGet(client: ApiClient, workspaceId: string): Promise<{ sender: OrderEmailSender; storeName: string }> {
  return client.request<{ sender: OrderEmailSender; storeName: string }>(`${base(workspaceId)}/sender`);
}

/** Empty strings clear a field. */
export async function orderEmailsSenderSet(
  client: ApiClient,
  workspaceId: string,
  sender: { fromName?: string | null; replyTo?: string | null }
): Promise<{ sender: OrderEmailSender; storeName: string }> {
  return client.request<{ sender: OrderEmailSender; storeName: string }>(`${base(workspaceId)}/sender`, { method: "PUT", body: sender });
}
