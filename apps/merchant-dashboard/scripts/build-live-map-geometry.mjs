// Builds apps/merchant-dashboard/src/pages/analytics/liveMap/worldGeometry.ts from
// Natural Earth (public domain) as packaged by world-atlas 2.0.2 (ISC). Neither
// package is a dependency: unpack their npm tarballs anywhere and point at them.
//
//   npm pack world-atlas@2.0.2 i18n-iso-countries@7.11.0   (then tar -xzf each)
//   node build-live-map-geometry.mjs <world-atlas package dir> <i18n-iso-countries codes.json> <out.ts>
//
// World: countries-110m, Antarctica dropped, Equal Earth projection, each shared
// arc simplified once (Douglas-Peucker) so neighbours keep one border.
// Inset (Egypt / Saudi Arabia and neighbours): countries-50m, equirectangular
// around 22.5°N, clipped to a box a little larger than the widest inset view.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [, , atlasDir, codesPath, outPath] = process.argv;
if (!atlasDir || !codesPath || !outPath) {
  console.error("usage: node build-live-map-geometry.mjs <world-atlas dir> <codes.json> <out.ts>");
  process.exit(1);
}

const codes = JSON.parse(readFileSync(codesPath, "utf8"));
const numericToAlpha2 = new Map(codes.map((c) => [c[2], c[0]]));
// Features Natural Earth keeps apart that ISO 3166 (and an IP lookup) does not.
const BY_NAME = { Kosovo: "XK", "N. Cyprus": "CY", Somaliland: "SO" };
const iso2 = (g) => (g.id ? numericToAlpha2.get(g.id) : BY_NAME[g.properties?.name]) ?? null;

/** Arcs in lon/lat, split where they jump across the antimeridian (a null marks the jump). */
function decodeArcs(topo) {
  const [sx, sy] = topo.transform.scale;
  const [tx, ty] = topo.transform.translate;
  return topo.arcs.map((arc) => {
    let x = 0;
    let y = 0;
    const out = [];
    for (const [dx, dy] of arc) {
      x += dx;
      y += dy;
      const p = [x * sx + tx, y * sy + ty];
      const prev = out[out.length - 1];
      if (prev && Math.abs(p[0] - prev[0]) > 180) out.push(null);
      out.push(p);
    }
    return out;
  });
}

/** Projects and simplifies each piece of an arc on its own, keeping the jump markers. */
function projectArcs(arcs, project, tolerance) {
  return arcs.map((arc) => {
    const pieces = [[]];
    for (const p of arc) {
      if (p === null) pieces.push([]);
      else pieces[pieces.length - 1].push(project(p));
    }
    const out = [];
    pieces.forEach((piece, i) => {
      if (i > 0) out.push(null);
      out.push(...simplify(piece, tolerance));
    });
    return out;
  });
}

// --- Equal Earth (Šavrič, Patterson, Jenny 2018) -------------------------------
const A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796;
const M = Math.sqrt(3) / 2;
function equalEarth([lon, lat]) {
  const l = (lon * Math.PI) / 180;
  const p = (lat * Math.PI) / 180;
  const t = Math.asin(M * Math.sin(p));
  const t2 = t * t, t6 = t2 * t2 * t2;
  const x = (l * Math.cos(t)) / (M * (A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2)));
  const y = t * (A1 + A2 * t2 + t6 * (A3 + A4 * t2));
  return [x, -y];
}

// --- Geometry helpers -----------------------------------------------------------
function simplify(points, tolerance) {
  if (points.length <= 2) return points.slice();
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  const t2 = tolerance * tolerance;
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = points[a];
    const [bx, by] = points[b];
    const dx = bx - ax, dy = by - ay;
    const len2 = dx * dx + dy * dy;
    let worst = -1, worstD = t2;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      let d;
      if (len2 === 0) d = (px - ax) ** 2 + (py - ay) ** 2;
      else {
        const u = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
        d = (px - ax - u * dx) ** 2 + (py - ay - u * dy) ** 2;
      }
      if (d > worstD) { worstD = d; worst = i; }
    }
    if (worst >= 0) {
      keep[worst] = 1;
      stack.push([a, worst], [worst, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

const area = (ring) => {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) s += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  return s / 2;
};

function centroid(ring) {
  let cx = 0, cy = 0, a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const f = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    a += f;
    cx += (ring[j][0] + ring[i][0]) * f;
    cy += (ring[j][1] + ring[i][1]) * f;
  }
  return a === 0 ? ring[0] : [cx / (3 * a), cy / (3 * a)];
}

function inside([x, y], ring) {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** The centroid, or, for a shape that curls around it, the middle of the widest span on that line. */
function representativePoint(ring) {
  const c = centroid(ring);
  if (inside(c, ring)) return c;
  const y = c[1];
  const xs = [];
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
  }
  xs.sort((a, b) => a - b);
  let best = c, width = -1;
  for (let i = 0; i + 1 < xs.length; i += 2) {
    if (xs[i + 1] - xs[i] > width) { width = xs[i + 1] - xs[i]; best = [(xs[i] + xs[i + 1]) / 2, y]; }
  }
  return best;
}

/** Sutherland–Hodgman against an axis-aligned box. */
function clipRing(ring, [x0, y0, x1, y1]) {
  const edges = [
    (p) => p[0] >= x0, (p) => p[0] <= x1, (p) => p[1] >= y0, (p) => p[1] <= y1,
  ];
  const cut = [
    (a, b) => [x0, a[1] + ((b[1] - a[1]) * (x0 - a[0])) / (b[0] - a[0])],
    (a, b) => [x1, a[1] + ((b[1] - a[1]) * (x1 - a[0])) / (b[0] - a[0])],
    (a, b) => [a[0] + ((b[0] - a[0]) * (y0 - a[1])) / (b[1] - a[1]), y0],
    (a, b) => [a[0] + ((b[0] - a[0]) * (y1 - a[1])) / (b[1] - a[1]), y1],
  ];
  let out = ring;
  for (let e = 0; e < 4 && out.length; e++) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i], prev = input[(i + input.length - 1) % input.length];
      const ci = edges[e](cur), pi = edges[e](prev);
      if (ci) {
        if (!pi) out.push(cut[e](prev, cur));
        out.push(cur);
      } else if (pi) out.push(cut[e](prev, cur));
    }
  }
  return out;
}

