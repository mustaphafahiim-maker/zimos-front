import type { ApiClient, Order, ShopperOrder, ShopperOrderStage } from "@store-builder/api-client";

/**
 * Orders placed from this browser. Only the reference is kept on the device
 * (id, number, phone) — status, items and totals always come from the real
 * public lookup endpoint (POST /store/:id/orders/lookup).
 */
export interface OrderRef {
  id: string;
  orderNumber: string;
  phone: string;
  createdAt: string;
}

const key = (workspaceId: string) => `zimos_orders_${workspaceId}`;

function read(workspaceId: string): OrderRef[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(key(workspaceId)) ?? "[]");
    return Array.isArray(raw)
      ? raw
          .filter((o) => o && typeof o.id === "string" && typeof o.orderNumber === "string" && typeof o.phone === "string")
          .map((o) => ({ id: o.id, orderNumber: o.orderNumber, phone: o.phone, createdAt: typeof o.createdAt === "string" ? o.createdAt : "" }))
      : [];
  } catch {
    return [];
  }
}

export function rememberOrder(workspaceId: string, order: Pick<Order, "id" | "orderNumber" | "createdAt">, phone: string) {
  if (typeof window === "undefined") return;
  const ref: OrderRef = { id: order.id, orderNumber: order.orderNumber, phone, createdAt: order.createdAt ?? new Date().toISOString() };
  const next = [ref, ...read(workspaceId).filter((o) => o.id !== ref.id)].slice(0, 20);
  try {
    window.localStorage.setItem(key(workspaceId), JSON.stringify(next));
  } catch {
    /* storage disabled — the order still exists on the server */
  }
}

/** Newest first. */
export function listOrderRefs(workspaceId: string): OrderRef[] {
  return read(workspaceId);
}

export function getOrderRef(workspaceId: string, orderId: string): OrderRef | null {
  return read(workspaceId).find((o) => o.id === orderId) ?? null;
}

/** Real order status; `null` when the number/phone pair doesn't match an order. */
export async function lookupOrder(
  client: ApiClient,
  workspaceId: string,
  query: { orderId?: string; orderNumber?: string; phone: string }
): Promise<ShopperOrder | null> {
  try {
    return await client.lookupStorefrontOrder(workspaceId, query);
  } catch (err) {
    if ((err as { status?: number })?.status === 404) return null;
    throw err;
  }
}

/** Timeline step index: 0 placed · 1 confirmed · 2 shipped · 3 delivered. */
export function stageStep(stage: ShopperOrderStage): 0 | 1 | 2 | 3 {
  switch (stage) {
    case "confirmed":
      return 1;
    case "shipped":
    case "out_for_delivery":
      return 2;
    case "delivered":
    case "returned":
      return 3;
    default:
      return 0;
  }
}
