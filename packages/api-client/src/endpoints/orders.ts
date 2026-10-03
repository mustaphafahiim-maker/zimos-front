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

// ------------------------------------------------ meta: tags, seen, test --

export type OrderSource = "store" | "funnel" | "manual" | "api" | "import" | "upsell";
export const ORDER_SOURCES: readonly OrderSource[] = ["store", "funnel", "manual", "api", "import", "upsell"];

/** The SPEC §4.2 fields every order carries (list and GET one). */
export interface OrderMeta {
  source: OrderSource;
  tags: string[];
  isSeen: boolean;
  seenAt: string | null;
  /** Placed while previewing the store, or marked by hand; not a sale. */
  isTest: boolean;
  /** Set when the order was archived ("deleted" from the lists). */
  archivedAt: string | null;
}

/** Reads the meta fields off an order, with safe defaults for older responses. */
export function ordersMeta(order: Order): OrderMeta {
  const o = order as Order & Partial<OrderMeta>;
  return {
    source: o.source ?? "store",
    tags: o.tags ?? [],
    isSeen: o.isSeen ?? true,
    seenAt: o.seenAt ?? null,
    isTest: o.isTest ?? false,
    archivedAt: o.archivedAt ?? null,
  };
}

export interface OrderMetaPatch {
  /** Replaces the order's tags. */
  tags?: string[];
  addTags?: string[];
  removeTags?: string[];
  isTest?: boolean;
  isSeen?: boolean;
  archived?: boolean;
}

/** Tags, test, archive need orders.manage; `{ isSeen }` alone needs orders.view. */
export async function ordersUpdateMeta(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  patch: OrderMetaPatch
): Promise<OrderMeta & { id: string }> {
  const { order } = await client.request<{ order: OrderMeta & { id: string } }>(`${base(workspaceId, orderId)}/meta`, {
    method: "PATCH",
    body: patch,
  });
  return order;
}

export interface OrderTagCount {
  tag: string;
  count: number;
}

/** Every tag in use in the store, most used first. */
export async function ordersListTags(client: ApiClient, workspaceId: string): Promise<OrderTagCount[]> {
  const { tags } = await client.request<{ tags: OrderTagCount[] }>(`${base(workspaceId)}/tags`);
  return tags;
}

// ----------------------------------------------------------------- notes --

export type OrderNoteVisibility = "internal" | "public";

export interface OrderNote {
  id: string;
  orderId: string;
  body: string;
  /** "public" notes are shown to the customer on the tracking page. */
  visibility: OrderNoteVisibility;
  author: { id: string; fullName: string } | null;
  createdAt: string;
}

/** Newest first. */
export async function ordersListNotes(client: ApiClient, workspaceId: string, orderId: string): Promise<OrderNote[]> {
  const { notes } = await client.request<{ notes: OrderNote[] }>(`${base(workspaceId, orderId)}/notes`);
  return notes;
}

export async function ordersAddNote(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  payload: { body: string; visibility?: OrderNoteVisibility }
): Promise<OrderNote> {
  const { note } = await client.request<{ note: OrderNote }>(`${base(workspaceId, orderId)}/notes`, {
    method: "POST",
    body: payload,
  });
  return note;
}

export async function ordersDeleteNote(
  client: ApiClient,
  workspaceId: string,
  orderId: string,
  noteId: string
): Promise<void> {
  await client.request<void>(`${base(workspaceId, orderId)}/notes/${noteId}`, { method: "DELETE" });
}

// --------------------------------------------------------------- filters --

/** The orders list's SPEC §4.3 filters, accepted by the list, the tab counts and the export. */
export interface OrderListFilters {
  archived?: "exclude" | "only" | "include";
  tag?: string;
  source?: OrderSource;
  paymentMethod?: "cod" | "card" | "wallet" | "bank_transfer";
  governorate?: string;
  carrier?: string;
  seen?: boolean;
  test?: boolean;
}
