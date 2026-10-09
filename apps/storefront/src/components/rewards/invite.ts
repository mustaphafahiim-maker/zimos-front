"use client";

import { useSyncExternalStore } from "react";
import { REFERRAL_CODE_PATTERN, type ReferralFriendOffer } from "@store-builder/api-client";

/**
 * A friend's invite, kept in this browser between the landing (`?ref=CODE`)
 * and the checkout that sends it (handoff 222). One per store, with the offer
 * the API quoted for it; forgotten once an order is placed with it, when the
 * shopper removes it, and after 30 days. Storage may be blocked (a private
 * window): the invite then lasts for the page it was opened on.
 */

export interface StoredInvite {
  code: string;
  friend: ReferralFriendOffer;
  /** When it was kept, ms. */
  at: number;
}

const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const key = (storeId: string) => `zimos_invite_${storeId}`;
const hiddenKey = (storeId: string) => `zimos_invite_banner_hidden_${storeId}`;

const listeners = new Set<() => void>();
/** What storage could not keep, by store: the invite still holds for this page. */
const memory = new Map<string, StoredInvite | null>();
/** The parsed value by its raw text, so a snapshot keeps its identity between reads. */
let parsed: { raw: string; value: StoredInvite | null } | null = null;

function parse(raw: string | null): StoredInvite | null {
  if (!raw) return null;
  if (parsed && parsed.raw === raw) return parsed.value;
  let value: StoredInvite | null = null;
  try {
    const data = JSON.parse(raw) as Partial<StoredInvite> | null;
    const friend = data?.friend;
    if (
      data &&
      typeof data.code === "string" &&
      REFERRAL_CODE_PATTERN.test(data.code) &&
      typeof data.at === "number" &&
      Date.now() - data.at < MAX_AGE_MS &&
      friend &&
      typeof friend.percentOff === "number"
    ) {
      value = { code: data.code, friend: { percentOff: friend.percentOff, freeShipping: Boolean(friend.freeShipping) }, at: data.at };
    }
  } catch {
    /* not ours */
  }
  parsed = { raw, value };
  return value;
}

export function readInvite(storeId: string): StoredInvite | null {
  if (!storeId || typeof window === "undefined") return null;
  if (memory.has(storeId)) return memory.get(storeId) ?? null;
  try {
    return parse(window.localStorage.getItem(key(storeId)));
  } catch {
    return null;
  }
}

export function writeInvite(storeId: string, invite: { code: string; friend: ReferralFriendOffer } | null) {
  if (!storeId || typeof window === "undefined") return;
  const value: StoredInvite | null = invite ? { code: invite.code, friend: invite.friend, at: Date.now() } : null;
  try {
    if (value) window.localStorage.setItem(key(storeId), JSON.stringify(value));
    else window.localStorage.removeItem(key(storeId));
    memory.delete(storeId);
  } catch {
    // Storage is blocked: the invite is kept for as long as this page lives.
    memory.set(storeId, value);
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (!e.key || e.key.startsWith("zimos_invite_")) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** The invite this browser holds for the store; null on the server, and when there is none. */
export function useStoredInvite(storeId: string | undefined): StoredInvite | null {
  return useSyncExternalStore(
    subscribe,
    () => readInvite(storeId ?? ""),
    () => null
  );
}

/** Whether the shopper closed the landing banner in this tab. */
export function isInviteBannerHidden(storeId: string): boolean {
  try {
    return window.sessionStorage.getItem(hiddenKey(storeId)) === "1";
  } catch {
    return false;
  }
}

export function setInviteBannerHidden(storeId: string, hidden: boolean) {
  try {
    if (hidden) window.sessionStorage.setItem(hiddenKey(storeId), "1");
    else window.sessionStorage.removeItem(hiddenKey(storeId));
  } catch {
    /* it shows again on the next page */
  }
  listeners.forEach((listener) => listener());
}

/** True once the banner was closed in this tab; false on the server. */
export function useInviteBannerHidden(storeId: string | undefined): boolean {
  return useSyncExternalStore(
    subscribe,
    () => (storeId ? isInviteBannerHidden(storeId) : false),
    () => false
  );
}
