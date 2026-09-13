import { cn } from "@store-builder/ui";
import { useT } from "@/i18n/LocaleContext";

export type AnalyticsRange = "7d" | "30d" | "90d";

const STRINGS = {
  en: { range: "Date range", "7d": "7 days", "30d": "30 days", "90d": "90 days" },
  ar: { range: "النطاق الزمني", "7d": "7 أيام", "30d": "30 يومًا", "90d": "90 يومًا" },
};

const RANGES: AnalyticsRange[] = ["7d", "30d", "90d"];

interface RangeSwitchProps {
  value: AnalyticsRange;
  onChange: (next: AnalyticsRange) => void;
  className?: string;
}

/** Segmented 7d / 30d / 90d control used by the home and analytics pages. */
export function RangeSwitch({ value, onChange, className }: RangeSwitchProps) {
  const t = useT(STRINGS);
  return (
    <div
      role="radiogroup"
      aria-label={t.range}
      className={cn("inline-flex rounded-[10px] border border-line bg-paper-raised p-0.5", className)}
    >
      {RANGES.map((r) => (
        <button
          key={r}
          type="button"
          role="radio"
          aria-checked={value === r}
          onClick={() => onChange(r)}
          className={cn(
            "cursor-pointer rounded-[8px] px-3 py-1 text-xs font-medium transition-colors",
            value === r ? "bg-primary text-white" : "text-ink-soft hover:bg-primary-soft hover:text-ink"
          )}
        >
          {t[r]}
        </button>
      ))}
    </div>
  );
}
