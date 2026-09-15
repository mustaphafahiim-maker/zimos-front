"use client";

import { StoreLink } from "@/components/StoreRoute";
import { useCart } from "@/lib/CartProvider";
import { useStore } from "@/lib/StoreContext";
import { CartGlyph } from "./Icons";
import { iconBtn } from "./ui";

export function CartIcon() {
  const { itemCount } = useCart();
  const { t, intlLocale } = useStore();

  return (
    <StoreLink
      href="/cart"
      aria-label={itemCount > 0 ? t.common.cartWithCount(itemCount) : t.common.cart}
      className={iconBtn}
    >
      <CartGlyph />
      {itemCount > 0 && (
        <span className="absolute -end-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-paper-raised">
          {new Intl.NumberFormat(intlLocale).format(itemCount)}
        </span>
      )}
    </StoreLink>
  );
}
