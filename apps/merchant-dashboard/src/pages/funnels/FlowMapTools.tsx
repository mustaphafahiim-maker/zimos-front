import { useCallback, useEffect, useMemo, useState, type PointerEvent as ReactPointerEvent, type RefObject } from "react";
import { Eye, Maximize2, Minus, MousePointerClick, Plus } from "lucide-react";
import { Button, cn } from "@store-builder/ui";
import type { PageTree } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { Select } from "@/components/Select";

/**
 * The funnel map's tools (SPEC §9.2): zoom with the wheel or the buttons, pan
 * by dragging the empty map, a schematic thumbnail of each step's page, and
 * each step's numbers for a period (visits, clicks on to the next step, CTR)
 * from the funnel's analytics.
 */

const STRINGS = {
  en: {
    zoomOut: "Zoom out",
    zoomIn: "Zoom in",
    fit: "Fit the map",
    zoom: "Zoom {pct}%",
    period: "Numbers for",
    days7: "Last 7 days",
    days30: "Last 30 days",
    days90: "Last 90 days",
    visits: "{n} visits",
    clicks: "{n} moved on",
    ctr: "CTR {pct}%",
    noVisits: "No visits yet",
  },
  ar: {
    zoomOut: "تصغير",
    zoomIn: "تكبير",
    fit: "اعرض الخريطة كلها",
    zoom: "تكبير {pct}%",
    period: "الأرقام عن",
    days7: "آخر 7 أيام",
    days30: "آخر 30 يوم",
    days90: "آخر 90 يوم",
    visits: "{n} زيارة",
    clicks: "{n} كمّلوا",
    ctr: "نسبة النقر {pct}%",
    noVisits: "مفيش زيارات لسه",
  },
} satisfies Messages;

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 1.6;
const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(z * 100) / 100));

/**
 * Zoom and pan for a scrolling map. The wheel zooms around the pointer; a drag
 * that starts on the empty map scrolls it. `toMap` turns a pointer event into
 * map coordinates (what a card's x/y are in), whatever the zoom and scroll.
 */
