import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  resolveDrag,
  type CanvasDragMessage,
  type CanvasEdit,
  type CanvasFeedback,
  type DragLabels,
  type DragSession,
} from "@/lib/canvasDrag";

/**
 * Holds one drag on the preview canvas (see lib/canvasDrag.ts for the whole
 * protocol): the frame reports the pointer, this works out where it would
 * land and answers with what to draw, and on release hands the editor one
 * tree edit.
 *
 * Kept in a ref, not state: a pointer move must not re-render the editor —
 * or anything — only post a small message back to the frame, and only when
 * what it should draw actually changed.
 */
export function useCanvasDragSession({
  origin,
  labels,
  onEdit,
  onSettled,
}: {
  /** The storefront origin every reply is posted to. */
  origin: string | null;
  labels: DragLabels;
  /** A drag was released somewhere that changes the page. */
  onEdit: (edit: CanvasEdit) => void;
  /** A drag ended, whether or not it changed anything. */
  onSettled: () => void;
}) {
  const session = useRef<(DragSession & { source: Window; last: string }) | null>(null);
  const latest = useRef({ labels, onEdit, onSettled });
  useEffect(() => {
    latest.current = { labels, onEdit, onSettled };
  });

  const reply = useCallback(
    (target: Window, feedback: CanvasFeedback | null, done = false, committed = false) => {
      if (!origin) return;
      target.postMessage({ type: "zimos:canvas-feedback", feedback, done, committed }, origin);
    },
    [origin]
  );

  const handle = useCallback(
    (message: CanvasDragMessage, source: Window) => {
      if (message.phase === "start") {
        const next = { drag: message.drag, start: message.pointer, source, last: "" };
        session.current = next;
        const { feedback } = resolveDrag(next, message.pointer, latest.current.labels);
        next.last = JSON.stringify(feedback);
        reply(source, feedback);
        return;
      }
      const current = session.current;
      if (!current || current.source !== source) return;

      if (message.phase === "cancel") {
        session.current = null;
        reply(source, null, true, false);
        latest.current.onSettled();
        return;
      }

      const { feedback, edit } = resolveDrag(current, message.pointer, latest.current.labels);
      if (message.phase === "move") {
        const key = JSON.stringify(feedback);
        if (key !== current.last) {
          current.last = key;
          reply(source, feedback);
        }
        return;
      }

      // Released: one edit, one undo step.
      session.current = null;
      reply(source, feedback, true, edit !== null);
      if (edit) latest.current.onEdit(edit);
      latest.current.onSettled();
    },
    [reply]
  );

  /** Drops a drag: its frame went away (a new render swapped in underneath it), or Esc. */
  const abort = useCallback(() => {
    const current = session.current;
    if (!current) return;
    session.current = null;
    reply(current.source, null, true, false);
    latest.current.onSettled();
  }, [reply]);

  const isActive = useCallback(() => session.current !== null, []);

  // Esc cancels a drag wherever the keyboard focus happens to be — the frame
  // handles it itself when focus is inside it, this covers the editor side.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape" || !session.current) return;
      event.preventDefault();
      abort();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [abort]);

  // Stable, so callers can list it as an effect dependency without re-running.
  return useMemo(() => ({ handle, abort, isActive }), [handle, abort, isActive]);
}
