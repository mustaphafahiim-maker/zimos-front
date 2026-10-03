"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import {
  columnBoxes,
  dividerGeometry,
  elementNode,
  imageBox,
  imageNode,
  isRtl,
  rowColumns,
  rowNode,
  sectionBody,
  sectionBoxes,
} from "./canvasGeometry";

/**
 * Drag and resize on the preview page — the frame's half. Its counterpart is
 * the editor's lib/canvasDrag.ts, which spells out the whole protocol.
 *
 * This side owns the pointer and the page: it measures what a drag needs when
 * a handle is grabbed, reports the pointer while it moves (at most once a
 * frame), and draws what the editor answers — a drop line, or the node being
 * resized restyled in place. It never re-renders the page and never edits
 * the tree: the editor decides the edit on release, and the preview refreshes
 * once with it. Esc (or a lost pointer) puts every restyled node back.
 */

export type CanvasTarget =
  | { kind: "section"; sectionId: string }
  | { kind: "element"; sectionId: string; elementId: string }
  | { kind: "section-height"; sectionId: string }
  | { kind: "column-width"; sectionId: string; rowId: string; index: number }
  | { kind: "image-width"; sectionId: string; elementId: string };

/** What the editor says to draw — checked, since it arrives in a message. */
export type CanvasFeedback =
  | { kind: "section"; gapIndex: number | null }
  | { kind: "element"; columnId: string; index: number }
  | { kind: "section-height"; sectionId: string; px: number | null; label: string }
  | { kind: "column-width"; sectionId: string; rowId: string; index: number; spans: [number, number]; label: string }
  | { kind: "image-width"; elementId: string; pct: number | null; label: string };

function isId(v: unknown): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= 200;
}
function isIndex(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v < 10_000;
}
function label(v: unknown): string {
  return typeof v === "string" ? v.slice(0, 40) : "";
}
function sizeOrNull(v: unknown, max: number): number | null | undefined {
  if (v === null) return null;
  return typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= max ? v : undefined;
}

export function readFeedback(raw: unknown): CanvasFeedback | null {
  const f = raw as Record<string, unknown> | null;
  if (!f || typeof f !== "object") return null;
  switch (f.kind) {
    case "section":
      return { kind: "section", gapIndex: isIndex(f.gapIndex) ? f.gapIndex : null };
    case "element":
      return isId(f.columnId) && isIndex(f.index) ? { kind: "element", columnId: f.columnId, index: f.index } : null;
    case "section-height": {
      const px = sizeOrNull(f.px, 4000);
      return isId(f.sectionId) && px !== undefined ? { kind: "section-height", sectionId: f.sectionId, px, label: label(f.label) } : null;
    }
    case "column-width": {
      const spans = f.spans;
      const ok =
        Array.isArray(spans) && spans.length === 2 && spans.every((n) => Number.isInteger(n) && n >= 1 && n <= 12);
      return isId(f.sectionId) && isId(f.rowId) && isIndex(f.index) && ok
        ? {
            kind: "column-width",
            sectionId: f.sectionId,
            rowId: f.rowId,
            index: f.index,
            spans: [spans[0] as number, spans[1] as number],
            label: label(f.label),
          }
        : null;
    }
    case "image-width": {
      const pct = sizeOrNull(f.pct, 100);
      return isId(f.elementId) && pct !== undefined ? { kind: "image-width", elementId: f.elementId, pct, label: label(f.label) } : null;
    }
    default:
      return null;
  }
}

/** The geometry the editor needs for this drag, measured now; null when the target is gone. */
function measureDrag(target: CanvasTarget): Record<string, unknown> | null {
  switch (target.kind) {
    case "section":
      return { kind: "section", sectionId: target.sectionId, sections: sectionBoxes() };
    case "element":
      return { kind: "element", sectionId: target.sectionId, elementId: target.elementId, columns: columnBoxes() };
    case "section-height": {
      const body = sectionBody(target.sectionId);
      return body ? { kind: "section-height", sectionId: target.sectionId, height: body.getBoundingClientRect().height } : null;
    }
    case "column-width": {
      const geometry = dividerGeometry(target.rowId, target.index);
      return geometry
        ? { kind: "column-width", sectionId: target.sectionId, rowId: target.rowId, index: target.index, ...geometry }
        : null;
    }
    case "image-width": {
      const img = imageNode(target.elementId);
      const column = elementNode(target.elementId)?.parentElement;
      if (!img || !column) return null;
      return {
        kind: "image-width",
        sectionId: target.sectionId,
        elementId: target.elementId,
        width: img.getBoundingClientRect().width,
        columnWidth: column.getBoundingClientRect().width,
        rtl: isRtl(column),
      };
    }
  }
}

