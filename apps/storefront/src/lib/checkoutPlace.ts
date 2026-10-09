import { getTrackingContext } from "./analyticsEvents";
import { currentFunnelId } from "./funnelGate";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Where a checkout is happening, for the abandoned-checkout autosave
 * (frontend-handoff 302, 322): `funnelId` on a funnel's own pages
 * (`/f/<funnelId>/…`), `websiteId` on the store's pages when the store names
 * its website. Read at the moment of each save, so a shopper who moves from a
 * funnel to the store's checkout is counted where they are: a save without
 * them clears them on the server.
 *
 * The website id is the one the page's analytics already carry (the store
 * layout hands it to <StoreAnalytics> from GET /store/:ws `websiteId`).
 */
export function checkoutPlace(ownFunnelId?: string): { funnelId?: string; websiteId?: string } {
  const funnelId = ownFunnelId && UUID.test(ownFunnelId) ? ownFunnelId : currentFunnelId();
  if (funnelId) return { funnelId };
  const websiteId = getTrackingContext()?.websiteId;
  return typeof websiteId === "string" && UUID.test(websiteId) ? { websiteId } : {};
}
