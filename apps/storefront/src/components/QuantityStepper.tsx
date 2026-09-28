"use client";

import { useStore } from "@/lib/StoreContext";
import { focusRing } from "./ui";

/**
 * − n + as one control, sized for a thumb (44px buttons) and labelled for a
 * screen reader. The value is announced as it changes. Used by the cart
 * drawer, the cart page and the product page so the three agree.
 */
export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max = 99,
  disabled = false,
  size = "md",
  labelledBy,
}: {
  value: number;
  onChange: (next: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  /** `sm` fits a cart line; `md` is the product page's. */
  size?: "sm" | "md";
  labelledBy?: string;
}) {
  const { t, intlLocale } = useStore();
  // Both sizes keep the 44px button; `sm` only tightens the number between them.
  const btn = `inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-lg leading-none text-ink transition-colors hover:bg-paper disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent ${focusRing}`;

  return (
    <div
      role="group"
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : t.product.quantity}
      className="inline-flex items-center rounded-xl border border-line bg-paper-raised"
    >
      <button
        type="button"
        aria-label={t.product.decrease}
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={disabled || value <= min}
        className={btn}
      >
        −
      </button>
      <output aria-live="polite" className={`text-center font-semibold tabular-nums text-ink ${size === "sm" ? "min-w-8 text-sm" : "min-w-10 text-base"}`}>
        {new Intl.NumberFormat(intlLocale).format(value)}
      </output>
      <button
        type="button"
        aria-label={t.product.increase}
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={disabled || value >= max}
        className={btn}
      >
        +
      </button>
    </div>
  );
}
