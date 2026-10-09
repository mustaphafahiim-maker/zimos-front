/**
 * Suppliers, purchase orders and stock counts (backend: frontend-handoff item 207,
 * src/modules/purchasing). Read inventory.view, change inventory.manage.
 * Every amount is integer minor units; the API answers them as strings.
 *
 * /workspaces/:ws/purchasing:
 *   GET    /suppliers                         → { suppliers }
 *   POST   /suppliers SupplierInput           → 201 supplier
 *   PATCH  /suppliers/:id                     → supplier
 *   DELETE /suppliers/:id                     → 204; 409 SUPPLIER_IN_USE when it has purchase orders
 *
 *   GET    /purchase-orders?status=&supplierId= → { purchaseOrders } (200 latest, without lines)
 *   POST   /purchase-orders PurchaseOrderInput  → 201 purchase order
 *   PUT    /purchase-orders/:id                 → purchase order; 409 PO_LOCKED unless it is a draft
 *   GET    /purchase-orders/:id                 → purchase order with its lines
 *   POST   /purchase-orders/:id/order           → draft → ordered; else 409 PO_STATUS
 *   POST   /purchase-orders/:id/cancel          → draft / ordered with nothing received; else 409 PO_STATUS
 *   POST   /purchase-orders/:id/receive         → partially_received / received. Adds the units to stock
 *          at the order's location and, unless `updateCost: false`, sets each variant's cost to the
 *          weighted average. 422 PO_OVER_RECEIVED with details[0].left; 409 PO_STATUS before it is ordered.
 *
 *   GET    /stock-counts                      → { stockCounts } (100 latest, without lines)
 *   POST   /stock-counts StockCountStart      → 201 count; `expected` = on hand now
 *   GET    /stock-counts/:id                  → count with its lines
 *   PATCH  /stock-counts/:id { lines }        → count — save as you go
 *   POST   /stock-counts/:id/apply            → every counted line adjusted by counted − on hand at that moment
 *   POST   /stock-counts/:id/cancel           → 409 COUNT_CLOSED once applied or cancelled
 */
import type { ApiClient } from "../client";

// ------------------------------------------------------------ suppliers --

export interface Supplier {
  id: string;
  name: string;
  contactName: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
}

export interface SupplierInput {
  /** 1–160 characters. */
  name: string;
  /** Up to 120 characters. */
  contactName?: string | null;
  /** Up to 40 characters. */
  phone?: string | null;
  email?: string | null;
  /** Up to 300 characters. */
  address?: string | null;
  /** Up to 5000 characters. */
  notes?: string | null;
}

// ------------------------------------------------------ purchase orders --

export type PurchaseOrderStatus = "draft" | "ordered" | "partially_received" | "received" | "cancelled";

export const PURCHASE_ORDER_STATUSES: readonly PurchaseOrderStatus[] = ["draft", "ordered", "partially_received", "received", "cancelled"];

export interface PurchaseOrderLine {
  id: string;
  variantId: string;
  sku: string | null;
  productName: string | null;
  optionValues: Record<string, string> | null;
  quantity: number;
  receivedQuantity: number;
  /** Minor units per unit. */
  unitCost: string;
  lineTotal: string;
}

/** A row of the list: totals without the lines. */
export interface PurchaseOrderSummary {
  id: string;
  /** "PO-0001" */
  number: string;
  status: PurchaseOrderStatus;
  /** `name` is missing only when the supplier could not be read. */
  supplier: { id: string; name?: string };
  /** The stock location (item 206) received units go to; null = the whole store / the default. */
  locationId: string | null;
  currency: string;
  /** "YYYY-MM-DD" */
  expectedAt: string | null;
  note: string | null;
  orderedAt: string | null;
  receivedAt: string | null;
  totalAmount: string;
  unitsOrdered: number;
  unitsReceived: number;
  lineCount: number;
  createdAt: string;
}

export interface PurchaseOrder extends Omit<PurchaseOrderSummary, "lineCount"> {
  lines: PurchaseOrderLine[];
}

export interface PurchaseOrderLineInput {
  variantId: string;
  /** 1–1,000,000 */
  quantity: number;
  /** Minor units, ≥ 0. */
  unitCost: number;
}

export interface PurchaseOrderInput {
  supplierId: string;
  locationId?: string | null;
  /** "YYYY-MM-DD" */
  expectedAt?: string | null;
  /** Up to 500 characters. */
  note?: string | null;
  /** 1–500 lines, one per variant. */
  lines: PurchaseOrderLineInput[];
}

export interface PurchaseOrderReceivePayload {
  /** Each quantity ≥ 1 and at most what is left on the line. */
  lines: Array<{ lineId: string; quantity: number }>;
  /** Default true. */
  updateCost?: boolean;
}

/** `details[0]` of a receive's 422 PO_OVER_RECEIVED. */
export interface PurchaseOrderOverReceived {
  field: "lines";
  lineId: string;
  left: number;
}

// --------------------------------------------------------- stock counts --

export type StockCountStatus = "open" | "applied" | "cancelled";

export interface StockCountSummary {
  id: string;
  /** null = the whole store. */
  locationId: string | null;
  status: StockCountStatus;
  note: string | null;
  appliedAt: string | null;
  createdAt: string;
}

export interface StockCountLine {
  id: string;
  variantId: string;
  sku: string | null;
  productName: string | null;
  /** On hand when the count started. */
  expected: number;
  counted: number | null;
  /** counted − expected, or null while not counted. */
  difference: number | null;
  /** What applying the count changed (counted − on hand at that moment). */
  appliedDelta: number | null;
}

