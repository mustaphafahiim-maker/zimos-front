"use client";

import { useEffect, useMemo, useState } from "react";
import { REFERRAL_CODE_PATTERN, shopperReferral, storeReferralCheck } from "@store-builder/api-client";
import { CrossIcon, GiftIcon } from "@/components/Icons";
import { container, focusRing } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { readToken } from "@/lib/shopperSession";
import { useStore } from "@/lib/StoreContext";
import { readInvite, setInviteBannerHidden, useInviteBannerHidden, useStoredInvite, writeInvite } from "./invite";
import { useRewardsCopy } from "./rewardsCopy";

/** The `?ref=` code on this page's address, when it has the shape of one. */
function linkCode(): string | null {
  if (typeof window === "undefined") return null;
  const code = new URLSearchParams(window.location.search).get("ref")?.trim().toUpperCase();
  return code && REFERRAL_CODE_PATTERN.test(code) ? code : null;
}

/**
 * A friend's invite link: a visitor who lands on any page of the store with
 * `?ref=CODE` has the code checked by the API and, when it is a running
 * invite, kept for the checkout (./invite.ts), and sees «معاك دعوة! خصم 10%
 * على أول طلب» above the store until they close it or order. A code that is
 * not an invite, and the shopper's own link, do nothing.
 */
export function InviteBanner() {
  const { store } = useStore();
  const copy = useRewardsCopy();
  const storeId = store?.id ?? "";
  const client = useMemo(() => createStorefrontApiClient(), []);
  const invite = useStoredInvite(storeId);
  const hidden = useInviteBannerHidden(storeId);
  // The link's code is checked once per page.
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (!storeId) return;
    const code = linkCode();
    if (!code || checked) return;
    let cancelled = false;
    void (async () => {
      try {
        const check = await storeReferralCheck(client, storeId, code);
        if (cancelled) return;
        if (!check.valid) {
          // A link that stopped working must not leave its older invite behind.
          if (readInvite(storeId)?.code === code) writeInvite(storeId, null);
          return;
        }
        // A signed-in shopper opening their own link: there is nothing to offer them.
        const token = readToken(storeId);
        if (token) {
          const mine = await shopperReferral(client, storeId, token).catch(() => null);
          if (cancelled) return;
          if (mine?.enabled && mine.code === check.code) return;
        }
        writeInvite(storeId, { code: check.code, friend: check.friend });
        setInviteBannerHidden(storeId, false);
      } catch {
        /* the store works the same without the banner */
      } finally {
        if (!cancelled) setChecked(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // `checked` only stops a second look at the same address.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeId, client]);

  const friend = !hidden && invite ? invite.friend : null;
  const text = !friend
    ? null
    : friend.percentOff > 0 && friend.freeShipping
      ? copy.bannerBoth(friend.percentOff)
      : friend.percentOff > 0
        ? copy.bannerPercent(friend.percentOff)
        : friend.freeShipping
          ? copy.bannerShipping
          : null;

  return (
    <>
      <div data-invite-slot="">
        {text && (
          <div role="status" aria-label={copy.bannerLabel} className="border-b border-primary/25 bg-primary-soft text-primary">
            <div className={`${container} flex min-h-11 items-center justify-center gap-2 py-1`}>
              <GiftIcon size={18} className="shrink-0" />
              <p className="min-w-0 text-center text-sm font-semibold">{text}</p>
              <button
                type="button"
                onClick={() => setInviteBannerHidden(storeId, true)}
                aria-label={copy.bannerClose}
                className={`-me-2 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg text-primary/80 hover:text-primary ${focusRing}`}
              >
                <CrossIcon size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