/** "M x y l dx dy …z" in whole units; consecutive duplicate points dropped. */
function ringPath(ring) {
  const pts = [];
  for (const [x, y] of ring) {
    const p = [Math.round(x), Math.round(y)];
    const last = pts[pts.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) pts.push(p);
  }
  if (pts.length > 1 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
  if (pts.length < 3) return "";
  let d = `M${pts[0][0]} ${pts[0][1]}l`;
  const parts = [];
  for (let i = 1; i < pts.length; i++) parts.push(`${pts[i][0] - pts[i - 1][0]} ${pts[i][1] - pts[i - 1][1]}`);
  d += parts.join(" ").replace(/ -/g, "-");
  return `${d}z`;
}

// Polygons of a TopoJSON geometry, each ring built from (already projected and simplified) arcs.
// A ring that crosses the antimeridian comes back as one ring per side.
function polygonsOf(geometry, arcs, middleX) {
  const ringsOf = (indexes) => {
    const ring = [];
    for (const index of indexes) {
      const arc = index < 0 ? arcs[~index].slice().reverse() : arcs[index];
      arc.forEach((p, i) => { if (i > 0 || ring.length === 0) ring.push(p); });
    }
    if (!ring.includes(null)) return [ring];
    const segments = [[]];
    for (const p of ring) {
      if (p === null) segments.push([]);
      else segments[segments.length - 1].push(p);
    }
    // The ring wraps: its last segment continues into its first.
    const last = segments.pop();
    segments[0] = [...last, ...segments[0]];
    const sides = new Map();
    for (const seg of segments.filter((x) => x.length)) {
      const side = seg.reduce((s, p) => s + p[0], 0) / seg.length < middleX ? "w" : "e";
      sides.set(side, [...(sides.get(side) ?? []), ...seg]);
    }
    return [...sides.values()];
  };
  const polys = geometry.type === "Polygon" ? [geometry.arcs] : geometry.type === "MultiPolygon" ? geometry.arcs : [];
  return polys.flatMap((poly) => {
    const [outer, ...holes] = poly.map(ringsOf);
    // Each side of a split outer ring is its own polygon; holes stay with the first.
    return outer.map((ring, i) => (i === 0 ? [ring, ...holes.flat()] : [ring]));
  });
}

// --- World (110m, Equal Earth) ----------------------------------------------------
const world = JSON.parse(readFileSync(join(atlasDir, "countries-110m.json"), "utf8"));
const WORLD_WIDTH = 1000;
const rawWorld = projectArcs(decodeArcs(world), equalEarth, 0);
// Bounds of everything but Antarctica.
const keepGeoms = world.objects.countries.geometries.filter((g) => g.id !== "010");
let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
for (const g of keepGeoms) for (const poly of polygonsOf(g, rawWorld, 0)) for (const ring of poly) for (const [x, y] of ring) {
  minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
}
const PAD = 4;
const k = (WORLD_WIDTH - 2 * PAD) / (maxX - minX);
const WORLD_HEIGHT = Math.ceil((maxY - minY) * k + 2 * PAD);
const toWorld = ([x, y]) => [(x - minX) * k + PAD, (y - minY) * k + PAD];
const worldArcs = projectArcs(decodeArcs(world), (p) => toWorld(equalEarth(p)), 0.7);

const worldCountries = [];
for (const g of keepGeoms) {
  const code = iso2(g);
  const rings = [];
  const polys = polygonsOf(g, worldArcs, WORLD_WIDTH / 2);
  let largest = null;
  for (const poly of polys) for (const ring of poly) {
    const a = Math.abs(area(ring));
    if (!largest || a > largest.a) largest = { ring, a };
    if (a >= 2) rings.push(ring);
  }
  if (!rings.length && largest) rings.push(largest.ring);
  const d = rings.map(ringPath).join("");
  if (d) worldCountries.push([code ?? "", d]);
}

// Marker points: the 50m set has the small countries 110m leaves out (Bahrain, Singapore…).
const fine = JSON.parse(readFileSync(join(atlasDir, "countries-50m.json"), "utf8"));
const fineWorld = projectArcs(decodeArcs(fine), (p) => toWorld(equalEarth(p)), 0);
const markers = {};
for (const g of fine.objects.countries.geometries) {
  const code = iso2(g);
  if (!code || g.id === "010" || markers[code]) continue;
  let largest = null;
  for (const poly of polygonsOf(g, fineWorld, WORLD_WIDTH / 2)) {
    const a = Math.abs(area(poly[0]));
    if (!largest || a > largest.a) largest = { ring: poly[0], a };
  }
  if (!largest) continue;
  const [x, y] = representativePoint(largest.ring);
  markers[code] = [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

// --- Inset (50m, equirectangular around 22.5°N) -----------------------------------
const INSET = { lonMin: 18, latMax: 40, cosRef: Math.cos((22.5 * Math.PI) / 180), unitsPerDegree: 100 };
const toInset = ([lon, lat]) => [(lon - INSET.lonMin) * INSET.cosRef * INSET.unitsPerDegree, (INSET.latMax - lat) * INSET.unitsPerDegree];
const CLIP = [...toInset([18, 40]), ...toInset([64, 6])]; // x0 y0 x1 y1
const insetArcs = projectArcs(decodeArcs(fine), toInset, 2.5);
const insetCountries = [];
for (const g of fine.objects.countries.geometries) {
  const code = iso2(g);
  const rings = [];
  for (const poly of polygonsOf(g, insetArcs, toInset([0, 0])[0])) for (const ring of poly) {
    const clipped = clipRing(ring, CLIP);
    if (clipped.length >= 3 && Math.abs(area(clipped)) >= 40) rings.push(clipped);
  }
  const d = rings.map(ringPath).join("");
  if (d) insetCountries.push([code ?? "", d]);
}

// The inset's area outlined on the world map.
const frame = [];
const [fLon0, fLon1, fLat0, fLat1] = [24, 56, 12, 33];
for (let lon = fLon0; lon <= fLon1; lon += 2) frame.push([lon, fLat1]);
for (let lat = fLat1; lat >= fLat0; lat -= 3) frame.push([fLon1, lat]);
for (let lon = fLon1; lon >= fLon0; lon -= 2) frame.push([lon, fLat0]);
for (let lat = fLat0; lat <= fLat1; lat += 3) frame.push([fLon0, lat]);
const frameD = ringPath(frame.map((p) => toWorld(equalEarth(p))));

const r = (n) => Math.round(n * 1e6) / 1e6;
const out = `/*
 * Live map geometry. GENERATED — do not edit by hand.
 *
 * Source: Natural Earth admin-0 countries (public domain, naturalearthdata.com),
 * as packaged by world-atlas 2.0.2 (ISC, Mike Bostock): countries-110m for the
 * world, countries-50m for the inset and for the marker points. Shapes are
 * simplified (Douglas-Peucker, ~0.7 units on the world, ~2.5 on the inset) and
 * rounded to whole units, so borders are approximate and only for orientation.
 * Countries are keyed by ISO 3166-1 alpha-2 ("" for land without a code).
 *
 * World: Equal Earth projection, Antarctica left out, viewBox 0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}.
 * Inset: equirectangular, x = (lon − ${INSET.lonMin}) · cos 22.5° · ${INSET.unitsPerDegree},
 * y = (${INSET.latMax} − lat) · ${INSET.unitsPerDegree}; see insetPoint() in places.ts.
 */

export const WORLD_WIDTH = ${WORLD_WIDTH};
export const WORLD_HEIGHT = ${WORLD_HEIGHT};

/** [ISO alpha-2, SVG path] per country. */
export const WORLD_COUNTRIES: ReadonlyArray<readonly [string, string]> = ${JSON.stringify(worldCountries)};

/** Where a country's marker sits on the world map (inside its largest landmass). */
export const WORLD_MARKERS: Readonly<Record<string, readonly [number, number]>> = ${JSON.stringify(markers)};

/** The inset's area, outlined on the world map. */
export const WORLD_INSET_FRAME = ${JSON.stringify(frameD)};

export const INSET_PROJECTION = { lonMin: ${INSET.lonMin}, latMax: ${INSET.latMax}, cosRef: ${r(INSET.cosRef)}, unitsPerDegree: ${INSET.unitsPerDegree} } as const;

/** [ISO alpha-2, SVG path] for the countries around Egypt and Saudi Arabia, clipped. */
export const INSET_COUNTRIES: ReadonlyArray<readonly [string, string]> = ${JSON.stringify(insetCountries)};
`;
writeFileSync(outPath, out);
console.log({ WORLD_HEIGHT, world: worldCountries.length, markers: Object.keys(markers).length, inset: insetCountries.map((c) => c[0]).join(","), bytes: out.length });
