import { useEffect, useRef, useState } from "react";
import type { Order, ReturnRequest } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";

export type OrderEntry = { status: "loading" } | { status: "ready"; order: Order } | { status: "error" };

// Orders already read this session, by store and id: a return the merchant comes
// back to shows its order number and customer at once, and is read again behind.
const remembered = new Map<string, Order>();
const REMEMBER_MAX = 300;

function remember(key: string, order: Order) {
  remembered.delete(key);
  remembered.set(key, order);
  if (remembered.size > REMEMBER_MAX) remembered.delete(remembered.keys().next().value as string);
}

/**
 * GET /returns carries an `orderId` and nothing else — no order number, no
 * customer, no product names behind the returned lines. So each distinct order
 * is fetched separately, all of them in flight at once, and kept for the life
 * of the page so a change of filter never fetches one twice.
 *
 * Each order lands on its own: a row fills in the moment its order arrives,
 * not when the slowest one does. One that 404s (or that this role may not
 * read) leaves its row in the fallback state. It must never blank the queue —
 * the return itself came back fine, and it is still actionable without the order.
 */
export function useOrdersById(orderIds: readonly string[]): Record<string, OrderEntry> {
  const workspaceId = useWorkspaceId();
  const [entries, setEntries] = useState<Record<string, OrderEntry>>({});
  // Ids already requested, so a re-render never re-fetches. Tied to the
  // workspace it was filled for: switching workspace invalidates the lot.
  const asked = useRef<{ workspaceId: string; ids: Set<string> }>({ workspaceId, ids: new Set() });
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const key = orderIds.join(",");

  useEffect(() => {
    if (asked.current.workspaceId !== workspaceId) {
      asked.current = { workspaceId, ids: new Set() };
      setEntries({});
    }
    const round = asked.current;
    const missing = orderIds.filter((id) => !round.ids.has(id));
    if (missing.length === 0) return;
    for (const id of missing) round.ids.add(id);

    setEntries((prev) => {
      const next = { ...prev };
      for (const id of missing) {
        const known = remembered.get(`${workspaceId}:${id}`);
        next[id] = known ? { status: "ready", order: known } : { status: "loading" };
      }
      return next;
    });

    // An answer for a store that is no longer the one on screen is dropped.
    const current = () => alive.current && asked.current === round;
    for (const id of missing) {
      apiClient.getOrder(workspaceId, id).then(
        (order) => {
          remember(`${workspaceId}:${id}`, order);
          if (current()) setEntries((prev) => ({ ...prev, [id]: { status: "ready", order } }));
        },
        () => {
          // A remembered order stays on the row when its refresh fails.
          if (current()) setEntries((prev) => (prev[id]?.status === "ready" ? prev : { ...prev, [id]: { status: "error" } }));
        }
      );
    }
    // `key` stands in for orderIds — a new array of the same ids is not a change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId, key]);

  return entries;
}

/**
 * Every return of the store, in one list. The page filters it by status in the
 * browser, which is what lets the chips say how many each status holds. Kept
 * between visits (lib/useCachedAsync.ts): coming back shows the queue at once
 * and reads it again behind.
 */
export function useReturnsList() {
  const workspaceId = useWorkspaceId();
  const list = useCachedAsync<ReturnRequest[]>(`returns:${workspaceId}`, () => apiClient.listReturns(workspaceId), [workspaceId]);

  /** The server's answer to an action, merged into its row (the list keeps what the answer leaves out: photos, source). */
  function applyUpdate(updated: ReturnRequest) {
    list.setData((prev) => (prev ?? []).map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
  }

  return { ...list, returns: list.data ?? [], applyUpdate };
}
