/**
 * Shoppers following their order by push (backend notifications/push/orderPush.js).
 *
 *   GET  /store/:ws/push-config               { available, publicKey } — available only while the store app is on
 *   POST /store/:ws/orders/:orderId/push      { number, token } — the order number proves it is theirs
 */
import type { ApiClient } from "../client";

export interface StorePushConfig {
  available: boolean;
  /** The VAPID key; null on a sandbox server (any token is accepted there). */
  publicKey: string | null;
}

export async function storePushConfig(client: ApiClient, workspaceRef: string): Promise<StorePushConfig> {
  const { push } = await client.request<{ push: StorePushConfig }>(`/store/${encodeURIComponent(workspaceRef)}/push-config`, { auth: false });
  return push;
}

export async function storeFollowOrder(client: ApiClient, workspaceRef: string, orderId: string, body: { number: string; token: string }): Promise<void> {
  await client.request(`/store/${encodeURIComponent(workspaceRef)}/orders/${encodeURIComponent(orderId)}/push`, {
    method: "POST",
    body: { ...body, platform: "web" },
    auth: false,
  });
}
