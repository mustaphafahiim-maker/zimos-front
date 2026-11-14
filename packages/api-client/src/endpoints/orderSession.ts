import type { ApiClient } from "../client";
import type { OrderTimelineEvent } from "./orders";

/** A page the shopper viewed before ordering, from the store's own analytics. */
export interface OrderSessionPage {
  path: string;
  title: string | null;
  at: string;
}

export interface OrderSessionDetails {
  /** False when the store's analytics never saw this shopper (a manual order, a blocked tracker). */
  tracked: boolean;
  /** The last pages viewed before the order (up to 30), oldest first. */
  pages: OrderSessionPage[];
  pageViews: number;
  firstVisitAt: string | null;
  /** From the first visit to the order. */
  timeToPurchaseSeconds: number | null;
  /** Null for an order without a customer. Test orders are not counted. */
  customer: {
    /** 1 = the customer's first order; null for a test order. */
    orderSequence: number | null;
    totalOrders: number;
    isNewCustomer: boolean;
    firstOrderAt: string | null;
  } | null;
  /** The newest timeline entry, for the page header. */
  lastAction: OrderTimelineEvent | null;
}

/** GET /orders/:id/session-details (orders/orderSessionDetails.js). */
export async function ordersSessionDetails(client: ApiClient, workspaceId: string, orderId: string): Promise<OrderSessionDetails> {
  return client.request<OrderSessionDetails>(`/workspaces/${workspaceId}/orders/${orderId}/session-details`);
}
