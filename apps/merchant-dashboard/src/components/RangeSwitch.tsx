import { CalendarDays, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
  cn,
} from "@store-builder/ui";
import { useCommon, useT, type Messages } from "@/i18n/LocaleContext";
import { ANALYTICS_RANGES, type AnalyticsRange } from "@/lib/analytics";

const STRINGS = {
  en: {
    label: "Date range",
    yesterday: "Yesterday",
    last365: "Last 365 days",
    compare: "Compare: previous period",
  },
  ar: {
    label: "الفترة",
    yesterday: "إمبارح",
    last365: "آخر 365 يوم",
    compare: "مقارنة: الفترة اللي قبلها",
  },
} satisfies Messages;

/**
 * The date-range control above the analytics and profit screens: a calendar
 * button that opens the presets, next to the (always-on) comparison chip.
 */
export function RangeSwitch({
  value,
  onChange,
  className,
}: {
  value: AnalyticsRange;
  onChange: (value: AnalyticsRange) => void;
  className?: string;
}) {
  const t = useT(STRINGS);
  const common = useCommon();
  const labels: Record<AnalyticsRange, string> = {
    today: common.today,
    yesterday: t.yesterday,
    "7d": common.last7,
    "30d": common.last30,
    "90d": common.last90,
    "365d": t.last365,
  };
  const chip =
    "inline-flex h-9 items-center gap-2 rounded-[0.5rem] border border-line bg-paper-raised px-3 text-sm font-medium text-ink";
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger aria-label={t.label} className={cn(chip, "cursor-pointer transition-colors hover:bg-paper")}>
          <CalendarDays className="size-4 text-ink-soft" aria-hidden />
          <span>{labels[value]}</span>
          <ChevronDown className="size-4 text-ink-soft" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-44">
          <DropdownMenuRadioGroup value={value} onValueChange={(next) => onChange(next as AnalyticsRange)}>
            {ANALYTICS_RANGES.map((range) => (
              <DropdownMenuRadioItem key={range} value={range}>
                {labels[range]}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <span className={cn(chip, "text-ink-soft")}>{t.compare}</span>
    </div>
  );
}
