"use client";

import { cartFreeGiftsOf, parseMoney, type Cart, type CartFreeGift } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";
import { GiftIcon } from "../Icons";

/**
 * The cart's free gifts (handoff 208), under its lines in the drawer, on the
 * cart page and in the checkout summary. A gift the cart has earned shows as
 * a line at no charge — the checkout adds it to the order by itself; one not
 * reached yet says how much is left; one out of stock is not mentioned. The
 * server decides all of it (`cart.freeGifts`), so nothing here is a promise
 * the order won't keep.
 */
export function CartFreeGifts({
  cart,
  progress = true,
  className = "",
}: {
  cart: Cart | null | undefined;
  /** false: only the gifts already earned (the checkout summary). */
  progress?: boolean;
  className?: string;
}) {
  const { t, money } = useStore();
  const copy = t.freeGifts;
  const gifts = cartFreeGiftsOf(cart);
  // One line per gift variant, as the checkout adds them.
  const earned = gifts.filter((g, i) => g.eligible && gifts.findIndex((x) => x.eligible && x.gift.variantId === g.gift.variantId) === i);
  const earnedIds = new Set(earned.map((g) => g.gift.variantId));
  // Not reached yet, in stock, only an amount away (a missing product can't be named here), and not a gift already earned.
  const next = progress
    ? gifts.filter((g) => !g.eligible && !g.outOfStock && !g.needsProduct && parseMoney(g.missingAmount) > 0 && !earnedIds.has(g.gift.variantId))
    : [];
  if (!cart || (earned.length === 0 && next.length === 0)) return null;
  const currency = cart.currency;
  const subtotal = Number(cart.subtotal) || 0;

  return (
    <div className={`space-y-2 ${className}`} aria-live="polite">
      {earned.map((g) => (
        <p key={g.ruleId} className="flex items-center gap-3 rounded-xl bg-success-soft px-3 py-2.5 text-sm">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-paper-raised text-success">
            <GiftIcon size={18} />
          </span>
          <span className="min-w-0 flex-1 font-medium text-ink">
            {copy.line(giftName(g))}
            {g.gift.quantity > 1 && <span className="text-xs font-normal text-ink-soft"> × {g.gift.quantity}</span>}
          </span>
          <span className="shrink-0 font-semibold text-success">{copy.free}</span>
        </p>
      ))}
      {next.map((g) => {
        const missing = parseMoney(g.missingAmount);
        const done = Math.max(4, Math.min(96, Math.round((subtotal / (subtotal + missing)) * 100)));
        return (
          <p key={g.ruleId} className="rounded-xl bg-primary-soft px-3 py-2 text-xs font-medium text-primary">
            <span className="flex items-center gap-2">
              <GiftIcon size={16} className="shrink-0" />
              {copy.missing(money(missing, currency), giftName(g))}
            </span>
            <span
              role="progressbar"
              aria-label={copy.progress(giftName(g))}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={done}
              className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-paper-raised"
            >
              <span className="block h-full rounded-full bg-current transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${done}%` }} />
            </span>
          </p>
        );
      })}
    </div>
  );
}

/** The gift's product, with its options when it has any ("Tote — Red"). */
function giftName(g: CartFreeGift): string {
  const options = Object.values(g.gift.optionValues ?? {}).filter(Boolean).join(" / ");
  const name = g.gift.productName || g.name;
  return options ? `${name} — ${options}` : name;
}
