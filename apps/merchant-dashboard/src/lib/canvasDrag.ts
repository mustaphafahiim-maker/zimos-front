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
  | { kind: "image-width"; sectionId: string; elementId: string; width: number; columnWidth: number; rtl: boolean }
  | PictureGeometry
  | LogoGeometry
  | ShellPartGeometry;

/** A zone of a template header and its parts in order, in document coordinates. */
export interface ShellZoneBox {
  zone: string;
  top: number;
  left: number;
  width: number;
  height: number;
  parts: Array<{ id: string; top: number; left: number; width: number; height: number }>;
}

/** A part of a template header grabbed by its grip (storefront lib/xsLayout). */
export interface ShellPartGeometry {
  kind: "shell-part";
  sectionId: "header";
  partId: string;
  device: ScreenDevice;
  rtl: boolean;
  zones: ShellZoneBox[];
}

/** An edge or a corner of a picture, by compass point on the screen: "e" is the right-hand edge in either direction. */
export type PictureHandle = "n" | "s" | "e" | "w" | "ne" | "nw" | "se" | "sw";
export const PICTURE_HANDLES: readonly PictureHandle[] = ["n", "s", "e", "w", "ne", "nw", "se", "sw"];

/** The screen a size is set for — the one the preview shows (storefront lib/deviceValue.ts). */
export type ScreenDevice = "base" | "tablet" | "mobile";
const SCREEN_DEVICES: readonly ScreenDevice[] = ["base", "tablet", "mobile"];

/**
 * One picture of an imported template's band, grabbed by an edge or corner.
 * `path` is where the picture is saved in the band's props ("image",
 * "items.2.image", "images.1"); `natural*` is the size the look gives it with
 * no size of its own, which a drag snaps back to; `boxWidth` is the width of
 * the box it sits in, whose twentieths are the steps a width snaps to.
 */
export interface PictureGeometry {
  kind: "picture";
  sectionId: string;
  elementId: string;
  path: string;
  handle: PictureHandle;
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
  boxWidth: number;
  device: ScreenDevice;
}

/** A template header's or footer's logo, grabbed by an edge or corner: it keeps its shape, so only its height is saved. */
export interface LogoGeometry {
  kind: "logo";
  /** "header" or "footer" — where the logo is, standing in for the section a page drag names. */
  sectionId: "header" | "footer";
  handle: PictureHandle;
  width: number;
  height: number;
  naturalHeight: number;
  device: ScreenDevice;
}

