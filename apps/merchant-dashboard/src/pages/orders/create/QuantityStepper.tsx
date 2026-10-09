import { useState } from "react";
import { cn } from "@store-builder/ui";
import { IconMinus, IconPlus } from "@/components/icons";
import { useT } from "@/i18n/LocaleContext";
import { asciiDigits } from "@/lib/wholeNumber";
import { CREATE_STRINGS } from "./strings";
import { MAX_QUANTITY, clampQuantity } from "./model";

interface QuantityStepperProps {
  value: number;
  onChange: (value: number) => void;
  /** Names the group and the figure for screen readers: «الكمية», or «كمية <المنتج>» on a line. */
  label: string;
  /** Enter in the figure (the picker adds the product). Without it Enter just leaves the field. */
  onEnter?: () => void;
  className?: string;
}

const STEP_BUTTON =
  "flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] " +
  "hover:bg-ink/8 focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] disabled:cursor-default disabled:text-ink-soft/50 disabled:hover:bg-transparent disabled:active:scale-100 " +
  "motion-reduce:transition-none motion-reduce:active:scale-100";

/**
 * − n +: one piece less, one more, or the figure typed straight in for a big
 * order. Never below one. Both buttons are 44px; the figure between them is a
 * field, so a quantity of forty is four key presses and not forty taps.
 * Material (the small glass track) is in glass/order-create.css.
 */
export function QuantityStepper({ value, onChange, label, onEnter, className }: QuantityStepperProps) {
  const t = useT(CREATE_STRINGS);
  // What is being typed, while it is being typed: an empty field is allowed for a moment, an empty quantity never.
  const [typing, setTyping] = useState<string | null>(null);

  return (
    <div
      role="group"
      aria-label={label}
      data-slot="order-qty"
      className={cn("inline-flex h-11 shrink-0 items-center rounded-full bg-paper-raised ring-1 ring-line", className)}
    >
      <button
        type="button"
        aria-label={t.less}
        title={t.less}
        disabled={value <= 1}
        onClick={() => onChange(clampQuantity(value - 1))}
        className={STEP_BUTTON}
      >
        <IconMinus className="size-4" weight="bold" aria-hidden />
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        enterKeyHint="done"
        autoComplete="off"
        dir="ltr"
        aria-label={label}
        value={typing ?? String(value)}
        onFocus={(event) => event.target.select()}
        onChange={(event) => {
          const digits = asciiDigits(event.target.value).replace(/\D/g, "").slice(0, String(MAX_QUANTITY).length);
          setTyping(digits);
          if (digits !== "" && Number(digits) >= 1) onChange(clampQuantity(Number(digits)));
        }}
        onBlur={() => setTyping(null)}
        onKeyDown={(event) => {
          if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
          // Enter here is about the quantity, never the step's button.
          event.preventDefault();
          event.stopPropagation();
          setTyping(null);
          if (onEnter) onEnter();
          else event.currentTarget.blur();
        }}
        className="h-full w-11 min-w-0 bg-transparent text-center text-sm font-semibold text-ink tabular-nums outline-none focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-primary pointer-coarse:text-base"
      />
      <button
        type="button"
        aria-label={t.more}
        title={t.more}
        disabled={value >= MAX_QUANTITY}
        onClick={() => onChange(clampQuantity(value + 1))}
        className={STEP_BUTTON}
      >
        <IconPlus className="size-4" weight="bold" aria-hidden />
      </button>
    </div>
  );
}
