"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The `product_shelf` strip: products in a row the shopper pages through with
 * the two arrows beside the heading, the dots under it, a swipe, or a mouse
 * drag. Plain native scrolling underneath — the arrows and dots only ask the
 * strip to scroll — so it works before this component has hydrated and with
 * a keyboard.
 *
 * The heading sits in here because the arrows share its row.
 */
export function ShelfRail({
  heading,
  children,
  rtl,
  label,
  labels,
}: {
  heading: ReactNode;
  children: ReactNode;
  rtl: boolean;
  label: string;
  labels: { previous: string; next: string; page: string };
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(0);
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);

  /** How far "one product" is: a tile plus the gap beside it. */
  const step = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return 0;
    const card = rail.firstElementChild as HTMLElement | null;
    const gap = parseFloat(getComputedStyle(rail).columnGap) || 0;
    return card ? card.getBoundingClientRect().width + gap : rail.clientWidth * 0.8;
  }, []);

  const measure = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const max = rail.scrollWidth - rail.clientWidth;
    const count = max <= 4 ? 1 : Math.ceil(rail.scrollWidth / rail.clientWidth);
    setPages(count);
    // RTL strips scroll into negative numbers; the distance travelled is what counts.
    const travelled = Math.abs(rail.scrollLeft);
    setPage(max <= 4 ? 0 : Math.min(count - 1, Math.round((travelled / max) * (count - 1))));
  }, []);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    measure();
    rail.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure, { passive: true });
    return () => {
      rail.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  /** One product on (`1`) or back (`-1`), wrapping round at either end. */
  function move(delta: 1 | -1) {
    const rail = railRef.current;
    if (!rail) return;
    const max = rail.scrollWidth - rail.clientWidth;
    const travelled = Math.abs(rail.scrollLeft);
    const sign = rtl ? -1 : 1;
    if (delta === 1 && travelled >= max - 4) {
      rail.scrollTo({ left: 0, behavior: "smooth" });
    } else if (delta === -1 && travelled <= 4) {
      rail.scrollTo({ left: sign * max, behavior: "smooth" });
    } else {
      rail.scrollBy({ left: sign * delta * step(), behavior: "smooth" });
    }
  }

  function goToPage(index: number) {
    const rail = railRef.current;
    if (!rail || pages < 2) return;
    const max = rail.scrollWidth - rail.clientWidth;
    rail.scrollTo({ left: (rtl ? -1 : 1) * (max * index) / (pages - 1), behavior: "smooth" });
  }

  return (
    <>
      <div className="zs-shelf__shell">
        <div className="zs-shelf__header">
          {heading}
          {pages > 1 ? (
            <div className="zs-shelf__arrows">
              <button type="button" className="zs-shelf__arrow" aria-label={labels.previous} onClick={() => move(-1)}>
                {rtl ? "→" : "←"}
              </button>
              <button type="button" className="zs-shelf__arrow" aria-label={labels.next} onClick={() => move(1)}>
                {rtl ? "←" : "→"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="zs-shelf__viewport">
        <div
          ref={railRef}
          className="zs-shelf__rail zs-scroll"
          tabIndex={0}
          aria-label={label}
          // A mouse drags the strip like a finger does; touch already scrolls it natively.
          onPointerDown={(e) => {
            if (e.pointerType !== "mouse" || !railRef.current) return;
            drag.current = { x: e.clientX, left: railRef.current.scrollLeft, moved: false };
          }}
          onPointerMove={(e) => {
            const d = drag.current;
            if (!d || !railRef.current) return;
            const dx = e.clientX - d.x;
            if (Math.abs(dx) > 4) d.moved = true;
            railRef.current.scrollLeft = d.left - dx;
          }}
          onPointerUp={() => {
            // Left in place for the click that follows, so a drag never opens a product.
            window.setTimeout(() => (drag.current = null), 0);
          }}
          onPointerLeave={() => (drag.current = null)}
          onClickCapture={(e) => {
            if (drag.current?.moved) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
        >
          {children}
        </div>
      </div>

      {pages > 1 ? (
        <div className="zs-shelf__dots">
          {Array.from({ length: pages }, (_, i) => (
            <button
              key={i}
              type="button"
              className={`zs-shelf__dot${i === page ? " is-active" : ""}`}
              aria-label={`${labels.page} ${i + 1}`}
              aria-current={i === page ? "true" : undefined}
              onClick={() => goToPage(i)}
            />
          ))}
        </div>
      ) : null}
    </>
  );
}
