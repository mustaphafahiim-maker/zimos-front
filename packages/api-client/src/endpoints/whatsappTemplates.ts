/**
 * The store's WhatsApp message templates as Meta has them (backend:
 * whatsapp/whatsappTemplates.js, SPEC §14.1): synced on demand, on connect,
 * and by Meta's status webhook. A known template that is not APPROVED is
 * refused at send (WHATSAPP_TEMPLATE_NOT_APPROVED, 422).
 *
 *   GET  /workspaces/:id/whatsapp/templates[?status=APPROVED]
 *   POST /workspaces/:id/whatsapp/templates/sync
 *
 * Sync codes: WHATSAPP_NOT_CONNECTED (422), WHATSAPP_NO_BUSINESS_ACCOUNT (422).
 */
import type { ApiClient } from "../client";

export interface WhatsappTemplateRow {
  id: string;
  name: string;
  language: string;
  category: string | null;
  /** APPROVED | PENDING | REJECTED | PAUSED | DISABLED | … as Meta says. */
  status: string;
  rejectedReason: string | null;
  bodyText: string | null;
  /** How many {{n}} the body has: the params a send fills, in order. */
  paramsCount: number;
  buttons: Array<{ type: string; text: string }>;
  syncedAt: string;
}

export interface WhatsappTemplateList {
  templates: WhatsappTemplateRow[];
  syncedAt: string | null;
}

export async function whatsappTemplatesList(client: ApiClient, workspaceId: string, status?: string): Promise<WhatsappTemplateList> {
  return client.request<WhatsappTemplateList>(`/workspaces/${workspaceId}/whatsapp/templates${status ? `?status=${encodeURIComponent(status)}` : ""}`);
}

export async function whatsappTemplatesSync(client: ApiClient, workspaceId: string): Promise<WhatsappTemplateList> {
  return client.request<WhatsappTemplateList>(`/workspaces/${workspaceId}/whatsapp/templates/sync`, { method: "POST", body: {} });
}
