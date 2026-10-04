"use client";

import { useSyncExternalStore } from "react";

/**
 * The shopper's "save my card" choice at checkout (SPEC §11.6): read by
 * placeOnlineOrder when the order is paid by card. Kept in memory for the
 * page, per store; unticked unless the shopper ticks it.
 */
const choices = new Map<string, boolean>();
const CHANGE = "zimos-save-card";

export function wantsSaveCard(workspaceId: string): boolean {
  return choices.get(workspaceId) === true;
}

export function setSaveCard(workspaceId: string, value: boolean) {
  choices.set(workspaceId, value);
  window.dispatchEvent(new Event(CHANGE));
}

function subscribe(callback: () => void) {
  window.addEventListener(CHANGE, callback);
  return () => window.removeEventListener(CHANGE, callback);
}

export function useSaveCard(workspaceId: string): [boolean, (value: boolean) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => wantsSaveCard(workspaceId),
    () => false
  );
  return [value, (next) => setSaveCard(workspaceId, next)];
}
