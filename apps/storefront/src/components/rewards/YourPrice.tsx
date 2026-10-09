"use client";

import { parseMoney } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";
import { useRewardsCopy } from "./rewardsCopy";
import { useYourPrice } from "./shopperPrices";

/**
 * The product page's «سعرك: 200 ج.م بدل 250» (handoff 205) for a signed-in
 * shopper with a price list: what a unit costs them at the quantity chosen,
 * and under it every quantity they pay less from — «من 5 قطع: 180 ج.م».
 * Every figure is the API's (GET /store/:ws/price-list). Nothing at all for
 * everyone else, and for a line the lists never touch (an offer, a bundle):
 * pass no `variantId` then.
 */
export function YourPrice({ variantId, quantity, className = "" }: { variantId: string | null | undefined; quantity: number; className?: string }) {
  const { money } = useStore();
  const copy = useRewardsCopy();
  const yours = useYourPrice(variantId, quantity);
  if (yours.base === null || yours.tiers.length === 0) return null;

  const base = yours.base;
  // One price from the first unit says it all in the headline; a table only when quantity changes the price.
  const showTable = yours.tiers.length > 1 || yours.tiers[0].minQuantity > 1;

  return (
    <div className={`mt-3 rounded-2xl border border-primary/25 bg-primary-soft px-4 py-3 ${className}`}>
      {yours.listName && (
        <p className="text-xs font-semibold text-primary">
          <bdi>{copy.listPrices(yours.listName)}</bdi>
        </p>
      )}
      {yours.unit !== null && <p className="mt-0.5 text-base font-bold text-ink">{copy.yourPrice(money(yours.unit), money(base))}</p>}
      {showTable && (
        <ul aria-label={copy.tiersTitle} className={`space-y-1 text-sm text-ink ${yours.unit !== null || yours.listName ? "mt-2" : ""}`}>
          {yours.tiers.map((tier) => {
            const current = tier.minQuantity === yours.from;
            return (
              <li key={tier.minQuantity} className={`flex flex-wrap items-center gap-x-2 gap-y-0.5 ${current ? "font-semibold" : ""}`}>
                <span>{copy.fromPieces(tier.minQuantity, money(parseMoney(tier.priceAmount)))}</span>
                {/* A pill, not a "·": beside Arabic digits a middle dot reads as a zero. */}
                {current && <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-semibold text-on-primary">{copy.tierNow}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
