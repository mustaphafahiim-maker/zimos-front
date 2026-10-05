"use client";

import { FreeShippingBar } from "../offers/CouponBits";
import type { FreeShippingProgress } from "@store-builder/api-client";
import { useStore } from "@/lib/StoreContext";
import { freeShippingRemaining, type ShippingLine } from "@/lib/shippingLine";

/** The value cell of the "Shipping" row in an order summary. */
export function ShippingFee({ line, currency }: { line: ShippingLine; currency?: string }) {
  const { t, money } = useStore();
  switch (line.kind) {
    case "amount":
      return <>{money(line.amount, currency)}</>;
    case "free":
      return <span className="font-semibold text-success">{t.checkout.shippingFree}</span>;
    case "pick_governorate":
      return <>{t.checkout.shippingPickGovernorate}</>;
    case "calculating":
      return <span aria-live="polite">{t.checkout.shippingCalculating}</span>;
    default:
      return <>{t.checkout.shippingOnConfirmation}</>;
  }
}

/**
 * "Add X more for free shipping" under the summary, while the store has a
 * threshold the basket hasn't reached; "ships free" once the row says Free
 * because of it. Nothing otherwise.
 */
export function FreeShippingHint({
  progress,
  line,
  currency,
  className = "",
}: {
  progress: FreeShippingProgress | null;
  line: ShippingLine;
  currency?: string;
  className?: string;
}) {
  const { t, money } = useStore();
  const remaining = freeShippingRemaining(progress);
  if (remaining !== null) {
    return (
      <p className={`rounded-xl bg-primary-soft px-3 py-2 text-xs font-medium text-primary ${className}`} aria-live="polite">
        {t.checkout.freeShippingHint(money(remaining, currency))}
        <FreeShippingBar progress={progress} />
      </p>
    );
  }
  if (progress?.qualified && line.kind === "free") {
    return (
      <p className={`rounded-xl bg-success-soft px-3 py-2 text-xs font-medium text-success ${className}`} aria-live="polite">
        {t.checkout.freeShippingReached}
      </p>
    );
  }
  return null;
}
