"use client";

import { useEffect, useMemo, useState } from "react";
import { flushSync } from "react-dom";
import {
  referralRefusalOf,
  shopperVip,
  storeReferralCheck,
  vipTierName,
  type ReferralCheckoutFields,
  type ReferralFriendOffer,
  type ReferralRefusal,
  type ShopperVip,
} from "@store-builder/api-client";
import { CheckIcon, GiftIcon } from "@/components/Icons";
import { btnSecondary, focusRing } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { CUSTOMER_REFERRALS_ENABLED, VIP_TIERS_ENABLED } from "@/lib/features";
import { useShopperApi, useShopperConfig } from "@/lib/shopperSession";
import { useStore } from "@/lib/StoreContext";
import { useStoredInvite, writeInvite } from "./invite";
import { useRewardsCopy, type RewardsCopy } from "./rewardsCopy";

/**
 * What an order gets beside its prices, said before it is placed: the
 * signed-in shopper's VIP level (a percent off the products and/or free
 * shipping) and a friend's invite kept from a `?ref=` link (sent as
 * `referralCode`). Each is read only while its feature is switched on
 * (lib/features).
 *
 * The API takes both off when the order is placed: the cart and the shipping
 * quote know neither, so the page's estimated total does not move and these
 * lines say what will come off instead. The storefront never works the
 * discounted prices out itself.
 *
 * A refused invite (not a first order, the shopper's own, a dead code) is
 * said in its own words, and the shopper can place the same order without it
 * in one tap.
 */
export function useCheckoutPerks({ enabled = true }: { /** False on a page that shows no order form: nothing is read. */ enabled?: boolean } = {}) {
  const { store, locale } = useStore();
  const copy = useRewardsCopy();
  const storeId = store?.id ?? "";
  const config = useShopperConfig();
  const api = useShopperApi();
  const accounts = config.status === "ready" && config.config.enabled;
  const token = accounts ? api.token : null;
  const publicClient = useMemo(() => createStorefrontApiClient(), []);

  // --- VIP: the signed-in shopper's level, once per token.
  const [vip, setVip] = useState<{ token: string; data: ShopperVip } | null>(null);
  useEffect(() => {
    if (!token || !enabled || !VIP_TIERS_ENABLED) return;
    let cancelled = false;
    api
      .call((client, id, tk) => shopperVip(client, id, tk))
      .then((data) => {
        if (!cancelled) setVip({ token, data });
      })
      .catch(() => {
        /* an extra: the order is placed and priced the same without this line */
      });
    return () => {
      cancelled = true;
    };
  }, [token, api, enabled]);
  const tier = enabled && vip && token && vip.token === token && vip.data.enabled ? vip.data.tier : null;

  // --- the invite: what this browser kept, checked again with the API so the line says today's offer.
  const kept = useStoredInvite(storeId);
  const stored = enabled && CUSTOMER_REFERRALS_ENABLED ? kept : null;
  const code = stored?.code ?? null;
  const [checked, setChecked] = useState<{ code: string; friend: ReferralFriendOffer } | null>(null);
  const [refusal, setRefusal] = useState<{ code: string; reason: ReferralRefusal } | null>(null);
  useEffect(() => {
    if (!storeId || !code) return;
    let cancelled = false;
    storeReferralCheck(publicClient, storeId, code)
      .then((check) => {
        if (cancelled) return;
        // The store stopped its programme, or the code is gone: nothing to send, nothing to say.
        if (!check.valid) writeInvite(storeId, null);
        else setChecked({ code, friend: check.friend });
      })
      .catch(() => {
        /* the offer kept at the landing still stands; the order's own answer decides */
      });
    return () => {
      cancelled = true;
    };
  }, [storeId, code, publicClient]);

  const friend = stored ? (checked && checked.code === stored.code ? checked.friend : stored.friend) : null;
  const refused = refusal && stored && refusal.code === stored.code ? refusal.reason : null;
  const payload: ReferralCheckoutFields = stored ? { referralCode: stored.code } : {};

  /** The shopper takes the invite off this order (and out of this browser). */
  function dropInvite() {
    writeInvite(storeId, null);
    setRefusal(null);
  }

  /**
   * A refused order: when the invite was the reason, it is said beside the
   * invite with the way on, and the same words come back for the form's own
   * error line. Null when the invite was not the reason.
   */
  function onError(err: unknown): string | null {
    const reason = referralRefusalOf(err);
    if (!reason || !stored) return null;
    setRefusal({ code: stored.code, reason });
    return `${refusalText(reason, copy)}. ${copy.refusedHint}`;
  }

  /** The order went through: the invite is used up. */
  function onPlaced() {
    if (stored) writeInvite(storeId, null);
  }

  return {
    /** The signed-in shopper's token (X-Shopper-Token): their VIP level prices the order. */
    shopperToken: token,
    tier,
    tierName: tier ? vipTierName(tier.name, locale) : "",
    invite: stored && friend ? { code: stored.code, friend } : null,
    refused,
    payload,
    dropInvite,
    onError,
    onPlaced,
  };
}

