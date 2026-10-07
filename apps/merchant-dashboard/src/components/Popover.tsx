import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cn } from "@store-builder/ui";
import { overlayTarget } from "./overlayRoot";

const GAP = 4;
const MARGIN = 8;

/**
 * A menu anchored to a button, drawn in the overlay root so no bar or panel
 * around the button can clip it or hold it under the next pane. It opens
 * below the button (above when there is more room there), lines up with the
 * button's end edge, stays inside the window, and scrolls inside itself when
 * the window is short. A click outside or Escape closes it.
 */
export function Popover({
  open,
  onClose,
  anchorRef,
  closeLabel,
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  anchorRef: RefObject<HTMLElement | null>;
  closeLabel: string;
  className?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const [style, setStyle] = useState<CSSProperties>({ visibility: "hidden" });

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!anchor || !panel) return;
      const a = anchor.getBoundingClientRect();
      const vw = document.documentElement.clientWidth || window.innerWidth;
      const vh = window.innerHeight;
      const width = Math.min(panel.offsetWidth, vw - 2 * MARGIN);
      const rtl = getComputedStyle(anchor).direction === "rtl";
      const ideal = rtl ? a.left : a.right - width;
      const left = Math.max(MARGIN, Math.min(ideal, vw - width - MARGIN));
      const below = vh - a.bottom - GAP - MARGIN;
      const above = a.top - GAP - MARGIN;
      const up = below < Math.min(panel.scrollHeight, 240) && above > below;
      setStyle({
        left,
        maxWidth: vw - 2 * MARGIN,
        maxHeight: Math.max(120, up ? above : below),
        ...(up ? { bottom: vh - a.top + GAP } : { top: a.bottom + GAP }),
      });
    };
    place();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [open, anchorRef]);

  if (!open) return null;
  return createPortal(
    <>
      <button type="button" aria-label={closeLabel} className="fixed inset-0 z-40 cursor-default" onClick={onClose} />
      <div
        ref={panelRef}
        data-popover=""
        style={style}
        className={cn("fixed z-40 overflow-y-auto rounded-2xl border border-line bg-paper-raised shadow-lg", className)}
      >
        {children}
      </div>
    </>,
    overlayTarget()
  );
}
