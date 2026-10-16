"use client";

import { loyaltyPointsFor } from "@store-builder/api-client";
import { useLoyaltyProgram } from "@/lib/loyaltyProgram";
import { useTenderCopy } from "./tenderCopy";

/**
 * The product page's «هتكسب 250 نقطة»: what one unit of the
 * product earns — its price over one currency unit, times the store's earn
 * rate, rounded down. Nothing on a store without a programme, or while the
 * price earns no whole point.
 */
export function EarnPointsNote({ unitMinor, className = "" }: { unitMinor: number; className?: string }) {
  const copy = useTenderCopy();
  const program = useLoyaltyProgram();
  const points = loyaltyPointsFor(unitMinor, program);
  if (points <= 0) return null;
  return (
    <p className={`mt-2 flex flex-wrap items-center gap-x-1.5 text-sm ${className}`}>
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 font-semibold text-primary">
        <StarIcon />
        {copy.earn(points)}
      </span>
      <span className="text-xs text-ink-soft">{copy.earnHint}</span>
    </p>
  );
}

/** A small star, drawn like the storefront's own glyphs (24px grid, currentColor). */
function StarIcon() {
  return (
    <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M12 2.6l2.8 5.9 6.4.8-4.7 4.5 1.2 6.4L12 17.1l-5.7 3.1 1.2-6.4L2.8 9.3l6.4-.8L12 2.6z" />
    </svg>
  );
}
