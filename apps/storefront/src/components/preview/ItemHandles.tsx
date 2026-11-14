"use client";

import { useEffect, useState, type KeyboardEvent, type PointerEvent } from "react";
import { BLUE, LAYER } from "./canvasChrome";
import { DotsSixVerticalIcon } from "./canvasIcons";

/**
 * The items of a selected band — its banners, cards, quotes, people, slides,
 * pictures (`data-xs-item="items.3"`, the item's place in the band's props):
 * the one under the pointer (or focused) gets a grip and two buttons. The
 * grip drags it to another item's place (an outline shows where); with the
 * keyboard, Space picks it up, the arrows move it one place at a time in the
 * way the band reads, and Space, Enter or Escape put it down. Duplicate puts
 * a copy after it, Delete takes it out. Each is one message — and one undo
 * step in the editor (canvasEdits.ts).
 *
 *   { type: "zimos:item-action", sectionId, elementId, list, action: "move", from, to }
 *   { type: "zimos:item-action", sectionId, elementId, list, action: "duplicate" | "delete", from }
 */

type Post = (message: Record<string, unknown>) => void;

export interface ItemStrings {
  moveItem: string;
  duplicateItem: string;
  deleteItem: string;
}

function itemPath(node: Element): { list: string; at: number } | null {
  const match = /^([A-Za-z][A-Za-z0-9]*)\.([0-9]{1,2})$/.exec(node.getAttribute("data-xs-item") ?? "");
  return match ? { list: match[1], at: Number(match[2]) } : null;
}

export function ItemHandles({ sectionId, elementId, post, strings }: { sectionId: string; elementId: string; post: Post; strings: ItemStrings }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ from: string; over: string | null } | null>(null);
  const [picked, setPicked] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    const again = () => setTick((n) => n + 1);
    function onOver(event: Event) {
      const node = (event.target as Element | null)?.closest?.("[data-xs-item]");
      if (node && node.closest(`[data-zimos-el="${CSS.escape(elementId)}"]`)) setHovered(node.getAttribute("data-xs-item"));
    }
    document.addEventListener("pointerover", onOver);
    window.addEventListener("scroll", again, { passive: true });
    window.addEventListener("resize", again);
    return () => {
      document.removeEventListener("pointerover", onOver);
      window.removeEventListener("scroll", again);
      window.removeEventListener("resize", again);
    };
  }, [elementId]);

  const marker = document.querySelector<HTMLElement>(`[data-zimos-el="${CSS.escape(elementId)}"]`);
  if (!marker) return null;
  const items = Array.from(marker.querySelectorAll<HTMLElement>("[data-xs-item]")).filter((node) => node.getAttribute("aria-hidden") !== "true" || node.classList.contains("xs-gallery__item"));
  const id = drag?.from ?? hovered;
  const node = id ? items.find((item) => item.getAttribute("data-xs-item") === id) : null;
  const path = node ? itemPath(node) : null;
  if (!node || !path) return null;
  const siblings = items.filter((item) => itemPath(item)?.list === path.list);
  const rect = node.getBoundingClientRect();
  if (rect.width === 0) return null;
  const rtl = getComputedStyle(node).direction === "rtl";

  const send = (action: "move" | "duplicate" | "delete", to?: number) =>
    post({ type: "zimos:item-action", sectionId, elementId, list: path.list, action, from: path.at, ...(to !== undefined ? { to } : {}) });

  /** The item under the pointer (of the same list), as a drop place. */
  function overAt(x: number, y: number): string | null {
    for (const item of siblings) {
      const r = item.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return item.getAttribute("data-xs-item");
    }
    return null;
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === " " || (picked && (event.key === "Enter" || event.key === "Escape"))) {
      event.preventDefault();
      setPicked((now) => !now && event.key === " ");
      return;
    }
    if (!picked) return;
    // Along the way the band reads; up and down are the same as back and forward.
    const back = event.key === "ArrowUp" || event.key === (rtl ? "ArrowRight" : "ArrowLeft");
    const forward = event.key === "ArrowDown" || event.key === (rtl ? "ArrowLeft" : "ArrowRight");
    if (!back && !forward) return;
    event.preventDefault();
    const here = siblings.indexOf(node!);
    const target = siblings[here + (forward ? 1 : -1)];
    const to = target ? itemPath(target)?.at : undefined;
    if (to !== undefined) {
      send("move", to);
      setHovered(target.getAttribute("data-xs-item"));
    }
  }

  const overNode = drag?.over ? siblings.find((item) => item.getAttribute("data-xs-item") === drag.over) : null;
  const overRect = overNode && overNode !== node ? overNode.getBoundingClientRect() : null;
  const bar = { top: Math.max(4, rect.top + 6), ...(rtl ? { right: window.innerWidth - rect.right + 6 } : { left: rect.left + 6 }) };
  // The canvas's own floating bar and its buttons (canvasChrome.ts "bar" / "act"), as on a selected section.
  const button = (label: string, onClick: () => void, glyph: string, danger = false) => (
    <button type="button" data-zc="act" data-tone={danger ? "danger" : undefined} aria-label={label} title={label} onClick={onClick} style={{ fontSize: 16, lineHeight: 1 }}>
      {glyph}
    </button>
  );

  return (
    <>
      <div aria-hidden style={{ position: "fixed", top: rect.top, left: rect.left, width: rect.width, height: rect.height, outline: `1px dashed ${BLUE}`, outlineOffset: -1, pointerEvents: "none", zIndex: LAYER + 3 }} />
      {overRect && (
        <div aria-hidden style={{ position: "fixed", top: overRect.top, left: overRect.left, width: overRect.width, height: overRect.height, outline: `3px solid ${BLUE}`, outlineOffset: -3, background: "rgba(37,99,235,.12)", pointerEvents: "none", zIndex: LAYER + 3 }} />
      )}
      <div data-zc="bar" style={{ position: "fixed", ...bar, zIndex: LAYER + 4 }}>
        <button
          type="button"
          data-zc="act"
          data-grip=""
          data-grabbing={drag ? "" : undefined}
          aria-label={strings.moveItem}
          aria-pressed={picked}
          title={strings.moveItem}
          onKeyDown={onKeyDown}
          onBlur={() => setPicked(false)}
          onPointerDown={(event: PointerEvent) => {
            event.preventDefault();
            event.currentTarget.setPointerCapture(event.pointerId);
            setDrag({ from: node.getAttribute("data-xs-item") ?? "", over: null });
          }}
          onPointerMove={(event) => {
            if (drag) setDrag({ ...drag, over: overAt(event.clientX, event.clientY) });
          }}
          onPointerUp={(event) => {
            if (!drag) return;
            const over = overAt(event.clientX, event.clientY);
            setDrag(null);
            const target = over ? siblings.find((item) => item.getAttribute("data-xs-item") === over) : null;
            const to = target ? itemPath(target)?.at : undefined;
            if (to !== undefined && to !== path.at) send("move", to);
          }}
          onPointerCancel={() => setDrag(null)}
          style={picked ? { background: "#fff", color: BLUE } : undefined}
        >
          <DotsSixVerticalIcon size={16} aria-hidden />
        </button>
        {button(strings.duplicateItem, () => send("duplicate"), "⧉")}
        {siblings.length > 1 && button(strings.deleteItem, () => send("delete"), "✕", true)}
      </div>
    </>
  );
}
