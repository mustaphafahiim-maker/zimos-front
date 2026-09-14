import { ApiError, type ApiClient, type PageTree } from "@store-builder/api-client";

/**
 * Public storefront endpoints the shared api-client doesn't wrap yet (funnel
 * runtime, review submission). Shapes mirror the backend exactly:
 *  - src/modules/funnels/funnelsService.js (startSession / getSessionStep / advanceSession)
 *  - src/modules/reviews/reviewService.js (submitReview / publicRatingFor)
 * They go through ApiClient.request so base URL, error mapping and the
 * server-side proxy headers stay identical to every other storefront call.
 */

/**
 * Catalogue page size. Lives in this plain module (not a "use client" file) so
 * server components get the number, not a client reference.
 */
export const PAGE_SIZE = 24;

// --- funnels ---------------------------------------------------------------

export type FunnelStepType =
  | "landing"
  | "sales"
  | "opt_in"
  | "checkout"
  | "upsell"
  | "downsell"
  | "thank_you"
  | "custom";

export type FunnelOutcome = "completed_checkout" | "accepted_offer" | "declined_offer" | "clicked_through";

export interface FunnelSession {
  id: string;
  currentStepKey: string;
  path: string[];
  status: "active" | "completed" | string;
  orderId: string | null;
}

export interface FunnelStep {
  key: string;
  name: string;
  stepType: FunnelStepType;
  tree: PageTree | null;
  seo: Record<string, unknown>;
}

/** Only upsell/downsell steps carry an offer (funnelGraph OFFER_STEP_TYPES). */
export interface FunnelOffer {
  id: string;
  name: string;
  priceAmount: string | number;
  currency: string;
  badge: string | null;
  lines: { variantId: string; quantity: number }[];
}

export interface FollowOnOrder {
  id: string;
  orderNumber: string;
  totalAmount: string | number;
  linkedFromOrderId: string;
}

/** Either a step to render, or `done` when the funnel has no further edge. */
export interface FunnelStepResponse {
  session: FunnelSession;
  step?: FunnelStep;
  offer?: FunnelOffer;
  done?: true;
  followOnOrder?: FollowOnOrder;
}

export interface FunnelStartResponse extends FunnelStepResponse {
  funnel: { id: string; name: string; subdomain: string | null };
}

const enc = encodeURIComponent;

/** `ref` is the funnel id or its subdomain; resumes the visitor's active session. */
export function startFunnelSession(client: ApiClient, workspaceId: string, ref: string, visitorId: string, attribution: Record<string, string> = {}) {
  return client.request<FunnelStartResponse>(`/store/${enc(workspaceId)}/funnels/${enc(ref)}/sessions`, {
    method: "POST",
    auth: false,
    body: { visitorId, attribution },
  });
}

export function getFunnelStep(client: ApiClient, workspaceId: string, funnelId: string, sessionId: string) {
  return client.request<FunnelStepResponse>(
    `/store/${enc(workspaceId)}/funnels/${enc(funnelId)}/sessions/${enc(sessionId)}/step`,
    { auth: false }
  );
}

/**
 * The backend serialises advance calls on the session row (SELECT … FOR
 * UPDATE), so a double-clicked Accept creates exactly one follow-on order.
 */
export function advanceFunnel(
  client: ApiClient,
  workspaceId: string,
  funnelId: string,
  sessionId: string,
  outcome: { type: FunnelOutcome; orderId?: string }
) {
  return client.request<FunnelStepResponse>(
    `/store/${enc(workspaceId)}/funnels/${enc(funnelId)}/sessions/${enc(sessionId)}/advance`,
    { method: "POST", auth: false, body: { outcome } }
  );
}

export type FunnelErrorKind = "paused" | "sessionGone" | "notFound" | "other";

/** 410 FUNNEL_PAUSED; 404 "FunnelSession not found" vs any other 404. */
export function classifyFunnelError(err: unknown): FunnelErrorKind {
  if (!(err instanceof ApiError)) return "other";
  if (err.status === 410 || err.code === "FUNNEL_PAUSED") return "paused";
  if (err.status === 404) return /FunnelSession/i.test(err.message) ? "sessionGone" : "notFound";
  return "other";
}

// --- reviews -----------------------------------------------------------------

export interface ProductRating {
  average: number | null;
  count: number;
}

export interface PublicReview {
  rating: number;
  comment: string | null;
  createdAt: string;
}

/**
 * The public product payload carries `rating: { average, count }` and up to 50
 * approved `reviews` (the api-client types still say `rating: number | null`,
 * so read them defensively here).
 */
export function ratingOf(product: { rating?: unknown }): ProductRating {
  const r = product.rating as Partial<ProductRating> | null | undefined;
  const count = typeof r?.count === "number" ? r.count : Number(r?.count) || 0;
  const avg = r?.average === null || r?.average === undefined ? null : Number(r.average);
  return { average: count > 0 && Number.isFinite(avg) ? avg : null, count };
}

export function reviewsOf(product: { reviews?: unknown }): PublicReview[] {
  if (!Array.isArray(product.reviews)) return [];
  return product.reviews
    .filter((r): r is PublicReview => !!r && typeof (r as PublicReview).rating === "number")
    .map((r) => ({ rating: r.rating, comment: r.comment ?? null, createdAt: r.createdAt }));
}

/** Body is exactly { phone, rating, comment } — the backend has no name field. */
export function submitProductReview(
  client: ApiClient,
  workspaceId: string,
  productId: string,
  body: { phone: string; rating: number; comment?: string }
) {
  return client.request<{ review: { id: string; rating: number; comment: string | null; status: string; created: boolean } }>(
    `/store/${enc(workspaceId)}/products/${enc(productId)}/reviews`,
    { method: "POST", auth: false, body }
  );
}
