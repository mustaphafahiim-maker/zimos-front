"use client";

import type { StorefrontPreorder } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";
import { formatShopDay, limitLines } from "@/lib/buyInfo";
import { BoxIcon } from "../Icons";

/**
 * Under the product page's price: what buying the chosen variant means —
 * a pre-order with its ship date and the merchant's message (handoff 195),
 * and the product's purchase limits (198). Each line shows only when the
 * API says so.
 */
export function ProductBuyNotes({ product, preorder }: { product: unknown; preorder: StorefrontPreorder | null }) {
  const { t, intlLocale } = useStore();
  const limits = limitLines(product, t.buyInfo);
  const date = preorder ? formatShopDay(preorder.shipsAt, intlLocale) : "";
  return (
    <>
      {preorder && (
        <div className="mt-2 rounded-xl border border-primary/25 bg-primary-soft px-3.5 py-2.5 text-sm" role="status">
          <p className="flex items-center gap-1.5 font-semibold text-primary">
            <BoxIcon size={16} className="shrink-0" />
            {date ? t.buyInfo.preorderLine(date) : t.buyInfo.preorderLineNoDate}
          </p>
          <p className="mt-0.5 text-ink-soft">{preorder.message || t.buyInfo.preorderNote}</p>
        </div>
      )}
      {limits.length > 0 && <p className="mt-2 text-sm text-ink-soft">{limits.join(" · ")}</p>}
    </>
  );
}

// The helpers the buy box reads with these notes (lib/buyInfo).
export { preorderFor, stepperLimits, takesPreorders } from "@/lib/buyInfo";
