/**
 * Paper for many ticked orders beyond waybills and the manifest (backend:
 * src/modules/orders/orderInvoicesPdf.js).
 *
 *   POST /workspaces/:ws/orders/documents/invoices   orders.view
 *
 * All exported names are prefixed `ordersSelection`.
 */
import type { ApiClient } from "../client";

export interface OrdersSelectionInvoices {
  pdf: Blob;
  /** How many invoices the PDF holds. */
  printed: number;
  /** Order numbers left out: no invoice yet (an online order still unpaid). */
  skipped: string[];
}

/** The orders' invoices in one PDF, in the order given (up to 200). 409 INVOICE_NOT_ISSUED when none has one. */
export async function ordersSelectionInvoicesPdf(
  client: ApiClient,
  workspaceId: string,
  orderIds: string[]
): Promise<OrdersSelectionInvoices> {
  const answer = await client.request<{ base64: string; contentType: string; printed: number; skipped: string[] }>(
    `/workspaces/${workspaceId}/orders/documents/invoices?as=base64`,
    { method: "POST", body: { orderIds } }
  );
  const binary = atob(answer.base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { pdf: new Blob([bytes], { type: answer.contentType }), printed: answer.printed, skipped: answer.skipped ?? [] };
}
