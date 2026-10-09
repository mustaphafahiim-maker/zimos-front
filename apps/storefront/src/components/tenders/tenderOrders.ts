import { parseMoney, type TenderCheckoutResult } from "@store-builder/api-client";

/**
 * What a gift card, loyalty points and store credit paid on an order placed
 * from this device (handoff 201, 203, 204), read from the checkout's own
 * answer and kept beside the order snapshot (lib/commerce) for the thank-you
 * page and the payment page. Nothing here is worked out by the storefront.
 */
export interface TenderOrder {
  orderId: string;
  /** The order's total, minor units. */
  total: number;
  currency: string;
  /** Placed with an online method: the parts are held until the gateway is paid, and given back if it never is. */
  online: boolean;
  /** Card, points and credit covered the whole order: nothing for a gateway or a courier to collect. */
  paidInStore: boolean;
  /** A gift card took part in covering the whole order. */
  paidByGiftCard: boolean;
  giftCard?: { applied: boolean; amount: number; last4: string; reason?: string };
  points?: { applied: boolean; amount: number; points: number; balance?: number; reason?: string };
  credit?: { applied: boolean; amount: number; balance?: number; reason?: string };
}

const key = (workspaceId: string) => `zimos_tender_orders_${workspaceId}`;

function read(workspaceId: string): TenderOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(key(workspaceId));
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list as TenderOrder[]) : [];
  } catch {
    return [];
  }
}

/** The checkout's answer as a record; null when no card, points or credit came with the order. */
export function tenderOrderFrom(result: TenderCheckoutResult, online: boolean): TenderOrder | null {
  const { order, giftCard, loyalty, storeCredit } = result;
  if (!giftCard && !loyalty && !storeCredit) return null;
  return {
    orderId: order.id,
    total: parseMoney(order.totalAmount),
    currency: order.currency,
    // An order the three covered wholly went on as cash on delivery with nothing to collect.
    online: online && !result.paidInStore,
    paidInStore: Boolean(result.paidInStore) || (!online && parseMoney(order.amountPaid) >= parseMoney(order.totalAmount) && parseMoney(order.totalAmount) > 0),
    paidByGiftCard: Boolean(result.paidByGiftCard),
    ...(giftCard
      ? { giftCard: { applied: giftCard.applied, amount: parseMoney(giftCard.amount), last4: giftCard.last4 ?? "", reason: giftCard.reason } }
      : {}),
    ...(loyalty
      ? { points: { applied: loyalty.applied, amount: parseMoney(loyalty.amount), points: loyalty.points ?? 0, balance: loyalty.balance, reason: loyalty.reason } }
      : {}),
    ...(storeCredit
      ? {
          credit: {
            applied: storeCredit.applied,
            amount: parseMoney(storeCredit.amount),
            balance: storeCredit.balance === undefined ? undefined : parseMoney(storeCredit.balance),
            reason: storeCredit.reason,
          },
        }
      : {}),
  };
}

export function rememberTenderOrder(workspaceId: string, entry: TenderOrder) {
  try {
    const next = [entry, ...read(workspaceId).filter((e) => e.orderId !== entry.orderId)].slice(0, 10);
    window.localStorage.setItem(key(workspaceId), JSON.stringify(next));
  } catch {
    /* storage blocked: the thank-you page simply says nothing about them */
  }
}

export function tenderOrderOf(workspaceId: string, orderId: string): TenderOrder | null {
  return read(workspaceId).find((e) => e.orderId === orderId) ?? null;
}
