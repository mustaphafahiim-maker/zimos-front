/**
 * The geometry of the proposed ZIMOS mark and wordmark.
 *
 * The mark is three modules on a square grid: two bars and, between them, a
 * bar whose opposite corners are cut along one diagonal so that the three read
 * as a Z. One angle, one corner radius, one gap. Nothing here depends on
 * colour, shading or overlap, so the same paths work in solid black.
 */

export type Point = readonly [number, number];

/** The only angle in the system: the diagonal, measured from the horizontal. */
export const ANGLE_DEG = 29;
const ANGLE = (ANGLE_DEG * Math.PI) / 180;
const COT = 1 / Math.tan(ANGLE);

/** A closed polygon with every corner rounded by a circular fillet of the same radius. */
export function roundedPolygon(points: readonly Point[], radius: number): string {
  const n = points.length;
  let d = "";
  for (let i = 0; i < n; i += 1) {
    const prev = points[(i - 1 + n) % n];
    const corner = points[i];
    const next = points[(i + 1) % n];
    const a = [prev[0] - corner[0], prev[1] - corner[1]];
    const b = [next[0] - corner[0], next[1] - corner[1]];
    const la = Math.hypot(a[0], a[1]);
    const lb = Math.hypot(b[0], b[1]);
    const ua = [a[0] / la, a[1] / la];
    const ub = [b[0] / lb, b[1] / lb];
    const cos = Math.max(-1, Math.min(1, ua[0] * ub[0] + ua[1] * ub[1]));
    const half = Math.acos(cos) / 2;
    // Tangent length for the wanted radius, capped so two fillets never overlap.
    const tangent = Math.min(radius / Math.tan(half), la / 2, lb / 2);
    const r = tangent * Math.tan(half);
    const from = [corner[0] + ua[0] * tangent, corner[1] + ua[1] * tangent];
    const to = [corner[0] + ub[0] * tangent, corner[1] + ub[1] * tangent];
    const sweep = ua[0] * ub[1] - ua[1] * ub[0] < 0 ? 1 : 0;
    d += `${i === 0 ? "M" : "L"}${from[0].toFixed(2)} ${from[1].toFixed(2)}A${r.toFixed(2)} ${r.toFixed(2)} 0 0 ${sweep} ${to[0].toFixed(2)} ${to[1].toFixed(2)}`;
  }
  return `${d}Z`;
}

export interface MarkSpec {
  /** Side of the square the mark is drawn in. */
  size: number;
  /** Height of the top and bottom modules. */
  bar: number;
  /** Space between modules: the X of the clear-space rule is `bar`. */
  gap: number;
  /** Height of the middle module. */
  middle: number;
  /** Height of the flat end the diagonal keeps on the grid edge. */
  cut: number;
  radius: number;
}

/** Master mark: 24 / 12 / 28 / 12 / 24 on a 100-unit square. */
export const MARK: MarkSpec = { size: 100, bar: 24, gap: 12, middle: 28, cut: 8, radius: 4 };

/**
 * Small-size mark for 16–32 px, drawn on a 16-unit grid so that it lands on
 * whole pixels at 16 and 32: equal layers, a lighter diagonal and tighter
 * corners keep the three modules apart instead of filling in.
 */
export const MICRO: MarkSpec = { size: 16, bar: 4, gap: 2, middle: 4, cut: 1, radius: 0.5 };

/** The three modules, top to bottom, as polygons. */
export function markModules(spec: MarkSpec): Point[][] {
  const { size, bar, gap, middle, cut } = spec;
  const top = bar + gap;
  const bottom = top + middle;
  const run = (middle - cut) * COT;
  return [
    [[0, 0], [size, 0], [size, bar], [0, bar]],
    [[run, top], [size, top], [size, top + cut], [size - run, bottom], [0, bottom], [0, bottom - cut]],
    [[0, size - bar], [size, size - bar], [size, size], [0, size]],
  ];
}

export function markPaths(spec: MarkSpec): string[] {
  return markModules(spec).map((module) => roundedPolygon(module, spec.radius));
}

