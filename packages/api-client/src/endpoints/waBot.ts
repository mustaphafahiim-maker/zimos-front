/**
 * The customer service bot on WhatsApp (backend whatsapp/bot/botService.js).
 *
 *   GET/PUT /workspaces/:ws/wa-bot                       settings + replies this month (PUT: workspace.manage)
 *   POST    /workspaces/:ws/wa-bot/preview               { message } → the bot's answer; nothing is sent
 *   PUT     /workspaces/:ws/wa-bot/conversations/:id     { paused } — take over / let the bot answer
 *
 * Inbox rows carry `botPaused`, messages `sentByBot` (read them with waBotPausedOf / waBotSentOf).
 */
import type { ApiClient } from "../client";

export type WaBotDialect = "egyptian" | "gulf" | "msa" | "english" | "french";

export interface WaBotSettings {
  enabled: boolean;
  /** false: only between `from` and `to` on `days`, on the store's clock. */
  alwaysOn: boolean;
  from: string;
  to: string;
  /** 0 = Sunday. */
  days: number[];
  dialect: WaBotDialect;
  extraInfo: string;
}

export interface WaBotView {
  bot: WaBotSettings;
  usage: { repliesThisMonth: number; limit: number | null };
  timezone: string;
}

export const waBotPausedOf = (conversation: unknown): boolean => Boolean((conversation as { botPaused?: boolean } | null)?.botPaused);
export const waBotSentOf = (message: unknown): boolean => Boolean((message as { sentByBot?: boolean } | null)?.sentByBot);

export function waBotGet(client: ApiClient, workspaceId: string): Promise<WaBotView> {
  return client.request<WaBotView>(`/workspaces/${workspaceId}/wa-bot`);
}

export function waBotSave(client: ApiClient, workspaceId: string, body: WaBotSettings): Promise<WaBotView> {
  return client.request<WaBotView>(`/workspaces/${workspaceId}/wa-bot`, { method: "PUT", body });
}

export async function waBotPreview(client: ApiClient, workspaceId: string, message: string): Promise<{ action: "reply" | "handoff"; text: string }> {
  const { answer } = await client.request<{ answer: { action: "reply" | "handoff"; text: string } }>(`/workspaces/${workspaceId}/wa-bot/preview`, {
    method: "POST",
    body: { message },
  });
  return answer;
}

export async function waBotSetPaused(client: ApiClient, workspaceId: string, conversationId: string, paused: boolean): Promise<boolean> {
  const { botPaused } = await client.request<{ botPaused: boolean }>(`/workspaces/${workspaceId}/wa-bot/conversations/${conversationId}`, {
    method: "PUT",
    body: { paused },
  });
  return botPaused;
}
