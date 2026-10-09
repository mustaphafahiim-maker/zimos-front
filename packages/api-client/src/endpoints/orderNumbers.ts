/**
 * Short store order numbers (backend: frontend-handoff item 381).
 *
 * New orders are numbered prefix + number + suffix ("#1001", "ZM-5000-EG").
 * A store that never set this numbers from #1001; older orders keep their
 * "ORD-…" numbers. `orderNumber` on an order is still a string, shown as is.
 *
 *   GET /workspaces/:ws/order-numbers            (orders.view)      → OrderNumbering
 *   PUT /workspaces/:ws/order-numbers  { prefix, suffix, start }    (workspace.manage) → OrderNumbering
 *       prefix, suffix: 0–10 of English letters, digits, "#" and "-" (stored upper case).
 *       start: 1–1,000,000,000, the lowest number the next order may get — numbers never go back.
 *       422 VALIDATION_ERROR details[].field: prefix | suffix | start; 403 without workspace.manage.
 */
import type { ApiClient } from "../client";

export interface OrderNumbering {
  prefix: string;
  suffix: string;
  start: number;
  /** True while the store never saved its own numbering. */
  isDefault: boolean;
  /** The number of the newest order, or null before the first one. */
  lastNumber: number | null;
  nextNumber: number;
  /** The next order's number as it will be written. */
  nextOrderNumber: string;
}

export interface OrderNumberingPayload {
  prefix: string;
  suffix: string;
  start: number;
}

export const ORDER_NUMBER_AFFIX_MAX = 10;
export const ORDER_NUMBER_START_MAX = 1_000_000_000;

export function orderNumbersGet(client: ApiClient, workspaceId: string): Promise<OrderNumbering> {
  return client.request<OrderNumbering>(`/workspaces/${workspaceId}/order-numbers`);
}

export function orderNumbersSave(client: ApiClient, workspaceId: string, payload: OrderNumberingPayload): Promise<OrderNumbering> {
  return client.request<OrderNumbering>(`/workspaces/${workspaceId}/order-numbers`, { method: "PUT", body: payload });
}
