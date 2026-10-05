/**
 * Fields the orders list rows carry beyond the Order type (backend:
 * orderService.listOrders / hydrateOrders), for the list's optional columns.
 */
import type { Order, OrderItem, ShipmentStatus } from "../types";

export interface OrderListShipment {
  carrierCode: string | null;
  waybillNumber: string | null;
  status: ShipmentStatus;
}

export interface OrderListExtras {
  /** Two letters, from the order's IP; null when unknown. */
  ipCountry: string | null;
  /** "low" when the details look made up or incomplete (risk/riskService). */
  dataQuality: "good" | "low" | null;
  /** The latest shipment that is not cancelled. */
  shipment: OrderListShipment | null;
  /** The funnel the order came through, by name (orders list and order page; backend orderListDecor.js). */
  funnelName: string | null;
  /** The list only: the customer had no earlier order in the store. Null where not sent (the order page). */
  isNewCustomer: boolean | null;
}

/** A line's product picture (its variant's, else the product's first), as the list and the order page send it. */
export function orderLineImageOf(item: OrderItem): string | null {
  const url = (item as OrderItem & { imageUrl?: string | null }).imageUrl;
  return typeof url === "string" && url ? url : null;
}

export function orderListExtrasOf(order: Order): OrderListExtras {
  const o = order as Order & Partial<OrderListExtras>;
  return {
    ipCountry: o.ipCountry ?? null,
    dataQuality: o.dataQuality === "good" || o.dataQuality === "low" ? o.dataQuality : null,
    shipment: o.shipment ?? null,
    funnelName: typeof o.funnelName === "string" && o.funnelName ? o.funnelName : null,
    isNewCustomer: typeof o.isNewCustomer === "boolean" ? o.isNewCustomer : null,
  };
}
