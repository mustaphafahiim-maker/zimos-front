/**
 * Gift cards (backend: src/modules/giftCards).
 *
 * Dashboard (discounts.manage), /workspaces/:ws/gift-cards:
 *   GET    /?state=&q=&before=&limit=     → { giftCards: GiftCard[], nextBefore }
 *          q = a full code, its last 4, or part of the recipient's email.
 *   POST   /  GiftCardIssuePayload        → 201 { giftCard, code } — the only time the code comes in full
 *   GET    /:id                           → GiftCardDetail (the card and its last 100 balance changes)
 *   PATCH  /:id GiftCardUpdatePayload     → GiftCardDetail
 *          422 VALIDATION_ERROR on `adjustBy` when the balance would go below zero.
 *   POST   /:id/code { resend }           → { code, sent } — reveal, or email it again to the recipient
 *          (422 GIFT_CARD_NO_EMAIL without an email).
 *   GET/PUT /settings                     → GiftCardSettings — the products sold as gift cards.
 *
 * Storefront (public): POST /store/:ws/gift-cards/check { code } → { giftCard: GiftCardBalance }
 *   404 GIFT_CARD_NOT_FOUND; rate-limited like order tracking (429).
 * Checkout: `giftCardCode` with cash on delivery or an online payment, never bank
 *   transfer. 422 GIFT_CARD_NOT_FOUND / GIFT_CARD_UNUSABLE on field `giftCardCode`; the 201 answer
 *   adds `giftCard` (GiftCardRedemption) and the order's amountPaid / financialState. Online, the
 *   card's part is held and the gateway charges the rest (endpoints/checkoutTenders.ts).
 *
 * Every amount is integer minor units, sent as a string.
 */
import { ApiError, type ApiClient } from "../client";
import { apiFieldProblems } from "../errors";

/** What a card can do now: spend (active), nothing left (empty), past its date, or switched off. */
export type GiftCardState = "active" | "empty" | "expired" | "disabled";

/** The status staff set; `state` is what follows from it, the balance and the date. */
export type GiftCardStatus = "active" | "disabled";

/** Issued by staff, or bought on an order (a product sold as a gift card). */
export type GiftCardSource = "manual" | "order";

export interface GiftCard {
  id: string;
  last4: string;
  initialAmount: string;
  balanceAmount: string;
  currency: string;
  state: GiftCardState;
  status: GiftCardStatus;
  expiresAt: string | null;
  source: GiftCardSource;
  /** The order that bought it (source "order"). */
  orderId: string | null;
  customerId: string | null;
  recipientName: string | null;
  recipientEmail: string | null;
  message: string | null;
  /** Staff only, never shown to the holder. */
  note: string | null;
  createdAt: string;
}

/**
 * With an online payment the card's part is first a `hold` for the unpaid order;
 * paid, it reads `redeem`; an order that expires or is cancelled turns it `hold_released` and
 * gives it back with a `release` line.
 */
export type GiftCardTransactionKind = "issue" | "redeem" | "refund" | "adjust" | "hold" | "hold_released" | "release";

/** One change of the balance; `amount` is signed ("-25000" for a redemption). */
export interface GiftCardTransaction {
  id: string;
  kind: GiftCardTransactionKind;
  amount: string;
  balanceAfter: string;
  orderId: string | null;
  note: string | null;
  createdAt: string;
}

export interface GiftCardDetail {
  giftCard: GiftCard;
  /** Newest first, at most 100. */
  transactions: GiftCardTransaction[];
}

export interface GiftCardPage {
  giftCards: GiftCard[];
  /** Pass back as `before` for the next page; null on the last one. */
  nextBefore: string | null;
}

export interface GiftCardListQuery {
  state?: GiftCardState;
  q?: string;
  before?: string;
  limit?: number;
}

export interface GiftCardIssuePayload {
  /** Minor units, ≥ 1. */
  amount: number;
  currency: string;
  /** A future ISO date, or null for no end. */
  expiresAt?: string | null;
  recipientName?: string | null;
  recipientEmail?: string | null;
  /** Up to 500 characters, shown to the holder. */
  message?: string | null;
  /** Up to 500 characters, staff only. */
  note?: string | null;
  /** Email the code to the recipient (default true; needs recipientEmail). */
  sendEmail?: boolean;
}

export interface GiftCardIssued {
  giftCard: GiftCard;
  /** "9KVF-TKVD-7GWL-T6FK" — show it once, with a copy button. */
  code: string;
}

export interface GiftCardUpdatePayload {
  status?: GiftCardStatus;
  expiresAt?: string | null;
  note?: string | null;
  recipientName?: string | null;
  recipientEmail?: string | null;
  /** ± minor units, never 0. */
  adjustBy?: number;
  adjustNote?: string | null;
}

export interface GiftCardSettings {
  /** Products whose every unit sold issues a card worth its price (≤ 50). */
  productIds: string[];
  /** Days a bought card stays valid (1–3650), or null for no end. */
  validityDays: number | null;
}

/** Most products the settings can name. */
export const GIFT_CARD_MAX_PRODUCTS = 50;

const base = (workspaceId: string) => `/workspaces/${workspaceId}/gift-cards`;