/** Thickness of the diagonal measured across it — equal to `bar` on the master. */
export function diagonalThickness(spec: MarkSpec): number {
  const run = (spec.middle - spec.cut) * COT;
  return (spec.size - run) * Math.sin(ANGLE) - spec.cut * Math.cos(ANGLE);
}

// ---------------------------------------------------------------- wordmark --

/** Cap height of the wordmark's own coordinate space. */
export const CAP = 100;
/** Stem weight: between semibold and bold at this cap height. */
export const STEM = 18;

export type Glyph =
  | { kind: "fill"; x: number; width: number; d: string }
  | { kind: "stroke"; x: number; width: number; d: string }
  | { kind: "ring"; x: number; width: number; rx: number; ry: number };

function glyphZ(): Omit<Extract<Glyph, { kind: "fill" }>, "x"> {
  const w = 78;
  // Horizontal width of the diagonal that gives it the stem's thickness.
  const a = 24;
  return {
    kind: "fill",
    width: w,
    d: roundedPolygon(
      [[0, 0], [w, 0], [w, STEM], [a, CAP - STEM], [w, CAP - STEM], [w, CAP], [0, CAP], [0, CAP - STEM], [w - a, STEM], [0, STEM]],
      1.5
    ),
  };
}

function glyphI(): Omit<Extract<Glyph, { kind: "fill" }>, "x"> {
  return { kind: "fill", width: STEM, d: roundedPolygon([[0, 0], [STEM, 0], [STEM, CAP], [0, CAP]], 1.5) };
}

function glyphM(): Omit<Extract<Glyph, { kind: "fill" }>, "x"> {
  const w = 98;
  const shoulder = 21;
  const valley = 54;
  const depth = 33.5;
  const slope = valley / (w / 2 - shoulder);
  const inner = valley + depth - (w / 2 - STEM) * slope;
  return {
    kind: "fill",
    width: w,
    d: roundedPolygon(
      [
        [0, CAP], [0, 0], [shoulder, 0], [w / 2, valley], [w - shoulder, 0], [w, 0], [w, CAP],
        [w - STEM, CAP], [w - STEM, inner], [w / 2, valley + depth], [STEM, inner], [STEM, CAP],
      ],
      1.5
    ),
  };
}

function glyphS(): Omit<Extract<Glyph, { kind: "stroke" }>, "x"> {
  const w = 74;
  const rx = 27;
  const ry = (CAP / 2 - STEM / 2) / 2;
  const left = STEM / 2 + rx;
  const right = w - STEM / 2 - rx;
  const inset = 5;
  return {
    kind: "stroke",
    width: w,
    d: `M${w - inset} ${STEM / 2}H${left}A${rx} ${ry} 0 0 0 ${left} ${CAP / 2}H${right}A${rx} ${ry} 0 0 1 ${right} ${CAP - STEM / 2}H${inset}`,
  };
}

/** A glyph before it is placed on the line. */
type Shape = Glyph extends infer G ? (G extends Glyph ? Omit<G, "x"> : never) : never;

/** ZIMOS, set once: letters and the space between them are part of the drawing. */
export const WORDMARK: { width: number; glyphs: Glyph[] } = (() => {
  const letters: Array<[Shape, number]> = [
    [glyphZ(), 15],
    [glyphI(), 15],
    [glyphM(), 13],
    [{ kind: "ring", width: 84, rx: 33, ry: 36 }, 13],
    [glyphS(), 0],
  ];
  let x = 0;
  const glyphs: Glyph[] = [];
  for (const [glyph, after] of letters) {
    glyphs.push({ ...glyph, x } as Glyph);
    x += glyph.width + after;
  }
  return { width: x, glyphs };
})();

/** Horizontal lockup: the mark, then the wordmark at 60% of its height, 1.5 X apart. */
export const LOCKUP = {
  gap: MARK.bar * 1.5,
  scale: 0.6,
  get width() {
    return MARK.size + this.gap + WORDMARK.width * this.scale;
  },
};
