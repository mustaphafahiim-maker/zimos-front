/**
 * "Notify me in this browser" for a sold-out variant (backend: frontend-handoff
 * item 392, stockAlerts + notifications/push). Beside the email / phone
 * sign-up of endpoints/stockAlerts.ts:
 *
 *   POST /store/:ws/stock-alerts { variantId, pushToken, locale? }
 *     pushToken = JSON.stringify(PushSubscription) — exactly one of email, phone, pushToken.
 *     → 201 { subscribed: true, channel: "push" }
 *     409 PUSH_UNAVAILABLE (hide the option), 422 INVALID_PUSH_SUBSCRIPTION,
 *     409 IN_STOCK, 404 not for sale, 429 as before.
 *   The push is sent once (title "Back in stock", link = the product page);
 *   nothing else is ever pushed from it.
 *
 * Whether the store can push at all: storePushConfig (endpoints/orderPush.ts).
 */
import type { ApiClient } from "../client";

export interface StockAlertPushRequest {
  variantId: string;
  /** The whole browser subscription as JSON: endpoint + keys. */
  pushToken: string;
  locale?: string;
}

export function subscribeStockAlertPush(client: ApiClient, workspaceRef: string, body: StockAlertPushRequest): Promise<{ subscribed: true; channel: "push" }> {
  return client.request<{ subscribed: true; channel: "push" }>(`/store/${encodeURIComponent(workspaceRef)}/stock-alerts`, { method: "POST", body, auth: false });
}
