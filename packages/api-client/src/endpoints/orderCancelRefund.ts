/**
 * Cancelling and refunding with the merchant's choices (SPEC §4.4; backend:
 * src/modules/orders/orderCancelRefund.js and payments/paymentController).
 *
 *   POST /workspaces/:ws/orders/:orderId/cancel    orders.manage (+ refunds.manage with refundAmount)
 *   POST /workspaces/:ws/orders/:orderId/refunds   refunds.manage
 *
 * `notifyCustomer`: true emails the customer (the store's order email, even
 * while it is switched off); false sends nothing and skips the store's
 * automations for that cancellation or refund; unset follows the settings.
 * A cancellation stands when its refund fails: `refundError` says why.
 */
import type { ApiClient } from "../client";
import type { Order, Refund } from "../types";

export interface OrderCancelOptions {
  reason: string;
  acknowledgeManualCancel?: boolean;
  notifyCustomer?: boolean;
  /** Minor units to give back once cancelled. */
  refundAmount?: number;
}

export interface OrderCancelResult {
  order: Order;
  refund?: Refund;
  refundError?: { code: string; message: string };
}

export function ordersCancelWithOptions(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  options: OrderCancelOptions
): Promise<OrderCancelResult> {
  return client.request<OrderCancelResult>(`/workspaces/${workspaceId}/orders/${orderId}/cancel`, {
    method: "POST",
    body: options,
  });
}

export async function ordersRefundWithNotify(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  body: { amount: number; reason?: string; paymentId?: string; notifyCustomer?: boolean }
): Promise<Refund> {
  const { refund } = await client.request<{ refund: Refund }>(`/workspaces/${workspaceId}/orders/${orderId}/refunds`, {
    method: "POST",
    body,
  });
  return refund;
}
