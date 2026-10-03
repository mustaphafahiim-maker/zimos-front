/**
 * WhatsApp campaigns — one approved template to contacts who agreed to
 * marketing (backend: src/modules/whatsapp/campaign*.js).
 *
 * Mounted at /workspaces/:workspaceId/whatsapp-campaigns (automations.manage).
 * All exported names are prefixed `whatsappCampaigns` / `WhatsappCampaign`.
 *
 * Consent: whatever the audience, only contacts with `marketingConsent` (and
 * not blocked) are messaged; the rest are counted in `excludedNoConsent`.
 * A customer who replies STOP loses consent and is skipped from then on.
 *
 * Notable codes: WHATSAPP_NOT_CONNECTED (422, on start), CAMPAIGN_NO_RECIPIENTS
 * (422 — nobody in the audience consents), CAMPAIGN_NOT_DRAFT /
 * CAMPAIGN_WRONG_STATE / CAMPAIGN_ACTIVE (409).
 */
import type { ApiClient } from "../client";

export type WhatsappCampaignStatus = "draft" | "scheduled" | "sending" | "paused" | "completed" | "cancelled";

export type WhatsappCampaignAudience =
  | { type: "all" }
  | { type: "segment"; segmentId: string }
  | { type: "list"; rows: Array<{ name?: string | null; phone: string }> };

export interface WhatsappCampaignRecipientCounts {
  pending: number;
  sent: number;
  failed: number;
  skipped: number;
}

export interface WhatsappCampaignReport extends WhatsappCampaignRecipientCounts {
  recipients: number;
  delivered: number;
  read: number;
  replies: number;
  unsubscribed: number;
  /** Orders placed by a recipient within `orderWindowDays` of their message. */
  orders: number;
  /** Minor units, as a string. */
  revenue: string;
  currency: string | null;
  orderWindowDays: number;
}

export interface WhatsappCampaignDto {
  id: string;
  name: string;
  status: WhatsappCampaignStatus;
  audience: { type: "all" | "segment" | "list"; segmentId: string | null; listSize: number | null };
  template: { name: string; language: string; params: string[] };
  couponCode: string | null;
  dailyCap: number;
  scheduledAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  /** `manual`, or why the campaign paused itself. */
  pauseReason: string | null;
  /** Fixed when the campaign starts. */
  audienceSize: number;
  excludedNoConsent: number;
  createdAt: string;
}

export interface WhatsappCampaignPayload {
  name: string;
  audience: WhatsappCampaignAudience;
  /** `params` may use {{customer_name}}, {{store_name}} and {{coupon_code}}. */
  template: { name: string; language?: string; params?: string[] };
  couponCode?: string | null;
  dailyCap?: number;
  scheduledAt?: string | null;
}

export interface WhatsappCampaignAudiencePreview {
  audienceSize: number;
  /** Consenting, not blocked: who would actually be messaged. */
  reachable: number;
  excluded: number;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/whatsapp-campaigns`;

export async function whatsappCampaignsList(
  client: ApiClient,
  workspaceId: string
): Promise<Array<WhatsappCampaignDto & { report: { recipients: WhatsappCampaignRecipientCounts } }>> {
  const { campaigns } = await client.request<{ campaigns: Array<WhatsappCampaignDto & { report: { recipients: WhatsappCampaignRecipientCounts } }> }>(base(workspaceId));
  return campaigns;
}

export async function whatsappCampaignsGet(
  client: ApiClient,
  workspaceId: string,
  campaignId: string
): Promise<{ campaign: WhatsappCampaignDto & { report: WhatsappCampaignReport }; failures: Array<{ phone: string; name: string | null; error: string | null }> }> {
  return client.request(`${base(workspaceId)}/${campaignId}`);
}

export async function whatsappCampaignsPreviewAudience(
  client: ApiClient,
  workspaceId: string,
  audience: WhatsappCampaignAudience
): Promise<WhatsappCampaignAudiencePreview> {
  return client.request<WhatsappCampaignAudiencePreview>(`${base(workspaceId)}/audience-preview`, { method: "POST", body: { audience } });
}

export async function whatsappCampaignsCreate(client: ApiClient, workspaceId: string, payload: WhatsappCampaignPayload): Promise<WhatsappCampaignDto> {
  const { campaign } = await client.request<{ campaign: WhatsappCampaignDto }>(base(workspaceId), { method: "POST", body: payload });
  return campaign;
}

/** start fixes the recipients and begins sending (or waits for `scheduledAt`). */
export async function whatsappCampaignsAct(
  client: ApiClient,
  workspaceId: string,
  campaignId: string,
  action: "start" | "pause" | "resume" | "cancel"
): Promise<WhatsappCampaignDto> {
  const { campaign } = await client.request<{ campaign: WhatsappCampaignDto }>(`${base(workspaceId)}/${campaignId}/${action}`, { method: "POST" });
  return campaign;
}

/** Drafts, cancelled and completed campaigns only. */
export async function whatsappCampaignsDelete(client: ApiClient, workspaceId: string, campaignId: string): Promise<void> {
  await client.request(`${base(workspaceId)}/${campaignId}`, { method: "DELETE" });
}