export function useFlowZoom(containerRef: RefObject<HTMLDivElement | null>, size: { width: number; height: number }) {
  const t = useT(STRINGS);
  const [zoom, setZoom] = useState(1);
  const [panning, setPanning] = useState<{ x: number; y: number; left: number; top: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left;
      const py = e.clientY - rect.top;
      setZoom((current) => {
        const next = clampZoom(current * (e.deltaY < 0 ? 1.1 : 1 / 1.1));
        if (next === current) return current;
        // Keep the point under the pointer where it is.
        const mapX = (el.scrollLeft + px) / current;
        const mapY = (el.scrollTop + py) / current;
        requestAnimationFrame(() => {
          el.scrollLeft = mapX * next - px;
          el.scrollTop = mapY * next - py;
        });
        return next;
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [containerRef]);

  const toMap = useCallback(
    (e: { clientX: number; clientY: number }) => {
      const el = containerRef.current;
      const rect = el?.getBoundingClientRect();
      return {
        x: (e.clientX - (rect?.left ?? 0) + (el?.scrollLeft ?? 0)) / zoom,
        y: (e.clientY - (rect?.top ?? 0) + (el?.scrollTop ?? 0)) / zoom,
      };
    },
    [containerRef, zoom]
  );

  const fit = () => {
    const el = containerRef.current;
    if (!el) return;
    setZoom(clampZoom(Math.min(1, el.clientWidth / size.width, el.clientHeight / size.height)));
    el.scrollTo({ left: 0, top: 0 });
  };

  /** On the map's background: a drag there pans. */
  const panHandlers = {
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => {
      if (e.button !== 0 || e.target !== e.currentTarget) return;
      const el = containerRef.current;
      if (!el) return;
      setPanning({ x: e.clientX, y: e.clientY, left: el.scrollLeft, top: el.scrollTop });
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => {
      const el = containerRef.current;
      if (!panning || !el) return;
      el.scrollLeft = panning.left - (e.clientX - panning.x);
      el.scrollTop = panning.top - (e.clientY - panning.y);
    },
    onPointerUp: () => setPanning(null),
    onPointerCancel: () => setPanning(null),
  };

  const controls = (
    <div className="flex items-center gap-1">
      <Button size="icon-xs" variant="outline" aria-label={t.zoomOut} title={t.zoomOut} onClick={() => setZoom((z) => clampZoom(z / 1.2))}>
        <Minus className="size-3" aria-hidden />
      </Button>
      <span className="w-11 text-center text-[11px] tabular-nums text-ink-soft" aria-live="polite" aria-label={fmt(t.zoom, { pct: Math.round(zoom * 100) })}>
        {Math.round(zoom * 100)}%
      </span>
      <Button size="icon-xs" variant="outline" aria-label={t.zoomIn} title={t.zoomIn} onClick={() => setZoom((z) => clampZoom(z * 1.2))}>
        <Plus className="size-3" aria-hidden />
      </Button>
      <Button size="icon-xs" variant="outline" aria-label={t.fit} title={t.fit} onClick={fit}>
        <Maximize2 className="size-3" aria-hidden />
      </Button>
    </div>
  );

  return { zoom, toMap, panHandlers, panning: panning !== null, controls };
}

// --- thumbnails ----------------------------------------------------------------

const TONE: Record<string, string> = {
  heading: "bg-ink/50",
  text: "bg-ink/20",
  image: "bg-primary/30",
  video: "bg-primary/30",
  button: "bg-primary",
  cod_form: "bg-accent",
  product_card: "bg-success/40",
};

/** A schematic of the step's page: one row per section (the first four), a block per element. */
export function StepThumbnail({ tree }: { tree: PageTree }) {
  const rows = tree.sections.slice(0, 4).map((section) =>
    (section.rows ?? []).flatMap((row) => (row.columns ?? []).flatMap((col) => (col.elements ?? []).map((el) => el.type))).slice(0, 6)
  );
  return (
    <div aria-hidden className="flex h-10 flex-col gap-0.5 overflow-hidden rounded-md border border-line bg-paper p-1">
      {rows.map((types, i) => (
        <div key={i} className="flex min-h-0 flex-1 items-center gap-0.5">
          {types.length === 0 ? (
            <span className="h-1 w-full rounded-full bg-line" />
          ) : (
            types.map((type, j) => <span key={j} className={cn("h-1.5 flex-1 rounded-full", TONE[type] ?? "bg-ink/15")} />)
          )}
        </div>
      ))}
    </div>
  );
}

// --- numbers -------------------------------------------------------------------

type Period = "7" | "30" | "90";
export type StepStats = { visits: number; clicks: number; ctr: number | null };

/** Each step's visits and how many moved on, for the chosen period (funnel analytics). */
export function useStepStats(funnelId: string | null) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const [period, setPeriod] = useState<Period>("30");
  const detail = useAsync(
    () =>
      funnelId
        ? apiClient
            .getFunnelAnalyticsDetail(workspaceId, funnelId, { from: new Date(Date.now() - Number(period) * 864e5).toISOString() })
            .catch(() => null)
        : Promise.resolve(null),
    [workspaceId, funnelId, period]
  );
  const byKey = useMemo(() => {
    const out = new Map<string, StepStats>();
    for (const s of detail.data?.steps ?? []) {
      const clicks = Math.max(0, s.reached - s.dropped);
      out.set(s.key, { visits: s.reached, clicks, ctr: s.reached > 0 ? Math.round((clicks / s.reached) * 100) : null });
    }
    return out;
  }, [detail.data]);

  const picker = (
    <Select aria-label={t.period} className="h-7 w-auto py-0 text-xs" value={period} onChange={(e) => setPeriod(e.target.value as Period)}>
      <option value="7">{t.days7}</option>
      <option value="30">{t.days30}</option>
      <option value="90">{t.days90}</option>
    </Select>
  );
  return { byKey, picker };
}

export function StepStatsLine({ stats }: { stats: StepStats | undefined }) {
  const t = useT(STRINGS);
  if (!stats) return null;
  if (stats.visits === 0) return <p className="text-[11px] text-ink-soft">{t.noVisits}</p>;
  return (
    <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-ink-soft">
      <span className="inline-flex items-center gap-0.5">
        <Eye className="size-3" aria-hidden />
        {fmt(t.visits, { n: stats.visits })}
      </span>
      <span className="inline-flex items-center gap-0.5">
        <MousePointerClick className="size-3" aria-hidden />
        {fmt(t.clicks, { n: stats.clicks })}
      </span>
      {stats.ctr !== null && <span>{fmt(t.ctr, { pct: stats.ctr })}</span>}
    </p>
  );
}
