/**
 * The online payments ledger (backend: frontend-handoff item 384,
 * src/modules/payments/ledger): every captured or failed gateway payment and
 * every refund of one, with the gateway's fee, the net, and the payout that
 * sent it to the bank. Cash on delivery, transfers, gift cards and points are
 * not in it. Everything needs `financial_reports.view` (403 otherwise).
 *
 * Under /workspaces/:ws/payments:
 *   GET  /transactions   filters + cursor → PaymentLedgerPage; `format=csv|xlsx` answers a file
 *   GET  /payouts        filters + cursor → PaymentPayoutsPage
 *   GET  /payouts/:id    → PaymentPayoutDetail (404 for another store's id)
 *   POST /payouts/sync   → { results } (409 PAYOUTS_NOT_AVAILABLE when no gateway reports payouts)
 *
 * Amounts are integer minor units. `amount` is signed (a refund is negative);
 * fees and net are in `feeCurrency`, the gateway's settlement currency.
 * All exported names are prefixed `paymentLedger` / `PaymentLedger` / `PaymentPayout`.
 */
import type { ApiClient } from "../client";

export type PaymentLedgerType = "payment" | "refund";
export type PaymentLedgerStatus = "captured" | "refunded" | "failed" | "pending";
export type PaymentPayoutStatus = "pending" | "in_transit" | "paid" | "failed" | "canceled";

/** The payout a ledger row went out in, as the row carries it. */
export interface PaymentLedgerPayoutRef {
  id: string;
  externalId: string | null;
  status: PaymentPayoutStatus;
  arrivalDate: string | null;
}

export interface PaymentLedgerRow {
  type: PaymentLedgerType;
  id: string;
  paymentId: string;
  orderId: string | null;
  orderNumber: string | null;
  gateway: string;
  method: string | null;
  mode: "live" | "test";
  status: PaymentLedgerStatus;
  /** The payment's own status (a captured row of a partly refunded payment says so here). */
  paymentStatus: string | null;
  /** Signed: a refund is negative. */
  amount: number;
  currency: string;
  /** Null: the gateway hasn't said yet, or never reports fees. */
  fee: number | null;
  feeCurrency: string | null;
  /** Null when nothing moved (a failed payment, a pending refund) or the payout hasn't reported it yet. */
  net: number | null;
  payoutId: string | null;
  payout: PaymentLedgerPayoutRef | null;
  reference: string | null;
  maskedDisplay: string | null;
  failureReason: string | null;
  /** A refund's origin: merchant, gateway, chargeback. Null on a payment. */
  source: string | null;
  occurredAt: string;
}

export interface PaymentLedgerTotals {
  byCurrency: { currency: string; payments: number; captured: number; refunds: number; refunded: number; failed: number; feesPending: number }[];
  feesByCurrency: { currency: string; fees: number; net: number }[];
}

export interface PaymentLedgerPage {
  transactions: PaymentLedgerRow[];
  /** Over everything the filters select; only on the first page. */
  totals?: PaymentLedgerTotals | null;
  nextCursor: string | null;
}

export interface PaymentLedgerFilters {
  gateway?: string;
  method?: string;
  status?: PaymentLedgerStatus;
  type?: PaymentLedgerType;
  mode?: "live" | "test";
  orderId?: string;
  payoutId?: string;
  /** YYYY-MM-DD on the store's calendar; `to` is inclusive. */
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}

export interface PaymentPayout {
  id: string;
  gateway: string;
  mode: "live" | "test";
  externalId: string | null;
  amount: number;
  currency: string;
  fee: number | null;
  arrivalDate: string | null;
  status: PaymentPayoutStatus;
  payments: number;
  refunds: number;
  /** Lines of the payout that are not a ZIMOS payment or refund. */
  unmatchedCount: number;
  unmatchedAmount: number;
  syncedAt: string | null;
  createdAt: string;
}

export interface PaymentPayoutsPage {
  payouts: PaymentPayout[];
  nextCursor: string | null;
}

export interface PaymentPayoutFilters {
  gateway?: string;
  status?: PaymentPayoutStatus;
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}

export interface PaymentPayoutDetail {
  payout: PaymentPayout;
  /** `net + unmatchedAmount` = the payout's amount. */
  summary: { paymentsAmount: number; refundsAmount: number; fees: number; net: number; unmatchedCount: number; unmatchedAmount: number };
  payments: PaymentLedgerRow[];
  refunds: PaymentLedgerRow[];
}

/** One gateway's line of a payouts refresh: counts, "recently synced", or the gateway's error. */
export interface PaymentPayoutSyncResult {
  gateway: string;
  since?: string;
  payouts?: number;
  created?: number;
  matchedPayments?: number;
  matchedRefunds?: number;
  unmatched?: number;
  skipped?: string;
  error?: string;
  message?: string;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/payments`;

function query(params: object): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params as Record<string, string | number | undefined | null>)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

// The class's own authenticated fetch (token refresh, ApiError), for the file download.
function rawFetch(client: ApiClient, path: string, init: RequestInit): Promise<Response> {
  return (client as unknown as { rawFetch(path: string, init: RequestInit): Promise<Response> }).rawFetch(path, init);
}

export function paymentLedgerList(client: ApiClient, workspaceId: string, filters: PaymentLedgerFilters = {}): Promise<PaymentLedgerPage> {
  return client.request<PaymentLedgerPage>(`${base(workspaceId)}/transactions${query(filters)}`);
}

/** The same filters as a file (up to 10,000 rows); `lang` words its headers. */
export async function paymentLedgerExport(
  client: ApiClient,
  workspaceId: string,
  filters: Omit<PaymentLedgerFilters, "limit" | "cursor">,
  format: "csv" | "xlsx",
  lang: "en" | "ar"
): Promise<{ blob: Blob; filename: string }> {
  const res = await rawFetch(client, `${base(workspaceId)}/transactions${query({ ...filters, format, lang })}`, {});
  const disposition = res.headers.get("Content-Disposition") ?? "";
  const named = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1];
  let filename = `payments.${format}`;
  if (named) {
    try {
      filename = decodeURIComponent(named);
    } catch {
      filename = named;
    }
  }
  return { blob: await res.blob(), filename };
}

export function paymentPayoutsList(client: ApiClient, workspaceId: string, filters: PaymentPayoutFilters = {}): Promise<PaymentPayoutsPage> {
  return client.request<PaymentPayoutsPage>(`${base(workspaceId)}/payouts${query(filters)}`);
}

export function paymentPayoutGet(client: ApiClient, workspaceId: string, payoutId: string): Promise<PaymentPayoutDetail> {
  return client.request<PaymentPayoutDetail>(`${base(workspaceId)}/payouts/${payoutId}`);
}

export async function paymentPayoutsSync(client: ApiClient, workspaceId: string): Promise<PaymentPayoutSyncResult[]> {
  const { results } = await client.request<{ results: PaymentPayoutSyncResult[] }>(`${base(workspaceId)}/payouts/sync`, { method: "POST" });
  return results ?? [];
}
