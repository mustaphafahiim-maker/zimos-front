/**
 * Store features the API reports only by answering 404 while they are off —
 * the delivery slots (handoff 221) and the pickup places (225). A page that
 * offers one has to ask to find out; this remembers "off" for a few minutes
 * in the tab, so the product page and the checkout do not ask (and log a 404)
 * on every visit of a store that does not use the feature.
 *
 * Only "off" is remembered. A store that switches the feature on is seen
 * within the few minutes, or at once after a refused order (the forms read
 * again then, past this memory).
 */
export type OffFeature = "delivery-slots" | "pickup";

const TTL_MS = 5 * 60 * 1000;
const key = (feature: OffFeature, workspaceId: string) => `zimos_off_${feature}_${workspaceId}`;

export function isKnownOff(feature: OffFeature, workspaceId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const at = Number(window.sessionStorage.getItem(key(feature, workspaceId)));
    return Number.isFinite(at) && at > 0 && Date.now() - at < TTL_MS;
  } catch {
    return false;
  }
}

export function rememberOff(feature: OffFeature, workspaceId: string, off: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (off) window.sessionStorage.setItem(key(feature, workspaceId), String(Date.now()));
    else window.sessionStorage.removeItem(key(feature, workspaceId));
  } catch {
    /* storage blocked: the page just asks again next time */
  }
}
