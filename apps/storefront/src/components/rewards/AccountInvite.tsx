"use client";

import { useEffect, useRef, useState } from "react";
import {
  shopperReferral,
  type CustomerReferralStatus,
  type ReferralFriendOffer,
  type ReferralReward,
  type ShopperReferral,
} from "@store-builder/api-client";
import { CheckIcon, CopyIcon, GiftIcon, WhatsAppIcon } from "@/components/Icons";
import { useStoreBasePath } from "@/components/StoreRoute";
import { btnPrimary, btnSecondary, card, skeleton } from "@/components/ui";
import { Notice, useAccount } from "@/components/account/AccountShell";
import { useShopperRead } from "@/components/account/AccountWalletTabs";
import { useTenderCopy } from "@/components/tenders/tenderCopy";
import { storeHref } from "@/lib/storeHref";
import { useStore } from "@/lib/StoreContext";
import { useRewardsCopy, type RewardsCopy } from "./rewardsCopy";

/**
 * The account's «ادعي صحابك» page: the shopper's own invite
 * link to copy or to share on WhatsApp themself, what the friend and they
 * get, how many invites are waiting and rewarded, and each invite (friends
 * are never named). The tab that leads here is in AccountRewardsTabs.tsx.
 */

function friendText(friend: ReferralFriendOffer, copy: RewardsCopy): string {
  if (friend.percentOff > 0 && friend.freeShipping) return copy.friendBoth(friend.percentOff);
  if (friend.percentOff > 0) return copy.friendPercent(friend.percentOff);
  return friend.freeShipping ? copy.friendShipping : "";
}

/** What the friend reads in the shared message. */
function shareOffer(friend: ReferralFriendOffer, copy: RewardsCopy): string {
  if (friend.percentOff > 0 && friend.freeShipping) return copy.shareOfferBoth(friend.percentOff);
  if (friend.percentOff > 0) return copy.shareOfferPercent(friend.percentOff);
  return copy.shareOfferShipping;
}

const STATUS_CLASS: Record<CustomerReferralStatus, string> = {
  pending: "bg-accent-soft text-accent-dark",
  rewarded: "bg-success-soft text-success",
  void: "bg-paper text-ink-soft",
};

