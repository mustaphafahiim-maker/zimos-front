import { preorderShipsAtOf, storefrontPreorderOf, type StorefrontPreorder } from "@store-builder/api-client";

/**
 * What the product page, cart and checkout tell the shopper about buying:
 * pre-orders (handoff 195). Display only — the API decides what sells.
 */

/** A calendar day ("YYYY-MM-DD") in the shopper's language, read as that day (never shifted by the time zone). */
export function formatShopDay(
  ymd: string | null | undefined,
  intlLocale: string,
  opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long" }
): string {
  if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "";
  const date = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(intlLocale, { ...opts, timeZone: "UTC" }).format(date);
}

/** Whether the product keeps selling its variants once they run out. */
export function takesPreorders(product: unknown): boolean {
  return storefrontPreorderOf(product) !== null;
}

/**
 * The pre-order the chosen variant is sold as: only when it is sold out and
 * the product takes pre-orders; null otherwise (in stock, or "Sold out").
 */
export function preorderFor(product: unknown, variant: { inStock?: boolean } | null | undefined): StorefrontPreorder | null {
  if (!variant || variant.inStock) return null;
  return storefrontPreorderOf(product);
}

// ------------------------------------------------------------ thank-you --

/** What the thank-you page says about an order beyond its summary: the pre-ordered lines. */
export interface OrderBuyNotes {
  orderId: string;
  /** Lines taken as pre-orders, with their expected ship date. */
  preorders: { name: string; shipsAt: string }[];
}

const notesKey = (workspaceId: string) => `zimos_order_notes_${workspaceId}`;

function readNotes(workspaceId: string): OrderBuyNotes[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(notesKey(workspaceId));
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? (list as OrderBuyNotes[]) : [];
  } catch {
    return [];
  }
}

function writeNotes(workspaceId: string, notes: OrderBuyNotes): void {
  try {
    const next = [notes, ...readNotes(workspaceId).filter((n) => n.orderId !== notes.orderId)].slice(0, 20);
    window.localStorage.setItem(notesKey(workspaceId), JSON.stringify(next));
  } catch {
    /* storage disabled: the thank-you page simply says less */
  }
}

/**
 * Kept on this device from the checkout's answer, like the order snapshot
 * (lib/commerce): the lines saved with `preorderShipsAt`. An order with
 * nothing to say is not stored.
 */
export function saveOrderBuyNotes(workspaceId: string, order: { id: string; items?: unknown[] | null }): void {
  if (typeof window === "undefined") return;
  const preorders: OrderBuyNotes["preorders"] = [];
  for (const item of order.items ?? []) {
    const shipsAt = preorderShipsAtOf(item);
    if (shipsAt) preorders.push({ name: (item as { productNameSnapshot?: string }).productNameSnapshot ?? "", shipsAt });
  }
  if (preorders.length > 0) writeNotes(workspaceId, { orderId: order.id, preorders });
}

export function getOrderBuyNotes(workspaceId: string, orderId: string): OrderBuyNotes | null {
  return readNotes(workspaceId).find((n) => n.orderId === orderId) ?? null;
}