export interface DragPointer {
  x: number;
  y: number;
  shift: boolean;
  /** Resize from the centre (a picture or a logo). */
  alt?: boolean;
  /** Resize every picture of the band alike (a picture). */
  ctrl?: boolean;
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
  | { kind: "image-width"; sectionId: string; elementId: string; delta: -1 | 1; fine: boolean; current: number }
  /** An arrow on a picture's handle: left/right its width, up/down its height (`axis`), Ctrl/⌘ for every picture of the band. */
  | {
      kind: "picture";
      sectionId: string;
      elementId: string;
      path: string;
      device: ScreenDevice;
      axis: "w" | "h";
      delta: -1 | 1;
      fine: boolean;
      band: boolean;
      width: number;
      height: number;
      naturalWidth: number;
      naturalHeight: number;
      boxWidth: number;
    }
  | { kind: "logo"; sectionId: "header" | "footer"; device: ScreenDevice; delta: -1 | 1; fine: boolean; current: number; natural: number }
  /**
   * An arrow on a header part's grip, already resolved by the frame (which
   * sees what shows): along its zone, or to the end of the zone before or
   * after — where it lands as in "shell-move".
   */
  | { kind: "shell-part"; sectionId: "header"; partId: string; device: ScreenDevice; zone: string; before: string | null; after: string | null };

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
  | { kind: "image-width"; sectionId: string; elementId: string; pct: number | null }
  /**
   * A picture's own size on one screen, in pixels; null goes back to the
   * look's, absent leaves that side as it was. `scope: "band"` gives every
   * picture of the band (of the same list) the same size.
   */
  | {
      kind: "picture-size";
      sectionId: string;
      elementId: string;
      path: string;
      device: ScreenDevice;
      scope: "one" | "band";
      width?: number | null;
      height?: number | null;
    }
  /** A template logo's height on one screen; null goes back to the look's. Applied to the store look, not the page. */
  | { kind: "logo-size"; part: "header" | "footer"; device: ScreenDevice; px: number | null }
  /**
   * A template header's part moved into `zone`, on one screen: right before
   * the part `before`, else right after `after`, else (the zone shows
   * nothing) at its end. Named by the parts that show beside it, not by an
   * index — a look may hide parts its zone holds. Applied to the store look.
   */
  | { kind: "shell-move"; id: string; zone: string; before: string | null; after: string | null; device: ScreenDevice }
  /** A band's ground picture (`path`, e.g. "slides.0.image") centred on x% y%: saved as its "…Position". */
  | { kind: "bg-position"; sectionId: string; elementId: string; path: string; x: number; y: number }
  /** One item of a band's list (its banners, slides, pictures…) moved to `to`, duplicated after itself, or deleted. */
  | { kind: "band-item"; sectionId: string; elementId: string; list: string; action: "move" | "duplicate" | "delete"; from: number; to?: number };

/** What the frame draws while the pointer moves. */
export type CanvasFeedback =
  | { kind: "section"; gapIndex: number | null }
  | { kind: "element"; columnId: string; index: number }
  | { kind: "section-height"; sectionId: string; px: number | null; label: string }
  | { kind: "column-width"; sectionId: string; rowId: string; index: number; spans: [number, number]; label: string }
  | { kind: "image-width"; elementId: string; pct: number | null; label: string }
  /** Null on a side: the look's own size there. */
  | { kind: "picture"; elementId: string; path: string; scope: "one" | "band"; width: number | null; height: number | null; label: string }
  | { kind: "logo"; part: "header" | "footer"; px: number | null; label: string }
  | { kind: "shell-part"; zone: string; index: number };

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

/** A picture's sides, in pixels: never smaller than this, never wider than its box, never taller than PICTURE_MAX_H. */
export const PICTURE_MIN_PX = 24;
export const PICTURE_MAX_H = 2000;
/** Within this many pixels of the look's own size, a side snaps back to it (and is saved as "the look's"). */
export const PICTURE_SNAP_PX = 8;
/** A width snaps to twentieths (5%) of the box the picture sits in. */
export const PICTURE_STEP_PCT = 5;
/** A logo's height, by where it is: the same ranges the storefront reads (lib/storeShell.ts). */
export const LOGO_RANGE: Record<"header" | "footer", readonly [number, number]> = { header: [20, 140], footer: [16, 200] };

const clamp = (value: number, least: number, most: number) => Math.min(most, Math.max(least, value));

/** Which way an edge or corner grows the picture on screen: +1 right/down, -1 left/up, 0 not on that axis. */
export function handleSigns(handle: PictureHandle): { sx: -1 | 0 | 1; sy: -1 | 0 | 1 } {
  return {
    sx: handle.includes("e") ? 1 : handle.includes("w") ? -1 : 0,
    sy: handle.includes("s") ? 1 : handle.includes("n") ? -1 : 0,
  };
}

/**
 * A picture's size after a drag: each side the handle moves follows the
 * pointer (twice as far with Alt, resizing from the centre); Shift keeps the
 * picture's shape. A width snaps to 5% of its box, and either side snaps back
 * to the look's own size near it — saved then as null, "the look's".
 */
export function pictureSizeAt(
  drag: PictureGeometry,
  dx: number,
  dy: number,
  { shift = false, alt = false }: { shift?: boolean; alt?: boolean } = {}
): { width: number | null; height: number | null; shown: { width: number; height: number }; touches: { width: boolean; height: boolean } } {
  const { sx, sy } = handleSigns(drag.handle);
  const k = alt ? 2 : 1;
  let w = sx ? drag.width + sx * dx * k : drag.width;
  let h = sy ? drag.height + sy * dy * k : drag.height;
  const ratio = drag.height / Math.max(1, drag.width);
  if (shift) {
    // The side that moved more, relative to its size, leads.
    if (sx && (!sy || Math.abs(w - drag.width) / Math.max(1, drag.width) >= Math.abs(h - drag.height) / Math.max(1, drag.height))) h = w * ratio;
    else w = h / ratio;
  }
  const maxW = Math.max(PICTURE_MIN_PX, drag.boxWidth);
  w = clamp(w, PICTURE_MIN_PX, maxW);
  h = clamp(h, PICTURE_MIN_PX, PICTURE_MAX_H);
  const step = (drag.boxWidth * PICTURE_STEP_PCT) / 100;
  let width: number | null = Math.abs(w - drag.naturalWidth) <= PICTURE_SNAP_PX ? null : step > 0 ? clamp(Math.round(w / step) * step, PICTURE_MIN_PX, maxW) : w;
  if (shift && width !== null) h = clamp(width * ratio, PICTURE_MIN_PX, PICTURE_MAX_H);
  let height: number | null = Math.abs(h - drag.naturalHeight) <= PICTURE_SNAP_PX ? null : h;
  if (width !== null) width = Math.round(width);
  if (height !== null) height = Math.round(height);
  const touches = { width: sx !== 0 || (shift && sy !== 0), height: sy !== 0 || (shift && sx !== 0) };
  return {
    width,
    height,
    shown: { width: width ?? Math.round(drag.naturalWidth), height: height ?? Math.round(drag.naturalHeight) },
    touches,
  };
}

/** A logo's height after a drag: it keeps its shape, so a sideways drag scales it too. Snaps to 2px, and back to the look's. */
export function logoHeightAt(drag: LogoGeometry, dx: number, dy: number, alt = false): number | null {
  const { sx, sy } = handleSigns(drag.handle);
  const k = alt ? 2 : 1;
  const byWidth = sx ? (drag.width + sx * dx * k) / Math.max(1, drag.width) : 0;
  const byHeight = sy ? (drag.height + sy * dy * k) / Math.max(1, drag.height) : 0;
  // From a corner, whichever way the pointer moved more leads.
  const scale = sx && sy ? (Math.abs(byWidth - 1) >= Math.abs(byHeight - 1) ? byWidth : byHeight) : sx ? byWidth : byHeight;
  const [least, most] = LOGO_RANGE[drag.sectionId];
  const px = clamp(Math.round((drag.height * scale) / 2) * 2, least, most);
  return Math.abs(px - drag.naturalHeight) <= 2 ? null : px;
}

/** Past this distance from every zone, a header part has nowhere to land. */
export const SHELL_DROP_REACH_PX = 80;

/**
 * Where a header part dragged to (x, y) would land: the smallest zone under
 * the pointer (the bar's own zone holds the menu's and the icons'), else the
 * nearest within reach; its place there by the parts' middles in the way the
 * header reads. Null nowhere, or where it already is.
 */
export function shellDropTarget(drag: ShellPartGeometry, x: number, y: number): { zone: string; index: number } | null {
  const pad = 8;
  const inside = drag.zones.filter((z) => x >= z.left - pad && x <= z.left + z.width + pad && y >= z.top - pad && y <= z.top + z.height + pad);
  let zone = inside.sort((a, b) => a.width * a.height - b.width * b.height)[0] ?? null;
  if (!zone) {
    let best = Number.POSITIVE_INFINITY;
    for (const z of drag.zones) {
      const dx = x < z.left ? z.left - x : x > z.left + z.width ? x - z.left - z.width : 0;
      const dy = y < z.top ? z.top - y : y > z.top + z.height ? y - z.top - z.height : 0;
      const d = Math.hypot(dx, dy);
      if (d < best) {
        best = d;
        zone = z;
      }
    }
    if (!zone || best > SHELL_DROP_REACH_PX) return null;
  }
  const others = zone.parts;
  let index = others.length;
  for (let i = 0; i < others.length; i++) {
    const middle = others[i].left + others[i].width / 2;
    if (drag.rtl ? x > middle : x < middle) {
      index = i;
      break;
    }
  }
  const from = zone.parts.findIndex((p) => p.id === drag.partId);
  if (from !== -1 && (index === from || index === from + 1)) return null;
  return { zone: zone.zone, index };
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
  /** The badge's note when a picture or logo is back at the look's own size. */
  original?: string;
  /** The badge's note when every picture of the band is being resized. */
  everyPicture?: string;
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
    case "picture": {
      const size = pictureSizeAt(drag, pointer.x - start.x, pointer.y - start.y, pointer);
      const scope = pointer.ctrl ? "band" : "one";
      const back = size.width === null && size.height === null && labels.original ? ` · ${labels.original}` : "";
      const all = scope === "band" && labels.everyPicture ? ` · ${labels.everyPicture}` : "";
      const unchanged =
        (!size.touches.width || size.shown.width === Math.round(drag.width)) && (!size.touches.height || size.shown.height === Math.round(drag.height));
      return {
        feedback: {
          kind: "picture",
          elementId: drag.elementId,
          path: drag.path,
          scope,
          width: size.touches.width ? size.width : null,
          height: size.touches.height ? size.height : null,
          label: `${size.shown.width} × ${size.shown.height}${back}${all}`,
        },
        edit:
          unchanged && scope === "one"
            ? null
            : {
                kind: "picture-size",
                sectionId: drag.sectionId,
                elementId: drag.elementId,
                path: drag.path,
                device: drag.device,
                scope,
                ...(size.touches.width ? { width: size.width } : {}),
                ...(size.touches.height ? { height: size.height } : {}),
              },
      };
    }
    case "shell-part": {
      const target = shellDropTarget(drag, pointer.x, pointer.y);
      if (!target) return { feedback: null, edit: null };
      const shown = drag.zones.find((z) => z.zone === target.zone)?.parts ?? [];
      const before = shown[target.index]?.id ?? null;
      const after = before ? null : (shown[target.index - 1]?.id ?? null);
      return { feedback: { kind: "shell-part", ...target }, edit: { kind: "shell-move", id: drag.partId, zone: target.zone, before, after, device: drag.device } };
    }
    case "logo": {
      const px = logoHeightAt(drag, pointer.x - start.x, pointer.y - start.y, pointer.alt);
      return {
        feedback: { kind: "logo", part: drag.sectionId, px, label: px === null ? (labels.original ?? labels.auto) : `${px}px` },
        edit: { kind: "logo-size", part: drag.sectionId, device: drag.device, px },
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
    case "picture": {
      // One press: a twentieth of the box sideways or 8px up and down; with Shift, one pixel.
      const along = step.axis === "w" ? step.width : step.height;
      const unit = step.fine ? 1 : step.axis === "w" ? (step.boxWidth * PICTURE_STEP_PCT) / 100 : HEIGHT_STEP_PX;
      const natural = step.axis === "w" ? step.naturalWidth : step.naturalHeight;
      let next = step.fine ? along + step.delta : nextGridLine(along, Math.max(1, unit), step.delta);
      // A press that would pass the look's own size stops on it.
      if ((along > natural && next < natural) || (along < natural && next > natural)) next = natural;
      const most = step.axis === "w" ? Math.max(PICTURE_MIN_PX, step.boxWidth) : PICTURE_MAX_H;
      const px = Math.round(clamp(next, PICTURE_MIN_PX, most));
      const value = Math.abs(px - natural) < 1 ? null : px;
      return {
        kind: "picture-size",
        sectionId: step.sectionId,
        elementId: step.elementId,
        path: step.path,
        device: step.device,
        scope: step.band ? "band" : "one",
        ...(step.axis === "w" ? { width: value } : { height: value }),
      };
    }
    case "shell-part":
      // The editor knows the header's arrangement; it turns this into a move (WebsiteEditorPage).
      return null;
    case "logo": {
      const [least, most] = LOGO_RANGE[step.sectionId];
      const next = step.fine ? step.current + step.delta : nextGridLine(step.current, 2, step.delta);
      const px = clamp(next, least, most);
      return { kind: "logo-size", part: step.sectionId, device: step.device, px: px === step.natural ? null : px };
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

/** Where a picture is saved in a band's props: "image", "items.2.image", "images.1". */
export function isPicturePath(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z]{1,30}(?:\.\d{1,2}(?:\.[A-Za-z]{1,30})?)?$/.test(value);
}

function isHandle(value: unknown): value is PictureHandle {
  return PICTURE_HANDLES.includes(value as PictureHandle);
}

function isScreen(value: unknown): value is ScreenDevice {
  return SCREEN_DEVICES.includes(value as ScreenDevice);
}

/** A size in pixels a frame could have measured. */
function isPx(value: unknown): value is number {
  return isNum(value) && value >= 0 && value <= 10_000;
}

/** A header part's id (storefront lib/xsLayout). */
function isPartId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(value);
}

function isShellPart(value: unknown): value is "header" | "footer" {
  return value === "header" || value === "footer";
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
    case "picture":
      return isId(d.elementId) &&
        isPicturePath(d.path) &&
        isHandle(d.handle) &&
        isScreen(d.device) &&
        isPx(d.width) &&
        isPx(d.height) &&
        isPx(d.naturalWidth) &&
        isPx(d.naturalHeight) &&
        isPx(d.boxWidth)
        ? {
            kind: "picture",
            sectionId: d.sectionId,
            elementId: d.elementId,
            path: d.path,
            handle: d.handle,
            width: d.width,
            height: d.height,
            naturalWidth: d.naturalWidth,
            naturalHeight: d.naturalHeight,
            boxWidth: d.boxWidth,
            device: d.device,
          }
        : null;
    case "shell-part": {
      if (d.sectionId !== "header" || !isPartId(d.partId) || !isScreen(d.device) || typeof d.rtl !== "boolean" || !Array.isArray(d.zones) || d.zones.length > 12) return null;
      const zones: ShellZoneBox[] = [];
      for (const raw of d.zones) {
        const z = raw as Record<string, unknown> | null;
        if (!z || typeof z.zone !== "string" || !/^[a-z]{1,20}$/.test(z.zone) || !isNum(z.top) || !isNum(z.left) || !isPx(z.width) || !isPx(z.height) || !Array.isArray(z.parts) || z.parts.length > 40) return null;
        const parts: ShellZoneBox["parts"] = [];
        for (const rawPart of z.parts) {
          const p = rawPart as Record<string, unknown> | null;
          if (!p || !isPartId(p.id) || !isNum(p.top) || !isNum(p.left) || !isPx(p.width) || !isPx(p.height)) return null;
          parts.push({ id: p.id, top: p.top, left: p.left, width: p.width, height: p.height });
        }
        zones.push({ zone: z.zone, top: z.top, left: z.left, width: z.width, height: z.height, parts });
      }
      return { kind: "shell-part", sectionId: "header", partId: d.partId, device: d.device, rtl: d.rtl, zones };
    }
    case "logo":
      return isShellPart(d.sectionId) && isHandle(d.handle) && isScreen(d.device) && isPx(d.width) && isPx(d.height) && isPx(d.naturalHeight)
        ? { kind: "logo", sectionId: d.sectionId, handle: d.handle, width: d.width, height: d.height, naturalHeight: d.naturalHeight, device: d.device }
        : null;
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
  // Alt and Ctrl/⌘ only when pressed: a pointer that names neither reads exactly as before them.
  const pointer: DragPointer = { x: data.x, y: data.y, shift: data.shift === true, ...(data.alt === true ? { alt: true } : {}), ...(data.ctrl === true ? { ctrl: true } : {}) };
  if (data.phase === "move" || data.phase === "end") return { type: "zimos:canvas-drag", phase: data.phase, pointer };
  if (data.phase === "start") {
    const drag = readDragGeometry(data.drag);
    return drag ? { type: "zimos:canvas-drag", phase: "start", drag, pointer } : null;
  }
  return null;
}

export function readCanvasStep(value: unknown): CanvasStep | null {
  const s = value as Record<string, unknown> | null;
  if (!s || typeof s !== "object" || !isId(s.sectionId)) return null;
  // A header part's arrow press comes placed by the frame, with no delta.
  if (s.kind === "shell-part") {
    return s.sectionId === "header" &&
      isPartId(s.partId) &&
      isScreen(s.device) &&
      typeof s.zone === "string" &&
      /^[a-z]{1,20}$/.test(s.zone) &&
      (s.before === null || isPartId(s.before)) &&
      (s.after === null || isPartId(s.after))
      ? { kind: "shell-part", sectionId: "header", partId: s.partId, device: s.device, zone: s.zone, before: s.before, after: s.after }
      : null;
  }
  if (!isDelta(s.delta)) return null;
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
    case "picture":
      return isId(s.elementId) &&
        isPicturePath(s.path) &&
        isScreen(s.device) &&
        (s.axis === "w" || s.axis === "h") &&
        isPx(s.width) &&
        isPx(s.height) &&
        isPx(s.naturalWidth) &&
        isPx(s.naturalHeight) &&
        isPx(s.boxWidth)
        ? {
            kind: "picture",
            sectionId: s.sectionId,
            elementId: s.elementId,
            path: s.path,
            device: s.device,
            axis: s.axis,
            delta: s.delta,
            fine: s.fine === true,
            band: s.band === true,
            width: s.width,
            height: s.height,
            naturalWidth: s.naturalWidth,
            naturalHeight: s.naturalHeight,
            boxWidth: s.boxWidth,
          }
        : null;
    case "logo":
      return isShellPart(s.sectionId) && isScreen(s.device) && isPx(s.current) && isPx(s.natural)
        ? { kind: "logo", sectionId: s.sectionId, device: s.device, delta: s.delta, fine: s.fine === true, current: s.current, natural: s.natural }
        : null;
    default:
      return null;
  }
}
