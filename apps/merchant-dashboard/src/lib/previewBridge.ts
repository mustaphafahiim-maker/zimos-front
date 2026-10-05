/**
 * The dashboard half of the message bridge between the website editor and its
 * live storefront preview. The storefront half is
 * apps/storefront/src/components/preview/PreviewBridge.tsx; the two apps share
 * no code, so the shapes are spelled out on both sides.
 *
 * Frame → editor (only ever accepted from the storefront origin, and only
 * from a frame this editor owns):
 *   { type: "zimos:preview-ready", sectionIds }        after every (re)load
 *   { type: "zimos:select-section", sectionId }        a section was clicked
 *   { type: "zimos:select-shell", part }                the header, footer or announcement bar was clicked
 *   { type: "zimos:insert-section", index }             "add a section here"
 *   { type: "zimos:move-section", sectionId, direction } the canvas's own up/down buttons
 *   { type: "zimos:section-rects", sections }            each section's box, while a drag is on
 *   { type: "zimos:canvas-drag", phase, … }               drag / resize on the page itself (lib/canvasDrag.ts)
 *   { type: "zimos:canvas-step", step }                   one arrow-key press on a canvas handle
 *   { type: "zimos:color-mode", mode }                    the page went light or dark (its own switch, or the OS)
 *   { type: "zimos:edit-text", elementId, text }          a double-click text edit was committed (item 95)
 *
 * `zimos:preview-ready` also carries `colorMode`, the mode the page opened in.
 *
 * Editor → frame (posted to the storefront origin, never "*"):
 *   { type: "zimos:editor-state", selectedId, labels, strings, theme,
 *     selectedShell, shellLabels, shell, colorMode }
 *   { type: "zimos:scroll-to-section", sectionId }
 *   { type: "zimos:scroll-to-shell", part }
 *   { type: "zimos:drag-state", active, hoverIndex }     a library block is being dragged over the canvas
 *   { type: "zimos:canvas-feedback", feedback, done, committed }  what a canvas drag should draw
 *
 * `shell` is the unsaved header/footer (and announcement bar) in the exact
 * shape a save writes into themeSettings (`header` / `footer`); the frame
 * reads it with the same functions the live store uses.
 *
 * Drag-and-drop from the block library onto the canvas is native HTML5 DnD
 * started in the dashboard (same-origin) and dropped on a cross-origin frame,
 * so `dragover`/`drop` fire on a transparent overlay the dashboard positions
 * over the iframe (see StorefrontPreview) rather than inside the frame's own
 * document, which the dashboard can't read into. `zimos:section-rects` is how
 * the frame hands over what it can see — every section's box — so the
 * dashboard can turn a pointer position into "the gap between section N and
 * N+1" itself; `zimos:drag-state` sends that gap back down so the frame's own
 * "+" indicators and drop-line agree with what the dashboard is about to do.
 */

/** An unsaved store look, as the storefront's `readPreviewTheme` accepts it. */
export interface PreviewTheme {
  /** A store theme key, or "original". */
  storeTheme?: string;
  primaryColor?: string;
  primaryColorDark?: string;
  secondaryColor?: string;
  fontFamily?: string;
  cornerRadius?: string;
  /** Undefined leaves the saved logo alone; null previews "no logo". */
  logoUrl?: string | null;
}

import { readCanvasDrag, readCanvasStep, type CanvasDragMessage, type CanvasStep } from "./canvasDrag";

/** Light or dark — the preview's own switch, independent of the dashboard's. */
export type ColorMode = "light" | "dark";

export function isColorMode(value: unknown): value is ColorMode {
  return value === "light" || value === "dark";
}

/** The store's fixed parts — drawn by the store layout on every page, not by the page tree. */
export type ShellPart = "header" | "footer" | "announcement";
const SHELL_PART_SET = new Set<string>(["header", "footer", "announcement"]);

export function isShellPart(value: unknown): value is ShellPart {
  return typeof value === "string" && SHELL_PART_SET.has(value);
}

/** Unsaved header/footer settings, exactly as a save would write them into themeSettings. */
export interface ShellPreview {
  header: Record<string, unknown>;
  footer: Record<string, unknown> | null;
}

/** One section's box, as the frame measures it (its own viewport, `getBoundingClientRect()`). */
export interface SectionRect {
  sectionId: string;
  /** Its position in the page — same number as `zimos:insert-section`'s index. */
  index: number;
  top: number;
  height: number;
}

export type FrameMessage =
  | { type: "zimos:preview-ready"; sectionIds: string[]; colorMode?: ColorMode }
  | { type: "zimos:color-mode"; mode: ColorMode }
  | { type: "zimos:select-section"; sectionId: string }
  | { type: "zimos:select-shell"; part: ShellPart }
  | { type: "zimos:insert-section"; index: number }
  | { type: "zimos:move-section"; sectionId: string; direction: "up" | "down" }
  | { type: "zimos:section-rects"; sections: SectionRect[] }
  | CanvasDragMessage
  | { type: "zimos:canvas-step"; step: CanvasStep }
  | { type: "zimos:edit-text"; elementId: string; text: string };

/**
 * The canvas's own words, in the editor's language: the section outline's
 * buttons, and the handles for dragging and resizing on the page. The frame
 * falls back to English for any it isn't sent.
 */
export interface CanvasStrings {
  addAbove: string;
  addBelow: string;
  moveUp: string;
  moveDown: string;
  dragSection?: string;
  dragElement?: string;
  resizeHeight?: string;
  resizeColumns?: string;
  resizeImage?: string;
  /** The size badge for "no minimum height". */
  auto?: string;
  /** The tooltip on text that a double-click edits. */
  editText?: string;
}

