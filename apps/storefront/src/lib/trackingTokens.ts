/**
 * The order's signed tracking token, as the checkout's 201 hands it out
 * (`trackingToken`, frontend-handoff 236): the same token as the `/track?t=`
 * link. It is the guest shopper's proof that an order placed on this device
 * is theirs — the thank-you page's survey answers with it — so it is kept
 * here the way the payment token is (lib/payments): in this browser only,
 * per store, for the last 20 orders.
 */

const key = (workspaceId: string) => `zimos_tracking_tokens_${workspaceId}`;

function read(workspaceId: string): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(key(workspaceId));
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/** Keeps the token of an order just placed; nothing happens without one (an older API). */
export function saveTrackingToken(workspaceId: string, orderId: string, token: string | null | undefined) {
  if (!token || typeof window === "undefined") return;
  try {
    const entries = Object.entries(read(workspaceId)).filter(([id]) => id !== orderId);
    window.localStorage.setItem(key(workspaceId), JSON.stringify(Object.fromEntries([[orderId, token], ...entries].slice(0, 20))));
  } catch {
    /* storage blocked: the thank-you page simply has no proof to show */
  }
}

export function getTrackingToken(workspaceId: string, orderId: string): string | null {
  const token = read(workspaceId)[orderId];
  return typeof token === "string" && token ? token : null;
}
