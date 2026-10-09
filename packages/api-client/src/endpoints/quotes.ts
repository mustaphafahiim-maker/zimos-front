/**
 * Quote requests for bulk / business buyers (backend: frontend-handoff items 219 and 275,
 * src/modules/quotes).
 *
 * A shopper asks for quantities and gets a private token (shown once — the browser keeps it);
 * the store answers with a unit price per line and a date the offer holds until; the shopper
 * accepts with a delivery address — a cash-on-delivery order at exactly the quoted prices plus
 * shipping — or declines.
 *
 * Storefront (public), /store/:ws/quotes:
 *   POST /                     ShopperQuoteRequest → 201 ShopperQuoteCreated
 *        429 after 5 requests an hour from one address; 422 on `lines` for a product not on sale.
 *        With X-Shopper-Token the quote is linked to the signed-in shopper's account.
 *   GET  /:quoteId?token=      → { quote: ShopperQuote } (404 for a wrong token)
 *   POST /:quoteId/accept      { token, shippingAddress, notes? } → 201 ShopperQuoteAccepted
 *        409 QUOTE_EXPIRED (past its date), 409 QUOTE_NOT_OPEN (not quoted, or accepted already:
 *        a second accept never makes a second order — read the quote again and show its state).
 *        Stock, shipping and fraud rules answer as they do at checkout.
 *   POST /:quoteId/decline     { token } → { quote } (409 QUOTE_NOT_OPEN once it is closed)
 *
 * Dashboard, /workspaces/:ws/quotes (read orders.view, change orders.manage):
 *   GET  /?status=             → QuoteList (newest first, at most 200)
 *   GET  /:quoteId             → { quote: Quote } with the full contact
 *   PUT  /:quoteId/answer      QuoteAnswer → { quote } — only requested products (422 on `lines`);
 *        the first answer emails the shopper once. 409 QUOTE_CLOSED once accepted / declined / cancelled.
 *   POST /:quoteId/cancel      → { quote } (409 QUOTE_CLOSED)
 * A new request raises the merchant notification `quote.request` (link /quotes/:id).
 *
 * Every amount is integer minor units, sent as a string.
 */
import type { ApiClient } from "../client";

/** `expired` is a quoted offer past its date; the list filter knows the other five. */
export type QuoteStatus = "new" | "quoted" | "accepted" | "declined" | "cancelled" | "expired";

/** The statuses GET /quotes?status= accepts (an expired quote is filed under "quoted"). */
export type QuoteListStatus = Exclude<QuoteStatus, "expired">;
export const QUOTE_LIST_STATUSES: readonly QuoteListStatus[] = ["new", "quoted", "accepted", "declined", "cancelled"];

/** What the API accepts (quotes/index.js). */
export const QUOTE_LIMITS = {
  lines: 50,
  quantity: 100000,
  fullNameMin: 2,
  fullName: 120,
  phoneMin: 6,
  phone: 32,
  email: 255,
  company: 120,
  lineNote: 300,
  message: 2000,
  answerNote: 2000,
  acceptNotes: 500,
} as const;

export interface QuoteLine {
  variantId: string;
  /** Null when the variant is gone. */
  productName: string | null;
  sku: string | null;
  optionValues: Record<string, string> | null;
  /** The quantity offered once quoted; the requested one before. */
  quantity: number;
  requestedQuantity: number;
  /** The shopper's note on this line. */
  note: string | null;
  /** The variant's price in the store today, minor units. */
  listPrice: string | null;
  /** The store's price for one unit; null until quoted, and for a line the store left out. */
  unitPrice: string | null;
  lineTotal: string | null;
}

/** What the shopper sees of the contact: never the phone or the email. */
export interface QuoteContactPublic {
  fullName: string;
  company: string | null;
}

export interface QuoteContact extends QuoteContactPublic {
  phone: string;
  email: string | null;
}

export interface ShopperQuote {
  id: string;
  /** "Q-0001" */
  number: string;
  status: QuoteStatus;
  contact: QuoteContactPublic;
  lines: QuoteLine[];
  /** The shopper's message. */
  message: string | null;
  /** The store's note with its prices. */
  quotedNote: string | null;
  /** The sum of the quoted lines; null until quoted. Shipping is added when the order is made. */
  totalAmount: string | null;
  currency: string | null;
  validUntil: string | null;
  quotedAt: string | null;
  /** The order an accepted quote became. */
  orderId: string | null;
  createdAt: string;
}

export interface Quote extends Omit<ShopperQuote, "contact"> {
  contact: QuoteContact;
  /** The shopper's account, when they were signed in. */
  customerId: string | null;
}

