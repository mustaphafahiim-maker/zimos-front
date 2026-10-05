"use client";

import { useEffect } from "react";
import { sendEvent } from "./analyticsEvents";

/**
 * An offer was in front of the shopper (SPEC §10.11: each offer's
 * impressions): a custom `offer_view` event with metadata { kind, id } — an
 * order bump rule, a thank-you upsell rule, a bundle, a cross-sell rule, the
 * exit popup. Once per offer per page; the offers hub counts them
 * (offers/offerStats.js).
 */
export type OfferKind = "bump" | "upsell" | "bundle" | "cross_sell" | "exit_downsell";

const sent = new Set<string>();

export function trackOfferView(workspaceId: string, kind: OfferKind, id: string | null | undefined): void {
  if (typeof window === "undefined" || !workspaceId || !id) return;
  const key = `${window.location.pathname}|${kind}|${id}`;
  if (sent.has(key)) return;
  sent.add(key);
  sendEvent(workspaceId, { name: "offer_view", metadata: { kind, id } });
}

/** Sends the view once the offer is on screen (`id` known). */
export function useOfferView(workspaceId: string, kind: OfferKind, id: string | null | undefined): void {
  useEffect(() => {
    trackOfferView(workspaceId, kind, id);
  }, [workspaceId, kind, id]);
}
