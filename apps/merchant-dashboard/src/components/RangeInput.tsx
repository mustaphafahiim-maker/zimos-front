import { cn } from "@store-builder/ui";

export interface RangeInputProps {
  /** Names the slider for screen readers; pass `labelledBy` instead when its label is on the page. */
  label?: string;
  labelledBy?: string;
  value: number;
  onChange: (value: number) => void;
  /** What the value means, in words («Midnight», «60%»), read out in place of the bare number. */
  valueText?: string;
  min?: number;
  max?: number;
  step?: number;
  className?: string;
}

/**
 * A slider: the browser's own range input, so the keyboard (arrows, Home,
 * End, Page Up / Down), touch and the reading direction (it runs right to
 * left in Arabic) come with it. A 44px target; the thumb and the filled part
 * take the brand through `accent-color`, in every look.
 */
export function RangeInput({ label, labelledBy, value, onChange, valueText, min = 0, max = 100, step = 1, className }: RangeInputProps) {
  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-valuetext={valueText}
      onChange={(event) => onChange(Number(event.target.value))}
      className={cn(
        "h-11 min-w-0 cursor-pointer accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        className
      )}
    />
  );
}
