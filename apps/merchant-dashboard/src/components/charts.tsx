/**
 * The dashboard's three chart shapes, as plain inline SVG.
 *
 * No charting library: these are small, single-series figures and a dependency
 * would cost more than it saves. Rules they all follow:
 *
 * - One series each, so there is no legend and no categorical palette — the
 *   card title names what is plotted and the colour is a brand token, which
 *   means dark mode is handled by the tokens rather than by a second palette.
 * - Marks are thin, grid and axis lines are recessive, and values are written
 *   in ink tokens, never in the series colour.
 * - Every mark carries a `<title>`, so hovering (and a screen reader) gives the
 *   exact value instead of making the merchant read it off an axis.
 * - Each figure sets `dir="ltr"` on itself: a time axis runs left-to-right in
 *   Arabic too, and no caller has to remember to wrap it.
 * - A figure is drawn at its own width, one SVG unit to one CSS pixel, so axis
 *   text is the same 12px on a phone as on a desktop.
 */
import { useId, useLayoutEffect, useState, type MouseEvent, type ReactNode } from "react";
import { cn } from "@store-builder/ui";

export interface ChartPoint {
  label: string;
  value: number;
}

const AXIS_CLASS = "fill-[var(--color-ink-soft)] text-xs";

/** About how wide a piece of axis text is — enough to size a gutter and to tell when two labels would touch. */
const textWidth = (text: string) => Math.ceil(text.length * 6.5);

/** Room beside the plot for its value labels: as wide as the longest one, within reason. */
const gutterFor = (labels: string[]) => Math.min(88, Math.max(40, ...labels.map((label) => textWidth(label) + 10)));

/**
 * The figure's own width in CSS pixels, kept current as the card resizes.
 * `fallback` is drawn until the box has been measured.
 */
function useChartWidth(fallback: number) {
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    if (!frame) return;
    const measure = () => {
      // Zero means the box is not laid out (a hidden tab): keep the last width.
      if (frame.clientWidth > 0) setWidth(Math.max(240, frame.clientWidth));
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [frame]);
  return [setFrame, width] as const;
}

/** The inks a sparkline is drawn in: the brand, good news, bad news, or secondary ink. */
export type SparklineTone = "primary" | "success" | "danger" | "neutral";

const SPARK_INK: Record<SparklineTone, string> = {
  primary: "var(--color-primary)",
  success: "var(--color-success)",
  danger: "var(--color-danger)",
  neutral: "var(--color-ink-soft)",
};

/** A sparkline is drawn 120 units wide and stretched to its box; its strokes do not stretch with it. */
const SPARK_WIDTH = 120;
/** How far past the last point a bleeding wash runs on, for the card around it to clip. */
const SPARK_OVERHANG = 80;

interface SparkPoint {
  x: number;
  y: number;
}

/**
 * Slopes for a curve that passes through every point and never overshoots one
 * (monotone cubic). A trend may be smoothed, but it must not dip under zero or
 * rise over its peak between two days. Needs three points or more.
 */
function sparkTangents(points: SparkPoint[]): number[] {
  const count = points.length;
  const slope = (a: SparkPoint, b: SparkPoint) => (b.y - a.y) / (b.x - a.x);
  const tangents = new Array<number>(count).fill(0);
  for (let i = 1; i < count - 1; i++) {
    const h0 = points[i].x - points[i - 1].x;
    const h1 = points[i + 1].x - points[i].x;
    const s0 = slope(points[i - 1], points[i]);
    const s1 = slope(points[i], points[i + 1]);
    const p = (s0 * h1 + s1 * h0) / (h0 + h1);
    tangents[i] = (Math.sign(s0) + Math.sign(s1)) * Math.min(Math.abs(s0), Math.abs(s1), 0.5 * Math.abs(p)) || 0;
  }
  tangents[0] = (3 * slope(points[0], points[1]) - tangents[1]) / 2;
  tangents[count - 1] = (3 * slope(points[count - 2], points[count - 1]) - tangents[count - 2]) / 2;
  return tangents;
}

