/**
 * A refund that cannot be made twice (backend: frontend-handoff item 320).
 *
 * POST /workspaces/:ws/orders/:orderId/refunds with an `Idempotency-Key`: the
 * second request with the same key and the same body replays the first one's
 * answer instead of refunding again.
 *   409 IDEMPOTENCY_KEY_IN_PROGRESS — the first request is still running (or it
 *       failed on the server: the key is then spent, send a new one).
 *   A key reused with another body is refused, so a changed form needs a new key.
 */
import type { ApiClient } from "../client";
import type { Refund } from "../types";

export interface OrderRefundOnceBody {
  amount: number;
  reason?: string;
  paymentId?: string;
  notifyCustomer?: boolean;
}

export async function ordersRefundOnce(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  body: OrderRefundOnceBody,
  idempotencyKey: string
): Promise<Refund> {
  const { refund } = await client.request<{ refund: Refund }>(`/workspaces/${workspaceId}/orders/${orderId}/refunds`, {
    method: "POST",
    body,
    headers: { "Idempotency-Key": idempotencyKey },
  });
  return refund;
}
