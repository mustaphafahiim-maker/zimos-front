"use client";

import type { ReactNode } from "react";
import { parseMoney, type CartLine } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";
import { useRewardsCopy } from "./rewardsCopy";
import { useYourPrice } from "./shopperPrices";

/**
 * Under a cart line that a signed-in shopper's price list lowered (handoff
 * 205): «سعرك · Wholesale — بدل 250 ج.م», and the next quantity that costs
 * less. The line's own price and total are already the cart's (the API prices
 * the cart with the shopper's token); this only says why they are lower.
 *
 * `children` is what the line would say otherwise — the cart's "price changed
 * since you added it" — shown for every other line: the API marks a
 * list-priced line as changed, which is not what happened to it.
 */
export function CartLinePrice({
  line,
  currency,
  children,
}: {
  line: Pick<CartLine, "variantId" | "offerId" | "quantity" | "currentUnitPrice">;
  currency?: string;
  children?: ReactNode;
}) {
  const { money } = useStore();
  const copy = useRewardsCopy();
  // An offer line keeps the offer's own price: the lists never touch it.
  const yours = useYourPrice(line.offerId ? null : line.variantId, line.quantity);

  // While a signed-in shopper's prices are being read, neither note: the other one would flash on every lowered line.
  if (yours.loading) return null;
  const lowered = yours.unit !== null && yours.base !== null && parseMoney(line.currentUnitPrice) < yours.base;
  if (!lowered || yours.base === null) return <>{children}</>;

  const next = yours.tiers.find((tier) => tier.minQuantity > line.quantity);
  return (
    <span className="mt-1 block text-xs">
      <span className="font-semibold text-success">
        {copy.cartYourPrice}
        {yours.listName && (
          <>
            {" · "}
            <bdi>{yours.listName}</bdi>
          </>
        )}
      </span>{" "}
      <span className="text-ink-soft">{copy.insteadOf(money(yours.base, currency))}</span>
      {next && <span className="mt-0.5 block text-ink-soft">{copy.fromPieces(next.minQuantity, money(parseMoney(next.priceAmount), currency))}</span>}
    </span>
  );
}