/** The path through a series: straight between two points, a smooth curve through three or more. */
function sparkPath(points: SparkPoint[]): string {
  if (points.length === 0) return "";
  const at = (p: SparkPoint) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`;
  if (points.length < 3) return points.map((p, i) => `${i === 0 ? "M" : "L"}${at(p)}`).join(" ");
  const tangents = sparkTangents(points);
  let d = `M${at(points[0])}`;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const third = (b.x - a.x) / 3;
    d += ` C${(a.x + third).toFixed(2)},${(a.y + third * tangents[i - 1]).toFixed(2)} ${(b.x - third).toFixed(2)},${(b.y - third * tangents[i]).toFixed(2)} ${at(b)}`;
  }
  return d;
}

/**
 * The tiny trend inside a metric tile: this period as a 2px line with a wash
 * under it and a dot on its last point, the period before it thin and dashed.
 * Decorative: the value and the change on the tile carry the numbers.
 *
 * The figure is stretched to its box (`w-full` unless the caller sizes it), and
 * the strokes keep their thickness while it stretches. A single value, an empty
 * series or one that is all zeros draws a flat baseline.
 */
export function Sparkline({
  current,
  previous,
  height = 32,
  className,
  area = true,
  tone = "primary",
  bleed = false,
}: {
  current: number[];
  previous?: number[] | null;
  height?: number;
  className?: string;
  /** The wash under the line of this period: the colour of the line, fading out towards the baseline. */
  area?: boolean;
  /** The ink of the line: the brand, green or red for good or bad news, or secondary ink. */
  tone?: SparklineTone;
  /**
   * For a card that clips the figure at its own edges (KpiCard): the line starts
   * on the start edge, the wash runs on past the last point for the card to cut,
   * and the baseline sits a little above the bottom so a day at zero still shows.
   * The caller leaves room after the figure for the dot (padding on its wrapper).
   */
  bleed?: boolean;
}) {
  const gradientId = `spark-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const ink = SPARK_INK[tone];
  const padX = bleed ? 0 : 2;
  const padTop = bleed ? 6 : 2;
  const padBottom = bleed ? 9 : 2;

  // Anything that is not a number counts as zero, so the path never holds a NaN.
  const clean = (values: number[] | null | undefined) => (values ?? []).map((v) => (Number.isFinite(v) ? v : 0));
  const now = clean(current);
  const before = clean(previous);
  const all = [...now, ...before];
  const min = Math.min(0, ...all);
  const max = Math.max(0, ...all);
  const range = max - min;
  const baseline = Math.max(padTop, height - padBottom);
  const plot = baseline - padTop;
  const y = (value: number) => (range > 0 ? padTop + plot * (1 - (value - min) / range) : baseline);
  const startX = padX;
  const endX = SPARK_WIDTH - padX;
  const place = (values: number[]): SparkPoint[] =>
    values.length > 1
      ? values.map((value, i) => ({ x: startX + ((endX - startX) * i) / (values.length - 1), y: y(value) }))
      : [
          { x: startX, y: baseline },
          { x: endX, y: baseline },
        ];

  const points = place(now);
  const first = points[0];
  const last = points[points.length - 1];
  const line = sparkPath(points);
  // Nothing rises off the baseline: there is no shape to fill.
  const flat = now.length < 2 || range === 0;
  const washEnd = bleed ? SPARK_WIDTH + SPARK_OVERHANG : last.x;
  const wash = `${line} L${washEnd.toFixed(2)},${last.y.toFixed(2)} L${washEnd.toFixed(2)},${height} L${first.x.toFixed(2)},${height} Z`;
  // A zero-length stroke with round caps is a round dot that stays round while the figure stretches.
  // Smaller in a tile, where the whole figure is a few dozen pixels wide.
  const dotSize = bleed ? 5 : 4;
  const dot = `M${last.x.toFixed(2)},${last.y.toFixed(2)} l0.001,0`;

  return (
    <svg
      viewBox={`0 0 ${SPARK_WIDTH} ${height}`}
      className={cn("h-8 w-full overflow-visible", className)}
      preserveAspectRatio="none"
      direction="ltr"
      data-slot="sparkline"
      data-tone={tone}
      aria-hidden
    >
      {area && !flat && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              {/* 22% at the line, nothing at the baseline: about 12% over the whole shape. The glass layer may deepen it. */}
              <stop offset="0%" stopColor={ink} style={{ stopOpacity: "var(--spark-wash, 0.22)" }} />
              <stop offset="100%" stopColor={ink} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={wash} fill={`url(#${gradientId})`} stroke="none" />
        </>
      )}
      {/* The period before: recessive, behind this one. One value is not a trend, so it draws nothing. */}
      {before.length > 1 && (
        <path
          d={sparkPath(place(before))}
          fill="none"
          stroke="var(--color-ink-soft)"
          strokeOpacity="0.7"
          strokeWidth="1"
          strokeDasharray="3 3"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <path
        d={line}
        fill="none"
        stroke={ink}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* Where the period stands now: a dot on the last point, with a soft halo. */}
      <path d={dot} fill="none" stroke={ink} strokeOpacity="0.2" strokeWidth={dotSize * 2} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path d={dot} fill="none" stroke={ink} strokeWidth={dotSize} strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export interface ComparePoint {
  label: string;
  value: number;
  /** Same position in the period before; null when that window wasn't loaded. */
  previous: number | null;
  previousLabel?: string;
}

/**
 * This period against the one before it: a solid line over a faint fill, and
 * the comparison dashed. Hovering shows both values for that day.
 */
export function ComparisonLineChart({
  points,
  format,
  formatAxis = format,
  height = 240,
  className,
  summary,
  currentLabel,
  previousLabel,
}: {
  points: ComparePoint[];
  format: (value: number) => string;
  formatAxis?: (value: number) => string;
  height?: number;
  className?: string;
  summary: string;
  currentLabel: string;
  previousLabel: string;
}) {
  const gradientId = useId();
  const [hover, setHover] = useState<number | null>(null);
  const [frameRef, width] = useChartWidth(640);
  const padEnd = 12;
  const padTop = 12;
  const padBottom = 24;
  const plotH = height - padTop - padBottom;

  const values = points.flatMap((p) => [p.value, p.previous ?? 0]);
  if (points.length === 0 || values.every((v) => v === 0)) {
    return <EmptyPlot height={height} className={className} label={summary} />;
  }

  const max = Math.max(...values);
  const gridSteps = [0, 0.25, 0.5, 0.75, 1];
  const padStart = gutterFor(gridSteps.map((g) => formatAxis(max * g)));
  const plotW = width - padStart - padEnd;
  const step = points.length > 1 ? plotW / (points.length - 1) : 0;
  const x = (i: number) => (points.length > 1 ? padStart + i * step : padStart + plotW / 2);
  const y = (v: number) => padTop + plotH - (v / max) * plotH;
  const linePath = (pick: (p: ComparePoint) => number | null) =>
    points
      .map((p, i) => {
        const v = pick(p);
        return v === null ? null : `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      })
      .filter(Boolean)
      .join(" ");
  const current = linePath((p) => p.value);
  const area = `${current} L${x(points.length - 1).toFixed(1)},${padTop + plotH} L${x(0).toFixed(1)},${padTop + plotH} Z`;
  const hasPrevious = points.some((p) => p.previous !== null);
  const previous = hasPrevious ? linePath((p) => p.previous) : "";
  const last = points.length - 1;
  const mid = Math.floor(last / 2);
  const tickWidth = (i: number) => textWidth(points[i].label);
  // The middle date only where it clears the two at the ends: on a phone, hourly labels do not.
  const midFits = Math.max(tickWidth(0), tickWidth(last)) + tickWidth(mid) / 2 + 10 <= plotW / 2;
  const ticks = (midFits ? [0, mid, last] : [0, last]).filter((i, k, arr) => arr.indexOf(i) === k);

  const onMove = (event: MouseEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - box.left) / box.width;
    const px = ratio * width - padStart;
    const index = step > 0 ? Math.round(px / step) : 0;
    setHover(Math.min(last, Math.max(0, index)));
  };

  const point = hover === null ? null : points[hover];
  const tipStart = hover !== null && hover > last / 2;

  return (
    <div ref={frameRef} dir="ltr" className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full"
        style={{ height }}
        role="img"
        aria-label={summary}
        preserveAspectRatio="none"
        onMouseMove={onMove}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridSteps.map((g) => (
          <g key={g}>
            <line
              x1={padStart}
              x2={width - padEnd}
              y1={y(max * g)}
              y2={y(max * g)}
              stroke="var(--color-line)"
              strokeWidth="1"
              strokeDasharray={g === 0 ? undefined : "2 4"}
            />
            <text x={padStart - 6} y={y(max * g) + 4} textAnchor="end" className={AXIS_CLASS}>
              {formatAxis(max * g)}
            </text>
          </g>
        ))}
        <path d={area} fill={`url(#${gradientId})`} />
        {previous && (
          <path
            d={previous}
            fill="none"
            stroke="var(--color-line-strong)"
            strokeWidth="1.5"
            strokeDasharray="4 4"
            vectorEffect="non-scaling-stroke"
          />
        )}
        <path
          d={current}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        {point && hover !== null && (
          <g>
            <line
              x1={x(hover)}
              x2={x(hover)}
              y1={padTop}
              y2={padTop + plotH}
              stroke="var(--color-line-strong)"
              strokeWidth="1"
            />
            {point.previous !== null && (
              <circle cx={x(hover)} cy={y(point.previous)} r="3.5" fill="var(--color-paper-raised)" stroke="var(--color-line-strong)" strokeWidth="1.5" />
            )}
            <circle cx={x(hover)} cy={y(point.value)} r="4" fill="var(--color-primary)" />
          </g>
        )}
        {ticks.map((i) => (
          <text
            key={i}
            x={x(i)}
            y={height - 6}
            textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"}
            className={AXIS_CLASS}
          >
            {points[i].label}
          </text>
        ))}
      </svg>
      {point && (
        <div
          className={cn(
            "pointer-events-none absolute top-2 z-10 min-w-40 rounded-[0.5rem] border border-line bg-paper-raised p-2.5 text-xs shadow-md",
            tipStart ? "start-14" : "end-3"
          )}
          dir="auto"
        >
          <p className="mb-1.5 font-medium text-ink">{point.label}</p>
          <p className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-ink-soft">
              <span aria-hidden className="inline-block h-0.5 w-3 rounded bg-primary" />
              {currentLabel}
            </span>
            <span className="tabular-nums font-medium text-ink">
              <bdi dir="ltr">{format(point.value)}</bdi>
            </span>
          </p>
          {point.previous !== null && (
            <p className="mt-1 flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-ink-soft">
                <span aria-hidden className="inline-block h-0 w-3 border-t border-dashed border-line-strong" />
                {point.previousLabel ?? previousLabel}
              </span>
              <span className="tabular-nums text-ink-soft">
                <bdi dir="ltr">{format(point.previous)}</bdi>
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/** Nothing to draw — every value is zero, or there are no points at all. */
function isFlat(points: ChartPoint[]): boolean {
  return points.length === 0 || points.every((p) => p.value === 0);
}

interface AxisProps {
  points: ChartPoint[];
  /** Turns a value into the text shown in tooltips and on the max label. */
  format: (value: number) => string;
  height?: number;
  className?: string;
  /** Sentence describing the whole figure, for screen readers. */
  summary: string;
}

/**
 * Revenue-over-time: a 2px line over a faint fill. Only the peak is labelled —
 * a number on every point is noise at 30+ days.
 */
export function LineAreaChart({ points, format, height = 200, className, summary }: AxisProps) {
  const gradientId = useId();
  const [frameRef, width] = useChartWidth(600);
  const padTop = 18;
  const padBottom = 20;
  const plot = height - padTop - padBottom;

  if (isFlat(points)) return <EmptyPlot height={height} className={className} label={summary} />;

  const max = Math.max(...points.map((p) => p.value));
  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const x = (i: number) => (points.length > 1 ? i * step : width / 2);
  const y = (value: number) => padTop + plot - (value / max) * plot;

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ");
  const area = `${line} L${x(points.length - 1).toFixed(1)},${padTop + plot} L${x(0).toFixed(1)},${padTop + plot} Z`;
  const peak = points.reduce((best, p, i) => (p.value > points[best].value ? i : best), 0);
  const last = points.length - 1;

  return (
    <div ref={frameRef} dir="ltr" className={className}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full"
        style={{ height }}
        role="img"
        aria-label={summary}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* Baseline only: a full grid would compete with a line this thin. */}
        <line
          x1="0"
          x2={width}
          y1={padTop + plot}
          y2={padTop + plot}
          stroke="var(--color-line)"
          strokeWidth="1"
        />
        <path d={area} fill={`url(#${gradientId})`} />
        <path
          d={line}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
        <circle cx={x(last)} cy={y(points[last].value)} r="4" fill="var(--color-primary)" />
        <text
          x={Math.min(width - 4, Math.max(4, x(peak)))}
          y={Math.max(12, y(points[peak].value) - 6)}
          textAnchor={peak > points.length / 2 ? "end" : "start"}
          className={AXIS_CLASS}
        >
          {format(points[peak].value)}
        </text>
        {/* Hit areas: wider than the line, so hovering anywhere near works. */}
        {points.map((p, i) => (
          <rect
            key={p.label}
            x={Math.max(0, x(i) - step / 2)}
            y={padTop}
            width={Math.max(step, 6)}
            height={plot}
            fill="transparent"
          >
            <title>{`${p.label}: ${format(p.value)}`}</title>
          </rect>
        ))}
        <text x="0" y={height - 6} className={AXIS_CLASS}>
          {points[0].label}
        </text>
        <text x={width} y={height - 6} textAnchor="end" className={AXIS_CLASS}>
          {points[last].label}
        </text>
      </svg>
    </div>
  );
}

/** Counts per day. Bars sit on the baseline with a rounded top and a 2px gap. */
export function BarChart({
  points,
  format,
  height = 200,
  className,
  summary,
  color = "var(--color-primary)",
}: AxisProps & { color?: string }) {
  const [frameRef, width] = useChartWidth(600);
  const padTop = 12;
  const padBottom = 20;
  const plot = height - padTop - padBottom;

  if (isFlat(points)) return <EmptyPlot height={height} className={className} label={summary} />;

  const max = Math.max(...points.map((p) => p.value));
  const slot = width / points.length;
  const barWidth = Math.max(1, slot - 2);
  const radius = Math.min(4, barWidth / 2);

  return (
    <div ref={frameRef} dir="ltr" className={className}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full"
        style={{ height }}
        role="img"
        aria-label={summary}
        preserveAspectRatio="none"
      >
        <line
          x1="0"
          x2={width}
          y1={padTop + plot}
          y2={padTop + plot}
          stroke="var(--color-line)"
          strokeWidth="1"
        />
        {points.map((p, i) => {
          const barHeight = max > 0 ? (p.value / max) * plot : 0;
          const x = i * slot + 1;
          const y = padTop + plot - barHeight;
          const r = Math.min(radius, barHeight);
          // Rounded at the data end, square where it meets the baseline.
          const d =
            barHeight <= 0
              ? ""
              : `M${x},${padTop + plot} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + barWidth - r},${y} Q${x + barWidth},${y} ${x + barWidth},${y + r} L${x + barWidth},${padTop + plot} Z`;
          return (
            <g key={p.label}>
              {d && <path d={d} fill={color} />}
              <rect x={x} y={padTop} width={barWidth} height={plot} fill="transparent">
                <title>{`${p.label}: ${format(p.value)}`}</title>
              </rect>
            </g>
          );
        })}
        <text x="0" y={height - 6} className={AXIS_CLASS}>
          {points[0].label}
        </text>
        <text x={width} y={height - 6} textAnchor="end" className={AXIS_CLASS}>
          {points[points.length - 1].label}
        </text>
      </svg>
    </div>
  );
}

export interface StackedPoint {
  label: string;
  /** The larger series (drawn as the back bar). */
  primary: number;
  /** The subset series (drawn in front). */
  secondary: number;
  comparisonPrimary?: number | null;
  comparisonSecondary?: number | null;
}

/**
 * Umami's traffic chart: views as the back bar, visitors in front, and the
 * comparison period as dashed lines. Hover shows every value for that bucket.
 */
export function StackedBarsChart({
  points,
  height = 260,
  className,
  summary,
  primaryLabel,
  secondaryLabel,
  comparisonLabel,
  format = (v) => String(v),
}: {
  points: StackedPoint[];
  height?: number;
  className?: string;
  summary: string;
  primaryLabel: string;
  secondaryLabel: string;
  comparisonLabel?: string;
  format?: (value: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const [frameRef, width] = useChartWidth(720);
  const padEnd = 12;
  const padTop = 12;
  const padBottom = 24;
  const plotH = height - padTop - padBottom;

  const values = points.flatMap((p) => [p.primary, p.comparisonPrimary ?? 0]);
  if (points.length === 0 || values.every((v) => v === 0)) {
    return <EmptyPlot height={height} className={className} label={summary} />;
  }
  const max = Math.max(...values, 1);
  const gridSteps = [0, 0.5, 1];
  const padStart = gutterFor(gridSteps.map((g) => format(Math.round(max * g))));
  const plotW = width - padStart - padEnd;
  const slot = plotW / points.length;
  const barW = Math.max(2, slot * 0.6);
  const x = (i: number) => padStart + i * slot + (slot - barW) / 2;
  const cx = (i: number) => padStart + i * slot + slot / 2;
  const y = (v: number) => padTop + plotH - (v / max) * plotH;
  const hasComparison = points.some((p) => p.comparisonPrimary !== null && p.comparisonPrimary !== undefined);
  const linePath = (pick: (p: StackedPoint) => number | null | undefined) =>
    points
      .map((p, i) => {
        const v = pick(p);
        return v === null || v === undefined ? null : `${i === 0 ? "M" : "L"}${cx(i).toFixed(1)},${y(v).toFixed(1)}`;
      })
      .filter(Boolean)
      .join(" ");
  const last = points.length - 1;
  const quarters = [0, Math.floor(last / 4), Math.floor(last / 2), Math.floor((3 * last) / 4), last];
  const tickRoom = Math.max(...quarters.map((i) => textWidth(points[i].label))) + 10;
  // Five dates where they fit side by side, three on a narrow plot, else only the two ends.
  const tickEvery = plotW / 4 >= tickRoom ? 1 : plotW / 2 >= tickRoom ? 2 : 4;
  const ticks = quarters.filter((_, k) => k % tickEvery === 0).filter((v, i, a) => a.indexOf(v) === i);
  const point = hover === null ? null : points[hover];
  const tipStart = hover !== null && hover > last / 2;

  return (
    <div ref={frameRef} dir="ltr" className={cn("relative", className)}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="block w-full"
        style={{ height }}
        role="img"
        aria-label={summary}
        preserveAspectRatio="none"
        onMouseMove={(event) => {
          const box = event.currentTarget.getBoundingClientRect();
          const px = ((event.clientX - box.left) / box.width) * width - padStart;
          setHover(Math.min(last, Math.max(0, Math.floor(px / slot))));
        }}
        onMouseLeave={() => setHover(null)}
      >
        {gridSteps.map((g) => (
          <g key={g}>
            <line x1={padStart} x2={width - padEnd} y1={y(max * g)} y2={y(max * g)} stroke="var(--color-line)" strokeWidth="1" strokeDasharray={g === 0 ? undefined : "2 4"} />
            <text x={padStart - 6} y={y(max * g) + 4} textAnchor="end" className={AXIS_CLASS}>
              {format(Math.round(max * g))}
            </text>
          </g>
        ))}
        {points.map((p, i) => (
          <g key={p.label}>
            <rect x={x(i)} y={y(p.primary)} width={barW} height={Math.max(0, padTop + plotH - y(p.primary))} rx="2" fill="var(--color-primary)" fillOpacity={hover === i ? 0.35 : 0.25} />
            <rect x={x(i)} y={y(p.secondary)} width={barW} height={Math.max(0, padTop + plotH - y(p.secondary))} rx="2" fill="var(--color-primary)" fillOpacity={hover === i ? 1 : 0.85} />
          </g>
        ))}
        {hasComparison && (
          <>
            <path d={linePath((p) => p.comparisonPrimary)} fill="none" stroke="var(--color-line-strong)" strokeWidth="1.5" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            <path d={linePath((p) => p.comparisonSecondary)} fill="none" stroke="var(--color-ink-soft)" strokeWidth="1.5" strokeDasharray="2 4" vectorEffect="non-scaling-stroke" />
          </>
        )}
        {/* The last date is held inside the figure: centred on a thin bar at the edge, it would be cut. */}
        {ticks.map((i) => (
          <text
            key={i}
            x={Math.min(cx(i), width - textWidth(points[i].label) / 2)}
            y={height - 6}
            textAnchor="middle"
            className={AXIS_CLASS}
          >
            {points[i].label}
          </text>
        ))}
      </svg>
      {point && (
        <div
          className={cn(
            "pointer-events-none absolute top-2 z-10 min-w-44 rounded-[0.5rem] border border-line bg-paper-raised p-2.5 text-xs shadow-md",
            tipStart ? "start-12" : "end-3"
          )}
          dir="auto"
        >
          <p className="mb-1.5 font-medium text-ink">{point.label}</p>
          <p className="flex items-center justify-between gap-4">
            <span className="text-ink-soft">{primaryLabel}</span>
            <span className="tabular-nums font-medium text-ink">{format(point.primary)}</span>
          </p>
          <p className="mt-0.5 flex items-center justify-between gap-4">
            <span className="text-ink-soft">{secondaryLabel}</span>
            <span className="tabular-nums font-medium text-ink">{format(point.secondary)}</span>
          </p>
          {hasComparison && comparisonLabel && (
            <p className="mt-1 flex items-center justify-between gap-4 border-t border-line pt-1">
              <span className="text-ink-soft">{comparisonLabel}</span>
              <span className="tabular-nums text-ink-soft">
                {format(point.comparisonPrimary ?? 0)} / {format(point.comparisonSecondary ?? 0)}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export interface HBarRow {
  label: string;
  value: number;
  /** Small line under the label, e.g. "12 units · EGP 3,400". */
  caption?: string;
}

/**
 * Ranked rows — order status, top products. Not an SVG: it is a list with a
 * proportional track behind each row, so every value is also plain text and
 * the whole thing reads as a table without a chart-specific fallback.
 */
export function HBarList({
  rows,
  format,
  className,
  emptyLabel,
}: {
  rows: HBarRow[];
  format?: (value: number) => string;
  className?: string;
  emptyLabel?: ReactNode;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <>{emptyLabel ?? null}</>;
  return (
    <ul className={cn("space-y-2.5", className)}>
      {rows.map((row) => (
        <li key={row.label}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 truncate text-sm text-ink" dir="auto">
              {row.label}
            </span>
            <span className="tabular-nums shrink-0 text-sm font-medium text-ink">
              <bdi dir="ltr">{format ? format(row.value) : row.value}</bdi>
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-paper">
            <div
              className="h-full rounded-full bg-primary"
              style={{ width: `${Math.round((row.value / max) * 100)}%` }}
            />
          </div>
          {row.caption && (
            <p className="mt-0.5 text-xs text-ink-soft" dir="auto">
              {row.caption}
            </p>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Keeps the card the same height when the range has no activity in it. */
function EmptyPlot({
  height,
  className,
  label,
}: {
  height: number;
  className?: string;
  label: string;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      style={{ height }}
      className={cn(
        "flex items-center justify-center rounded-[0.5rem] border border-dashed border-line text-xs text-ink-soft",
        className
      )}
    >
      {label}
    </div>
  );
}
