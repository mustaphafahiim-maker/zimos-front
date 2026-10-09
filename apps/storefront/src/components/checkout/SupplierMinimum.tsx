"use client";

import { belowSupplierMinimum, type SupplierMinimumGap } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";
import { pickText } from "@/lib/i18n";
import { SUPPLIER_MINIMUM_TEXT } from "@/lib/supplierMinimum";

/*
 * A dropshipping supplier's minimum order, on the shopper's side (handoff
 * 263). The shipping quote says when the cart's products from one supplier
 * come to less than that supplier's minimum (`supplierMinimum`), and the
 * checkout refuses such an order with 422 BELOW_SUPPLIER_MINIMUM. So the cart
 * and the checkout say how much is missing before the order is sent, and the
 * checkout keeps its order button off until the minimum is reached. Every
 * amount is the server's.
 */

export interface SupplierMinimumState {
  /** The sentence to show while the minimum is not reached; null once it is (or the store has none). */
  message: string | null;
  /** The order cannot be placed yet. */
  blocked: boolean;
  /** A checkout the server refused for this, in the shopper's words; null for any other failure. */
  onError: (err: unknown) => string | null;
}

/** The quote's `supplierMinimum` (lib/useShippingQuote), ready for the cart and the checkout. */
export function useSupplierMinimum(gap: SupplierMinimumGap | null | undefined, currency?: string): SupplierMinimumState {
  const { locale, money } = useStore();
  const text = pickText(SUPPLIER_MINIMUM_TEXT, locale);
  return {
    message: gap ? text.below(money(gap.missingAmount, currency)) : null,
    blocked: Boolean(gap),
    onError: (err) => {
      const refused = belowSupplierMinimum(err);
      return refused ? text.below(money(refused.missingAmount, currency)) : null;
    },
  };
}

/** Says how much more to add, like the store's own minimum-order notice. */
export function SupplierMinimumNotice({ state, className = "" }: { state: SupplierMinimumState; className?: string }) {
  if (!state.message) return null;
  return (
    <p role="status" className={`rounded-xl bg-danger-soft px-3 py-2 text-xs font-medium text-danger ${className}`}>
      {state.message}
    </p>
  );
}
