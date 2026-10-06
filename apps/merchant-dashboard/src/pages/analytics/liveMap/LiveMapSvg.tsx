import { useEffect, useMemo, useRef, useState, type PointerEvent, type ReactNode } from "react";
import { cn } from "@store-builder/ui";
import type { LiveMapCounts } from "@store-builder/api-client";
import { formatCount } from "@/lib/analytics";
import { INSET_COUNTRIES, WORLD_COUNTRIES, WORLD_HEIGHT, WORLD_INSET_FRAME, WORLD_MARKERS, WORLD_WIDTH } from "./worldGeometry";
import { MAP_PLACES, insetPoint } from "./places";

/*
 * The live map's drawing: a world map coloured by country and an Egypt / Saudi
 * Arabia inset with a dot per governorate or region. Both are plain inline SVG
 * from worldGeometry.ts — no tiles, no map library.
 *
 * Three kinds of activity, strongest first: orders, checkouts, visitors. Each
 * has a colour (success / attention-dark / primary tokens; contrast ≥ 3:1 on
 * the card and on the land in both themes) and a shape (square, diamond,
 * circle), so colour is never the only cue; the lists beside the map carry the
 * same numbers in words.
 */

export type Kind = "orders" | "checkouts" | "visitors";
/** Display order everywhere (strip, legend, tables, tooltips): the way a visit becomes an order. */
export const KINDS: readonly Kind[] = ["visitors", "checkouts", "orders"];

export const KIND_FILL: Record<Kind, string> = {
  orders: "fill-success",
  checkouts: "fill-accent-dark",
  visitors: "fill-primary",
};

/** A country's soft fill on the world map, by its strongest kind. */
const KIND_TINT: Record<Kind, string> = {
  orders: "fill-success/30",
  checkouts: "fill-accent-dark/30",
  visitors: "fill-primary/25",
};

export function topKind(c: LiveMapCounts): Kind {
  return c.orders > 0 ? "orders" : c.checkouts > 0 ? "checkouts" : "visitors";
}

export function activityOf(c: LiveMapCounts): number {
  return c.visitors + c.checkouts + c.orders;
}

/** One mark: a circle (visitors), a diamond (checkouts) or a rounded square (orders), all of about the same area. */
function Glyph({ kind, x, y, r, className }: { kind: Kind; x: number; y: number; r: number; className?: string }) {
  const common = { className: cn(KIND_FILL[kind], "stroke-card", className), strokeWidth: 1.5, vectorEffect: "non-scaling-stroke" as const };
  if (kind === "visitors") return <circle cx={x} cy={y} r={r} {...common} />;
  if (kind === "checkouts") {
    const d = r * 1.25;
    return <path d={`M${x} ${y - d}L${x + d} ${y}L${x} ${y + d}L${x - d} ${y}Z`} strokeLinejoin="round" {...common} />;
  }
  const s = r * 0.886;
  return <rect x={x - s} y={y - s} width={2 * s} height={2 * s} rx={s * 0.25} {...common} />;
}

/** The kind's shape at text size, for legends, table headers and tooltips. */
export function KindIcon({ kind, className }: { kind: Kind; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("size-3.5 shrink-0", className)} aria-hidden focusable="false">
      <Glyph kind={kind} x={8} y={8} r={5.5} />
    </svg>
  );
}

/** How many viewBox units one screen pixel is, kept current as the map resizes. */
function useUnitsPerPx(viewBoxWidth: number) {
  const ref = useRef<SVGSVGElement>(null);
  const [unitsPerPx, setUnitsPerPx] = useState(1);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const width = el.getBoundingClientRect().width;
      if (width > 0) setUnitsPerPx(viewBoxWidth / width);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [viewBoxWidth]);
  return { ref, unitsPerPx };
}

/**
 * Mark radius in viewBox units: at least 5 px on screen (a 10 px mark), its area
 * growing with activity up to 16 px — less on a phone-wide map, where a big
 * mark would hide its neighbours.
 */
