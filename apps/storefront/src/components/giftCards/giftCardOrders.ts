/**
 * What a gift card paid on an order placed from this device (handoff 189),
 * kept beside the order snapshot (lib/commerce) for the thank-you page. The
 * order's own `amountPaid` right after checkout is what the card took: a COD
 * order has nothing else captured yet. 0 means the card could not be used.
 */
export interface GiftCardOrder {
  orderId: string;
  last4: string;
  /** Minor units the card paid. */
  amount: number;
  /** The order's total, minor units. */
  total: number;
  currency: string;
}

const key = (workspaceId: string) => `zimos_gift_card_orders_${workspaceId}`;

function read(workspaceId: string): GiftCardOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key(workspaceId));
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list as GiftCardOrder[]) : [];
  } catch {
    return [];
  }
}

export function rememberGiftCardOrder(workspaceId: string, entry: GiftCardOrder) {
  try {
    const next = [entry, ...read(workspaceId).filter((e) => e.orderId !== entry.orderId)].slice(0, 10);
    window.localStorage.setItem(key(workspaceId), JSON.stringify(next));
  } catch {
    /* storage blocked: the thank-you page simply says nothing about the card */
  }
}

export function giftCardOrderOf(workspaceId: string, orderId: string): GiftCardOrder | null {
  return read(workspaceId).find((e) => e.orderId === orderId) ?? null;
}
