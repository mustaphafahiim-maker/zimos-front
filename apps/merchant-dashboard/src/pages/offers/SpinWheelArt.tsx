import { cn } from "@store-builder/ui";

/**
 * The wheel of the Spin to win preview (handoff 258), drawn as inline SVG from
 * the dashboard's own colour tokens: equal slices with their labels, a rim, a
 * hub and the pointer at the top. A picture of what the store shows — the
 * chances are written in the list beside it, not in the size of a slice.
 */

export interface WheelArtSlice {
  key: string;
  label: string;
}

const CENTER = 100;
const RADIUS = 94;

/** A point of the wheel: 0° is the top (the pointer), angles grow clockwise. */
function pointAt(angle: number, radius: number): [number, number] {
  const rad = ((angle - 90) * Math.PI) / 180;
  return [CENTER + radius * Math.cos(rad), CENTER + radius * Math.sin(rad)];
}

function wedge(from: number, to: number): string {
  const [x1, y1] = pointAt(from, RADIUS);
  const [x2, y2] = pointAt(to, RADIUS);
  return `M ${CENTER} ${CENTER} L ${x1.toFixed(2)} ${y1.toFixed(2)} A ${RADIUS} ${RADIUS} 0 ${to - from > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
}

const FILLS = ["fill-primary-soft", "fill-accent-soft", "fill-paper-sunken"] as const;

/** Three tints in turn, and never the same one on both sides of the seam between the last slice and the first. */
function fillOf(index: number, count: number): string {
  if (count > 1 && index === count - 1 && index % FILLS.length === 0) return FILLS[1];
  return FILLS[index % FILLS.length];
}

/** A label cut to what a slice can hold; the whole label is in the list under the wheel. */
function shortLabel(label: string, count: number): string {
  const max = count <= 4 ? 16 : count <= 8 ? 13 : 11;
  const letters = Array.from(label.trim());
  return letters.length > max ? `${letters.slice(0, max - 1).join("")}…` : letters.join("");
}

export function SpinWheelArt({ slices, label, className }: { slices: WheelArtSlice[]; label: string; className?: string }) {
  const count = slices.length;
  const step = count > 0 ? 360 / count : 360;
  const fontSize = count <= 6 ? 9 : count <= 9 ? 8 : 7;
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label={label} className={cn("block h-auto w-full", className)}>
      {count <= 1 ? (
        <circle cx={CENTER} cy={CENTER} r={RADIUS} className={FILLS[0]} />
      ) : (
        slices.map((slice, i) => (
          <path key={slice.key} d={wedge(i * step, (i + 1) * step)} className={cn(fillOf(i, count), "stroke-paper-raised")} strokeWidth={1.5} />
        ))
      )}
      {slices.map((slice, i) => {
        // Along the slice's own radius; on the left half the text is turned to read from the rim inwards, so it is never upside down.
        const mid = (i + 0.5) * step;
        const flipped = count > 1 && mid > 180;
        const reach = RADIUS * 0.6;
        return (
          <text
            key={slice.key}
            x={count === 1 ? CENTER : flipped ? CENTER - reach : CENTER + reach}
            y={count === 1 ? CENTER + reach : CENTER}
            transform={count === 1 ? undefined : `rotate(${flipped ? mid + 90 : mid - 90} ${CENTER} ${CENTER})`}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={fontSize}
            className="fill-ink font-semibold"
          >
            {shortLabel(slice.label, count)}
          </text>
        );
      })}
      <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" className="stroke-line-strong" strokeWidth={2} />
      <circle cx={CENTER} cy={CENTER} r={13} className="fill-paper-raised stroke-line-strong" strokeWidth={2} />
      {/* The pointer: the slice under it is the one the wheel stops on. */}
      <path d={`M ${CENTER - 8} 1 L ${CENTER + 8} 1 L ${CENTER} 17 Z`} className="fill-primary stroke-paper-raised" strokeWidth={1.5} strokeLinejoin="round" />
    </svg>
  );
}