/**
 * The pointer's viewport position for the size badge — kept outside React
 * state so a pointer move re-renders only the badge, nothing else.
 */
const badge = {
  point: null as { x: number; y: number } | null,
  listeners: new Set<() => void>(),
  set(point: { x: number; y: number } | null) {
    this.point = point;
    this.listeners.forEach((fn) => fn());
  },
};

export function useBadgePoint(): { x: number; y: number } | null {
  return useSyncExternalStore(
    (fn) => {
      badge.listeners.add(fn);
      return () => badge.listeners.delete(fn);
    },
    () => badge.point,
    () => null
  );
}

/** Near the top or bottom edge a section or element drag scrolls the page. */
const EDGE_PX = 56;
const SCROLL_PX = 14;
/** How long a released drag waits for the editor's answer before putting things back. */
const ANSWER_TIMEOUT_MS = 2000;
/** How long a committed move keeps its drop line up while the refreshed preview loads. */
const PENDING_MS = 4000;

interface Session {
  target: CanvasTarget;
  pointerId: number;
  handle: HTMLElement;
  x: number;
  y: number;
  shift: boolean;
  frame: number;
  released: boolean;
  timeout: number;
}

export interface CanvasDrag {
  /** The drag in progress (or just released and waiting for the refreshed preview). */
  active: CanvasTarget | null;
  feedback: CanvasFeedback | null;
  /** Released and applied — the drop line stays up until the preview refreshes. */
  pending: boolean;
  begin: (target: CanvasTarget, event: ReactPointerEvent<HTMLElement>) => void;
  /** One arrow-key press on a handle; true when the key did something. */
  step: (target: CanvasTarget, key: string, shift: boolean) => boolean;
}

