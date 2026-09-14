/**
 * Dashboard bindings for the shared SVG charts: default number/percent
 * formatting follows the dashboard locale (Latin digits, EN/AR).
 */
import {
  BarChart as SharedBarChart,
  FunnelBars as SharedFunnelBars,
  HBarList as SharedHBarList,
  LineAreaChart as SharedLineAreaChart,
  type BarChartProps,
  type FunnelBarsProps,
  type HBarListProps,
  type LineAreaChartProps,
} from "@store-builder/ui";
import { formatNumber, formatPercentValue } from "@/lib/format";

export { Sparkline } from "@store-builder/ui";

const num = (v: number) => formatNumber(v);

export function LineAreaChart(props: LineAreaChartProps) {
  return <SharedLineAreaChart format={num} {...props} />;
}

export function BarChart(props: BarChartProps) {
  return <SharedBarChart format={num} {...props} />;
}

export function HBarList(props: HBarListProps) {
  return <SharedHBarList format={num} {...props} />;
}

export function FunnelBars(props: FunnelBarsProps) {
  return <SharedFunnelBars format={num} formatRate={(r) => formatPercentValue(r, 0)} {...props} />;
}
