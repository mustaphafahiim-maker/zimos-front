import { useLayoutEffect, useState } from "react";
import { cn } from "@store-builder/ui";

/** One minute of the store: who was on it and how many pages they opened. */
export interface MinutePoint {
  /** The start of the minute (ISO): the React key. */
  key: string;
  /** The minute as the clock shows it («٩:٤١ م»). */
  label: string;
  visitors: number;
  views: number;
}

interface MinuteChartProps {
  points: MinutePoint[];
  /** The height to fill, in px (the chart card names it). */
  height: number;
  /** A sentence for the whole figure, for screen readers. */
  summary: string;
  /** A count in the viewer's digits. */
  format: (value: number) => string;
  /** One minute in words — «٩:٤١ م: ٣ زوار · ٧ مشاهدات» — for the line above the bars and for each bar's title. */
  describe: (point: MinutePoint) => string;
  /** Under the last bar, the minute that is still running: «دلوقتي». */
  nowLabel: string;
  className?: string;
}

const AXIS_CLASS = "fill-[var(--color-ink-soft)] text-xs";
const VALUE_CLASS = "fill-[var(--color-ink)] text-xs font-semibold tabular-nums";

/** Room for the line that reads out one minute, above the bars. */
const READOUT = 28;
const PAD_TOP = 18;
const PAD_BOTTOM = 22;

/** The figure's own width in CSS pixels, kept current as the card resizes (as components/charts.tsx measures). */
function useChartWidth(fallback: number) {
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    if (!frame) return;
    const measure = () => {
      // Zero means the box is not laid out (a folded section): keep the last width.
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
 * The store minute by minute: one bar per minute for the visitors on it, the
 * number written on top (there are only a handful of bars, so every one can
 * carry its figure — nothing waits for a pointer), the running minute in full
 * colour and named «دلوقتي».
 *
 * A line above the bars reads one minute out in words, visitors and page views
 * together: the running minute by default, any other one when its bar is
 * pressed or pointed at. So the page views of a minute are one tap away on a
 * phone, where a `<title>` never shows.
 *
 * Plain SVG in the style of components/charts.tsx: brand token for the marks,
 * ink tokens for the text, a `<title>` per bar, drawn at its own width, and
 * `dir="ltr"` — time runs left to right in Arabic too.
 */
export function MinuteChart({ points, height, summary, format, describe, nowLabel, className }: MinuteChartProps) {
  const [frameRef, width] = useChartWidth(600);
  const [picked, setPicked] = useState<string | null>(null);

  if (points.length === 0) return null;

  const last = points.length - 1;
  // A minute that has rolled out of the window is no longer picked: back to the running one.
  const pickedIndex = picked === null ? -1 : points.findIndex((point) => point.key === picked);
  const active = pickedIndex >= 0 ? pickedIndex : last;

  const svgHeight = Math.max(96, height - READOUT);
  const plot = svgHeight - PAD_TOP - PAD_BOTTOM;
  const baseline = PAD_TOP + plot;
  const max = Math.max(1, ...points.map((point) => point.visitors));
  const slot = width / points.length;
  const barWidth = Math.max(4, Math.min(44, slot * 0.62));
  const radius = Math.min(6, barWidth / 2);
  // A figure on every bar while they are wide enough to carry two digits; otherwise only on the picked one.
  const labelEvery = slot >= 22;
  const middle = Math.floor(last / 2);

  return (
    <div className={cn("flex h-full min-w-0 flex-col", className)}>
      <p
        // Read with the page, not announced: it changes with every snapshot.
        style={{ height: READOUT }}
        className="flex shrink-0 items-start gap-2 text-[13px] leading-5 text-ink"
      >
        <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
        <bdi className="min-w-0 truncate">{describe(points[active])}</bdi>
      </p>

      <div ref={frameRef} dir="ltr" className="min-w-0">
        <svg
          viewBox={`0 0 ${width} ${svgHeight}`}
          className="block w-full"
          style={{ height: svgHeight }}
          role="img"
          aria-label={summary}
          preserveAspectRatio="none"
          onMouseLeave={() => setPicked(null)}
        >
          <line x1="0" x2={width} y1={baseline} y2={baseline} stroke="var(--color-line)" strokeWidth="1" />
          {points.map((point, index) => {
            const barHeight = (point.visitors / max) * plot;
            const x = index * slot + (slot - barWidth) / 2;
            const y = baseline - barHeight;
            const r = Math.min(radius, barHeight);
            const isActive = index === active;
            // Rounded at the data end, square where it meets the baseline.
            const d =
              barHeight <= 0
                ? ""
                : `M${x},${baseline} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + barWidth - r},${y} Q${x + barWidth},${y} ${x + barWidth},${y + r} L${x + barWidth},${baseline} Z`;
            return (
              <g key={point.key}>
                {d ? (
                  <path d={d} fill="var(--color-primary)" fillOpacity={isActive ? 1 : 0.42} />
                ) : (
                  // A quiet minute still has a mark: a short tick on the baseline.
                  <rect
                    x={x}
                    y={baseline - 2}
                    width={barWidth}
                    height={2}
                    rx="1"
                    fill={isActive ? "var(--color-primary)" : "var(--color-line-strong)"}
                  />
                )}
                {(labelEvery || isActive) && point.visitors > 0 && (
                  <text x={x + barWidth / 2} y={Math.max(12, y - 5)} textAnchor="middle" className={VALUE_CLASS}>
                    {format(point.visitors)}
                  </text>
                )}
                {/* The whole column is the target: a press or the pointer reads this minute out above. */}
                <rect
                  x={index * slot}
                  y={0}
                  width={slot}
                  height={baseline}
                  fill="transparent"
                  style={{ cursor: "pointer" }}
                  onMouseEnter={() => setPicked(point.key)}
                  onClick={() => setPicked(point.key)}
                >
                  <title>{describe(point)}</title>
                </rect>
              </g>
            );
          })}
          <text x="0" y={svgHeight - 6} className={AXIS_CLASS}>
            {points[0].label}
          </text>
          {last >= 6 && (
            <text x={middle * slot + slot / 2} y={svgHeight - 6} textAnchor="middle" className={AXIS_CLASS}>
              {points[middle].label}
            </text>
          )}
          {last > 0 && (
            <text x={width} y={svgHeight - 6} textAnchor="end" className="fill-[var(--color-primary)] text-xs font-semibold">
              {nowLabel}
            </text>
          )}
        </svg>
      </div>
    </div>
  );
}
