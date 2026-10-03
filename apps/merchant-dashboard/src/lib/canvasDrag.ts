/**
 * Drag and resize on the live preview itself — the editor's half.
 *
 * The page is drawn inside a cross-origin iframe (the storefront), so the
 * dashboard can't see its DOM. The frame's overlay (storefront
 * components/preview/useCanvasDrag.ts) owns the pointer: when the merchant
 * grabs a handle it measures what the drag needs, and then reports the
 * pointer while it moves. This side holds the drag, works out where it
 * would land (the pure functions below), tells the frame what to draw
 * (`zimos:canvas-feedback`), and on release turns it into ONE tree edit —
 * one undo step, one preview refresh. Nothing is re-rendered while the
 * pointer moves; the frame only moves a line or restyles one node.
 *
 * Frame → editor
 *   { type: "zimos:canvas-drag", phase: "start", drag, x, y, shift }
 *   { type: "zimos:canvas-drag", phase: "move" | "end", x, y, shift }
 *   { type: "zimos:canvas-drag", phase: "cancel" }                     Esc, or the pointer was lost
 *   { type: "zimos:canvas-step", step }                                 one arrow-key press on a handle
 *
 * Editor → frame
 *   { type: "zimos:canvas-feedback", feedback, done, committed }
 *
 * Section and element drags use document coordinates (viewport + scroll), so
 * the frame can scroll under a long drag without the geometry going stale.
 *
 * Everything the frame sends is checked here, field by field: any page can
 * post to the dashboard window, and even the storefront only ever describes
 * geometry — the tree edit is always decided on this side.
 */

// --- geometry the frame sends ---------------------------------------------------

/** A section's box in document coordinates. */
export interface DragSectionBox {
  sectionId: string;
  index: number;
  top: number;
  height: number;
}

/** A column and the elements in it, in tree order; boxes in document coordinates. */
export interface DragColumnBox {
  columnId: string;
  sectionId: string;
  top: number;
  left: number;
  width: number;
  height: number;
  elements: Array<{ elementId: string; top: number; height: number }>;
}

export type DragGeometry =
  | { kind: "section"; sectionId: string; sections: DragSectionBox[] }
  | { kind: "element"; sectionId: string; elementId: string; columns: DragColumnBox[] }
  | { kind: "section-height"; sectionId: string; height: number }
  | {
      kind: "column-width";
      sectionId: string;
      rowId: string;
      /** The first of the two columns either side of the divider, in tree order. */
      index: number;
      spans: number[];
      /** Where that column starts, in px from the row's inline-start edge. */
      pairStart: number;
      /** One twelfth of the row plus one gap — the width a span adds. */
      unit: number;
      gap: number;
      rtl: boolean;
    }
  | { kind: "image-width"; sectionId: string; elementId: string; width: number; columnWidth: number; rtl: boolean };

export interface DragPointer {
  x: number;
  y: number;
  shift: boolean;
}

/** A drag in progress, as the editor holds it. */
export interface DragSession {
  drag: DragGeometry;
  start: DragPointer;
}

/** A single arrow-key press on one of the frame's handles. */
export type CanvasStep =
  | { kind: "element"; sectionId: string; elementId: string; delta: -1 | 1 }
  | { kind: "section-height"; sectionId: string; delta: -1 | 1; fine: boolean; current: number }
  | { kind: "column-width"; sectionId: string; rowId: string; index: number; spans: number[]; delta: -1 | 1 }
  | { kind: "image-width"; sectionId: string; elementId: string; delta: -1 | 1; fine: boolean; current: number };

// --- what the editor does with it -------------------------------------------------

/** One tree edit, applied by the editor (pages/website/editor/canvasEdits.ts). */
export type CanvasEdit =
  /** `to` is moveSection's target index. */
  | { kind: "move-section"; sectionId: string; to: number }
  /** `index` is the element's place in the target column, counting the column as it is now. */
  | { kind: "move-element"; elementId: string; columnId: string; index: number }
  /** Null goes back to the section's natural height. */
  | { kind: "section-height"; sectionId: string; px: number | null }
  | { kind: "column-spans"; sectionId: string; rowId: string; index: number; spans: [number, number] }
  /** Null goes back to the full width of the column. */
  | { kind: "image-width"; sectionId: string; elementId: string; pct: number | null };

