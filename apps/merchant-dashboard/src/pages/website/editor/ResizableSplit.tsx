import { useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { cn } from "@store-builder/ui";
import {
  SPLIT_DEFAULT_RATIO,
  SPLIT_HANDLE_PX,
  SPLIT_MIN_PX,
  clampSplitPx,
  keyboardSplitPx,
  readSplitRatio,
  splitRatio,
} from "./splitPane";

/**
 * Two panes stacked in one column with a drag handle between them — the
 * editor's start pane, "Page sections" over "Add a block". Each pane scrolls
 * on its own; neither can be made shorter than SPLIT_MIN_PX.
 *
 * The handle is a WAI-ARIA window splitter: pointer drag (mouse, pen and
 * touch alike), Up/Down arrows when focused (Shift for bigger steps),
 * Home/End for either end, and double-click to go back to the default.
 * The split is remembered per browser in localStorage.
 *
 * `topCollapsed` is the top pane folded to its header (LayerList's own
 * show/hide): the handle steps aside and the bottom pane takes the rest.
 *
 * The top pane's height is a CSS calc over the ratio with a min/max, so the
 * browser keeps it clamped when the window resizes; the pure clamping in
 * splitPane.ts is what decides the ratio while dragging.
 */
export function ResizableSplit({
  storageKey,
  top,
  bottom,
  topCollapsed = false,
  label,
  hint,
}: {
  storageKey: string;
  top: ReactNode;
  bottom: ReactNode;
  topCollapsed?: boolean;
  /** The handle's accessible name. */
  label: string;
  /** Tooltip on the handle. */
  hint?: string;
}) {
  const topId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(() => {
    try {
      return readSplitRatio(localStorage.getItem(storageKey));
    } catch {
      return SPLIT_DEFAULT_RATIO;
    }
  });
  const drag = useRef<{ pointerId: number; startY: number; startTop: number; container: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  function persist(next: number) {
    try {
      localStorage.setItem(storageKey, next.toFixed(4));
    } catch {
      // Private window or blocked storage — the split still works until reload.
    }
  }

  function measure(): { top: number; container: number } | null {
    const container = containerRef.current?.getBoundingClientRect().height ?? 0;
    const topHeight = topRef.current?.getBoundingClientRect().height ?? 0;
    return container > 0 ? { top: topHeight, container } : null;
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 && event.pointerType === "mouse") return;
    const box = measure();
    if (!box) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, startY: event.clientY, startTop: box.top, container: box.container };
    setDragging(true);
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const session = drag.current;
    if (!session || session.pointerId !== event.pointerId) return;
    const nextTop = clampSplitPx(session.startTop + (event.clientY - session.startY), session.container);
    setRatio(splitRatio(nextTop, session.container));
  }

  function endDrag(event: PointerEvent<HTMLDivElement>) {
    const session = drag.current;
    if (!session || session.pointerId !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    const nextTop = clampSplitPx(session.startTop + (event.clientY - session.startY), session.container);
    const next = splitRatio(nextTop, session.container);
    setRatio(next);
    persist(next);
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const box = measure();
    if (!box) return;
    const nextTop = keyboardSplitPx(event.key, { shiftKey: event.shiftKey }, box.top, box.container);
    if (nextTop === null) return;
    event.preventDefault();
    const next = splitRatio(nextTop, box.container);
    setRatio(next);
    persist(next);
  }

  function reset() {
    setRatio(SPLIT_DEFAULT_RATIO);
    persist(SPLIT_DEFAULT_RATIO);
  }

  return (
    <div ref={containerRef} className="flex h-full min-h-0 flex-col">
      <div
        id={topId}
        ref={topRef}
        className={cn("flex min-h-0 shrink-0 flex-col", dragging && "select-none")}
        style={
          topCollapsed
            ? undefined
            : {
                height: `calc((100% - ${SPLIT_HANDLE_PX}px) * ${ratio})`,
                minHeight: SPLIT_MIN_PX,
                maxHeight: `calc(100% - ${SPLIT_HANDLE_PX + SPLIT_MIN_PX}px)`,
              }
        }
      >
        {top}
      </div>

      {!topCollapsed && (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label={label}
          aria-controls={topId}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(ratio * 100)}
          tabIndex={0}
          title={hint}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onKeyDown={onKeyDown}
          onDoubleClick={reset}
          style={{ height: SPLIT_HANDLE_PX }}
          className="group relative shrink-0 cursor-row-resize touch-none select-none focus-visible:outline-none"
        >
          <span
            aria-hidden
            className={cn(
              "absolute inset-x-0 top-1/2 h-px -translate-y-1/2 transition-colors",
              dragging ? "bg-primary" : "bg-line group-hover:bg-primary/60 group-focus-visible:bg-primary"
            )}
          />
          <span
            aria-hidden
            className={cn(
              "absolute left-1/2 top-1/2 h-1 w-10 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors",
              dragging
                ? "bg-primary"
                : "bg-line-strong group-hover:bg-primary group-focus-visible:bg-primary group-focus-visible:ring-2 group-focus-visible:ring-primary/40"
            )}
          />
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col">{bottom}</div>
    </div>
  );
}
