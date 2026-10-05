/**
 * The unsubscribe link at the end of a marketing email — the email form of a
 * STOP reply (backend: src/modules/notifications/marketingUnsubscribe.js).
 * All exported names in this file are prefixed with `marketingUnsubscribe`.
 *
 * Codes: 404 INVALID_LINK (forged, or the checkout is gone).
 */
import type { ApiClient } from "../client";

export interface MarketingUnsubscribeResult {
  ok: true;
  storeName: string;
}

/** POST /store/:ws/marketing/unsubscribe — no auth; the token is the link's `t`. */
export function marketingUnsubscribe(client: ApiClient, workspaceId: string, token: string) {
  return client.request<MarketingUnsubscribeResult>(`/store/${workspaceId}/marketing/unsubscribe`, {
    method: "POST",
    body: { token },
    auth: false,
  });
}
