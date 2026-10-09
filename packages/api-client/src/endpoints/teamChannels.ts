/**
 * Team channels (backend: frontend-handoff item 378, notifications/teamChannels).
 *
 * A store's Telegram group, Slack channel or Discord channel that gets the
 * alerts it asked for. Not a seat: a place. Up to 10 per store.
 *
 * /workspaces/:ws/team-channels (workspace.manage; routing a type also needs
 * that type's own permission):
 *   GET    /                      → TeamChannelList
 *   POST   /  TeamChannelCreate   → 201 { channel }
 *   PATCH  /:id TeamChannelUpdate → { channel } — send only what changed
 *   DELETE /:id                   → { deleted: true, id }
 *   POST   /:id/test              → { result, channel } (works on a paused channel too)
 *   GET    /:id/deliveries        → { deliveries } (last 50, kept 30 days)
 *
 * The bot token and the webhook URL are stored sealed and never come back:
 * the API shows `hint`.
 *
 * Errors: 422 VALIDATION_ERROR (details[0].field botToken | chatId |
 * webhookUrl | types | name), 403 TEAM_CHANNEL_TYPE_FORBIDDEN,
 * 409 TEAM_CHANNEL_LIMIT, 404, 503 TEAM_CHANNEL_UNAVAILABLE on test.
 */
import type { ApiClient } from "../client";

export type TeamChannelProvider = "telegram" | "slack" | "discord";

/** The language a channel's messages are written in. */
export type TeamChannelLocale = "ar" | "en";

export interface TeamChannel {
  id: string;
  provider: TeamChannelProvider;
  name: string;
  /** What stands in for the secret: "-1001234567890 · ••••2345". */
  hint: string | null;
  locale: TeamChannelLocale;
  /** Alert types (order.new, stock.low…); typed loosely so a newer backend type still shows. */
  types: string[];
  isActive: boolean;
  lastStatus: "sent" | "failed" | null;
  lastError: string | null;
  lastSentAt: string | null;
  failureCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TeamChannelList {
  channels: TeamChannel[];
  providers: TeamChannelProvider[];
  /** The alert types this person may route. */
  types: string[];
  /** sandbox (development only): messages are recorded, not really sent. */
  adapter: { available: boolean; sandbox: boolean };
}

interface TeamChannelCommon {
  name: string;
  locale?: TeamChannelLocale;
  types?: string[];
  isActive?: boolean;
}

export type TeamChannelCreate = TeamChannelCommon &
  (
    | { provider: "telegram"; botToken: string; chatId: string }
    | { provider: "slack" | "discord"; webhookUrl: string }
  );

export interface TeamChannelUpdate {
  name?: string;
  locale?: TeamChannelLocale;
  types?: string[];
  isActive?: boolean;
  botToken?: string;
  chatId?: string;
  webhookUrl?: string;
}

export type TeamChannelTestResult = { status: "sent" } | { status: "failed"; error: string | null };

export interface TeamChannelDelivery {
  id: string;
  /** An alert type, "test" or "automation_step". */
  type: string;
  status: "sent" | "failed";
  error: string | null;
  createdAt: string;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/team-channels`;

export function teamChannelsList(client: ApiClient, workspaceId: string): Promise<TeamChannelList> {
  return client.request<TeamChannelList>(base(workspaceId));
}

export async function teamChannelsCreate(client: ApiClient, workspaceId: string, body: TeamChannelCreate): Promise<TeamChannel> {
  const { channel } = await client.request<{ channel: TeamChannel }>(base(workspaceId), { method: "POST", body });
  return channel;
}

export async function teamChannelsUpdate(client: ApiClient, workspaceId: string, channelId: string, body: TeamChannelUpdate): Promise<TeamChannel> {
  const { channel } = await client.request<{ channel: TeamChannel }>(`${base(workspaceId)}/${channelId}`, { method: "PATCH", body });
  return channel;
}

export async function teamChannelsDelete(client: ApiClient, workspaceId: string, channelId: string): Promise<void> {
  await client.request(`${base(workspaceId)}/${channelId}`, { method: "DELETE" });
}

export function teamChannelsTest(client: ApiClient, workspaceId: string, channelId: string): Promise<{ result: TeamChannelTestResult; channel: TeamChannel }> {
  return client.request<{ result: TeamChannelTestResult; channel: TeamChannel }>(`${base(workspaceId)}/${channelId}/test`, { method: "POST" });
}

export async function teamChannelsDeliveries(client: ApiClient, workspaceId: string, channelId: string): Promise<TeamChannelDelivery[]> {
  const { deliveries } = await client.request<{ deliveries: TeamChannelDelivery[] }>(`${base(workspaceId)}/${channelId}/deliveries`);
  return deliveries;
}
