import { useCommon, useT, type Messages } from "@/i18n/LocaleContext";
import { ANALYTICS_RANGES, type AnalyticsRange } from "@/lib/analytics";
import { FilterTabs } from "@/components/FilterTabs";

const STRINGS = {
  en: { label: "Date range" },
  ar: { label: "الفترة" },
} satisfies Messages;

/** The date-range control above the analytics and profit screens. */
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
    "7d": common.last7,
    "30d": common.last30,
    "90d": common.last90,
  };
  return (
    <FilterTabs
      className={className}
      label={t.label}
      value={value}
      onChange={onChange}
      tabs={ANALYTICS_RANGES.map((range) => ({ value: range, label: labels[range] }))}
    />
  );
}