export function giftCardsList(client: ApiClient, workspaceId: string, query: GiftCardListQuery = {}): Promise<GiftCardPage> {
  const qs = new URLSearchParams();
  if (query.state) qs.set("state", query.state);
  if (query.q && query.q.trim()) qs.set("q", query.q.trim());
  if (query.before) qs.set("before", query.before);
  if (query.limit) qs.set("limit", String(query.limit));
  const s = qs.toString();
  return client.request<GiftCardPage>(`${base(workspaceId)}${s ? `?${s}` : ""}`);
}

export function giftCardIssue(client: ApiClient, workspaceId: string, body: GiftCardIssuePayload): Promise<GiftCardIssued> {
  return client.request<GiftCardIssued>(base(workspaceId), { method: "POST", body, idempotent: true });
}

export function giftCardGet(client: ApiClient, workspaceId: string, giftCardId: string): Promise<GiftCardDetail> {
  return client.request<GiftCardDetail>(`${base(workspaceId)}/${giftCardId}`);
}

export function giftCardUpdate(
  client: ApiClient,
  workspaceId: string,
  giftCardId: string,
  body: GiftCardUpdatePayload
): Promise<GiftCardDetail> {
  return client.request<GiftCardDetail>(`${base(workspaceId)}/${giftCardId}`, { method: "PATCH", body });
}

/** The full code again (`resend: false`), or emailed to the recipient once more (`resend: true`). */
export function giftCardCode(
  client: ApiClient,
  workspaceId: string,
  giftCardId: string,
  resend = false
): Promise<{ code: string; sent: boolean }> {
  return client.request<{ code: string; sent: boolean }>(`${base(workspaceId)}/${giftCardId}/code`, {
    method: "POST",
    body: { resend },
  });
}

export function giftCardSettingsGet(client: ApiClient, workspaceId: string): Promise<GiftCardSettings> {
  return client.request<GiftCardSettings>(`${base(workspaceId)}/settings`);
}

export function giftCardSettingsSave(client: ApiClient, workspaceId: string, body: GiftCardSettings): Promise<GiftCardSettings> {
  return client.request<GiftCardSettings>(`${base(workspaceId)}/settings`, { method: "PUT", body });
}

// ----------------------------------------------------------- storefront --

/** What a shopper may see of a card: never its id, its holder or the full code. */
export interface GiftCardBalance {
  last4: string;
  balanceAmount: string;
  currency: string;
  state: GiftCardState;
  expiresAt: string | null;
}

/** A card's balance by its code (any spacing or case). 404 GIFT_CARD_NOT_FOUND. */
export async function giftCardCheck(client: ApiClient, workspaceId: string, code: string): Promise<GiftCardBalance> {
  const { giftCard } = await client.request<{ giftCard: GiftCardBalance }>(`/store/${workspaceId}/gift-cards/check`, {
    method: "POST",
    body: { code },
    auth: false,
  });
  return giftCard;
}

/** What the checkout's 201 adds when a card came with the order. */
export interface GiftCardRedemption {
  applied: boolean;
  /** True with an online payment: held until the gateway is paid, given back if it never is. */
  held?: boolean;
  amount?: string;
  last4?: string;
  balanceAmount?: string;
  currency?: string;
  /**
   * When not applied: "unusable" (spent meanwhile), "nothing_due", "error", or
   * "covers_order_cod_unavailable" (it covered the whole order but the store has cash on
   * delivery off, so the gateway charges the full total).
   */
  reason?: string;
}

/** The checkout body's gift-card field, with cash on delivery only. */
export interface GiftCardCheckoutFields {
  giftCardCode?: string;
}

/** A gift-card code is 16 characters without spacing or dashes; the API takes any spacing or case. */
export function normalizeGiftCardCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** "9KVFTKVD7GWLT6FK" → "9KVF-TKVD-7GWL-T6FK", as the card is printed. */
export function prettyGiftCardCode(raw: string): string {
  const n = normalizeGiftCardCode(raw);
  return (n.match(/.{1,4}/g) ?? []).join("-");
}

/**
 * Why a checkout or a balance check refused the card, when it did:
 * "not_found", "expired", "empty", "disabled", "currency" (another currency),
 * "cod_only" (sent with a bank transfer: a card goes with cash on delivery or an
 * online payment), or null for any other error.
 */
export type GiftCardRefusal = "not_found" | "expired" | "empty" | "disabled" | "currency" | "cod_only";

export function giftCardRefusalOf(err: unknown): GiftCardRefusal | null {
  if (!(err instanceof ApiError)) return null;
  if (err.code === "GIFT_CARD_NOT_FOUND") return "not_found";
  const problem = apiFieldProblems(err).find((p) => p.field === "giftCardCode");
  const text = `${problem?.message ?? ""} ${err.code === "GIFT_CARD_UNUSABLE" ? err.message : ""}`.toLowerCase();
  if (err.code === "GIFT_CARD_UNUSABLE") {
    if (/expired/.test(text)) return "expired";
    if (/no balance/.test(text)) return "empty";
    if (/no longer valid/.test(text)) return "disabled";
    if (/ is in /.test(text)) return "currency";
    return "disabled";
  }
  if (problem && /cash on delivery/i.test(problem.message)) return "cod_only";
  if (problem) return "not_found";
  return null;
}