export interface StockCount extends StockCountSummary {
  lines: StockCountLine[];
  /** Lines with a count entered. */
  counted: number;
  total: number;
}

export interface StockCountStart {
  locationId?: string | null;
  /** One product's variants; without it and `variantIds`, every variant (2000 at most). */
  productId?: string;
  variantIds?: string[];
  /** Up to 300 characters. */
  note?: string | null;
}

export interface StockCountEntry {
  variantId: string;
  /** ≥ 0, or null to clear it. */
  counted: number | null;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/purchasing`;

export async function suppliersList(client: ApiClient, workspaceId: string): Promise<Supplier[]> {
  const { suppliers } = await client.request<{ suppliers: Supplier[] }>(`${base(workspaceId)}/suppliers`);
  return suppliers;
}

export function supplierCreate(client: ApiClient, workspaceId: string, body: SupplierInput): Promise<Supplier> {
  return client.request<Supplier>(`${base(workspaceId)}/suppliers`, { method: "POST", body });
}

export function supplierUpdate(client: ApiClient, workspaceId: string, supplierId: string, body: Partial<SupplierInput>): Promise<Supplier> {
  return client.request<Supplier>(`${base(workspaceId)}/suppliers/${supplierId}`, { method: "PATCH", body });
}

export function supplierDelete(client: ApiClient, workspaceId: string, supplierId: string): Promise<void> {
  return client.request<void>(`${base(workspaceId)}/suppliers/${supplierId}`, { method: "DELETE" });
}

export async function purchaseOrdersList(
  client: ApiClient,
  workspaceId: string,
  query: { status?: PurchaseOrderStatus; supplierId?: string } = {}
): Promise<PurchaseOrderSummary[]> {
  const qs = new URLSearchParams();
  if (query.status) qs.set("status", query.status);
  if (query.supplierId) qs.set("supplierId", query.supplierId);
  const s = qs.toString();
  const { purchaseOrders } = await client.request<{ purchaseOrders: PurchaseOrderSummary[] }>(
    `${base(workspaceId)}/purchase-orders${s ? `?${s}` : ""}`
  );
  return purchaseOrders;
}

export function purchaseOrderGet(client: ApiClient, workspaceId: string, purchaseOrderId: string): Promise<PurchaseOrder> {
  return client.request<PurchaseOrder>(`${base(workspaceId)}/purchase-orders/${purchaseOrderId}`);
}

export function purchaseOrderCreate(client: ApiClient, workspaceId: string, body: PurchaseOrderInput): Promise<PurchaseOrder> {
  return client.request<PurchaseOrder>(`${base(workspaceId)}/purchase-orders`, { method: "POST", body });
}

export function purchaseOrderUpdate(
  client: ApiClient,
  workspaceId: string,
  purchaseOrderId: string,
  body: PurchaseOrderInput
): Promise<PurchaseOrder> {
  return client.request<PurchaseOrder>(`${base(workspaceId)}/purchase-orders/${purchaseOrderId}`, { method: "PUT", body });
}

export function purchaseOrderMarkOrdered(client: ApiClient, workspaceId: string, purchaseOrderId: string): Promise<PurchaseOrder> {
  return client.request<PurchaseOrder>(`${base(workspaceId)}/purchase-orders/${purchaseOrderId}/order`, { method: "POST" });
}

export function purchaseOrderCancel(client: ApiClient, workspaceId: string, purchaseOrderId: string): Promise<PurchaseOrder> {
  return client.request<PurchaseOrder>(`${base(workspaceId)}/purchase-orders/${purchaseOrderId}/cancel`, { method: "POST" });
}

export function purchaseOrderReceive(
  client: ApiClient,
  workspaceId: string,
  purchaseOrderId: string,
  body: PurchaseOrderReceivePayload
): Promise<PurchaseOrder> {
  return client.request<PurchaseOrder>(`${base(workspaceId)}/purchase-orders/${purchaseOrderId}/receive`, { method: "POST", body });
}

export async function stockCountsList(client: ApiClient, workspaceId: string): Promise<StockCountSummary[]> {
  const { stockCounts } = await client.request<{ stockCounts: StockCountSummary[] }>(`${base(workspaceId)}/stock-counts`);
  return stockCounts;
}

export function stockCountStart(client: ApiClient, workspaceId: string, body: StockCountStart): Promise<StockCount> {
  return client.request<StockCount>(`${base(workspaceId)}/stock-counts`, { method: "POST", body });
}

export function stockCountGet(client: ApiClient, workspaceId: string, countId: string): Promise<StockCount> {
  return client.request<StockCount>(`${base(workspaceId)}/stock-counts/${countId}`);
}

/** Save what was counted so far; lines left out keep their value. */
export function stockCountEnter(client: ApiClient, workspaceId: string, countId: string, lines: StockCountEntry[]): Promise<StockCount> {
  return client.request<StockCount>(`${base(workspaceId)}/stock-counts/${countId}`, { method: "PATCH", body: { lines } });
}

export function stockCountApply(client: ApiClient, workspaceId: string, countId: string): Promise<StockCount> {
  return client.request<StockCount>(`${base(workspaceId)}/stock-counts/${countId}/apply`, { method: "POST" });
}

export function stockCountCancel(client: ApiClient, workspaceId: string, countId: string): Promise<StockCount> {
  return client.request<StockCount>(`${base(workspaceId)}/stock-counts/${countId}/cancel`, { method: "POST" });
}
