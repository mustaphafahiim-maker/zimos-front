/**
 * The customer's details as written on an order (backend:
 * orderService.updateOrderLimited, PATCH /workspaces/:ws/orders/:orderId,
 * orders.manage). For a typo in the name or number before the order ships;
 * 409 once it has shipped or when it is cancelled.
 */
import type { ApiClient } from "../client";
import type { Order } from "../types";

export interface OrderContactInput {
  fullName: string;
  phone: string;
  alternatePhone?: string | null;
  email?: string | null;
}

export async function ordersUpdateContact(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  contact: OrderContactInput
): Promise<Order> {
  const { order } = await client.request<{ order: Order }>(`/workspaces/${workspaceId}/orders/${orderId}`, {
    method: "PATCH",
    body: { contact },
  });
  return order;
}
