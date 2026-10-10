/**
 * Back-in-stock alerts (backend stockAlerts/, frontend-handoff 194).
 *
 * Storefront, no sign-in:
 *   POST /store/:ws/stock-alerts { variantId, email | phone (exactly one), locale? }
 *     → 201 { subscribed: true, channel }. Asking twice is fine (one alert per
 *     variant and address). 409 IN_STOCK when the variant can be bought;
 *     404 not for sale; 422 INVALID_PHONE; 429 after 20 alerts an hour.
 *   The shopper is told once — one email or SMS — when the variant's stock
 *   goes from 0 to available (any stock edit, import or return).
 *
 * Dashboard (permission products.view):
 *   GET /workspaces/:ws/stock-alerts → { variants } (most waited first, 200 rows).
 */
import type { ApiClient } from "../client";

export type StockAlertChannel = "email" | "sms";

export type StockAlertRequest = { variantId: string; locale?: "ar" | "en" | "fr" } & (
  | { email: string; phone?: never }
  | { phone: string; email?: never }
);

export interface StockAlertSubscribed {
  subscribed: true;
  channel: StockAlertChannel;
}

export function subscribeStockAlert(client: ApiClient, workspaceRef: string, body: StockAlertRequest): Promise<StockAlertSubscribed> {
  return client.request<StockAlertSubscribed>(`/store/${workspaceRef}/stock-alerts`, { method: "POST", body, auth: false });
}

// ---------------------------------------------------------------- staff --

export interface StockAlertVariant {
  productId: string;
  productName: string;
  variantId: string;
  sku: string | null;
  optionValues: Record<string, string> | null;
  /** Shoppers still waiting for this variant. */
  waiting: number;
  /** Shoppers already told it came back. */
  notified: number;
  lastRequestAt: string;
}

export function stockAlertsSummary(client: ApiClient, workspaceId: string): Promise<{ variants: StockAlertVariant[] }> {
  return client.request<{ variants: StockAlertVariant[] }>(`/workspaces/${workspaceId}/stock-alerts`);
}
