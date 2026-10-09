import type { OrderPackingSlipSize } from "@store-builder/api-client";

/**
 * What the picking and packing screens keep in the browser. Every read and
 * write is wrapped: with storage blocked the screens still work, they only
 * forget on a reload.
 *
 * - the orders ticked for a pick list (session): the pick-list page is its own
 *   route, and up to 500 ids do not fit a link;
 * - the lines ticked off on a pick list (session);
 * - an order's scans so far and its hand-ticked lines (session): the server
 *   keeps nothing between pack calls, so a reload sends the list again;
 * - the last packing-slip note and paper size (local): the same line goes on
 *   every batch.
 */

function read<T>(storage: () => Storage, key: string): T | null {
  try {
    const raw = storage().getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(storage: () => Storage, key: string, value: unknown) {
  try {
    if (value === null) storage().removeItem(key);
    else storage().setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked or full: nothing to keep */
  }
}

const session = () => window.sessionStorage;
const local = () => window.localStorage;

// ------------------------------------------------------------ pick list --

const SELECTION_KEY = "zimos.pickList.selection";
const ticksKey = (mode: PickListMode) => `zimos.pickList.ticks.${mode}`;

export type PickListMode = "ready" | "selection";

/** The orders ticked in the list, for the pick-list page. A new selection starts with nothing ticked off. */
export function savePickListSelection(workspaceId: string, orderIds: string[]) {
  write(session, SELECTION_KEY, { workspaceId, orderIds });
  write(session, ticksKey("selection"), null);
}

export function readPickListSelection(workspaceId: string): string[] {
  const stored = read<{ workspaceId?: string; orderIds?: unknown }>(session, SELECTION_KEY);
  if (!stored || stored.workspaceId !== workspaceId || !Array.isArray(stored.orderIds)) return [];
  return stored.orderIds.filter((id): id is string => typeof id === "string");
}

export function readPickListTicks(mode: PickListMode): string[] {
  const stored = read<unknown>(session, ticksKey(mode));
  return Array.isArray(stored) ? stored.filter((k): k is string => typeof k === "string") : [];
}

export function savePickListTicks(mode: PickListMode, ticks: string[]) {
  write(session, ticksKey(mode), ticks.length ? ticks : null);
}

// --------------------------------------------------------- scan to pack --

const packKey = (orderId: string) => `zimos.pack.${orderId}`;

export interface PackDraft {
  scans: string[];
  /** Indexes of the no-barcode lines ticked by hand. */
  manual: number[];
}

export function readPackDraft(orderId: string): PackDraft {
  const stored = read<{ scans?: unknown; manual?: unknown }>(session, packKey(orderId));
  return {
    scans: Array.isArray(stored?.scans) ? stored.scans.filter((s): s is string => typeof s === "string") : [],
    manual: Array.isArray(stored?.manual) ? stored.manual.filter((n): n is number => Number.isInteger(n)) : [],
  };
}

export function savePackDraft(orderId: string, draft: PackDraft | null) {
  write(session, packKey(orderId), draft && (draft.scans.length || draft.manual.length) ? draft : null);
}

// -------------------------------------------------------- packing slips --

const SLIP_NOTE_KEY = "zimos.packingSlips.note";
const SLIP_SIZE_KEY = "zimos.packingSlips.size";

export function readPackingSlipPrefs(): { note: string; size: OrderPackingSlipSize } {
  const note = read<unknown>(local, SLIP_NOTE_KEY);
  const size = read<unknown>(local, SLIP_SIZE_KEY);
  return { note: typeof note === "string" ? note : "", size: size === "A4" ? "A4" : "A5" };
}

export function savePackingSlipPrefs(prefs: { note: string; size: OrderPackingSlipSize }) {
  write(local, SLIP_NOTE_KEY, prefs.note || null);
  write(local, SLIP_SIZE_KEY, prefs.size);
}
