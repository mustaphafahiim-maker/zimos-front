/**
 * Dependency-free SVG charts sized for dashboard cards. Colors come from the
 * theme tokens via CSS variables so they flip with dark mode.
 */
import { useId } from "react";
import { cn } from "@store-builder/ui";

export interface ChartPoint {
  label: string;
  value: number;
}

interface LineAreaChartProps {
  points: ChartPoint[];
  height?: number;
  className?: string;
  format?: (v: number) => string;
  color?: string;
}

export function LineAreaChart({
  points,
  height = 160,
  className,
  format = String,
  color = "var(--color-primary)",
}: LineAreaChartProps) {
  const id = useId();
  const w = 600;
  const h = height;
  const padX = 8;
  const padY = 10;
  if (points.length === 0) return null;
  const max = Math.max(...points.map((p) => p.value), 1);
  const step = (w - padX * 2) / Math.max(points.length - 1, 1);
  const y = (v: number) => padY + (h - padY * 2) * (1 - v / max);
  const coords = points.map((p, i) => [padX + i * step, y(p.value)] as const);
  const path = coords.map(([x, yy], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${yy.toFixed(1)}`).join(" ");
  const last = coords[coords.length - 1];
  const area = `${path} L${last[0].toFixed(1)},${h - padY} L${padX},${h - padY} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("w-full", className)} style={{ height }} role="img">
      <defs>
        <linearGradient id={`g-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line
          key={f}
          x1={padX}
          x2={w - padX}
          y1={padY + (h - padY * 2) * f}
          y2={padY + (h - padY * 2) * f}
          stroke="var(--color-line)"
          strokeDasharray="3 4"
          strokeWidth="1"
        />
      ))}
      <path d={area} fill={`url(#g-${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      {coords.map(([x, yy], i) => (
        <g key={i}>
          <circle cx={x} cy={yy} r="3" fill={color} className="opacity-0 hover:opacity-100" />
          <rect x={x - step / 2} y={0} width={step} height={h} fill="transparent">
            <title>{`${points[i].label}: ${format(points[i].value)}`}</title>
          </rect>
        </g>
      ))}
    </svg>
  );
}

interface BarChartProps {
  points: ChartPoint[];
  height?: number;
  className?: string;
  format?: (v: number) => string;
  color?: string;
}

export function BarChart({ points, height = 120, className, format = String, color = "var(--color-accent)" }: BarChartProps) {
  const w = 600;
  const h = height;
  const gap = 4;
  const max = Math.max(...points.map((p) => p.value), 1);
  const bw = (w - gap * (points.length + 1)) / Math.max(points.length, 1);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("w-full", className)} style={{ height }} role="img">
      {points.map((p, i) => {
        const bh = ((h - 6) * p.value) / max;
        return (
          <rect key={i} x={gap + i * (bw + gap)} y={h - bh} width={bw} height={bh} rx="2" fill={color} opacity="0.85">
            <title>{`${p.label}: ${format(p.value)}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}

interface HBarListProps {
  rows: Array<{ label: string; value: number; caption?: string }>;
  format?: (v: number) => string;
  color?: string;
  className?: string;
}

export function HBarList({ rows, format = String, color = "var(--color-primary)", className }: HBarListProps) {
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <ul className={cn("space-y-2.5", className)}>
      {rows.map((r, i) => (
        <li key={i}>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="truncate text-ink">{r.label}</span>
            <span className="tabular shrink-0 text-ink-soft">{r.caption ?? format(r.value)}</span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-line/60">
            <div className="h-full rounded-full" style={{ width: `${(r.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

export function Sparkline({ values, className, color = "var(--color-primary)" }: { values: number[]; className?: string; color?: string }) {
  const w = 100;
  const h = 28;
  const max = Math.max(...values, 1);
  const step = w / Math.max(values.length - 1, 1);
  const d = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - (v / max) * (h - 4) - 2).toFixed(1)}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={cn("h-7 w-24", className)} aria-hidden>
      <path d={d} fill="none" stroke={color} strokeWidth="1.75" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** First / last label under a chart. */
export function ChartAxis({ points }: { points: ChartPoint[] }) {
  if (points.length === 0) return null;
  return (
    <div className="mt-2 flex justify-between text-xs text-ink-soft">
      <span>{points[0].label}</span>
      <span>{points[points.length - 1].label}</span>
    </div>
  );
}
