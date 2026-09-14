import { Link } from "react-router-dom";
import { KpiCard as SharedKpiCard, type KpiCardProps } from "@store-builder/ui";
import { useT } from "@/i18n/LocaleContext";
import { formatPercentValue } from "@/lib/format";

const STRINGS = {
  en: { vsPrevious: "vs previous period" },
  ar: { vsPrevious: "مقارنة بالفترة السابقة" },
};

export function KpiCard(props: KpiCardProps) {
  const t = useT(STRINGS);
  return (
    <SharedKpiCard
      linkComponent={Link}
      formatDelta={(ratio) => formatPercentValue(ratio)}
      {...props}
      deltaLabel={props.deltaLabel ?? t.vsPrevious}
    />
  );
}
