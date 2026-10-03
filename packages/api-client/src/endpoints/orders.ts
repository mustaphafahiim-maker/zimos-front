/**
 * Orders — what the orders screens need beyond the methods already on
 * ApiClient (backend: src/modules/orders). Functions take the shared client
 * and use its public `request()`. Every exported name is prefixed with
 * `orders` / `Order`.
 *
 * Mounted at /workspaces/:workspaceId/orders (orders.view to read,
 * orders.manage to change).
 *
 * Notable codes: INVALID_STATUS_TRANSITION (409 — details.from, details.to,
 * details.allowed), STATUS_UNCHANGED (409), ORDER_NOT_CANCELLED (409),
 * INSUFFICIENT_STOCK (409 — reopening a cancelled order whose stock is gone),
 * CARRIER_MANUAL_CANCEL_REQUIRED (409 — cancelling an order booked with a
 * courier that has no cancel API; resend with acknowledgeManualCancel).
 */
import type { ApiClient } from "../client";
import type { Order, OrderStage } from "../types";

const base = (workspaceId: string, orderId?: string) =>
  `/workspaces/${workspaceId}/orders${orderId ? `/${orderId}` : ""}`;

// ---------------------------------------------------------------- status --

/** GET one order also says which stages it may be moved to by hand. */
export type OrderWithNextStages = Order & { nextStages?: OrderStage[] };

/** The stages `order` may be moved to from the order page; empty when none. */
export function ordersNextStages(order: Order): OrderStage[] {
  return (order as OrderWithNextStages).nextStages ?? [];
}

export type OrderActorType = "user" | "system" | "carrier" | "customer" | "api";

export interface OrderStatusHistoryEntry {
  id: string;
  /** null on the order's first row. */
  fromStatus: OrderStage | null;
  toStatus: OrderStage;
  actorType: OrderActorType;
  actorId: string | null;
  /** The staff member's name when actorType is "user". */
  actorName: string | null;
  reason: string | null;
  createdAt: string;
}

export interface OrderStatusChangePayload {
  status: OrderStage;
  reason?: string;
  /** → needs_follow_up: which of the two it is (default unreachable). */
  followUp?: "unreachable" | "postponed";
  /** → cancelled, after cancelling the booking in the courier's own dashboard. */
  acknowledgeManualCancel?: boolean;
  /** A shipping stage on an order with no shipment yet: the manual shipment created for it. */
  carrierCode?: string;
  waybillNumber?: string;
  trackingUrl?: string;
}

/** Moves the order to another stage. Answers the order as GET one does. */
export async function ordersChangeStatus(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  payload: OrderStatusChangePayload
): Promise<OrderWithNextStages> {
  const { order } = await client.request<{ order: OrderWithNextStages }>(`${base(workspaceId, orderId)}/status`, {
    method: "PATCH",
    body: payload,
  });
  return order;
}

/** Every move of the order between stages, oldest first. */
export async function ordersStatusHistory(
  client: ApiClient,
  workspaceId: string,
  orderId: string
): Promise<OrderStatusHistoryEntry[]> {
  const { history } = await client.request<{ history: OrderStatusHistoryEntry[] }>(
    `${base(workspaceId, orderId)}/status-history`
  );
  return history;
}
