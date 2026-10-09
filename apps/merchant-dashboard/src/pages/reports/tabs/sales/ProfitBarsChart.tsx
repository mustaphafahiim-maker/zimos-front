import { useLayoutEffect, useState } from "react";

export interface ProfitBarPoint {
  label: string;
  value: number;
}

const AXIS_CLASS = "fill-[var(--color-ink-soft)] text-xs";

/**
 * The figure's own width in CSS pixels, kept current as the card resizes (the
 * same measure components/charts.tsx takes; it is not exported there).
 */
function useChartWidth(fallback: number) {
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    if (!frame) return;
    const measure = () => {
      // Zero means the box is not laid out: keep the last width.
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

/**
 * Net profit per day, in the style of components/charts.tsx (plain SVG, brand
 * tokens, one unit to one pixel, a `<title>` per mark, a left-to-right time
 * axis) — with the one thing `BarChart` cannot draw: a day that LOST money. A
 * profit rises from the zero line in the brand colour; a loss hangs below it
 * in red, so a bad day is no longer drawn as an empty one. Position carries
 * the meaning as well as colour, and every bar names its day and amount.
 */
export function ProfitBarsChart({
  points,
  format,
  height = 180,
  summary,
  className,
}: {
  points: ReadonlyArray<ProfitBarPoint>;
  /** Turns a value into the text of a tooltip and of the peak label. */
  format: (value: number) => string;
  height?: number;
  /** Sentence describing the whole figure, for screen readers. */
  summary: string;
  className?: string;
}) {
  const [frameRef, width] = useChartWidth(600);
  if (points.length === 0) return null;

  const padTop = 18;
  const padBottom = 20;
  const plot = height - padTop - padBottom;
  const values = points.map((point) => (Number.isFinite(point.value) ? point.value : 0));
  const max = Math.max(0, ...values);
  const min = Math.min(0, ...values);
  const span = max - min || 1;
  /** Where zero sits: at the bottom when nothing lost money, part-way up otherwise. */
  const zero = padTop + (max / span) * plot;
  const slot = width / points.length;
  const barWidth = Math.max(1, slot - 2);
  const radius = Math.min(4, barWidth / 2);
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
        {points.map((point, index) => {
          const value = values[index];
          const size = (Math.abs(value) / span) * plot;
          const x = index * slot + 1;
          const end = x + barWidth;
          const r = Math.min(radius, size);
          const up = value >= 0;
          // The data end of the bar: above the zero line for a profit, below it for a loss.
          const tip = up ? zero - size : zero + size;
          const inner = up ? tip + r : tip - r;
          // Rounded at the data end, square where it meets the zero line.
          const d =
            size <= 0
              ? ""
              : `M${x},${zero} L${x},${inner} Q${x},${tip} ${x + r},${tip} L${end - r},${tip} Q${end},${tip} ${end},${inner} L${end},${zero} Z`;
          return (
            <g key={`${point.label}:${index}`}>
              {d && <path d={d} fill={up ? "var(--color-primary)" : "var(--color-danger)"} />}
              <rect x={x} y={padTop} width={barWidth} height={plot} fill="transparent">
                <title>{`${point.label}: ${format(value)}`}</title>
              </rect>
            </g>
          );
        })}
        <line x1="0" x2={width} y1={zero} y2={zero} stroke="var(--color-line-strong)" strokeWidth="1" />
        {max > 0 && (
          <text x="0" y="12" className={AXIS_CLASS}>
            {format(max)}
          </text>
        )}
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
