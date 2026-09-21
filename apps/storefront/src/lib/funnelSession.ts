import { useMemo, useSyncExternalStore } from "react";
import type { FunnelFollowOnOrderDto } from "@store-builder/api-client";

/**
 * What a funnel keeps on this device, next to the session the backend holds.
 *
 *  - The visitor id. The backend resumes a visitor's newest *active* session
 *    when the funnel is entered again, so the id must be stable per browser
 *    (and per store).
 *  - The order placed on a checkout step. Once it exists it must never be
 *    placed again: if the advance after it fails (network, reload), the step
 *    only retries the advance with the same order id.
 *  - Accepted upsell/downsell orders. The backend returns them once, on the
 *    advance that created them, and has no public endpoint to list them, so
 *    the thank-you step reads them from here.
 *
 * Storage failures are swallowed: the funnel still works, it just forgets.
 */

const visitorKey = (workspaceId: string) => `zimos_funnel_visitor_${workspaceId}`;
const placedKey = (sessionId: string) => `zimos_funnel_placed_${sessionId}`;
const followOnKey = (sessionId: string) => `zimos_funnel_orders_${sessionId}`;

// Same-tab writes don't fire `storage`, so subscribers are told directly.
const CHANGE = "zimos-funnel-storage";

function freshId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function read(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
    window.dispatchEvent(new Event(CHANGE));
  } catch {
    /* storage disabled */
  }
}

/** Stable per browser and store. The API caps it at 64 characters. */
export function funnelVisitorId(workspaceId: string): string {
  const saved = read(visitorKey(workspaceId));
  if (saved && saved.length <= 64) return saved;
  const id = freshId();
  write(visitorKey(workspaceId), id);
  return id;
}

export interface PlacedOrder {
  id: string;
  orderNumber: string;
}

export function rememberPlacedOrder(sessionId: string, order: PlacedOrder) {
  write(placedKey(sessionId), JSON.stringify(order));
}

export function rememberFollowOn(sessionId: string, order: FunnelFollowOnOrderDto) {
  const list = parseList(read(followOnKey(sessionId))).filter((o) => o.id !== order.id);
  write(followOnKey(sessionId), JSON.stringify([...list, order]));
}

function parsePlaced(raw: string | null): PlacedOrder | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as PlacedOrder;
    return v && typeof v.id === "string" ? v : null;
  } catch {
    return null;
  }
}

function parseList(raw: string | null): FunnelFollowOnOrderDto[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw) as FunnelFollowOnOrderDto[];
    return Array.isArray(v) ? v.filter((o) => o && typeof o.id === "string") : [];
  } catch {
    return [];
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE, onChange);
  };
}

/** A stored string, read after hydration (null on the server and first paint). */
function useStored(key: string): string | null {
  return useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null
  );
}

export function usePlacedOrder(sessionId: string): PlacedOrder | null {
  const raw = useStored(placedKey(sessionId));
  return useMemo(() => parsePlaced(raw), [raw]);
}

export function useFollowOnOrders(sessionId: string): FunnelFollowOnOrderDto[] {
  const raw = useStored(followOnKey(sessionId));
  return useMemo(() => parseList(raw), [raw]);
}

/** False on the server and during hydration, true after — for device-only data. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}
