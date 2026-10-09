"use client";

import { shopperVip, vipTierHasPerks, vipTierName, type ShopperVip, type VipTierPerks } from "@store-builder/api-client";
import { CheckIcon } from "@/components/Icons";
import { btnPrimary, card, skeleton } from "@/components/ui";
import { Notice, useAccount } from "@/components/account/AccountShell";
import { useShopperRead } from "@/components/account/AccountWalletTabs";
import { useStore } from "@/lib/StoreContext";
import { useRewardsCopy, type RewardsCopy } from "./rewardsCopy";

/**
 * The account's «مستواي» page (handoff 218): the signed-in shopper's VIP
 * level with what it gives, how far the next one is, and every level of the
 * store. The tab that leads here is in AccountRewardsTabs.tsx.
 */

function perkLines(perks: VipTierPerks, copy: RewardsCopy): string[] {
  return [
    perks.percentOff > 0 ? copy.perkPercent(perks.percentOff) : null,
    perks.freeShipping ? copy.perkShipping : null,
    perks.pointsMultiplier > 1 ? copy.perkPoints(perks.pointsMultiplier) : null,
  ].filter((line): line is string => Boolean(line));
}

/** A crown, drawn like the storefront's own glyphs (24px grid, currentColor). */
function CrownIcon({ size = 20 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M4 17.5 3 7.5l5 4 4-6.5 4 6.5 5-4-1 10H4Z" />
      <path d="M4.5 20.5h15" />
    </svg>
  );
}

export function AccountVip() {
  const { money, locale, t } = useStore();
  const copy = useRewardsCopy();
  const { api } = useAccount();
  const [state, reload] = useShopperRead<ShopperVip>(api, shopperVip);

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
        <div className={`${skeleton} h-40 w-full`} />
        <div className={`${skeleton} h-16 w-full`} />
        <div className={`${skeleton} h-16 w-full`} />
      </div>
    );
  }

  const { data } = state;
  if (!data.enabled) return <Notice title={copy.vipOff} />;

  const byOrders = data.basis === "orders";
  const { tier, next } = data;
  const value = data.standing?.value ?? 0;
  const tierName = tier ? vipTierName(tier.name, locale) : "";
  const nextName = next ? vipTierName(next.name, locale) : "";
  const perks = tier ? perkLines(tier, copy) : [];
  // How far along the way to the next level: what they have, over what that level asks for.
  const target = next ? value + next.missing : 0;
  const percent = next && target > 0 ? Math.max(0, Math.min(100, Math.round((value / target) * 100))) : 100;

  return (
    <div>
      <section className={`${card} p-5 sm:p-6`} aria-labelledby="account-vip-title">
        <div className="flex items-start gap-3">
          <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${tier ? "bg-primary-soft text-primary" : "bg-paper text-ink-soft"}`}>
            <CrownIcon size={24} />
          </span>
          <div className="min-w-0">
            <h2 id="account-vip-title" className="font-display text-xl font-bold text-ink sm:text-2xl">
              {tier ? <bdi>{copy.yourLevel(tierName)}</bdi> : copy.noLevel}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">{byOrders ? copy.standingOrders(value) : copy.standingSpent(money(value))}</p>
          </div>
        </div>

        {tier &&
          (perks.length > 0 ? (
            <ul className="mt-4 space-y-1.5 border-t border-line pt-4 text-sm font-medium text-ink">
              {perks.map((line) => (
                <li key={line} className="flex items-center gap-2">
                  <CheckIcon size={16} className="shrink-0 text-success" />
                  {line}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 border-t border-line pt-4 text-sm text-ink-soft">{copy.noPerks}</p>
          ))}
        {!tier && <p className="mt-4 border-t border-line pt-4 text-sm text-ink-soft">{copy.noLevelHint}</p>}

        <div className="mt-4 border-t border-line pt-4">
          {next ? (
            <>
              <p className="text-sm font-semibold text-ink">
                <bdi>{byOrders ? copy.nextOrders(next.missing, nextName) : copy.nextSpent(money(next.missing), nextName)}</bdi>
              </p>
              <div
                role="progressbar"
                aria-label={copy.progressTo(nextName)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percent}
                className="mt-2 h-2.5 overflow-hidden rounded-full bg-line/60"
              >
                <div className="h-full rounded-full bg-primary" style={{ width: `${percent}%` }} />
              </div>
            </>
          ) : (
            <p className="text-sm font-semibold text-ink">{copy.topLevel}</p>
          )}
          <p className="mt-3 text-xs text-ink-soft">{copy.vipHow}</p>
        </div>
      </section>

      {data.tiers.length > 0 && (
        <section className="mt-6" aria-labelledby="account-vip-levels">
          <h2 id="account-vip-levels" className="text-base font-semibold text-ink">
            {copy.allLevels}
          </h2>
          <ul className={`${card} mt-3 divide-y divide-line`}>
            {data.tiers.map((level) => {
              const mine = tier?.id === level.id;
              const lines = perkLines(level, copy);
              return (
                <li key={level.id} className={`px-4 py-3 sm:px-5 ${mine ? "bg-primary-soft/60" : ""}`}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                    <p className="text-sm font-semibold text-ink">
                      <bdi>{vipTierName(level.name, locale)}</bdi>
                      {mine && <span className="ms-2 rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-on-primary">{copy.yoursBadge}</span>}
                    </p>
                    <p className="text-xs text-ink-soft tabular-nums">{byOrders ? copy.fromOrders(level.threshold) : copy.fromSpent(money(level.threshold))}</p>
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">{vipTierHasPerks(level) ? lines.join(" · ") : copy.noPerks}</p>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
