import type { ReferralFriendOffer, ReferralReward } from "@store-builder/api-client";
import { formatMoney } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { fmt } from "@/i18n/LocaleContext";
import type { ReferralStrings } from "./referralStrings";

/** «50 ج.م رصيد» or «200 نقطة»: what an inviter is given. */
export function referralRewardText(reward: ReferralReward, currency: string, t: ReferralStrings): string {
  return reward.type === "points" ? pluralOf(t, "points", reward.amount) : fmt(t.rewardCreditPart, { amount: formatMoney(reward.amount, currency) });
}

/** «خصم 10٪ على أول طلب»: what the invited friend gets, or "" when the offer is empty. */
export function referralFriendText(friend: ReferralFriendOffer, t: ReferralStrings): string {
  if (friend.percentOff > 0 && friend.freeShipping) return fmt(t.friendBothPart, { n: friend.percentOff });
  if (friend.percentOff > 0) return fmt(t.friendPercentPart, { n: friend.percentOff });
  return friend.freeShipping ? t.friendShippingPart : "";
}