/** What the frame draws while the pointer moves. */
export type CanvasFeedback =
  | { kind: "section"; gapIndex: number | null }
  | { kind: "element"; columnId: string; index: number }
  | { kind: "section-height"; sectionId: string; px: number | null; label: string }
  | { kind: "column-width"; sectionId: string; rowId: string; index: number; spans: [number, number]; label: string }
  | { kind: "image-width"; elementId: string; pct: number | null; label: string };

// --- snapping -----------------------------------------------------------------------

/** Heights snap to this grid; Shift turns snapping off. */
export const HEIGHT_STEP_PX = 8;
/** Below this a minimum height is meaningless — the section just takes its content's height. */
export const MIN_SECTION_HEIGHT_PX = 48;
export const MAX_SECTION_HEIGHT_PX = 2000;
/** Image widths snap to this many percent of the column; Shift turns snapping off. */
export const IMAGE_STEP_PCT = 5;
export const MIN_IMAGE_PCT = 10;
/** Past this distance from every column, an element drag has nowhere to land. */
export const ELEMENT_DROP_REACH_PX = 96;

function snap(value: number, step: number, shift: boolean): number {
  return shift ? Math.round(value) : Math.round(value / step) * step;
}

/**
 * A section's minimum height after a drag, or null for "its natural height".
 * Snapped to 8px unless Shift is held; anything under MIN_SECTION_HEIGHT_PX
 * means no minimum at all.
 */
export function snapSectionHeight(px: number, shift = false): number | null {
  if (!Number.isFinite(px)) return null;
  const snapped = snap(px, HEIGHT_STEP_PX, shift);
  if (snapped < MIN_SECTION_HEIGHT_PX) return null;
  return Math.min(MAX_SECTION_HEIGHT_PX, snapped);
}

/** An image's width as a percentage of its column, or null for the full width. */
export function snapImagePercent(pct: number, shift = false): number | null {
  if (!Number.isFinite(pct)) return null;
  const snapped = Math.min(100, Math.max(MIN_IMAGE_PCT, snap(pct, IMAGE_STEP_PCT, shift)));
  return snapped >= 100 ? null : snapped;
}

/**
 * The two spans either side of a column divider after a drag. The pair keeps
 * its combined span, so nothing else in the row moves; each side keeps at
 * least one twelfth. Spans are whole twelfths — the tree has nothing finer —
 * so there is no Shift variant.
 */
export function pairSpansAt(offset: number, drag: Extract<DragGeometry, { kind: "column-width" }>): [number, number] {
  const total = (drag.spans[drag.index] ?? 0) + (drag.spans[drag.index + 1] ?? 0);
  if (total < 2 || !(drag.unit > 0)) {
    return [drag.spans[drag.index] ?? 1, drag.spans[drag.index + 1] ?? 1];
  }
  const first = Math.round((offset - drag.pairStart + drag.gap / 2) / drag.unit);
  const clamped = Math.min(total - 1, Math.max(1, first));
  return [clamped, total - clamped];
}

// --- drop targets -------------------------------------------------------------------

/**
 * Which gap between sections `y` is nearest to — "before the section at this
 * index", `rects.length` being the very end. Same rule as the library's drop
 * (previewBridge.ts's nearestGapIndex), over document coordinates.
 */
export function sectionGapAt(sections: DragSectionBox[], y: number): number {
  const sorted = [...sections].sort((a, b) => a.index - b.index);
  for (const s of sorted) {
    if (y < s.top + s.height / 2) return s.index;
  }
  return sorted.length === 0 ? 0 : sorted[sorted.length - 1].index + 1;
}

/**
 * A gap turned into moveSection's target index, or null when dropping there
 * leaves the section where it is (the gap just above or just below it).
 */
export function sectionMoveTarget(from: number, gap: number, count: number): number | null {
  if (from < 0 || from >= count) return null;
  const g = Math.min(count, Math.max(0, gap));
  if (g === from || g === from + 1) return null;
  return g > from ? g - 1 : g;
}

