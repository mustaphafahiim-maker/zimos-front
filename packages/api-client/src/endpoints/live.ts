/**
 * Live view (backend: src/modules/analytics/realtimeStream.js): the realtime
 * snapshot with today's numbers and the checkout / purchase feed, and the
 * Server-Sent Events stream that pushes a new snapshot whenever something
 * changed.
 *
 * `liveGetSnapshot` and `liveStreamUrl` need analytics.view. The stream itself
 * is opened with a one-minute ticket (EventSource cannot send an
 * Authorization header); a ticket works once, so build a fresh URL for every
 * (re)connection. All exported names are prefixed with `live` / `Live`.
 */
import type { ApiClient } from "../client";
import type { WebAnalyticsRealtime } from "../types";

export interface LiveCheckout {
  id: string;
  subtotalAmount: number;
  currency: string;
  items: number;
  source: "store" | "funnel";
  governorate: string | null;
  lastActivityAt: string;
}

export interface LivePurchase {
  orderId: string;
  orderNumber: string;
  totalAmount: number;
  currency: string;
  paymentMethod: string;
  governorate: string | null;
  inFunnel: boolean;
  createdAt: string;
}

export interface LiveBlock {
  currency: string;
  /** Since midnight in the store's time zone. */
  today: { visitors: number; orders: number; sales: number };
  /** Checkouts being filled in during the last ten minutes. */
  checkingOut: LiveCheckout[];
  /** The latest orders of the last 24 hours. */
  purchases: LivePurchase[];
}

export interface LiveSnapshot {
  /** Same shape as getWebAnalyticsRealtime; `series` is the last ten minutes. */
  realtime: WebAnalyticsRealtime;
  live: LiveBlock;
  funnelId: string | null;
}

export interface LiveStreamEvent extends LiveSnapshot {
  type: "snapshot";
  at: string;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/analytics/live`;

export async function liveGetSnapshot(client: ApiClient, workspaceId: string, funnelId?: string): Promise<LiveSnapshot> {
  return client.request<LiveSnapshot>(`${base(workspaceId)}${funnelId ? `?funnelId=${funnelId}` : ""}`);
}

/** A ready-to-open EventSource URL (asks for a fresh ticket). `apiBaseUrl` is the client's base, e.g. "/api/v1". */
export async function liveStreamUrl(client: ApiClient, workspaceId: string, apiBaseUrl: string, funnelId?: string): Promise<string> {
  const { ticket } = await client.request<{ ticket: string }>(`${base(workspaceId)}/stream-ticket`, { method: "POST" });
  const query = `ticket=${encodeURIComponent(ticket)}${funnelId ? `&funnelId=${funnelId}` : ""}`;
  return `${apiBaseUrl.replace(/\/$/, "")}/analytics-stream/${workspaceId}?${query}`;
}
