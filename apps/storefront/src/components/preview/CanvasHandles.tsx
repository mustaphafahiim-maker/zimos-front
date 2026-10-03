"use client";

import { useEffect, useState, type CSSProperties, type KeyboardEvent, type PointerEvent } from "react";
import {
  EL_ATTR,
  SECTION_ATTR,
  TYPE_ATTR,
  columnNode,
  elementNode,
  elementRect,
  imageNode,
  isRtl,
  sectionBody,
  sectionDividers,
  sectionNode,
  type Rect,
} from "./canvasGeometry";
import { useBadgePoint, type CanvasDrag, type CanvasTarget } from "./useCanvasDrag";

/**
 * The drag and resize handles on the selected section, and what a drag in
 * progress draws — all a fixed layer over the page, like the rest of the
 * editor's canvas (PreviewBridge), so the page's own markup is untouched.
 *
 *  - under the section: a bar that sets its minimum height;
 *  - between two columns sitting side by side: a bar that moves the boundary;
 *  - on the element under the pointer (or the one last clicked, for touch):
 *    a grip that moves it — to another place in its column, another column
 *    or another section — and on a picture, a corner that resizes it.
 *
 * Every handle is a real button: focus it and the arrow keys do one step
 * (Shift for a fine step where there is one). Esc cancels a drag.
 */

const BLUE = "#2563eb";
const LAYER = 2147483004;

export interface CanvasStrings {
  dragSection: string;
  dragElement: string;
  resizeHeight: string;
  resizeColumns: string;
  resizeImage: string;
}

function handleStyle(extra: CSSProperties): CSSProperties {
  return {
    position: "fixed",
    zIndex: LAYER,
    background: BLUE,
    border: "2px solid #fff",
    boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
    touchAction: "none",
    padding: 0,
    ...extra,
  };
}

/** Pointer and keyboard wiring shared by every handle. */
function handleProps(drag: CanvasDrag, target: CanvasTarget, handle: string, label: string) {
  return {
    type: "button" as const,
    "aria-label": label,
    title: label,
    "data-zimos-handle": handle,
    onPointerDown: (e: PointerEvent<HTMLButtonElement>) => drag.begin(target, e),
    onKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => {
      if (drag.step(target, e.key, e.shiftKey)) e.preventDefault();
    },
  };
}

/** The grip on a selected section's name bar: drag it up or down the page. */
export function SectionGrip({ drag, sectionId, label }: { drag: CanvasDrag; sectionId: string; label: string }) {
  return (
    <button
      {...handleProps(drag, { kind: "section", sectionId }, `section:${sectionId}`, label)}
      style={{
        width: 20,
        height: 20,
        borderRadius: 999,
        border: "1.5px solid #fff",
        background: BLUE,
        color: "#fff",
        font: "600 11px/1 ui-sans-serif, system-ui, sans-serif",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: drag.active?.kind === "section" ? "grabbing" : "grab",
        boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
        touchAction: "none",
        padding: 0,
      }}
    >
      <GripGlyph />
    </button>
  );
}

function GripGlyph() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" fill="currentColor">
      <circle cx="3" cy="2" r="1" />
      <circle cx="7" cy="2" r="1" />
      <circle cx="3" cy="5" r="1" />
      <circle cx="7" cy="5" r="1" />
      <circle cx="3" cy="8" r="1" />
      <circle cx="7" cy="8" r="1" />
    </svg>
  );
}

