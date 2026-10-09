"use client";

import type { ReactNode, RefObject } from "react";
import { CartGlyph, ChevronIcon } from "../Icons";
import { card, focusRing } from "../ui";
import { FlashOnChange, busyProps } from "./LiveAmount";

/**
 * The checkout's order summary, drawn once and placed twice.
 *
 * On a phone it is a strip at the top of the page — how many pieces, the
 * total, a chevron — that opens in place to the whole summary (lines, coupon,
 * totals), so the shopper can see what they are ordering before the first
 * field instead of after the last. From `lg` it is the summary card of the
 * side column, always open, with a plain title.
 *
 * The body is one subtree either way (the page moves this element with CSS
 * `order`), so the coupon field and the other controls in it exist once.
 * `open` only matters below `lg`.
 */
export function CheckoutSummaryFold({
  id,
  title,
  note,
  totalLabel,
  total,
  busy = false,
  open,
  onToggle,
  showLabel,
  hideLabel,
  bodyRef,
  className = "",
  children,
}: {
  id: string;
  title: string;
  /** Under the title on the strip: «٣ قطع». */
  note?: string;
  totalLabel: string;
  /** The same text the bottom bar shows. */
  total: string;
  /** The total is the last one while a new quote is fetched. */
  busy?: boolean;
  open: boolean;
  onToggle: () => void;
  showLabel: string;
  hideLabel: string;
  bodyRef?: RefObject<HTMLDivElement | null>;
  className?: string;
  children: ReactNode;
}) {
  const amount = busyProps(busy);
  return (
    <section className={`${card} ${className}`} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="text-base font-semibold text-ink">
        {/* Phones: the strip. It is the heading's own button, so it reads as "Order summary, collapsed". */}
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={onToggle}
          className={`flex min-h-16 w-full cursor-pointer items-center gap-3 rounded-2xl px-4 py-3 text-start lg:hidden ${focusRing}`}
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary">
            <CartGlyph size={20} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-ink">{title}</span>
            <span className="block truncate text-xs font-normal text-ink-soft">
              {note ? `${note} · ` : ""}
              {open ? hideLabel : showLabel}
            </span>
          </span>
          <span aria-busy={amount["aria-busy"]} className={`shrink-0 text-end ${amount.className}`}>
            <span className="block text-xs font-normal text-ink-soft">{totalLabel}</span>
            <span className="block text-base font-bold text-ink">
              <FlashOnChange signal={total}>{total}</FlashOnChange>
            </span>
          </span>
          <ChevronIcon
            size={18}
            className={`shrink-0 text-ink-soft transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
          />
        </button>
        <span className="hidden px-5 pt-5 lg:block">{title}</span>
      </h2>
      <div
        id={`${id}-body`}
        ref={bodyRef}
        className={`${open ? "block" : "hidden"} border-t border-line px-4 pb-5 pt-1 sm:px-5 lg:block lg:border-0 lg:pt-0`}
      >
        {children}
      </div>
    </section>
  );
}
