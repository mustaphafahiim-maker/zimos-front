"use client";

import Link from "next/link";
import { useCart } from "@/lib/CartProvider";
import { useStore } from "@/lib/StoreContext";
import { CartGlyph } from "./Icons";
import { iconBtn } from "./ui";

export function CartIcon({ workspaceId }: { workspaceId: string }) {
  const { itemCount } = useCart();
  const { t, locale } = useStore();

  return (
    <Link
      href={`/store/${workspaceId}/cart`}
      aria-label={itemCount > 0 ? t.common.cartWithCount(itemCount) : t.common.cart}
      className={iconBtn}
    >
      <CartGlyph />
      {itemCount > 0 && (
        <span className="absolute -end-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-xs font-semibold text-white">
          {new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-EG").format(itemCount)}
        </span>
      )}
    </Link>
  );
}
