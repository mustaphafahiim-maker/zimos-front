/**
 * "Confirm via WhatsApp" on the order page (backend:
 * src/modules/orders/whatsappConfirm.js).
 *
 *   POST /workspaces/:ws/orders/:orderId/whatsapp-confirm   orders.manage or orders.confirm
 *
 * With WhatsApp connected the store sends its `order_confirmation` template
 * (buttons "Confirm order" / "Cancel"; the customer's tap confirms or cancels
 * the order). Without it, the answer is a wa.me link with the message
 * written out. A failed send is an ApiError whose `details.link` is that
 * link. 409 ORDER_ALREADY_CONFIRMED / ORDER_CANCELLED.
 */
import { ApiError, type ApiClient } from "../client";

export type OrderWhatsappConfirm =
  | { channel: "whatsapp"; template: string; messageId: string; status: string; link: string }
  | { channel: "link"; link: string; message: string };

export function ordersWhatsappConfirm(client: ApiClient, workspaceId: string, orderId: string): Promise<OrderWhatsappConfirm> {
  return client.request<OrderWhatsappConfirm>(`/workspaces/${workspaceId}/orders/${orderId}/whatsapp-confirm`, {
    method: "POST",
    body: {},
  });
}

/** The wa.me link a failed send carries, to offer instead. */
export function ordersWhatsappFallbackLink(err: unknown): string | null {
  if (!(err instanceof ApiError) || !err.details || typeof err.details !== "object") return null;
  const link = (err.details as { link?: unknown }).link;
  return typeof link === "string" && link.startsWith("https://wa.me/") ? link : null;
}
