/**
 * Fields the orders list rows carry beyond the Order type (backend:
 * orderService.listOrders / hydrateOrders), for the list's optional columns.
 */
import type { Order, ShipmentStatus } from "../types";

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
}

export function orderListExtrasOf(order: Order): OrderListExtras {
  const o = order as Order & Partial<OrderListExtras>;
  return {
    ipCountry: o.ipCountry ?? null,
    dataQuality: o.dataQuality === "good" || o.dataQuality === "low" ? o.dataQuality : null,
    shipment: o.shipment ?? null,
  };
}
