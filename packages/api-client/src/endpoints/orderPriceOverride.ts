/**
 * Staff price changes on manual orders and order edits (backend:
 * frontend-handoff item 382). All of it needs `orders.price_override`
 * (403 FORBIDDEN without it); the storefront never accepts these fields.
 *
 * The same endpoints as before — POST /orders, POST /orders/manual/preview,
 * POST /orders/:id/items/preview, PUT /orders/:id/items — take three more things:
 *   - a catalogue line with `unitPrice` (minor units, ≥ 0);
 *   - a custom line with no variant: { title, unitPrice, quantity, sku?, weightGrams? }
 *     (on an edit, sent back with its `orderItemId` to keep it);
 *   - `manualDiscount` { type: "amount" | "percent", value, reason } — on an edit, left out
 *     keeps the order's discount, `null` removes it.
 * What comes back: `priceOverride` on every order line, `manualDiscount` on the order and on
 * both previews; `discountAmount` is the code's discount plus the manual one.
 * 422 VALIDATION_ERROR fields: manualDiscount.value | manualDiscount.reason | items.N | items.orderItemId.
 *
 * All exported names are prefixed `orderStaff` / `OrderStaff`.
 */
import type { ApiClient } from "../client";
import type { OrderDraft, OrderDraftPreview, OrderItemsPreview, OrderWithNextStages } from "./orders";

/** A line of the catalogue, optionally sold at the staff's own price. */
export interface OrderStaffCatalogItem {
  variantId: string;
  offerId?: string;
  quantity: number;
  /** Minor units. Left out = the catalogue's price. */
  unitPrice?: number;
}

/** A line that is not in the catalogue: it holds no stock and, without a weight, weighs nothing. */
export interface OrderStaffCustomItem {
  /** An edit only: the custom line the order already has, kept as it is. */
  orderItemId?: string;
  title: string;
  unitPrice: number;
  quantity: number;
  sku?: string;
  weightGrams?: number;
}

export type OrderStaffItem = OrderStaffCatalogItem | OrderStaffCustomItem;

export interface OrderStaffDiscountInput {
  type: "amount" | "percent";
  /** Minor units for an amount; 0–100 (two decimals) for a percent. */
  value: number;
  reason: string;
}

/** What a line says about its price: staff changed it, or the whole line is custom. */
export type OrderStaffPriceOverride =
  | { kind: "override"; catalogUnitPriceAmount: string; actorUserId?: string | null; actorName?: string | null; at?: string | null }
  | { kind: "custom"; actorUserId?: string | null; actorName?: string | null; at?: string | null };

/** The staff discount as the order (and each preview) carries it. */
export interface OrderStaffDiscount {
  kind: "manual";
  type: "amount" | "percent";
  value: number;
  reason: string;
  /** What it took off, minor units. */
  amount: number;
  actorUserId?: string | null;
  actorName?: string | null;
  at?: string | null;
}

/** A line's `priceOverride`, when the server sends one. */
export function orderStaffPriceOverride(line: unknown): OrderStaffPriceOverride | null {
  const value = (line as { priceOverride?: OrderStaffPriceOverride | null } | null | undefined)?.priceOverride;
  return value && (value.kind === "override" || value.kind === "custom") ? value : null;
}

/** An order's (or a preview's) `manualDiscount`, when it has one. */
export function orderStaffDiscount(holder: unknown): OrderStaffDiscount | null {
  const value = (holder as { manualDiscount?: OrderStaffDiscount | null } | null | undefined)?.manualDiscount;
  return value && typeof value === "object" && typeof value.amount !== "undefined" ? { ...value, amount: Number(value.amount) } : null;
}

export type OrderStaffDraft = Omit<OrderDraft, "items"> & { items: OrderStaffItem[]; manualDiscount?: OrderStaffDiscountInput };

/** A preview line as item 382 answers it: custom lines have no variant. */
export type OrderStaffPreviewLine = Omit<OrderDraftPreview["items"][number], "variantId"> & {
  variantId: string | null;
  custom?: boolean;
  sku?: string | null;
  priceOverride?: OrderStaffPriceOverride | null;
};

/** Prices a manual order with staff prices, custom lines and a staff discount; nothing is saved. */
export async function orderStaffPreviewDraft(
  client: ApiClient,
  workspaceId: string,
  draft: OrderStaffDraft
): Promise<OrderDraftPreview & { manualDiscount?: OrderStaffDiscount | null }> {
  const { preview } = await client.request<{ preview: OrderDraftPreview & { manualDiscount?: OrderStaffDiscount | null } }>(
    `/workspaces/${workspaceId}/orders/manual/preview`,
    { method: "POST", body: draft }
  );
  return preview;
}

/** `manualDiscount`: undefined keeps the order's, null removes it. */
export interface OrderStaffItemsEdit {
  items: OrderStaffItem[];
  manualDiscount?: OrderStaffDiscountInput | null;
}

export type OrderStaffItemsPreview = OrderItemsPreview & { manualDiscount?: OrderStaffDiscount | null };

function editBody(edit: OrderStaffItemsEdit): Record<string, unknown> {
  return edit.manualDiscount === undefined ? { items: edit.items } : { items: edit.items, manualDiscount: edit.manualDiscount };
}

/** What saving these lines (and this staff discount) would do to the order; nothing is saved. */
export async function orderStaffPreviewItems(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  edit: OrderStaffItemsEdit
): Promise<OrderStaffItemsPreview> {
  const { preview } = await client.request<{ preview: OrderStaffItemsPreview }>(`/workspaces/${workspaceId}/orders/${orderId}/items/preview`, {
    method: "POST",
    body: editBody(edit),
  });
  return preview;
}

/** Replaces the order's lines, with staff prices, custom lines and the staff discount. */
export async function orderStaffUpdateItems(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  edit: OrderStaffItemsEdit
): Promise<OrderWithNextStages> {
  const { order } = await client.request<{ order: OrderWithNextStages }>(`/workspaces/${workspaceId}/orders/${orderId}/items`, {
    method: "PUT",
    body: editBody(edit),
  });
  return order;
}
