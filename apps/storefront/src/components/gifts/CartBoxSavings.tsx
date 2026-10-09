"use client";

import { cartBundleSavingsOf, type Cart } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";
import { BoxIcon } from "../Icons";

/**
 * What the cart's boxes and bundles save (handoff 215), under its lines: the
 * line totals already carry it (`cart.bundles`), so this says it in words
 * rather than taking it off again.
 */
export function CartBoxSavings({ cart, className = "" }: { cart: Cart | null | undefined; className?: string }) {
  const { t, money } = useStore();
  const savings = cartBundleSavingsOf(cart);
  if (!cart || savings.length === 0) return null;
  return (
    <ul className={`space-y-2 ${className}`} aria-live="polite">
      {savings.map((s) => (
        <li key={s.bundleId + (s.productId ?? "")} className="flex items-center gap-2 rounded-xl bg-success-soft px-3 py-2 text-xs font-medium text-success">
          <BoxIcon size={16} className="shrink-0" />
          {t.giftBox.bundleSaved(money(s.amount, cart.currency), s.name)}
        </li>
      ))}
    </ul>
  );
}
