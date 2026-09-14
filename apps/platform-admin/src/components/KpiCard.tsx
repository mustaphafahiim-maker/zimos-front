import { Link } from "react-router-dom";
import { KpiCard as SharedKpiCard, type KpiCardProps } from "@store-builder/ui";

export function KpiCard(props: KpiCardProps) {
  return <SharedKpiCard linkComponent={Link} {...props} />;
}