/**
 * Where an element dragged to (x, y) would land: the column under the
 * pointer — or the nearest one, within reach — and its place among that
 * column's elements, by their vertical midpoints. Null when the pointer is
 * nowhere near a column.
 */
export function elementDropTarget(
  columns: DragColumnBox[],
  x: number,
  y: number
): { columnId: string; index: number } | null {
  let best: DragColumnBox | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const column of columns) {
    const dx = x < column.left ? column.left - x : x > column.left + column.width ? x - column.left - column.width : 0;
    const dy = y < column.top ? column.top - y : y > column.top + column.height ? y - column.top - column.height : 0;
    const distance = Math.hypot(dx, dy);
    if (distance < bestDistance) {
      best = column;
      bestDistance = distance;
    }
  }
  if (!best || bestDistance > ELEMENT_DROP_REACH_PX) return null;
  let index = best.elements.length;
  for (let i = 0; i < best.elements.length; i++) {
    const el = best.elements[i];
    if (y < el.top + el.height / 2) {
      index = i;
      break;
    }
  }
  return { columnId: best.columnId, index };
}

/**
 * Whether dropping an element at `target` would leave it exactly where it is
 * — its own slot, or the one just after it, in its own column.
 */
export function isElementNoop(drag: Extract<DragGeometry, { kind: "element" }>, target: { columnId: string; index: number }): boolean {
  const column = drag.columns.find((c) => c.columnId === target.columnId);
  const from = column ? column.elements.findIndex((e) => e.elementId === drag.elementId) : -1;
  return from !== -1 && (target.index === from || target.index === from + 1);
}

// --- resolving a drag -----------------------------------------------------------------

export interface DragLabels {
  /** The badge for "no minimum height". */
  auto: string;
}

/** Where a drag would land right now: what to draw, and the edit a release would make. */
export function resolveDrag(
  session: DragSession,
  pointer: DragPointer,
  labels: DragLabels
): { feedback: CanvasFeedback | null; edit: CanvasEdit | null } {
  const { drag, start } = session;
  switch (drag.kind) {
    case "section": {
      const from = drag.sections.find((s) => s.sectionId === drag.sectionId)?.index ?? -1;
      const gap = sectionGapAt(drag.sections, pointer.y);
      const to = sectionMoveTarget(from, gap, drag.sections.length);
      return {
        feedback: { kind: "section", gapIndex: to === null ? null : gap },
        edit: to === null ? null : { kind: "move-section", sectionId: drag.sectionId, to },
      };
    }
    case "element": {
      const target = elementDropTarget(drag.columns, pointer.x, pointer.y);
      if (!target || isElementNoop(drag, target)) return { feedback: null, edit: null };
      return {
        feedback: { kind: "element", ...target },
        edit: { kind: "move-element", elementId: drag.elementId, ...target },
      };
    }
    case "section-height": {
      const px = snapSectionHeight(drag.height + (pointer.y - start.y), pointer.shift);
      return {
        feedback: { kind: "section-height", sectionId: drag.sectionId, px, label: px === null ? labels.auto : `${px}px` },
        edit: { kind: "section-height", sectionId: drag.sectionId, px },
      };
    }
    case "column-width": {
      // The pointer's distance from the row's inline-start edge: in RTL the
      // row starts on the right, so moving left is moving "forward".
      const dx = pointer.x - start.x;
      const startBoundary = drag.pairStart + (drag.spans[drag.index] ?? 0) * drag.unit - drag.gap / 2;
      const offset = startBoundary + (drag.rtl ? -dx : dx);
      const spans = pairSpansAt(offset, drag);
      const total = spans[0] + spans[1];
      const pct = (n: number) => `${Math.round((n / 12) * 100)}%`;
      const unchanged = spans[0] === drag.spans[drag.index];
      return {
        feedback: {
          kind: "column-width",
          sectionId: drag.sectionId,
          rowId: drag.rowId,
          index: drag.index,
          spans,
          label: total === 12 ? `${pct(spans[0])} · ${pct(spans[1])}` : `${spans[0]}/12 · ${spans[1]}/12`,
        },
        edit: unchanged
          ? null
          : { kind: "column-spans", sectionId: drag.sectionId, rowId: drag.rowId, index: drag.index, spans },
      };
    }
    case "image-width": {
      // The picture stays centred in its column, so its corner moves half as
      // far as its width grows: twice the pointer's travel is the new width.
      const dx = (pointer.x - start.x) * (drag.rtl ? -1 : 1);
      const pct = snapImagePercent(((drag.width + 2 * dx) / Math.max(1, drag.columnWidth)) * 100, pointer.shift);
      return {
        feedback: { kind: "image-width", elementId: drag.elementId, pct, label: `${pct ?? 100}%` },
        edit: { kind: "image-width", sectionId: drag.sectionId, elementId: drag.elementId, pct },
      };
    }
  }
}