function markRadius(activity: number, max: number, unitsPerPx: number, viewBoxWidth: number) {
  const widthPx = viewBoxWidth / unitsPerPx;
  const top = Math.min(16, Math.max(9, widthPx / 42));
  return (5 + (top - 5) * Math.sqrt(activity / Math.max(1, max))) * unitsPerPx;
}

// --- Tooltip ---------------------------------------------------------------------

export interface MapTip {
  title: string;
  subtitle?: string;
  counts: LiveMapCounts;
}

interface TipState extends MapTip {
  x: number;
  y: number;
}

/**
 * Pointer tooltips for the marks. Hover on a mouse, tap on a touch screen; the
 * lists beside the map hold the same numbers for keyboard and screen readers.
 */
function useMapTip() {
  const box = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<TipState | null>(null);
  const place = (event: PointerEvent, content: MapTip) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    setTip({ ...content, x: event.clientX - rect.left, y: event.clientY - rect.top });
  };
  const bind = (content: MapTip) => ({
    onPointerEnter: (e: PointerEvent) => place(e, content),
    onPointerMove: (e: PointerEvent) => place(e, content),
    onPointerDown: (e: PointerEvent) => {
      // A tap shows the tip; the frame's own pointerdown (a tap elsewhere) hides it.
      e.stopPropagation();
      place(e, content);
    },
    style: { cursor: "pointer" },
  });
  // A finger "leaves" as soon as it lifts: keep a tapped tip until the next tap.
  const leave = (e: PointerEvent) => {
    if (e.pointerType !== "touch") setTip(null);
  };
  // A tap anywhere outside the map hides it too.
  const shown = tip !== null;
  useEffect(() => {
    if (!shown) return;
    const outside = (e: Event) => {
      if (!box.current?.contains(e.target as Node)) setTip(null);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [shown]);
  return { box, tip, bind, leave, clear: () => setTip(null) };
}

export function MapTooltip({ tip, width, labels }: { tip: TipState | null; width: number; labels: Record<Kind, string> }) {
  if (!tip) return null;
  const w = 200;
  // Screen coordinates follow the pointer, so they are physical, not logical.
  const left = Math.max(4, Math.min(tip.x + 12, width - w - 4));
  // Above the pointer, or below it near the top edge where it would be cut off.
  const above = tip.y > 140;
  return (
    <div
      className="pointer-events-none absolute z-10 rounded-[var(--radius)] bg-paper-raised p-3 text-xs shadow-[var(--shadow-pop)] ring-1 ring-line"
      style={{ left, top: above ? tip.y - 12 : tip.y + 16, width: w, transform: above ? "translateY(-100%)" : undefined }}
    >
      <p className="truncate text-sm font-semibold text-ink" dir="auto">
        {tip.title}
      </p>
      {tip.subtitle && (
        <p className="truncate text-ink-soft" dir="auto">
          {tip.subtitle}
        </p>
      )}
      <dl className="mt-2 space-y-1">
        {KINDS.map((kind) => (
          <div key={kind} className="flex items-center gap-2">
            <KindIcon kind={kind} />
            <dt className="min-w-0 flex-1 text-ink-soft">{labels[kind]}</dt>
            <dd className="tabular-nums font-medium text-ink">
              <bdi dir="ltr">{formatCount(tip.counts[kind])}</bdi>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function TipFrame({ tipper, labels, children }: { tipper: ReturnType<typeof useMapTip>; labels: Record<Kind, string>; children: ReactNode }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = tipper.box.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(el.getBoundingClientRect().width));
    observer.observe(el);
    return () => observer.disconnect();
  }, [tipper.box]);
  return (
    <div ref={tipper.box} className="relative" onPointerLeave={tipper.leave} onPointerDown={tipper.clear}>
      {children}
      <MapTooltip tip={tipper.tip} width={width} labels={labels} />
    </div>
  );
}

// --- World -----------------------------------------------------------------------

export interface WorldMark extends LiveMapCounts {
  country: string;
  name: string;
}

/** The world, each active country tinted by its strongest kind with a mark sized by its activity. */
export function WorldMap({
  countries,
  label,
  labels,
  showInsetFrame,
}: {
  countries: readonly WorldMark[];
  label: string;
  labels: Record<Kind, string>;
  showInsetFrame: boolean;
}) {
  const { ref, unitsPerPx } = useUnitsPerPx(WORLD_WIDTH);
  const tipper = useMapTip();
  const byCode = useMemo(() => new Map(countries.map((c) => [c.country, c])), [countries]);
  const max = Math.max(1, ...countries.map(activityOf));
  // Biggest first, so a small mark is never hidden under a big one.
  const marks = countries.filter((c) => WORLD_MARKERS[c.country]).sort((a, b) => activityOf(b) - activityOf(a));

  return (
    <TipFrame tipper={tipper} labels={labels}>
      <svg ref={ref} viewBox={`0 0 ${WORLD_WIDTH} ${WORLD_HEIGHT}`} role="img" aria-label={label} className="block h-auto w-full">
        <g>
          {WORLD_COUNTRIES.map(([code, d], i) => {
            const hit = code ? byCode.get(code) : undefined;
            return (
              <path
                key={`${code}-${i}`}
                d={d}
                fillRule="evenodd"
                className={cn(hit ? KIND_TINT[topKind(hit)] : "fill-line", "stroke-card")}
                strokeWidth={0.75}
                vectorEffect="non-scaling-stroke"
                {...(hit ? tipper.bind({ title: hit.name, counts: hit }) : {})}
              />
            );
          })}
        </g>
        {showInsetFrame && (
          <path d={WORLD_INSET_FRAME} fill="none" className="stroke-line-strong" strokeWidth={1} strokeDasharray="4 3" vectorEffect="non-scaling-stroke" />
        )}
        <g>
          {marks.map((c) => {
            const [x, y] = WORLD_MARKERS[c.country];
            return (
              <g key={c.country} {...tipper.bind({ title: c.name, counts: c })}>
                <Glyph kind={topKind(c)} x={x} y={y} r={markRadius(activityOf(c), max, unitsPerPx, WORLD_WIDTH)} />
              </g>
            );
          })}
        </g>
      </svg>
    </TipFrame>
  );
}

// --- Egypt and Saudi Arabia ------------------------------------------------------

export type InsetZoom = "both" | "eg" | "delta" | "sa";
export const INSET_ZOOMS: readonly InsetZoom[] = ["both", "eg", "delta", "sa"];

/** Each zoom's window as [west, south, east, north] in degrees. */
const WINDOWS: Record<InsetZoom, readonly [number, number, number, number]> = {
  both: [24, 12, 56, 33],
  eg: [24.5, 21.6, 37.2, 32],
  delta: [29.4, 29.5, 32.9, 31.7],
  sa: [34.2, 16, 56, 32.6],
};

const INSET_W = 600;
const INSET_H = 420;

/** The zoom window in inset units, widened to the map's shape and centred. */
function windowOf(zoom: InsetZoom) {
  const [west, south, east, north] = WINDOWS[zoom];
  const [x0, y0] = insetPoint(north, west);
  const [x1, y1] = insetPoint(south, east);
  let w = x1 - x0;
  let h = y1 - y0;
  const cx = x0 + w / 2;
  const cy = y0 + h / 2;
  if (w / h > INSET_W / INSET_H) h = (w * INSET_H) / INSET_W;
  else w = (h * INSET_W) / INSET_H;
  return { x: cx - w / 2, y: cy - h / 2, k: INSET_W / w };
}

type Box = readonly [number, number, number, number];
const overlaps = (a: Box, b: Box) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];

/**
 * Names beside the busiest marks (at most six), each placed after or before its
 * mark and left out when it would cover another mark or name — the list beside
 * the map has every place anyway. The width is an estimate (about 0.58 em a
 * letter), enough to keep names apart.
 */
function labelMarks(marks: ReadonlyArray<{ p: InsetMark; x: number; y: number; r: number }>, unitsPerPx: number) {
  const font = 11 * unitsPerPx;
  const gap = 4 * unitsPerPx;
  const taken: Box[] = marks.map(({ x, y, r }) => [x - r, y - r, x + r, y + r]);
  const out: Array<{ code: string; text: string; x: number; y: number; anchor: "start" | "end" }> = [];
  for (const { p, x, y, r } of marks) {
    if (out.length >= 6) break;
    const w = p.name.length * font * 0.58;
    const h = font * 1.3;
    for (const anchor of ["start", "end"] as const) {
      const tx = anchor === "start" ? x + r + gap : x - r - gap;
      const box: Box = anchor === "start" ? [tx, y - h / 2, tx + w, y + h / 2] : [tx - w, y - h / 2, tx, y + h / 2];
      if (box[0] < 0 || box[2] > INSET_W || box[1] < 0 || box[3] > INSET_H) continue;
      if (taken.some((b) => overlaps(b, box))) continue;
      taken.push(box);
      out.push({ code: p.code, text: p.name, x: tx, y, anchor });
      break;
    }
  }
  return out;
}

export interface InsetMark extends LiveMapCounts {
  code: string;
  name: string;
  subtitle: string;
}

export function InsetMap({
  places,
  zoom,
  label,
  labels,
}: {
  places: readonly InsetMark[];
  zoom: InsetZoom;
  label: string;
  labels: Record<Kind, string>;
}) {
  const { ref, unitsPerPx } = useUnitsPerPx(INSET_W);
  const tipper = useMapTip();
  const view = windowOf(zoom);
  const at = (lat: number, lon: number) => {
    const [x, y] = insetPoint(lat, lon);
    return [(x - view.x) * view.k, (y - view.y) * view.k] as const;
  };
  const max = Math.max(1, ...places.map(activityOf));
  const byCode = new Map(MAP_PLACES.map((p) => [p.code, p]));
  const marks = places
    .filter((p) => byCode.has(p.code))
    .sort((a, b) => activityOf(b) - activityOf(a))
    .map((p) => {
      const place = byCode.get(p.code)!;
      const [x, y] = at(place.lat, place.lon);
      return { p, x, y, r: markRadius(activityOf(p), max, unitsPerPx, INSET_W) };
    });
  const names = labelMarks(marks, unitsPerPx);

  return (
    <TipFrame tipper={tipper} labels={labels}>
      <svg
        ref={ref}
        viewBox={`0 0 ${INSET_W} ${INSET_H}`}
        role="img"
        aria-label={label}
        className="block h-auto w-full overflow-hidden rounded-[var(--radius)] bg-paper"
      >
        <g transform={`matrix(${view.k} 0 0 ${view.k} ${-view.x * view.k} ${-view.y * view.k})`}>
          {INSET_COUNTRIES.map(([code, d], i) => {
            const home = code === "EG" || code === "SA";
            return (
              <path
                key={`${code}-${i}`}
                d={d}
                fillRule="evenodd"
                className={home ? "fill-paper-raised stroke-line-strong" : "fill-line/60 stroke-line"}
                strokeWidth={home ? 1 : 0.75}
                vectorEffect="non-scaling-stroke"
              />
            );
          })}
        </g>
        {/* Every governorate and region as a faint point, so an active dot can be read against its neighbours. */}
        <g className="fill-line-strong">
          {MAP_PLACES.map((p) => {
            const [x, y] = at(p.lat, p.lon);
            return <circle key={p.code} cx={x} cy={y} r={1.6 * unitsPerPx} />;
          })}
        </g>
        <g>
          {marks.map(({ p, x, y, r }) => (
            <g key={p.code} {...tipper.bind({ title: p.name, subtitle: p.subtitle, counts: p })}>
              <Glyph kind={topKind(p)} x={x} y={y} r={r} />
            </g>
          ))}
        </g>
        {/* The names repeat the list beside the map, so they are hidden from screen readers. */}
        <g aria-hidden direction="ltr" className="pointer-events-none fill-ink stroke-paper-raised font-medium" fontSize={11 * unitsPerPx}>
          {names.map((n) => (
            <text
              key={n.code}
              x={n.x}
              y={n.y}
              textAnchor={n.anchor}
              dominantBaseline="central"
              strokeWidth={3 * unitsPerPx}
              strokeLinejoin="round"
              paintOrder="stroke"
            >
              {n.text}
            </text>
          ))}
        </g>
      </svg>
    </TipFrame>
  );
}