export interface EditorStateMessage {
  type: "zimos:editor-state";
  selectedId: string | null;
  labels: Record<string, string>;
  strings: CanvasStrings;
  theme: PreviewTheme | null;
  selectedShell: ShellPart | null;
  shellLabels: Record<ShellPart, string> | null;
  /** Null shows the saved header and footer. */
  shell: ShellPreview | null;
  /** Null leaves the frame on its own (stored or system) mode. */
  colorMode: ColorMode | null;
  /** Outlines every section, row, column and element (item 95). */
  xray?: boolean;
  /** The elements whose text a double-click edits on the page. */
  inlineText?: string[];
}

export interface ScrollToSectionMessage {
  type: "zimos:scroll-to-section";
  sectionId: string;
}

export interface ScrollToShellMessage {
  type: "zimos:scroll-to-shell";
  part: ShellPart;
}

/**
 * Sent while a block from the library is being dragged over the canvas, so
 * the frame's between-section "+" indicators stay up continuously instead of
 * only on hover, and light up whichever gap the dashboard has decided the
 * pointer is nearest to. `hoverIndex` is null before the frame's first
 * `zimos:section-rects` reply lets the dashboard compute one.
 */
export interface DragStateMessage {
  type: "zimos:drag-state";
  active: boolean;
  hoverIndex: number | null;
}

/** `scheme://host[:port]` of a URL, or null when it isn't one. */
export function originOf(url: string): string | null {
  try {
    const { origin } = new URL(url);
    return origin === "null" ? null : origin;
  } catch {
    return null;
  }
}

/** Ids are free-form strings server-side; this only rules out junk. */
function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 200;
}

/**
 * Reads a `message` event as a frame message, or null when it must be
 * ignored: from any origin but the storefront's, from a window that isn't one
 * of the editor's own preview frames (when `frames` is given), or not one of
 * the shapes above. Anything can post to the dashboard window, so every
 * field is checked rather than cast.
 */
export function readFrameMessage(
  event: Pick<MessageEvent, "origin" | "data"> & { source?: unknown },
  storefrontOrigin: string | null,
  frames?: ReadonlyArray<unknown>
): FrameMessage | null {
  if (!storefrontOrigin || event.origin !== storefrontOrigin) return null;
  if (frames && !frames.some((frame) => frame != null && frame === event.source)) return null;

  const data = event.data as Record<string, unknown> | null;
  if (!data || typeof data !== "object") return null;

  switch (data.type) {
    case "zimos:preview-ready":
      return {
        type: "zimos:preview-ready",
        sectionIds: Array.isArray(data.sectionIds) ? data.sectionIds.filter(isId) : [],
        ...(isColorMode(data.colorMode) ? { colorMode: data.colorMode } : {}),
      };
    case "zimos:color-mode":
      return isColorMode(data.mode) ? { type: "zimos:color-mode", mode: data.mode } : null;
    case "zimos:select-section":
      return isId(data.sectionId) ? { type: "zimos:select-section", sectionId: data.sectionId } : null;
    case "zimos:select-shell":
      return isShellPart(data.part) ? { type: "zimos:select-shell", part: data.part } : null;
    case "zimos:insert-section":
      return typeof data.index === "number" && Number.isInteger(data.index) && data.index >= 0
        ? { type: "zimos:insert-section", index: data.index }
        : null;
    case "zimos:move-section":
      return isId(data.sectionId) && (data.direction === "up" || data.direction === "down")
        ? { type: "zimos:move-section", sectionId: data.sectionId, direction: data.direction }
        : null;
    case "zimos:section-rects":
      return Array.isArray(data.sections)
        ? { type: "zimos:section-rects", sections: data.sections.filter(isSectionRect) }
        : null;
    case "zimos:canvas-drag":
      return readCanvasDrag(data);
    case "zimos:canvas-step": {
      const step = readCanvasStep(data.step);
      return step ? { type: "zimos:canvas-step", step } : null;
    }
    case "zimos:edit-text":
      return isId(data.elementId) && typeof data.text === "string" && data.text.length <= 4000
        ? { type: "zimos:edit-text", elementId: data.elementId, text: data.text }
        : null;
    default:
      return null;
  }
}

/** A well-formed section box — junk entries are dropped rather than the whole message. */
function isSectionRect(value: unknown): value is SectionRect {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    isId(r.sectionId) &&
    typeof r.index === "number" &&
    Number.isInteger(r.index) &&
    r.index >= 0 &&
    typeof r.top === "number" &&
    Number.isFinite(r.top) &&
    typeof r.height === "number" &&
    Number.isFinite(r.height) &&
    r.height >= 0
  );
}

/**
 * Which gap between sections a Y position is nearest to — "before the section
 * at this index", where `rects.length` means "at the very end", exactly the
 * index `insertSection()` expects. `y` and every rect's `top`/`height` must be
 * in the same coordinate space (the iframe's own viewport: both come from
 * `getBoundingClientRect()` inside it, and the dashboard's drop overlay sits
 * pixel-for-pixel over that same iframe, so a pointer position needs no
 * further scaling — see StorefrontPreview).
 */
export function nearestGapIndex(rects: SectionRect[], y: number): number {
  const sorted = [...rects].sort((a, b) => a.index - b.index);
  for (const rect of sorted) {
    if (y < rect.top + rect.height / 2) return rect.index;
  }
  return sorted.length === 0 ? 0 : sorted[sorted.length - 1].index + 1;
}
