import type { VipTierPerks } from "@store-builder/api-client";
import { fmt } from "@/i18n/LocaleContext";
import type { VipStrings } from "./vipTierStrings";

/** «خصم 10٪، شحن مجاني، نقط ولاء ×2» — what a tier gives, or "" when it gives nothing. */
export function vipPerksText(perks: VipTierPerks, t: VipStrings): string {
  return [
    perks.percentOff > 0 ? fmt(t.perkPercent, { n: perks.percentOff }) : null,
    perks.freeShipping ? t.perkShipping : null,
    perks.pointsMultiplier > 1 ? fmt(t.perkPoints, { n: perks.pointsMultiplier }) : null,
  ]
    .filter((part): part is string => Boolean(part))
    .join(t.perkJoin);
}