export type CheckoutPerksState = ReturnType<typeof useCheckoutPerks>;

function refusalText(reason: ReferralRefusal, copy: RewardsCopy): string {
  switch (reason) {
    case "own":
      return copy.refusedOwn;
    case "not_first":
      return copy.refusedNotFirst;
    case "off":
      return copy.refusedOff;
    default:
      return copy.refusedInvalid;
  }
}

/** «خصم 10٪ على أول طلب» — the friend's offer, as the checkout says it; "" for an empty one. */
function inviteOfferText(friend: ReferralFriendOffer, copy: RewardsCopy): string {
  if (friend.percentOff > 0 && friend.freeShipping) return copy.inviteOfferBoth(friend.percentOff);
  if (friend.percentOff > 0) return copy.inviteOfferPercent(friend.percentOff);
  return friend.freeShipping ? copy.inviteOfferShipping : "";
}

/**
 * Under the order summary: «خصم VIP 10٪», «شحن مجاني لعملاء VIP», and the
 * invite as applied — or, once the API refused it, why, with «كمّل الطلب من
 * غير الدعوة». Must sit inside the order's `<form>`: that button submits it.
 * `frame`: a part of the order summary (the checkout page), or a box of its
 * own (the product page's order form).
 */
export function CheckoutPerks({ state, frame = "summary" }: { state: CheckoutPerksState; frame?: "summary" | "box" }) {
  const copy = useRewardsCopy();
  const { tier, invite, refused } = state;
  const vipPercent = tier && tier.percentOff > 0 ? tier.percentOff : 0;
  const vipShipping = Boolean(tier?.freeShipping);
  const offer = invite ? inviteOfferText(invite.friend, copy) : "";
  if (!vipPercent && !vipShipping && !invite) return null;

  const invitePercent = invite && !refused ? invite.friend.percentOff : 0;
  const inviteShipping = Boolean(invite && !refused && invite.friend.freeShipping);
  const anyPercent = vipPercent > 0 || invitePercent > 0;
  const row = "flex items-start gap-2 text-sm font-medium text-success";

  return (
    <div className={frame === "box" ? "space-y-2 rounded-xl border border-line p-4" : "mt-3 space-y-2 border-t border-line pt-3"}>
      {vipPercent > 0 && (
        <p className={row}>
          <CheckIcon size={16} className="mt-0.5 shrink-0" />
          <span className="min-w-0">
            {copy.vipLine(vipPercent)}
            {state.tierName && (
              <span className="block text-xs font-normal text-ink-soft">
                <bdi>{copy.vipLevel(state.tierName)}</bdi>
              </span>
            )}
          </span>
        </p>
      )}
      {vipShipping && (
        <p className={row}>
          <CheckIcon size={16} className="mt-0.5 shrink-0" />
          <span className="min-w-0">{copy.vipShipping}</span>
        </p>
      )}

      {invite && !refused && offer && (
        <div className="flex items-start justify-between gap-2">
          <p className={row}>
            <GiftIcon size={16} className="mt-0.5 shrink-0" />
            <span className="min-w-0">{copy.inviteApplied(offer)}</span>
          </p>
          <button
            type="button"
            onClick={state.dropInvite}
            className={`-my-2 min-h-11 shrink-0 cursor-pointer rounded-lg px-2 text-xs font-medium text-ink-soft hover:text-danger ${focusRing}`}
          >
            {copy.removeInvite}
          </button>
        </div>
      )}

      <div aria-live="polite" className="empty:hidden">
        {invite && refused && (
          <div className="rounded-xl bg-danger-soft px-3 py-3">
            <p className="text-sm font-medium text-danger">{refusalText(refused, copy)}</p>
            <p className="mt-0.5 text-xs text-ink">{copy.refusedHint}</p>
            <button
              type="button"
              onClick={(e) => {
                const form = e.currentTarget.form;
                // The invite comes off first, so the order that goes out is the one without it.
                flushSync(() => state.dropInvite());
                form?.requestSubmit();
              }}
              className={`${btnSecondary} mt-2 w-full`}
            >
              {copy.placeWithout}
            </button>
          </div>
        )}
      </div>

      {/* Why the total above has not moved: the API takes these off when the order is placed. */}
      {anyPercent && <p className="text-xs text-ink-soft">{copy.atOrder}</p>}
      {(vipShipping || inviteShipping) && <p className="text-xs text-ink-soft">{copy.shippingComesOff}</p>}
      {vipPercent > 0 && invitePercent > 0 && <p className="text-xs text-ink-soft">{copy.biggestWins}</p>}
    </div>
  );
}
