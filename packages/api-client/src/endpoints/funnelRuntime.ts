/**
 * Public funnel runtime (backend: src/modules/funnels/funnelsPublicRoutes.js,
 * funnelsService start/getSessionStep/advanceSession). No staff auth.
 * Mounted at /store/:workspaceId/funnels — the workspace may be a UUID or the
 * store slug. All exported names in this file are prefixed with
 * `funnelRuntime` / `FunnelRuntime`.
 *
 * Notable codes: STEP_MISMATCH (409 — `fromStepKey` is no longer the
 * session's step; the error carries no step, so resync with
 * funnelRuntimeGetStep), FUNNEL_PAUSED (410), NOT_FOUND (404 — unpublished
 * funnel, unknown session), VALIDATION_ERROR (422 — e.g. accepting an upsell
 * before any checkout on this session).
 */
import type { FunnelOwnSettings } from "./funnelExtras";
import type { ApiClient } from "../client";
import type { FunnelStepTypeDto } from "./funnels";
import type { PageTree, StorefrontOrderBump } from "../types";

// ------------------------------------------------------------------ types --

export interface FunnelRuntimeSession {
  id: string;
  currentStepKey: string;
  /** Keys of the steps already passed through, oldest first. */
  path: string[];
  status: "active" | "completed";
  /** The order placed on this session's checkout step, once there is one. */
  orderId: string | null;
}

/** The published snapshot of one step — `tree` is the same page tree as website pages. */
export interface FunnelRuntimeStep {
  key: string;
  name: string;
  stepType: FunnelStepTypeDto;
  tree: PageTree | null;
  seo: Record<string, unknown>;
}

/** Present on upsell/downsell steps that have an active offer. */
export interface FunnelRuntimeOffer {
  id: string;
  name: string;
  /** Integer minor units — BIGINT, so it may arrive as a string. */
  priceAmount: string | number;
  currency: string;
  badge: string | null;
  lines: Array<{ variantId: string; quantity: number }>;
  /** The offer's real countdown (offers/offerCountdown.js): its length, and when it ends for this session. */
  countdownMinutes?: number | null;
  expiresAt?: string | null;
}

/**
 * What every runtime call answers with. `done: true` means the journey is
 * over — and it may still carry `step`, which is then the thank-you page the
 * visitor must see. `done` with no `step` means there is nothing left to
 * render (a republish removed that step).
 */
export interface FunnelRuntimeState {
  /** The funnel and its own settings (currency, icon, title); the step page reads them. */
  funnel?: { id: string; name: string; subdomain: string | null; settings?: FunnelOwnSettings };
  done?: boolean;
  session: FunnelRuntimeSession;
  step?: FunnelRuntimeStep;
  offer?: FunnelRuntimeOffer;
  /** On an offer step: accepting joins the checkout order (the store's funnel_upsell_merge, window open). */
  offerJoinsOrder?: boolean;
  /** A checkout step's order bump; null when its offer can't be sold right now. */
  bump?: StorefrontOrderBump | null;
}

export interface FunnelRuntimeStartResult extends FunnelRuntimeState {
  funnel: { id: string; name: string; subdomain: string | null };
}

export interface FunnelRuntimeFollowOnOrder {
  id: string;
  orderNumber: string;
  totalAmount: string | number;
  linkedFromOrderId: string;
}

/** The checkout order after an accepted offer joined it: its new totals and lines. */
export interface FunnelRuntimeMergedOrder {
  id: string;
  orderNumber: string;
  currency: string;
  subtotalAmount: string | number;
  discountAmount: string | number;
  shippingAmount: string | number;
  taxAmount: string | number;
  totalAmount: string | number;
  items: Array<{
    id: string;
    productId: string | null;
    productNameSnapshot: string;
    variantOptionsSnapshot: Record<string, string> | null;
    offerNameSnapshot: string | null;
    quantity: number;
    unitPriceAmount: string | number;
    lineTotalAmount: string | number;
    isOrderBump: boolean;
    isUpsell: boolean;
  }>;
  /** The line the accepted offer added. */
  addedItemId: string | null;
}

export interface FunnelRuntimeAdvanceResult extends FunnelRuntimeState {
  /** Set when an accepted upsell/downsell created a linked order. */
  followOnOrder?: FunnelRuntimeFollowOnOrder;
  /** Set when it joined the checkout order instead (the store's funnel_upsell_merge). */
  mergedOrder?: FunnelRuntimeMergedOrder;
}

export type FunnelRuntimeOutcomeType =
  | "completed_checkout"
  | "accepted_offer"
  | "declined_offer"
  | "clicked_through";

export interface FunnelRuntimeAdvancePayload {
  /**
   * The step this outcome was produced on. Always send it: a stale tab or a
   * double submit then fails with 409 STEP_MISMATCH instead of routing the
   * visitor from the wrong place.
   */
  fromStepKey?: string;
  outcome: {
    type: FunnelRuntimeOutcomeType;
    /** completed_checkout: the order just placed on this step. */
    orderId?: string;
    /** clicked_through: the page button that was pressed, for links drawn from one button. */
    sourceElementId?: string;
    /** accepted_offer: the variant the shopper chose for a one-line offer. */
    variantId?: string;
  };
}

// ------------------------------------------------------------- endpoints --

const base = (workspaceId: string) => `/store/${encodeURIComponent(workspaceId)}/funnels`;

/**
 * Enter (or resume) a funnel by id or subdomain. An active session for the
 * same `visitorId` is resumed; a completed one starts over.
 */
export async function funnelRuntimeStart(
  client: ApiClient,
  workspaceId: string,
  funnelRef: string,
  payload: { visitorId: string; attribution?: Record<string, unknown> }
): Promise<FunnelRuntimeStartResult> {
  return client.request<FunnelRuntimeStartResult>(
    `${base(workspaceId)}/${encodeURIComponent(funnelRef)}/sessions`,
    { method: "POST", body: payload, auth: false }
  );
}

/** The session's current step — also the resync after a STEP_MISMATCH. */
export async function funnelRuntimeGetStep(
  client: ApiClient,
  workspaceId: string,
  funnelId: string,
  sessionId: string
): Promise<FunnelRuntimeState> {
  return client.request<FunnelRuntimeState>(
    `${base(workspaceId)}/${funnelId}/sessions/${sessionId}/step`,
    { auth: false }
  );
}

/** Report the outcome of the current step and move to the next one. */
export async function funnelRuntimeAdvance(
  client: ApiClient,
  workspaceId: string,
  funnelId: string,
  sessionId: string,
  payload: FunnelRuntimeAdvancePayload
): Promise<FunnelRuntimeAdvanceResult> {
  return client.request<FunnelRuntimeAdvanceResult>(
    `${base(workspaceId)}/${funnelId}/sessions/${sessionId}/advance`,
    { method: "POST", body: payload, auth: false }
  );
}
