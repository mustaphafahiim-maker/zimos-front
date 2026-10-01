import { ApiError, apiErrorDetails, type DraftPlan } from "@store-builder/api-client";

/**
 * Draft stores (the backend's REQUIRE_SUBSCRIPTION_TO_GO_LIVE): anything that
 * would put a draft live — publishing the website or a funnel, an order taken
 * by hand, a custom domain, a shipment — is refused with 403
 * SUBSCRIPTION_REQUIRED and `details.draft`. The publish buttons stay where
 * they are; pressing one opens the subscribe dialog (GoLiveDialog) instead
 * of showing an error.
 *
 * lib/apiClient routes every such refusal here and *holds* the caller's
 * request: if the merchant starts the trial (or the free plan) in the dialog,
 * the same request is sent again and its answer handed back to the caller as
 * if it had worked the first time — the store is published without a reload.
 * Closing the dialog without going live hands the caller the original error.
 *
 * The banner's "Subscribe" button opens the same dialog with nothing held.
 */

export function draftRefusal(err: unknown): DraftPlan | null {
  if (!(err instanceof ApiError) || err.status !== 403 || err.code !== "SUBSCRIPTION_REQUIRED") return null;
  const details = apiErrorDetails<{ draft?: boolean } & Partial<DraftPlan>>(err);
  if (!details || !details.draft) return null;
  return {
    planId: details.planId ?? null,
    planName: details.planName ?? null,
    trial: details.trial ?? { eligible: false, days: 0 },
  };
}

interface Waiter {
  retry: () => Promise<unknown>;
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
  error: unknown;
}

export interface GoLiveState {
  open: boolean;
  /** What the refusal said, when a refusal opened it. */
  refusal: DraftPlan | null;
  /** A request is waiting to be sent again once the store is live. */
  holding: boolean;
  /** Bumped whenever a store goes live, so screens reading access refresh. */
  liveVersion: number;
}

let state: GoLiveState = { open: false, refusal: null, holding: false, liveVersion: 0 };
let waiters: Waiter[] = [];
const listeners = new Set<() => void>();

function set(next: Partial<GoLiveState>) {
  state = { ...state, ...next };
  for (const listener of listeners) listener();
}

export function subscribeGoLive(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getGoLiveState(): GoLiveState {
  return state;
}

/** Opens the subscribe dialog (from the banner), holding nothing. */
export function openGoLive(refusal: DraftPlan | null = null) {
  set({ open: true, refusal: refusal ?? state.refusal });
}

/** Opens the dialog for a refused request, and waits for its outcome. */
export function holdForGoLive<T>(error: unknown, refusal: DraftPlan, retry: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    waiters.push({ retry, resolve: resolve as (value: unknown) => void, reject, error });
    set({ open: true, refusal, holding: true });
  });
}

/**
 * The dialog is done. `live`: the store is out of draft — the held requests
 * go out again; otherwise they fail with the refusal they got.
 */
export function closeGoLive(live: boolean) {
  const held = waiters;
  waiters = [];
  set({ open: false, holding: false, refusal: null, ...(live ? { liveVersion: state.liveVersion + 1 } : {}) });
  for (const waiter of held) {
    if (live) waiter.retry().then(waiter.resolve, waiter.reject);
    else waiter.reject(waiter.error);
  }
}
