import { cn } from "@store-builder/ui";

export type AnalyticsRange = "7d" | "30d" | "90d";

const RANGES: Array<{ value: AnalyticsRange; label: string }> = [
  { value: "7d", label: "7 days" },
  { value: "30d", label: "30 days" },
  { value: "90d", label: "90 days" },
];

interface RangeSwitchProps {
  value: AnalyticsRange;
  onChange: (next: AnalyticsRange) => void;
  className?: string;
}

/** Segmented 7d / 30d / 90d control used by the home and analytics pages. */
export function RangeSwitch({ value, onChange, className }: RangeSwitchProps) {
  return (
    <div role="radiogroup" aria-label="Date range" className={cn("inline-flex rounded-[0.5rem] border border-line bg-paper-raised p-0.5", className)}>
      {RANGES.map((r) => (
        <button
          key={r.value}
          type="button"
          role="radio"
          aria-checked={value === r.value}
          onClick={() => onChange(r.value)}
          className={cn(
            "rounded-[0.4rem] px-3 py-1 text-xs font-medium transition-colors",
            value === r.value ? "bg-primary text-white" : "text-ink-soft hover:text-ink"
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
