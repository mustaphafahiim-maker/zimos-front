"use client";

import { useRef, useState, type ReactNode } from "react";
import { useImmersiveAllowed } from "./useImmersive";

/**
 * Lays its children out on a slowly turning drum instead of a flat grid: the
 * front item faces the shopper, the ones beside it curve away.
 *
 * Drag, arrow keys or the buttons move it. It is pure CSS 3D — a rotation on a
 * parent and one on each child — so there is no renderer and no library here.
 *
 * When the visitor asks for reduced motion or the device looks weak, the same
 * children render as an ordinary scrolling row: the products, prices and links
 * are identical, only the arrangement changes.
 */
export function OrbitStage({
  children,
  label,
  prevLabel = "Previous",
  nextLabel = "Next",
}: {
  children: ReactNode[];
  label: string;
  prevLabel?: string;
  nextLabel?: string;
}) {
  const allowed = useImmersiveAllowed();
  const [index, setIndex] = useState(0);
  const drag = useRef<{ x: number; from: number } | null>(null);
  const count = children.length;

  const step = count > 0 ? 360 / count : 0;
  // Far enough back that neighbours don't intersect the front item.
  const radius = Math.round(150 + count * 26);

  // The index is never reset when the product count changes: every place that
  // reads it (rotation, the "n / count" label, which item is in front) already
  // takes it modulo `count`, so any value stays valid.
  const go = (delta: number) => setIndex((i) => i + delta);

  if (count === 0) return null;

  if (!allowed) {
    return (
      <ul className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-2" aria-label={label}>
        {children.map((child, i) => (
          <li key={i} className="w-64 shrink-0 snap-start">
            {child}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative h-[420px] w-full touch-pan-y select-none"
        style={{ perspective: "1100px" }}
        role="group"
        aria-label={label}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowRight") go(1);
          if (e.key === "ArrowLeft") go(-1);
        }}
        onPointerDown={(e) => {
          drag.current = { x: e.clientX, from: index };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d) return;
          setIndex(d.from - Math.round((e.clientX - d.x) / 90));
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
      >
        <div
          className="absolute inset-0 transition-transform duration-500 ease-out"
          style={{ transformStyle: "preserve-3d", transform: `translateZ(-${radius}px) rotateY(${-index * step}deg)` }}
        >
          {children.map((child, i) => {
            // How far this item is from the front, 0 (facing) to 1 (behind).
            const offset = Math.abs(((((i - index) % count) + count + count / 2) % count) - count / 2) / (count / 2);
            return (
              <div
                key={i}
                className="absolute inset-x-0 mx-auto w-60 transition-opacity duration-500 sm:w-64"
                style={{
                  transform: `rotateY(${i * step}deg) translateZ(${radius}px)`,
                  opacity: 1 - offset * 0.65,
                  pointerEvents: offset < 0.2 ? "auto" : "none",
                }}
                aria-hidden={offset >= 0.2}
              >
                {child}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label={prevLabel}
          className="cursor-pointer rounded-full border border-line px-4 py-2 text-sm text-ink hover:border-primary"
        >
          ‹
        </button>
        <span className="text-sm text-ink-soft tabular-nums">
          {(((index % count) + count) % count) + 1} / {count}
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label={nextLabel}
          className="cursor-pointer rounded-full border border-line px-4 py-2 text-sm text-ink hover:border-primary"
        >
          ›
        </button>
      </div>
    </div>
  );
}