/**
 * The next grid line from `value` in the direction of `delta` — from an
 * off-grid 301 that is 304 going up and 296 going down, never a whole step
 * past the nearest line.
 */
function nextGridLine(value: number, step: number, delta: -1 | 1): number {
  return delta > 0 ? (Math.floor(value / step) + 1) * step : (Math.ceil(value / step) - 1) * step;
}

/** One arrow-key press as a tree edit — one step of the same size a drag snaps to. */
export function stepEdit(step: CanvasStep): CanvasEdit | null {
  switch (step.kind) {
    case "element":
      // Handled by the editor's own moveElement (blocks.ts), which knows the column.
      return null;
    case "section-height": {
      const base = step.current;
      const next = step.fine ? base + step.delta : nextGridLine(base, HEIGHT_STEP_PX, step.delta);
      return { kind: "section-height", sectionId: step.sectionId, px: snapSectionHeight(next, true) };
    }
    case "column-width": {
      const a = step.spans[step.index];
      const b = step.spans[step.index + 1];
      if (a === undefined || b === undefined) return null;
      const first = Math.min(a + b - 1, Math.max(1, a + step.delta));
      if (first === a) return null;
      return {
        kind: "column-spans",
        sectionId: step.sectionId,
        rowId: step.rowId,
        index: step.index,
        spans: [first, a + b - first],
      };
    }
    case "image-width": {
      const base = step.current;
      const next = step.fine ? base + step.delta : nextGridLine(base, IMAGE_STEP_PCT, step.delta);
      return { kind: "image-width", sectionId: step.sectionId, elementId: step.elementId, pct: snapImagePercent(next, true) };
    }
  }
}

// --- message readers ----------------------------------------------------------------

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 200;
}

function isNum(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value < 10_000;
}

function isDelta(value: unknown): value is -1 | 1 {
  return value === -1 || value === 1;
}

function readSpans(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > 12) return null;
  return value.every((n) => Number.isInteger(n) && n >= 1 && n <= 12) ? (value as number[]) : null;
}

function readSectionBoxes(value: unknown): DragSectionBox[] | null {
  if (!Array.isArray(value) || value.length > 1000) return null;
  const out: DragSectionBox[] = [];
  for (const raw of value) {
    const r = raw as Record<string, unknown> | null;
    if (!r || !isId(r.sectionId) || !isIndex(r.index) || !isNum(r.top) || !isNum(r.height) || r.height < 0) return null;
    out.push({ sectionId: r.sectionId, index: r.index, top: r.top, height: r.height });
  }
  return out;
}

function readColumnBoxes(value: unknown): DragColumnBox[] | null {
  if (!Array.isArray(value) || value.length > 2000) return null;
  const out: DragColumnBox[] = [];
  for (const raw of value) {
    const c = raw as Record<string, unknown> | null;
    if (
      !c ||
      !isId(c.columnId) ||
      !isId(c.sectionId) ||
      !isNum(c.top) ||
      !isNum(c.left) ||
      !isNum(c.width) ||
      !isNum(c.height) ||
      !Array.isArray(c.elements) ||
      c.elements.length > 2000
    ) {
      return null;
    }
    const elements: DragColumnBox["elements"] = [];
    for (const rawEl of c.elements) {
      const e = rawEl as Record<string, unknown> | null;
      if (!e || !isId(e.elementId) || !isNum(e.top) || !isNum(e.height) || e.height < 0) return null;
      elements.push({ elementId: e.elementId, top: e.top, height: e.height });
    }
    out.push({ columnId: c.columnId, sectionId: c.sectionId, top: c.top, left: c.left, width: c.width, height: c.height, elements });
  }
  return out;
}