/** A row of the inbox. */
export interface QuoteSummary {
  id: string;
  number: string;
  status: QuoteStatus;
  contact: QuoteContact;
  lineCount: number;
  validUntil: string | null;
  orderId: string | null;
  createdAt: string;
}

export interface QuoteList {
  quotes: QuoteSummary[];
  /** How many of the rows returned are new — the store-wide count only when unfiltered or filtered to "new". */
  newCount: number;
}

export interface QuoteAnswerLine {
  variantId: string;
  /** 1–100000 */
  quantity: number;
  /** Minor units, ≥ 0. */
  unitPrice: number;
}

export interface QuoteAnswer {
  /** 1–50, only variants that were asked for. */
  lines: QuoteAnswerLine[];
  note?: string | null;
  /** ISO date-time in the future. */
  validUntil: string;
}

const base = (workspaceId: string) => `/workspaces/${workspaceId}/quotes`;

export function quotesList(client: ApiClient, workspaceId: string, status?: QuoteListStatus): Promise<QuoteList> {
  return client.request<QuoteList>(`${base(workspaceId)}${status ? `?status=${status}` : ""}`);
}

export async function quoteGet(client: ApiClient, workspaceId: string, quoteId: string): Promise<Quote> {
  return (await client.request<{ quote: Quote }>(`${base(workspaceId)}/${quoteId}`)).quote;
}

/** Sends the store's prices (again, while the quote is still open). */
export async function quoteAnswer(client: ApiClient, workspaceId: string, quoteId: string, body: QuoteAnswer): Promise<Quote> {
  return (await client.request<{ quote: Quote }>(`${base(workspaceId)}/${quoteId}/answer`, { method: "PUT", body })).quote;
}

export async function quoteCancel(client: ApiClient, workspaceId: string, quoteId: string): Promise<Quote> {
  return (await client.request<{ quote: Quote }>(`${base(workspaceId)}/${quoteId}/cancel`, { method: "POST" })).quote;
}

// ----------------------------------------------------------- storefront --

export interface ShopperQuoteRequest {
  contact: { fullName: string; phone: string; email?: string | null; company?: string | null };
  /** 1–50 lines, one per variant. */
  lines: Array<{ variantId: string; quantity: number; note?: string | null }>;
  message?: string | null;
}

export interface ShopperQuoteCreated {
  quoteId: string;
  number: string;
  /** Shown this once: it opens the quote. */
  token: string;
  status: "new";
}

export interface ShopperQuoteAddress {
  country?: string;
  province: string;
  city: string;
  area?: string | null;
  addressLine: string;
  placeId?: string;
}

export interface ShopperQuoteAccepted {
  quote: ShopperQuote;
  orderId: string;
  orderNumber: string;
  /** The order's total: the quote's total plus shipping, minor units. */
  totalAmount: string;
}

const storeBase = (workspaceRef: string) => `/store/${workspaceRef}/quotes`;

/** A shopper's request. `shopperToken` links it to their account when they are signed in. */
export function shopperQuoteRequest(
  client: ApiClient,
  workspaceRef: string,
  body: ShopperQuoteRequest,
  shopperToken?: string | null
): Promise<ShopperQuoteCreated> {
  return client.request<ShopperQuoteCreated>(storeBase(workspaceRef), {
    method: "POST",
    body,
    auth: false,
    ...(shopperToken ? { headers: { "X-Shopper-Token": shopperToken } } : {}),
  });
}

export async function shopperQuoteGet(client: ApiClient, workspaceRef: string, quoteId: string, token: string): Promise<ShopperQuote> {
  const query = new URLSearchParams({ token });
  return (await client.request<{ quote: ShopperQuote }>(`${storeBase(workspaceRef)}/${quoteId}?${query.toString()}`, { auth: false })).quote;
}

/** Accepts the quote: a cash-on-delivery order at the quoted prices, delivered to `shippingAddress`. */
export function shopperQuoteAccept(
  client: ApiClient,
  workspaceRef: string,
  quoteId: string,
  body: { token: string; shippingAddress: ShopperQuoteAddress; notes?: string | null }
): Promise<ShopperQuoteAccepted> {
  return client.request<ShopperQuoteAccepted>(`${storeBase(workspaceRef)}/${quoteId}/accept`, { method: "POST", body, auth: false });
}

export async function shopperQuoteDecline(client: ApiClient, workspaceRef: string, quoteId: string, token: string): Promise<ShopperQuote> {
  return (
    await client.request<{ quote: ShopperQuote }>(`${storeBase(workspaceRef)}/${quoteId}/decline`, { method: "POST", body: { token }, auth: false })
  ).quote;
}