export function AccountInvite() {
  const { money, intlLocale, store, t } = useStore();
  const copy = useRewardsCopy();
  const tender = useTenderCopy();
  const basePath = useStoreBasePath();
  const { api } = useAccount();
  const [state, reload] = useShopperRead<ShopperReferral>(api, shopperReferral);
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  if (state.status === "error") {
    return (
      <Notice
        tone="danger"
        title={t.account.loadFailed}
        action={
          <button type="button" onClick={reload} className={btnPrimary}>
            {t.account.retry}
          </button>
        }
      />
    );
  }
  if (state.status === "loading") {
    return (
      <div className="space-y-3" aria-hidden>
        <div className={`${skeleton} h-56 w-full`} />
        <div className={`${skeleton} h-16 w-full`} />
      </div>
    );
  }

  const { data } = state;
  if (!data.enabled) return <Notice title={copy.inviteOff} />;

  const { offer } = data;
  // The link on this store's own address, however the store is being served.
  const url = `${window.location.origin}${storeHref(basePath, data.path)}`;
  const rewardText = (reward: ReferralReward) => (reward.type === "points" ? tender.points(reward.amount) : money(reward.amount));
  const friend = friendText(offer.friend, copy);
  const sentence = offer.referrer.type === "points" ? copy.offerPoints(friend, rewardText(offer.referrer)) : copy.offerCredit(friend, rewardText(offer.referrer));
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(copy.shareText(shareOffer(offer.friend, copy), store?.name ?? "", url))}`;
  const day = (iso: string) => new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium" }).format(new Date(iso));

  async function copyLink() {
    let ok = false;
    try {
      await navigator.clipboard.writeText(url);
      ok = true;
    } catch {
      // No clipboard permission, or not a secure origin: the old selection way.
      const field = document.createElement("textarea");
      field.value = url;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      } finally {
        field.remove();
      }
    }
    setCopied(ok ? "yes" : "failed");
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(null), 2500);
  }

  const statusText: Record<CustomerReferralStatus, string> = { pending: copy.statusPending, rewarded: copy.statusRewarded, void: copy.statusVoid };

  return (
    <div>
      <section className={`${card} p-5 sm:p-6`} aria-labelledby="account-invite-title">
        <div className="flex items-start gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">
            <GiftIcon size={24} />
          </span>
          <div className="min-w-0">
            <h2 id="account-invite-title" className="font-display text-xl font-bold text-ink sm:text-2xl">
              {copy.inviteTitle}
            </h2>
            <p className="mt-1 text-sm text-ink">{sentence}</p>
            {offer.minOrderAmount && <p className="mt-1 text-xs text-ink-soft">{copy.minOrder(money(offer.minOrderAmount))}</p>}
          </div>
        </div>

        <div className="mt-5 border-t border-line pt-4">
          <label htmlFor="account-invite-link" className="mb-1.5 block text-sm font-medium text-ink">
            {copy.yourLink}
          </label>
          <input
            id="account-invite-link"
            type="text"
            readOnly
            dir="ltr"
            value={url}
            onFocus={(e) => e.currentTarget.select()}
            className="block min-h-11 w-full rounded-xl border border-line-strong bg-paper px-3.5 py-2.5 text-sm text-ink outline-none focus:border-primary focus:ring-4 focus:ring-primary/15"
          />
          <p className="mt-1.5 text-xs text-ink-soft">
            {copy.yourCode}: <bdi dir="ltr" className="font-mono font-semibold text-ink">{data.code}</bdi>
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => void copyLink()} className={btnPrimary}>
              {copied === "yes" ? <CheckIcon size={18} /> : <CopyIcon size={18} />}
              {copied === "yes" ? copy.copied : copy.copyLink}
            </button>
            <a href={whatsapp} target="_blank" rel="noopener noreferrer" className={btnSecondary}>
              <WhatsAppIcon size={18} />
              {copy.shareWhatsapp}
            </a>
          </div>
          <p aria-live="polite" className="mt-2 text-xs font-medium text-danger empty:hidden">
            {copied === "failed" ? copy.copyFailed : ""}
          </p>
        </div>
      </section>

      <dl className="mt-4 grid grid-cols-2 gap-3">
        <div className={`${card} px-4 py-3`}>
          <dt className="text-xs text-ink-soft">{copy.statPending}</dt>
          <dd className="mt-1 font-display text-2xl font-bold text-ink tabular-nums">{new Intl.NumberFormat(intlLocale).format(data.stats.pending)}</dd>
        </div>
        <div className={`${card} px-4 py-3`}>
          <dt className="text-xs text-ink-soft">{copy.statRewarded}</dt>
          <dd className="mt-1 font-display text-2xl font-bold text-ink tabular-nums">{new Intl.NumberFormat(intlLocale).format(data.stats.rewarded)}</dd>
        </div>
      </dl>

      {data.referrals.length === 0 ? (
        <div className={`${card} mt-6 flex flex-col items-center px-5 py-10 text-center`}>
          <p className="text-base font-semibold text-ink">{copy.invitesEmpty}</p>
          <p className="mt-1 max-w-sm text-sm text-ink-soft">{copy.invitesEmptyHint}</p>
        </div>
      ) : (
        <section className="mt-6" aria-labelledby="account-invite-list">
          <h2 id="account-invite-list" className="text-base font-semibold text-ink">
            {copy.invitesTitle}
          </h2>
          <ul className={`${card} mt-3 divide-y divide-line`}>
            {data.referrals.map((row) => (
              <li key={row.id} className="flex items-start justify-between gap-3 px-4 py-3 text-sm sm:px-5">
                <div className="min-w-0">
                  <p className="font-medium text-ink">{copy.friendOrder}</p>
                  <p className="mt-0.5 text-xs text-ink-soft">{day(row.createdAt)}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_CLASS[row.status]}`}>{statusText[row.status]}</span>
                  {row.status === "rewarded" && row.reward && (
                    <span className="text-xs font-semibold text-success">
                      {row.reward.type === "points" ? copy.youGotPoints(rewardText(row.reward)) : copy.youGotCredit(rewardText(row.reward))}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
