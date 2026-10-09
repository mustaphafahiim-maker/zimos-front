"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { REFERRAL_CODE_PATTERN, shopperReferral, storeReferralCheck } from "@store-builder/api-client";
import { CrossIcon, GiftIcon } from "@/components/Icons";
import { container, focusRing } from "@/components/ui";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { readToken } from "@/lib/shopperSession";
import { useStore } from "@/lib/StoreContext";
import {
  isInviteBannerHidden,
  readInvite,
  setInviteBannerHidden,
  useInviteBannerHidden,
  useStoredInvite,
  writeInvite,
  type StoredInvite,
} from "./invite";
import { useRewardsCopy } from "./rewardsCopy";

/** On <html> while a banner is, or is about to be, above the store (globals.css holds its place). */
const HOLD = "data-sf-invite";
/** A store id is a UUID; only that shape is ever written into the script below. */
const SAFE_ID = /^[A-Za-z0-9_-]{1,80}$/;

/** The `?ref=` code on this page's address, when it has the shape of one. */
function linkCode(): string | null {
  if (typeof window === "undefined") return null;
  const code = new URLSearchParams(window.location.search).get("ref")?.trim().toUpperCase();
  return code && REFERRAL_CODE_PATTERN.test(code) ? code : null;
}

/** An invite that gives the friend something to read about. */
function offersSomething(invite: StoredInvite | null): boolean {
  return Boolean(invite && (invite.friend.percentOff > 0 || invite.friend.freeShipping));
}

/**
 * Runs while the page is being parsed, before anything is painted. Whether
 * this visitor has an invite is in their browser (./invite.ts) or on the
 * address (`?ref=`), so the server's HTML cannot carry the banner; this marks
 * <html> when one is on its way, and the stylesheet keeps the banner's height
 * free above the header from the first paint. The keys and the 30 days are
 * ./invite.ts's.
 */
function holdScript(storeId: string): string {
  const id = JSON.stringify(storeId);
  return [
    "(function(){try{",
    `var s=${id},on=/[?&]ref=[A-Za-z0-9]{4,16}(&|$)/.test(location.search);`,
    'if(!on&&sessionStorage.getItem("zimos_invite_banner_hidden_"+s)!=="1"){',
    'var v=JSON.parse(localStorage.getItem("zimos_invite_"+s)||"null");',
    'on=!!(v&&typeof v.at==="number"&&Date.now()-v.at<2592000000&&v.friend&&(v.friend.percentOff>0||v.friend.freeShipping))}',
    `if(on)document.documentElement.setAttribute("${HOLD}","")`,
    "}catch(_){}})();",
  ].join("");
}

const never = () => () => {};

/**
 * A friend's invite link (handoff 222): a visitor who lands on any page of
 * the store with `?ref=CODE` has the code checked by the API and, when it is
 * a running invite, kept for the checkout (./invite.ts) — and sees «معاك
 * دعوة! خصم 10% على أول طلب» above the store until they close it or order.
 * A code that is not an invite, and the shopper's own link, do nothing.
 *
 * The banner is drawn into a place that is always in the page: empty and
 * without height for everyone else, held at the banner's height from the
 * first paint for a visitor who has, or is arriving with, an invite — so the
 * store does not jump down under them when the banner appears.
 */
export function InviteBanner() {
  const { store } = useStore();
  const copy = useRewardsCopy();
  const storeId = store?.id ?? "";
  const client = useMemo(() => createStorefrontApiClient(), []);
  const invite = useStoredInvite(storeId);
  const hidden = useInviteBannerHidden(storeId);
  // A link's code is with the API: the banner's place stays held until the answer is in.
  const [checking, setChecking] = useState(() => linkCode() !== null);
  // True in the server's HTML and while it is taken over, false from then on: the
  // script matters only to the first paint, and React does not run one it adds later.
  const firstPaint = useSyncExternalStore(never, () => false, () => true);

  useEffect(() => {
    if (!storeId) return;
    const code = linkCode();
    if (!code) return;
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
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [storeId, client]);

  // Keeps the mark on <html> true to what is known now. Read from storage here rather than
  // from this render: the first render after the server's HTML has not seen the browser's yet.
  useEffect(() => {
    const coming = storeId !== "" && (checking || (offersSomething(readInvite(storeId)) && !isInviteBannerHidden(storeId)));
    document.documentElement.toggleAttribute(HOLD, coming);
  }, [storeId, checking, invite, hidden]);
  useEffect(() => () => document.documentElement.removeAttribute(HOLD), []);

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
      {firstPaint && SAFE_ID.test(storeId) && <script dangerouslySetInnerHTML={{ __html: holdScript(storeId) }} />}
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
