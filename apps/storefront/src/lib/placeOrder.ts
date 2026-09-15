import { ApiError, type ApiClient, type CheckoutPayload, type Order } from "@store-builder/api-client";
import { rememberOrder } from "./orders";

export interface OrderLine {
  variantId: string;
  offerId?: string;
  quantity: number;
}

/**
 * Places a COD order through the real storefront checkout (which attaches a
 * fresh Idempotency-Key per request).
 *
 *  - `cartToken`  → order from the shopper's cart (the /checkout page).
 *  - `lines`      → several lines from a product page (e.g. product + order
 *                   bump): they go into a *fresh, isolated* guest cart so the
 *                   shopper's main cart is never touched, then check out.
 *  - neither      → Buy Now: `payload.item` is the single line.
 */
export async function placeCodOrder({
  client,
  workspaceId,
  payload,
  cartToken,
  lines,
}: {
  client: ApiClient;
  workspaceId: string;
  payload: CheckoutPayload;
  cartToken?: string;
  lines?: OrderLine[];
}): Promise<Order> {
  if (lines && lines.length > 0) {
    const cart = await client.getOrCreateCart(workspaceId);
    for (const line of lines) {
      await client.addCartItem(workspaceId, cart.guestToken, line);
    }
    const { item: _ignored, ...rest } = payload;
    void _ignored;
    return client.checkout(workspaceId, rest, cart.guestToken);
  }
  return client.checkout(workspaceId, payload, cartToken);
}

/** Remember the order reference on this device and return the thank-you URL. */
export function afterOrder(workspaceId: string, order: Order, phone: string): string {
  rememberOrder(workspaceId, order, phone);
  const q = new URLSearchParams({ number: order.orderNumber });
  return `/store/${workspaceId}/orders/${order.id}?${q.toString()}`;
}

export function orderErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.message) return err.message;
  if (err instanceof Error && err.message && !/fetch/i.test(err.message)) return err.message;
  return fallback;
}
