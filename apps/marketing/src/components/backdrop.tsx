/**
 * The moving ground behind the hero and the closing band (`.lz-fx` in
 * landing.css): two soft lights drifting slowly, and the ribbon of the
 * logo as faint lines flowing sideways — the drawing is two screens wide
 * and repeats every half, so sliding it by half loops without a seam. The
 * hero adds a fine dot grid. Decoration only; still under reduced motion.
 */

const PERIOD = 720;

/** A wave across the 2880-unit drawing: quadratic turns, each `T` mirroring the last. */
function wave(y: number, amp: number, shift: number) {
  let d = `M${shift - PERIOD},${y} Q${shift - PERIOD * 0.75},${y - 2 * amp} ${shift - PERIOD / 2},${y}`;
  for (let x = shift; x <= 2880 + PERIOD; x += PERIOD / 2) d += ` T${x},${y}`;
  return d;
}

const RIBBON = wave(150, 46, 0);
const LINES = [
  { d: RIBBON, className: "lz-fx__line" },
  { d: wave(172, 34, 140), className: "lz-fx__line lz-fx__line--2" },
  { d: wave(126, 56, -200), className: "lz-fx__line lz-fx__line--3" },
];

export function Backdrop({ id, grid = false }: { id: string; grid?: boolean }) {
  return (
    <div className={grid ? "lz-fx lz-fx--grid" : "lz-fx"} aria-hidden>
      <i className="lz-fx__orb lz-fx__orb--a" />
      <i className="lz-fx__orb lz-fx__orb--b" />
      <svg className="lz-fx__wave" viewBox="0 0 2880 300" preserveAspectRatio="none" focusable="false">
        <defs>
          <linearGradient id={id} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="2880" y2="0">
            {[0, 0.25, 0.5, 0.75, 1].map((offset, i) => (
              <stop key={offset} offset={offset} style={{ stopColor: i % 2 ? "var(--lz-wave-b)" : "var(--lz-wave-a)" }} />
            ))}
          </linearGradient>
        </defs>
        <g fill="none" stroke={`url(#${id})`} strokeLinecap="round">
          <path className="lz-fx__band" d={RIBBON} vectorEffect="non-scaling-stroke" />
          {LINES.map((line) => (
            <path key={line.className} className={line.className} d={line.d} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      </svg>
    </div>
  );
}