export function readDragGeometry(value: unknown): DragGeometry | null {
  const d = value as Record<string, unknown> | null;
  if (!d || typeof d !== "object" || !isId(d.sectionId)) return null;
  switch (d.kind) {
    case "section": {
      const sections = readSectionBoxes(d.sections);
      return sections ? { kind: "section", sectionId: d.sectionId, sections } : null;
    }
    case "element": {
      const columns = readColumnBoxes(d.columns);
      return columns && isId(d.elementId)
        ? { kind: "element", sectionId: d.sectionId, elementId: d.elementId, columns }
        : null;
    }
    case "section-height":
      return isNum(d.height) && d.height >= 0 ? { kind: "section-height", sectionId: d.sectionId, height: d.height } : null;
    case "column-width": {
      const spans = readSpans(d.spans);
      if (!spans || !isId(d.rowId) || !isIndex(d.index) || d.index + 1 >= spans.length) return null;
      if (!isNum(d.pairStart) || !isNum(d.unit) || d.unit <= 0 || !isNum(d.gap) || typeof d.rtl !== "boolean") return null;
      return {
        kind: "column-width",
        sectionId: d.sectionId,
        rowId: d.rowId,
        index: d.index,
        spans,
        pairStart: d.pairStart,
        unit: d.unit,
        gap: d.gap,
        rtl: d.rtl,
      };
    }
    case "image-width":
      return isId(d.elementId) && isNum(d.width) && isNum(d.columnWidth) && d.columnWidth > 0 && typeof d.rtl === "boolean"
        ? {
            kind: "image-width",
            sectionId: d.sectionId,
            elementId: d.elementId,
            width: d.width,
            columnWidth: d.columnWidth,
            rtl: d.rtl,
          }
        : null;
    default:
      return null;
  }
}

export type CanvasDragMessage =
  | { type: "zimos:canvas-drag"; phase: "start"; drag: DragGeometry; pointer: DragPointer }
  | { type: "zimos:canvas-drag"; phase: "move" | "end"; pointer: DragPointer }
  | { type: "zimos:canvas-drag"; phase: "cancel" };

export function readCanvasDrag(data: Record<string, unknown>): CanvasDragMessage | null {
  if (data.phase === "cancel") return { type: "zimos:canvas-drag", phase: "cancel" };
  if (!isNum(data.x) || !isNum(data.y)) return null;
  const pointer: DragPointer = { x: data.x, y: data.y, shift: data.shift === true };
  if (data.phase === "move" || data.phase === "end") return { type: "zimos:canvas-drag", phase: data.phase, pointer };
  if (data.phase === "start") {
    const drag = readDragGeometry(data.drag);
    return drag ? { type: "zimos:canvas-drag", phase: "start", drag, pointer } : null;
  }
  return null;
}

export function readCanvasStep(value: unknown): CanvasStep | null {
  const s = value as Record<string, unknown> | null;
  if (!s || typeof s !== "object" || !isId(s.sectionId) || !isDelta(s.delta)) return null;
  switch (s.kind) {
    case "element":
      return isId(s.elementId) ? { kind: "element", sectionId: s.sectionId, elementId: s.elementId, delta: s.delta } : null;
    case "section-height":
      return isNum(s.current) && s.current >= 0
        ? { kind: "section-height", sectionId: s.sectionId, delta: s.delta, fine: s.fine === true, current: s.current }
        : null;
    case "column-width": {
      const spans = readSpans(s.spans);
      return spans && isId(s.rowId) && isIndex(s.index) && s.index + 1 < spans.length
        ? { kind: "column-width", sectionId: s.sectionId, rowId: s.rowId, index: s.index, spans, delta: s.delta }
        : null;
    }
    case "image-width":
      return isId(s.elementId) && isNum(s.current)
        ? {
            kind: "image-width",
            sectionId: s.sectionId,
            elementId: s.elementId,
            delta: s.delta,
            fine: s.fine === true,
            current: s.current,
          }
        : null;
    default:
      return null;
  }
}