function rectOf(el: Element | null): Rect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return r.width === 0 && r.height === 0 ? null : { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function CanvasHandles({
  sectionId,
  drag,
  strings,
  focusKey,
}: {
  /** The selected section; nothing is drawn without one. */
  sectionId: string | null;
  drag: CanvasDrag;
  strings: CanvasStrings;
  /** Where a keyboard step left the name of the handle to refocus after the refresh. */
  focusKey: string;
}) {
  const [hoveredEl, setHoveredEl] = useState<string | null>(null);
  const [activeEl, setActiveEl] = useState<string | null>(null);
  const dragging = drag.active !== null;

  // Which element is under the pointer (or was last tapped) inside the
  // selected section. Frozen while a drag is on.
  useEffect(() => {
    if (!sectionId) return;
    const inSection = (target: EventTarget | null) => {
      const el = (target as Element | null)?.closest?.<HTMLElement>(`[${EL_ATTR}]`);
      if (!el) return null;
      return el.closest(`[${SECTION_ATTR}]`)?.getAttribute(SECTION_ATTR) === sectionId ? el.getAttribute(EL_ATTR) : null;
    };
    function onOver(event: MouseEvent) {
      if ((event.target as Element | null)?.closest?.("[data-zimos-overlay]")) return;
      setHoveredEl(inSection(event.target));
    }
    function onDown(event: globalThis.PointerEvent) {
      if ((event.target as Element | null)?.closest?.("[data-zimos-overlay]")) return;
      setActiveEl(inSection(event.target));
    }
    document.addEventListener("mouseover", onOver);
    document.addEventListener("pointerdown", onDown, true);
    return () => {
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("pointerdown", onDown, true);
    };
  }, [sectionId]);

  // A different section: forget the last one's element.
  const [lastSection, setLastSection] = useState(sectionId);
  if (lastSection !== sectionId) {
    setLastSection(sectionId);
    setHoveredEl(null);
    setActiveEl(null);
  }

  // After a keyboard step the preview refreshes; give the handle the
  // merchant was using its focus back, so the next arrow press still works.
  useEffect(() => {
    if (!sectionId) return;
    let name: string | null = null;
    try {
      name = sessionStorage.getItem(focusKey);
      if (name) sessionStorage.removeItem(focusKey);
    } catch {
      return;
    }
    if (!name) return;
    const frame = requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-zimos-handle="${CSS.escape(name!)}"]`)?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, [sectionId, focusKey]);

  const shownEl = dragging
    ? drag.active?.kind === "element" || drag.active?.kind === "image-width"
      ? drag.active.elementId
      : null
    : (hoveredEl ?? activeEl);

  return (
    <>
      {sectionId && <SectionHandles sectionId={sectionId} drag={drag} strings={strings} />}
      {sectionId && shownEl && <ElementHandles sectionId={sectionId} elementId={shownEl} drag={drag} strings={strings} />}
      <DragPicture drag={drag} />
    </>
  );
}

function SectionHandles({ sectionId, drag, strings }: { sectionId: string; drag: CanvasDrag; strings: CanvasStrings }) {
  const body = rectOf(sectionBody(sectionId));
  const dividers = sectionDividers(sectionId);
  const resizingHeight = drag.active?.kind === "section-height";

  return (
    <>
      {body && (
        <button
          {...handleProps(drag, { kind: "section-height", sectionId }, `height:${sectionId}`, strings.resizeHeight)}
          style={handleStyle({
            // Beside the section's own "+" (which sits on the middle of its
            // bottom edge), so the two never overlap.
            top: body.top + body.height - 5,
            left: body.left + body.width / 2 + 22,
            width: 40,
            height: 10,
            borderRadius: 999,
            cursor: "ns-resize",
            opacity: resizingHeight ? 1 : 0.9,
          })}
        />
      )}
      {dividers.map((d) => {
        const target: CanvasTarget = { kind: "column-width", sectionId, rowId: d.rowId, index: d.index };
        const active =
          drag.active?.kind === "column-width" && drag.active.rowId === d.rowId && drag.active.index === d.index;
        return (
          <div key={`${d.rowId}:${d.index}`}>
            <div
              aria-hidden
              style={{
                position: "fixed",
                top: d.top,
                left: d.x - 0.5,
                width: 1,
                height: d.height,
                borderInlineStart: `1px dashed ${active ? BLUE : "rgba(37, 99, 235, 0.55)"}`,
                pointerEvents: "none",
                zIndex: LAYER,
              }}
            />
            <button
              {...handleProps(drag, target, `columns:${d.rowId}:${d.index}`, strings.resizeColumns)}
              style={handleStyle({
                top: d.top + Math.max(0, d.height / 2 - 20),
                left: d.x - 5,
                width: 10,
                height: Math.min(40, Math.max(20, d.height)),
                borderRadius: 999,
                cursor: "col-resize",
              })}
            />
          </div>
        );
      })}
    </>
  );
}

function ElementHandles({
  sectionId,
  elementId,
  drag,
  strings,
}: {
  sectionId: string;
  elementId: string;
  drag: CanvasDrag;
  strings: CanvasStrings;
}) {
  const marker = elementNode(elementId);
  const rect = marker ? elementRect(marker) : null;
  if (!marker || !rect) return null;
  const rtl = isRtl(marker.parentElement ?? marker);
  const isImage = marker.getAttribute(TYPE_ATTR) === "image";
  const img = isImage ? rectOf(imageNode(elementId)) : null;
  const moving = drag.active?.kind === "element" && drag.active.elementId === elementId;

  return (
    <>
      <div
        aria-hidden
        style={{
          position: "fixed",
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          outline: `1px dashed ${BLUE}`,
          outlineOffset: 2,
          background: moving ? "rgba(37, 99, 235, 0.12)" : "transparent",
          pointerEvents: "none",
          zIndex: LAYER - 1,
        }}
      />
      <button
        {...handleProps(drag, { kind: "element", sectionId, elementId }, `element:${elementId}`, strings.dragElement)}
        style={{
          ...handleStyle({
            top: rect.top - 4,
            left: rtl ? rect.left + rect.width - 18 : rect.left - 4,
            width: 22,
            height: 22,
            borderRadius: 6,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: moving ? "grabbing" : "grab",
          }),
        }}
      >
        <GripGlyph />
      </button>
      {img && (
        <button
          {...handleProps(drag, { kind: "image-width", sectionId, elementId }, `image:${elementId}`, strings.resizeImage)}
          style={handleStyle({
            top: img.top + img.height - 9,
            left: rtl ? img.left - 7 : img.left + img.width - 9,
            width: 16,
            height: 16,
            borderRadius: 4,
            cursor: rtl ? "nesw-resize" : "nwse-resize",
          })}
        />
      )}
    </>
  );
}

/**
 * What a drag in progress looks like: where a moved element would land (a
 * line in its new column), and for a resize, the size it would be — a small
 * badge by the pointer. A section's drop line is PreviewBridge's own
 * DragGaps, shared with the block library's drag.
 */
function DragPicture({ drag }: { drag: CanvasDrag }) {
  const point = useBadgePoint();
  const fb = drag.feedback;
  const faded = drag.pending ? 0.55 : 1;

  let line: Rect | null = null;
  if (fb?.kind === "element") {
    const column = columnNode(fb.columnId);
    const colRect = rectOf(column);
    if (column && colRect) {
      const rects = Array.from(column.querySelectorAll<HTMLElement>(`:scope > [${EL_ATTR}]`))
        .map((el) => elementRect(el))
        .filter((r): r is Rect => r !== null);
      const before = rects[fb.index - 1];
      const after = rects[fb.index];
      const y = before && after
        ? (before.top + before.height + after.top) / 2
        : after
          ? after.top - 4
          : before
            ? before.top + before.height + 4
            : colRect.top + 8;
      line = { top: y - 2, left: colRect.left, width: colRect.width, height: 4 };
    }
  }

  let ghost: Rect | null = null;
  if (drag.active?.kind === "section") ghost = rectOf(sectionNode(drag.active.sectionId));

  const label =
    fb && (fb.kind === "section-height" || fb.kind === "column-width" || fb.kind === "image-width") ? fb.label : "";

  return (
    <>
      {ghost && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            ...ghost,
            background: "rgba(37, 99, 235, 0.10)",
            outline: `2px dashed ${BLUE}`,
            outlineOffset: -2,
            pointerEvents: "none",
            zIndex: LAYER - 1,
          }}
        />
      )}
      {line && (
        <div
          aria-hidden
          style={{
            position: "fixed",
            ...line,
            borderRadius: 999,
            background: BLUE,
            opacity: faded,
            boxShadow: "0 0 0 2px #fff",
            pointerEvents: "none",
            zIndex: LAYER + 1,
          }}
        />
      )}
      {label && point && !drag.pending && (
        <div
          role="status"
          style={{
            position: "fixed",
            top: point.y + 16,
            left: point.x + 16,
            padding: "3px 8px",
            borderRadius: 6,
            background: "#111827",
            color: "#fff",
            font: "600 11px/1.3 ui-sans-serif, system-ui, sans-serif",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            zIndex: LAYER + 2,
            direction: "ltr",
          }}
        >
          {label}
        </div>
      )}
    </>
  );
}
