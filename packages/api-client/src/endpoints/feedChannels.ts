/**
 * Product feeds per channel (backend handoff item 264; src/modules/offers/productFeed.js).
 *
 * Same endpoints as the feed itself (feeds.ts): GET / PUT /workspaces/:ws/offers/feed.
 * The PUT body — whole, as before — gains `channels`, and the answer of both
 * gains each channel's state:
 *
 *   feed.channels.<meta|google|tiktok|snapchat> = FeedChannelSettings
 *     enabled            the channel's own switch (default true); the store-wide
 *                        `enabled` still has to be on
 *     collectionIds      its own collections, or null to follow the store-wide choice
 *                        (an empty list = its own choice of the whole catalog)
 *     excludeOutOfStock  its own rule, or null to follow the store-wide one
 *     requireChecklist   Google only: no Google feed until the Merchant checklist passes
 *   channels.<channel> = FeedChannelStatus { live, heldBackByChecklist, itemCount, productCount }
 *
 * A channel left out of the PUT's `channels` goes back to the defaults, so a
 * save always sends all four. A channel that is not live answers 404 at its link.
 */
import type { FeedChannel } from "./feeds";

export interface FeedChannelSettings {
  enabled: boolean;
  collectionIds: string[] | null;
  excludeOutOfStock: boolean | null;
  requireChecklist: boolean;
}

export type FeedChannelsSettings = Record<FeedChannel, FeedChannelSettings>;

export interface FeedChannelStatus {
  /** The channel's link answers with the feed right now. */
  live: boolean;
  /** Google, with `requireChecklist` on and the checklist not complete yet. */
  heldBackByChecklist: boolean;
  /** Variants this channel's feed lists. */
  itemCount: number;
  productCount: number;
}

export const FEED_CHANNEL_DEFAULTS: FeedChannelSettings = {
  enabled: true,
  collectionIds: null,
  excludeOutOfStock: null,
  requireChecklist: false,
};

/** One channel's settings out of a feed's (an older API sends none: the defaults). */
export function feedChannelSettingsOf(
  channels: Partial<Record<FeedChannel, Partial<FeedChannelSettings>>> | null | undefined,
  channel: FeedChannel
): FeedChannelSettings {
  const own = channels?.[channel] ?? {};
  return {
    enabled: own.enabled !== false,
    collectionIds: Array.isArray(own.collectionIds) ? own.collectionIds : null,
    excludeOutOfStock: typeof own.excludeOutOfStock === "boolean" ? own.excludeOutOfStock : null,
    requireChecklist: channel === "google" && own.requireChecklist === true,
  };
}

/** True while the channel takes both its collections and its stock rule from the store-wide settings. */
export function feedChannelFollowsStore(settings: FeedChannelSettings): boolean {
  return settings.collectionIds === null && settings.excludeOutOfStock === null;
}
