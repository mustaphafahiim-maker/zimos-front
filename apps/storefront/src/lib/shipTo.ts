"use client";

import { useCallback, useSyncExternalStore } from "react";
import { findGovernorate } from "./egypt";

/**
 * The governorate the shopper said they ship to, remembered per store on this
 * device — so the cart drawer, the cart page and the checkout form agree:
 * choose it in the cart and checkout opens with it already picked, and a
 * change on the checkout form shows in the cart next time.
 *
 * localStorage, read through useSyncExternalStore: "" during SSR and
 * hydration (the server has no storage), the stored code after. A private
 * tab or blocked storage falls back to memory for this page load. Only one
 * of the 27 governorate codes is ever returned.
 */

const keyFor = (workspaceId: string) => `zimos_ship_to_${workspaceId}`;
// Same-tab writes don't fire `storage`, so subscribers are told directly.
const CHANGE = "zimos-ship-to";
const memory = new Map<string, string>();

function read(workspaceId: string): string {
  let value = memory.get(workspaceId) ?? "";
  try {
    value = window.localStorage.getItem(keyFor(workspaceId)) ?? "";
  } catch {
    // Storage blocked: the in-memory value stands.
  }
  return findGovernorate(value) ? value : "";
}

function write(workspaceId: string, code: string) {
  const value = findGovernorate(code) ? code : "";
  memory.set(workspaceId, value);
  try {
    if (value) window.localStorage.setItem(keyFor(workspaceId), value);
    else window.localStorage.removeItem(keyFor(workspaceId));
  } catch {
    // Remembered in memory only.
  }
  window.dispatchEvent(new Event(CHANGE));
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(CHANGE, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(CHANGE, callback);
  };
}

/** [governorate code or "", set it] for this store. */
export function useShipTo(workspaceId: string): [string, (code: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(workspaceId),
    () => ""
  );
  const set = useCallback((code: string) => write(workspaceId, code), [workspaceId]);
  return [value, set];
}