export function useCanvasDrag({
  post,
  parentOrigin,
  focusKey,
}: {
  post: (message: Record<string, unknown>) => void;
  parentOrigin: string;
  /** sessionStorage key a keyboard step leaves its handle's name under, to refocus after the refresh. */
  focusKey: string;
}): CanvasDrag {
  const session = useRef<Session | null>(null);
  /** Every node restyled for the live preview, with the style attribute it had before. */
  const originals = useRef(new Map<HTMLElement, string | null>());
  const [active, setActive] = useState<CanvasTarget | null>(null);
  const [feedback, setFeedback] = useState<CanvasFeedback | null>(null);
  const [pending, setPending] = useState(false);
  const pendingTimer = useRef(0);

  const remember = useCallback((el: HTMLElement) => {
    if (!originals.current.has(el)) originals.current.set(el, el.getAttribute("style"));
  }, []);

  const restore = useCallback(() => {
    for (const [el, style] of originals.current) {
      if (style === null) el.removeAttribute("style");
      else el.setAttribute("style", style);
    }
    originals.current.clear();
  }, []);

  /** The live preview of a resize: one node restyled in place, no re-render. */
  const applyLive = useCallback(
    (fb: CanvasFeedback) => {
      if (fb.kind === "section-height") {
        const body = sectionBody(fb.sectionId);
        if (!body) return;
        remember(body);
        if (fb.px === null) {
          body.style.minHeight = "0px";
        } else {
          body.style.minHeight = `${fb.px}px`;
          body.style.display = "flex";
          body.style.flexDirection = "column";
          body.style.justifyContent = "center";
        }
      } else if (fb.kind === "column-width") {
        const row = rowNode(fb.rowId);
        if (!row) return;
        const columns = rowColumns(row);
        [0, 1].forEach((offset) => {
          const col = columns[fb.index + offset];
          if (!col) return;
          remember(col);
          col.style.gridColumn = `span ${fb.spans[offset]} / span ${fb.spans[offset]}`;
        });
      } else if (fb.kind === "image-width") {
        const box = imageBox(fb.elementId);
        if (!box) return;
        remember(box);
        box.style.width = "100%";
        box.style.maxWidth = `${fb.pct ?? 100}%`;
        box.style.marginInline = "auto";
      }
    },
    [remember]
  );

  // The pointer, while a drag is on. Coalesced to one report per frame; near
  // the top or bottom edge a move drag also scrolls the page.
  const listeners = useRef<{ move: (e: PointerEvent) => void; up: (e: PointerEvent) => void; key: (e: KeyboardEvent) => void } | null>(null);

  const detach = useCallback(() => {
    const l = listeners.current;
    if (!l) return;
    window.removeEventListener("pointermove", l.move);
    window.removeEventListener("pointerup", l.up);
    window.removeEventListener("pointercancel", l.up);
    window.removeEventListener("keydown", l.key, true);
    listeners.current = null;
  }, []);

  const finish = useCallback(
    (committed: boolean) => {
      detach();
      const current = session.current;
      if (current) {
        window.clearTimeout(current.timeout);
        cancelAnimationFrame(current.frame);
      }
      session.current = null;
      badge.set(null);
      window.clearTimeout(pendingTimer.current);
      if (committed) {
        // Leave the restyled nodes and the drop line as they are: the preview
        // refreshes with exactly this in a moment, so nothing flicks back.
        originals.current.clear();
        setPending(true);
        pendingTimer.current = window.setTimeout(() => {
          setPending(false);
          setActive(null);
          setFeedback(null);
        }, PENDING_MS);
      } else {
        restore();
        setPending(false);
        setActive(null);
        setFeedback(null);
      }
    },
    [detach, restore]
  );

  const cancel = useCallback(() => {
    if (!session.current) return;
    detach();
    post({ type: "zimos:canvas-drag", phase: "cancel" });
    finish(false);
  }, [detach, finish, post]);

  const report = useCallback(
    (phase: "move" | "end") => {
      const s = session.current;
      if (!s) return;
      post({ type: "zimos:canvas-drag", phase, x: s.x + window.scrollX, y: s.y + window.scrollY, shift: s.shift });
    },
    [post]
  );

  // One report per animation frame, however fast the pointer moves; near the
  // top or bottom edge a move drag keeps scrolling the page (and reporting,
  // since the pointer's place on the page changes as it scrolls).
  const tickRef = useRef<() => void>(() => {});
  useEffect(() => {
    tickRef.current = () => {
      const s = session.current;
      if (!s || s.released) return;
      s.frame = 0;
      const moves = s.target.kind === "section" || s.target.kind === "element";
      if (moves) {
        const dy = s.y < EDGE_PX ? -SCROLL_PX : s.y > window.innerHeight - EDGE_PX ? SCROLL_PX : 0;
        if (dy !== 0) {
          window.scrollBy(0, dy);
          s.frame = requestAnimationFrame(() => tickRef.current());
        }
      }
      report("move");
    };
  }, [report]);

  const begin = useCallback(
    (target: CanvasTarget, event: ReactPointerEvent<HTMLElement>) => {
      if (session.current || (event.pointerType === "mouse" && event.button !== 0)) return;
      const drag = measureDrag(target);
      if (!drag) return;
      event.preventDefault();
      event.stopPropagation();
      const handle = event.currentTarget;
      // preventDefault on pointerdown also cancels the focus a press would
      // give the handle — and with it Esc, which would go to whichever
      // document had focus (the editor's). Focus it by hand.
      handle.focus({ preventScroll: true });
      try {
        handle.setPointerCapture(event.pointerId);
      } catch {
        // Capture is a nicety: window listeners still see the pointer.
      }
      window.clearTimeout(pendingTimer.current);
      restore();
      session.current = {
        target,
        pointerId: event.pointerId,
        handle,
        x: event.clientX,
        y: event.clientY,
        shift: event.shiftKey,
        frame: 0,
        released: false,
        timeout: 0,
      };
      setActive(target);
      setFeedback(null);
      setPending(false);
      badge.set({ x: event.clientX, y: event.clientY });
      post({
        type: "zimos:canvas-drag",
        phase: "start",
        drag,
        x: event.clientX + window.scrollX,
        y: event.clientY + window.scrollY,
        shift: event.shiftKey,
      });

      const move = (e: PointerEvent) => {
        const s = session.current;
        if (!s || s.released || e.pointerId !== s.pointerId) return;
        s.x = e.clientX;
        s.y = e.clientY;
        s.shift = e.shiftKey;
        badge.set({ x: e.clientX, y: e.clientY });
        if (!s.frame) s.frame = requestAnimationFrame(() => tickRef.current());
      };
      const up = (e: PointerEvent) => {
        const s = session.current;
        if (!s || s.released || e.pointerId !== s.pointerId) return;
        detach();
        if (e.type === "pointercancel") {
          post({ type: "zimos:canvas-drag", phase: "cancel" });
          finish(false);
          return;
        }
        cancelAnimationFrame(s.frame);
        s.frame = 0;
        s.x = e.clientX;
        s.y = e.clientY;
        s.shift = e.shiftKey;
        s.released = true;
        report("end");
        // The editor answers with `done`; if it never does, put things back.
        s.timeout = window.setTimeout(() => finish(false), ANSWER_TIMEOUT_MS);
      };
      const key = (e: KeyboardEvent) => {
        if (e.key !== "Escape") return;
        e.preventDefault();
        e.stopPropagation();
        cancel();
      };
      listeners.current = { move, up, key };
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
      window.addEventListener("keydown", key, true);
    },
    [cancel, detach, finish, post, report, restore]
  );

  // The editor's answers.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.source !== window.parent || event.origin !== parentOrigin) return;
      const data = event.data as Record<string, unknown> | null;
      if (!data || data.type !== "zimos:canvas-feedback") return;
      const s = session.current;
      if (!s) return;
      const fb = readFeedback(data.feedback);
      if (fb) applyLive(fb);
      setFeedback(fb);
      if (data.done === true) finish(data.committed === true && s.released);
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [applyLive, finish, parentOrigin]);

  // A drag cut short by the component going away (a refresh) leaves nothing behind.
  useEffect(
    () => () => {
      detach();
      window.clearTimeout(pendingTimer.current);
    },
    [detach]
  );

  const step = useCallback(
    (target: CanvasTarget, key: string, shift: boolean): boolean => {
      if (session.current) return false;
      const rememberFocus = (name: string) => {
        try {
          sessionStorage.setItem(focusKey, name);
        } catch {
          // Storage blocked — focus just isn't restored after the refresh.
        }
      };
      const vertical = key === "ArrowUp" ? -1 : key === "ArrowDown" ? 1 : 0;
      switch (target.kind) {
        case "section": {
          if (!vertical) return false;
          rememberFocus(`section:${target.sectionId}`);
          post({ type: "zimos:move-section", sectionId: target.sectionId, direction: vertical < 0 ? "up" : "down" });
          return true;
        }
        case "element": {
          if (!vertical) return false;
          rememberFocus(`element:${target.elementId}`);
          post({
            type: "zimos:canvas-step",
            step: { kind: "element", sectionId: target.sectionId, elementId: target.elementId, delta: vertical },
          });
          return true;
        }
        case "section-height": {
          const body = sectionBody(target.sectionId);
          if (!vertical || !body) return false;
          rememberFocus(`height:${target.sectionId}`);
          post({
            type: "zimos:canvas-step",
            step: {
              kind: "section-height",
              sectionId: target.sectionId,
              delta: vertical,
              fine: shift,
              current: Math.round(body.getBoundingClientRect().height),
            },
          });
          return true;
        }
        case "column-width": {
          const row = rowNode(target.rowId);
          if (!row || (key !== "ArrowLeft" && key !== "ArrowRight")) return false;
          // Towards the row's end grows the first column: right in LTR, left in RTL.
          const towardsEnd = (key === "ArrowRight") !== isRtl(row);
          const spans = rowColumns(row).map((c) => Number(c.getAttribute("data-zimos-span")) || 12);
          rememberFocus(`columns:${target.rowId}:${target.index}`);
          post({
            type: "zimos:canvas-step",
            step: {
              kind: "column-width",
              sectionId: target.sectionId,
              rowId: target.rowId,
              index: target.index,
              spans,
              delta: towardsEnd ? 1 : -1,
            },
          });
          return true;
        }
        case "image-width": {
          const img = imageNode(target.elementId);
          const column = elementNode(target.elementId)?.parentElement;
          if (!img || !column) return false;
          const rtl = isRtl(column);
          const delta =
            key === "ArrowUp" || key === (rtl ? "ArrowLeft" : "ArrowRight")
              ? 1
              : key === "ArrowDown" || key === (rtl ? "ArrowRight" : "ArrowLeft")
                ? -1
                : 0;
          if (!delta) return false;
          rememberFocus(`image:${target.elementId}`);
          const current = Math.round((img.getBoundingClientRect().width / Math.max(1, column.getBoundingClientRect().width)) * 100);
          post({
            type: "zimos:canvas-step",
            step: { kind: "image-width", sectionId: target.sectionId, elementId: target.elementId, delta, fine: shift, current },
          });
          return true;
        }
      }
    },
    [focusKey, post]
  );

  return { active, feedback, pending, begin, step };
}
