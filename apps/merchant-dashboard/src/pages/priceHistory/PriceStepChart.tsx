import { useLayoutEffect, useState, type MouseEvent } from "react";
import type { PriceHistoryChange } from "@store-builder/api-client";
import { parseMoney } from "@/lib/format";

/**
 * A price over time as a step line: the price holds, then jumps at each
 * change — never a slope between two prices that were never charged. The
 * compare-at price rides along as a dashed grey line (the same pairing as the
 * dashboard's comparison chart: the subject in the brand colour, the context
 * in grey and dashed, so it never rests on colour alone).
 *
 * Drawn like components/charts.tsx: plain SVG at one unit per pixel, brand
 * tokens for the marks, ink tokens for the text, `dir="ltr"` for the time
 * axis, recessive solid grid lines. Hovering finds the nearest change and
 * reads both values; the list of changes under the chart is the same data as
 * a table, so nothing is reachable by hover alone.
 */

const AXIS_CLASS = "fill-[var(--color-ink-soft)] text-xs";
const textWidth = (text: string) => Math.ceil(text.length * 6.5);

function useChartWidth(fallback: number) {
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    if (!frame) return;
    const measure = () => {
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

/** A round step (1, 2, 2.5, 5 × 10ⁿ) near `rough`, so the grid lines land on clean amounts. */
function niceStep(rough: number): number {
  if (!(rough > 0)) return 1;
  const power = 10 ** Math.floor(Math.log10(rough));
  const unit = rough / power;
  return (unit <= 1 ? 1 : unit <= 2 ? 2 : unit <= 2.5 ? 2.5 : unit <= 5 ? 5 : 10) * power;
}

interface Point {
  /** ms since the epoch */
  at: number;
  /** The change's own time, as the API sent it. */
  iso: string;
  price: number;
  compareAt: number | null;
}

export function PriceStepChart({
  changes,
  formatMoney,
  formatDate,
  formatDateTime,
  priceLabel,
  compareAtLabel,
  summary,
  height = 220,
}: {
  /** Oldest first, at least one. */
  changes: PriceHistoryChange[];
  /** Minor units → the dashboard's money text. */
  formatMoney: (minor: number) => string;
  formatDate: (iso: string) => string;
  formatDateTime: (iso: string) => string;
  priceLabel: string;
  compareAtLabel: string;
  /** A sentence describing the figure, for screen readers. */
  summary: string;
  height?: number;
}) {
  const [frameRef, width] = useChartWidth(640);
  const [hover, setHover] = useState<number | null>(null);

  const points: Point[] = changes
    .map((c) => ({
      at: new Date(c.changedAt).getTime(),
      iso: c.changedAt,
      price: parseMoney(c.priceAmount),
      compareAt: c.compareAtAmount === null ? null : parseMoney(c.compareAtAmount),
    }))
    .filter((p) => Number.isFinite(p.at));
  if (points.length === 0) return null;

  const now = Math.max(Date.now(), points[points.length - 1].at);
  // The axis runs from the first recorded price to now; a price set a moment ago still gets a line to stand on.
  const start = points[0].at;
  const span = Math.max(now - start, 60_000);

  const values = points.flatMap((p) => (p.compareAt === null ? [p.price] : [p.price, p.compareAt]));
  const low = Math.min(...values);
  const high = Math.max(...values);
  const step = niceStep((high - low || high || 100) / 3);
  const floor = Math.max(0, Math.floor((low - step * 0.25) / step) * step);
  const ceiling = Math.max(floor + step, Math.ceil((high + step * 0.25) / step) * step);
  const ticks: number[] = [];
  for (let v = floor; v <= ceiling + step / 1000; v += step) ticks.push(v);

  const padTop = 12;
  const padBottom = 24;
  const padEnd = 12;
  const padStart = Math.min(96, Math.max(44, ...ticks.map((v) => textWidth(formatMoney(v)) + 10)));
  const plotW = Math.max(40, width - padStart - padEnd);
  const plotH = height - padTop - padBottom;
  const x = (at: number) => padStart + ((at - start) / span) * plotW;
  const y = (value: number) => padTop + plotH - ((value - floor) / (ceiling - floor)) * plotH;

  /** Hold each value until the next change, then step; a missing value lifts the pen. */
  const stepPath = (pick: (p: Point) => number | null) => {
    let d = "";
    let drawing = false;
    points.forEach((p, i) => {
      const value = pick(p);
      const until = i < points.length - 1 ? points[i + 1].at : now;
      if (value === null) {
        drawing = false;
        return;
      }
      d += `${drawing ? "V" : `M${x(p.at).toFixed(1)},`}${y(value).toFixed(1)} H${x(until).toFixed(1)} `;
      drawing = true;
    });
    return d.trim();
  };
  const pricePath = stepPath((p) => p.price);
  const comparePath = stepPath((p) => p.compareAt);
  const last = points[points.length - 1];

  const onMove = (event: MouseEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const at = start + (((event.clientX - box.left) / box.width) * width - padStart) / plotW * span;
    // The change in force at that moment: the last one at or before it.
    let index = 0;
    for (let i = 0; i < points.length; i++) if (points[i].at <= at) index = i;
    setHover(index);
  };
  const point = hover === null ? null : points[hover];
  const hoverX = point ? x(point.at) : 0;
  // Under two days the ends of the axis need their hour, or both would name the same day.
  const axisLabel = span < 2 * 86_400_000 ? formatDateTime : formatDate;
  const firstLabel = axisLabel(points[0].iso);
  const lastLabel = axisLabel(new Date(now).toISOString());

  return (
    <div ref={frameRef} dir="ltr" className="relative">
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
        {ticks.map((value) => (
          <g key={value}>
            <line x1={padStart} x2={width - padEnd} y1={y(value)} y2={y(value)} stroke="var(--color-line)" strokeWidth="1" />
            <text x={padStart - 6} y={y(value) + 4} textAnchor="end" className={AXIS_CLASS}>
              {formatMoney(value)}
            </text>
          </g>
        ))}
        {comparePath && (
          <path d={comparePath} fill="none" stroke="var(--color-line-strong)" strokeWidth="1.5" strokeDasharray="5 4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
        )}
        <path d={pricePath} fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {point && (
          <g>
            <line x1={hoverX} x2={hoverX} y1={padTop} y2={padTop + plotH} stroke="var(--color-line-strong)" strokeWidth="1" />
            {point.compareAt !== null && (
              <circle cx={hoverX} cy={y(point.compareAt)} r="4" fill="var(--color-paper-raised)" stroke="var(--color-line-strong)" strokeWidth="1.5" />
            )}
            <circle cx={hoverX} cy={y(point.price)} r="5" fill="var(--color-primary)" stroke="var(--color-paper-raised)" strokeWidth="2" />
          </g>
        )}
        {/* Where the price stands today: the one mark the eye should land on. */}
        <circle cx={x(now)} cy={y(last.price)} r="5" fill="var(--color-primary)" stroke="var(--color-paper-raised)" strokeWidth="2" />
        <text x={padStart} y={height - 6} textAnchor="start" className={AXIS_CLASS}>
          {firstLabel}
        </text>
        {textWidth(firstLabel) + textWidth(lastLabel) + 24 < plotW && (
          <text x={width - padEnd} y={height - 6} textAnchor="end" className={AXIS_CLASS}>
            {lastLabel}
          </text>
        )}
      </svg>
      {point && (
        // The box is placed by the figure's own left-to-right frame (away from the pointer's half);
        // its text then takes its own direction.
        <div className={`pointer-events-none absolute top-2 z-10 ${hoverX > padStart + plotW / 2 ? "start-14" : "end-3"}`}>
        <div className="min-w-44 rounded-[0.5rem] border border-line bg-paper-raised p-2.5 text-xs shadow-md" dir="auto">
          <p className="mb-1.5 font-medium text-ink">{formatDateTime(point.iso)}</p>
          <p className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 text-ink-soft">
              <span aria-hidden className="inline-block h-0.5 w-3 rounded bg-primary" />
              {priceLabel}
            </span>
            <span className="tabular-nums font-medium text-ink">
              <bdi dir="ltr">{formatMoney(point.price)}</bdi>
            </span>
          </p>
          {point.compareAt !== null && (
            <p className="mt-1 flex items-center justify-between gap-4">
              <span className="flex items-center gap-1.5 text-ink-soft">
                <span aria-hidden className="inline-block h-0 w-3 border-t border-dashed border-line-strong" />
                {compareAtLabel}
              </span>
              <span className="tabular-nums text-ink-soft">
                <bdi dir="ltr">{formatMoney(point.compareAt)}</bdi>
              </span>
            </p>
          )}
        </div>
        </div>
      )}
    </div>
  );
}
