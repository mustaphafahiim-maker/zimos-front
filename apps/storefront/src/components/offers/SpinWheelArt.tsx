/**
 * The wheel of the Spin to win popup (handoff 258), drawn as inline SVG in
 * the store's own colours: equal slices with their labels, a rim and a hub.
 * It is a picture — the popup lists every slice and its real chance in text
 * beside it — so it is hidden from assistive tech. The pointer is drawn by
 * the popup, outside the part that turns.
 */

export interface WheelArtSlice {
  id: string;
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

// Each slice's fill with the text colour that reads on it.
const TONES = [
  { fill: "fill-primary", text: "fill-on-primary" },
  { fill: "fill-primary-soft", text: "fill-ink" },
  { fill: "fill-accent-soft", text: "fill-ink" },
] as const;

/** Three tones in turn, and never the same one on both sides of the seam between the last slice and the first. */
function toneOf(index: number, count: number) {
  if (count > 1 && index === count - 1 && index % TONES.length === 0) return TONES[1];
  return TONES[index % TONES.length];
}

/** A label cut to what a slice can hold; the whole label is in the list beside the wheel. */
function shortLabel(label: string, count: number): string {
  const max = count <= 4 ? 16 : count <= 8 ? 13 : 11;
  const letters = Array.from(label.trim());
  return letters.length > max ? `${letters.slice(0, max - 1).join("")}…` : letters.join("");
}

/**
 * How far the wheel turns (degrees, clockwise) to stop with slice `index`
 * under the pointer: `turns` whole turns, then on to the slice — `within`
 * (−1…1) moves the stop off the slice's centre without leaving it.
 */
export function wheelStopAngle(index: number, count: number, turns: number, within = 0): number {
  const step = 360 / Math.max(1, count);
  const offset = Math.max(-1, Math.min(1, within)) * step * 0.32;
  return turns * 360 + (360 - (index + 0.5) * step) + offset;
}

export function SpinWheelArt({ slices, className = "" }: { slices: WheelArtSlice[]; className?: string }) {
  const count = slices.length;
  const step = count > 0 ? 360 / count : 360;
  const fontSize = count <= 6 ? 9 : count <= 9 ? 8 : 7;
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" focusable="false" className={`block h-auto w-full ${className}`.trimEnd()}>
      {count <= 1 ? (
        <circle cx={CENTER} cy={CENTER} r={RADIUS} className={TONES[0].fill} />
      ) : (
        slices.map((slice, i) => (
          <path key={slice.id} d={wedge(i * step, (i + 1) * step)} className={`${toneOf(i, count).fill} stroke-paper-raised`} strokeWidth={1.5} />
        ))
      )}
      {slices.map((slice, i) => {
        // Along the slice's own radius; on the left half the text is turned to read from the rim inwards, so it starts the right way up.
        const mid = (i + 0.5) * step;
        const flipped = count > 1 && mid > 180;
        const reach = RADIUS * 0.6;
        return (
          <text
            key={slice.id}
            x={count === 1 ? CENTER : flipped ? CENTER - reach : CENTER + reach}
            y={count === 1 ? CENTER + reach : CENTER}
            transform={count === 1 ? undefined : `rotate(${flipped ? mid + 90 : mid - 90} ${CENTER} ${CENTER})`}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={fontSize}
            className={`${toneOf(i, count).text} font-semibold`}
          >
            {shortLabel(slice.label, count)}
          </text>
        );
      })}
      <circle cx={CENTER} cy={CENTER} r={RADIUS} fill="none" className="stroke-primary-dark" strokeWidth={3} />
      <circle cx={CENTER} cy={CENTER} r={13} className="fill-paper-raised stroke-primary-dark" strokeWidth={3} />
    </svg>
  );
}
