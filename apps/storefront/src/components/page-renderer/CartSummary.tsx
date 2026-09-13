"use client";

import Link from "next/link";
import { useCart } from "@/lib/CartProvider";
import { useStore } from "@/lib/StoreContext";
import { btnPrimary } from "../ui";

/**
 * The `cart` element. The real cart — quantities, totals, checkout — lives at
 * /store/:workspaceId/cart and is deliberately not duplicated here; this block
 * is the live entry point to it, so a merchant who drops "Cart" onto a page
 * gets a count that is actually theirs rather than a mock.
 */
export function CartSummary({ title, workspaceId }: { title: string; workspaceId: string }) {
  const { itemCount, isLoading } = useCart();
  const { t } = useStore();

  return (
    <div className="rounded-2xl border border-line bg-paper-raised p-5 shadow-card">
      <h3 className="text-lg font-semibold text-ink">{title || t.renderer.yourCart}</h3>
      <p className="mt-1 text-sm text-ink-soft">
        {isLoading ? t.renderer.cartLoading : itemCount === 0 ? t.renderer.cartEmpty : t.renderer.cartCount(itemCount)}
      </p>
      <Link href={`/store/${workspaceId}/cart`} className={`${btnPrimary} mt-4`}>
        {t.renderer.viewCart}
      </Link>
    </div>
  );
}
