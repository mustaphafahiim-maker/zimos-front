"use client";

import { useEffect, useState, type KeyboardEvent, type PointerEvent } from "react";
import { BLUE, LAYER, useCoarsePointer } from "./canvasChrome";
import { ImageIcon } from "./canvasIcons";

/**
 * The pictures a selected band paints as its ground — a slider's slides, a
 * title's or a newsletter's photograph (`data-xs-bg`, with its address in
 * `data-xs-bg-src`): a "replace picture" button on the picture's corner, and
 * a dot on the point the picture centres on. Dragging the dot moves that
 * point (the picture follows at once); the arrow keys move it 5% a press
 * (Shift: 1%). On release the editor saves it as the picture's
 * `…Position` ("30% 60%"), one undo step.
 */

type Post = (message: Record<string, unknown>) => void;

const SIZE = 22;

/** "30% 60%" from a computed background-position; the middle for anything not in percent. */
function focalOf(node: HTMLElement): { x: number; y: number } {
  const [x, y] = getComputedStyle(node).backgroundPosition.split(",")[0].trim().split(/\s+/);
  const pct = (v: string | undefined) => (v && /^-?\d+(\.\d+)?%$/.test(v) ? Math.max(0, Math.min(100, Math.round(parseFloat(v)))) : 50);
  return { x: pct(x), y: pct(y) };
}

export function BackgroundHandles({
  sectionId,
  elementId,
  post,
  replaceLabel,
  focalLabel,
}: {
  sectionId: string;
  elementId: string;
  post: Post;
  replaceLabel: string;
  focalLabel: string;
}) {
  // Measured again as the page scrolls, resizes or a slide changes.
  const [, setTick] = useState(0);
  useEffect(() => {
    const again = () => setTick((n) => n + 1);
    window.addEventListener("scroll", again, { passive: true });
    window.addEventListener("resize", again);
    const timer = window.setInterval(again, 400);
    return () => {
      window.removeEventListener("scroll", again);
      window.removeEventListener("resize", again);
      window.clearInterval(timer);
    };
  }, []);

  const marker = document.querySelector<HTMLElement>(`[data-zimos-el="${CSS.escape(elementId)}"]`);
  if (!marker) return null;
  const all = Array.from(marker.querySelectorAll<HTMLElement>("[data-xs-bg][data-xs-bg-src]"));
  const shown = all.filter((node) => {
    if (node.getAttribute("aria-hidden") === "true") return false;
    const r = node.getBoundingClientRect();
    return r.width > 60 && r.height > 60 && r.bottom > 0 && r.top < window.innerHeight;
  });
  return (
    <>
      {shown.map((node) => {
        const src = node.getAttribute("data-xs-bg-src") ?? "";
        const nth = all.filter((other) => other.getAttribute("data-xs-bg-src") === src).indexOf(node);
        return (
          <Ground
            key={node.getAttribute("data-xs-bg") ?? src}
            node={node}
            onReplace={() => post({ type: "zimos:pick-image", sectionId, elementId, field: "src", src, nth: Math.max(0, nth) })}
            onFocal={(x, y) => post({ type: "zimos:bg-position", sectionId, elementId, path: node.getAttribute("data-xs-bg") ?? "", x, y })}
            replaceLabel={replaceLabel}
            focalLabel={focalLabel}
          />
        );
      })}
    </>
  );
}

function Ground({
  node,
  onReplace,
  onFocal,
  replaceLabel,
  focalLabel,
}: {
  node: HTMLElement;
  onReplace: () => void;
  onFocal: (x: number, y: number) => void;
  replaceLabel: string;
  focalLabel: string;
}) {
  const coarse = useCoarsePointer();
  const [dragging, setDragging] = useState<{ x: number; y: number } | null>(null);
  // The last arrow-key nudge, so the next press starts from it before the page is measured again.
  const [nudged, setNudged] = useState<{ x: number; y: number } | null>(null);
  const rect = node.getBoundingClientRect();
  const { x, y } = dragging ?? nudged ?? focalOf(node);
  const size = coarse ? SIZE + 10 : SIZE;
  const rtl = getComputedStyle(node).direction === "rtl";
  // A template photograph on an Arabic store is drawn mirrored (a layer of its own, app/xs-sections.css): so is its point.
  const layer = node.querySelector<HTMLElement>(":scope > .xs-slider__photo");
  const mirrored = !!layer && getComputedStyle(layer).display !== "none";
  const shownX = mirrored ? 100 - x : x;

  const place = (nx: number, ny: number) => {
    const cx = Math.max(0, Math.min(100, Math.round(nx)));
    const cy = Math.max(0, Math.min(100, Math.round(ny)));
    node.style.setProperty("background-position", `${cx}% ${cy}%`, "important");
    return { x: cx, y: cy };
  };
  const fromPointer = (event: PointerEvent) => {
    const px = ((event.clientX - rect.left) / rect.width) * 100;
    return place(mirrored ? 100 - px : px, ((event.clientY - rect.top) / rect.height) * 100);
  };

  function onKeyDown(event: KeyboardEvent) {
    const step = event.shiftKey ? 1 : 5;
    const along = mirrored ? -step : step;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-along, 0], ArrowRight: [along, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    const next = place(x + move[0], y + move[1]);
    setNudged(next);
    onFocal(next.x, next.y);
  }

  return (
    <>
      <button
        type="button"
        data-zc="handle"
        onClick={onReplace}
        aria-label={replaceLabel}
        title={replaceLabel}
        style={{
          position: "fixed",
          top: Math.max(4, rect.top + 10),
          ...(rtl ? { left: rect.left + 10 } : { left: rect.right - 10 - (coarse ? 44 : 34) }),
          zIndex: LAYER + 4,
          width: coarse ? 44 : 34,
          height: coarse ? 44 : 34,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 999,
          border: 0,
          background: BLUE,
          color: "#fff",
          boxShadow: "0 1px 4px rgba(0,0,0,.3)",
          cursor: "pointer",
        }}
      >
        <ImageIcon size={coarse ? 20 : 16} aria-hidden />
      </button>
      <button
        type="button"
        data-zc="handle"
        role="slider"
        aria-label={focalLabel}
        aria-valuetext={`${x}% ${y}%`}
        title={focalLabel}
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          setNudged(null);
          setDragging(fromPointer(event));
        }}
        onPointerMove={(event) => {
          if (dragging) setDragging(fromPointer(event));
        }}
        onPointerUp={(event) => {
          if (!dragging) return;
          const last = fromPointer(event);
          setDragging(null);
          onFocal(last.x, last.y);
        }}
        onPointerCancel={() => setDragging(null)}
        style={{
          position: "fixed",
          top: rect.top + (rect.height * y) / 100 - size / 2,
          left: rect.left + (rect.width * shownX) / 100 - size / 2,
          zIndex: LAYER + 4,
          width: size,
          height: size,
          borderRadius: 999,
          border: "3px solid #fff",
          background: BLUE,
          boxShadow: "0 0 0 1px rgba(0,0,0,.35), 0 1px 6px rgba(0,0,0,.35)",
          cursor: dragging ? "grabbing" : "grab",
          touchAction: "none",
          padding: 0,
        }}
      />
    </>
  );
}
