"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useStore } from "@/lib/StoreContext";
import { ArrowIcon, BoxIcon, CrossIcon, ZoomIcon } from "../Icons";
import { iconBtn } from "../ui";

/**
 * The product's photos.
 *
 * The thumbnail strip is unchanged — it is still the thing that picks the
 * photo, still labelled "<name> — 2/5". What is added around it is everything
 * a shopper expects of a gallery and had to do without: arrow keys, a swipe on
 * a phone, a magnifier that follows the cursor on a desktop, and a tap to see
 * the photo at full size.
 *
 * Deliberately library-free, like the rest of the storefront. The only pieces
 * with any real subtlety are the swipe (a pointer drag that cancels the click
 * it would otherwise fire) and the lightbox's focus trap, both small enough to
 * read here.
 */

/** A drag shorter than this is a tap, not a swipe. */
const SWIPE_PX = 45;

/** Everything inside the lightbox a Tab can reach. */
function focusablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1'])")).filter(
    (el) => !el.hasAttribute("disabled")
  );
}

export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const { t, dir } = useStore();
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const current = images[active] ?? images[0];
  const many = images.length > 1;

  // In an RTL store the "next" photo lives to the left, so the two arrow keys
  // swap over — as does the direction a swipe has to travel.
  const forward = dir === "rtl" ? -1 : 1;

  const step = useCallback(
    (delta: number) => {
      if (images.length === 0) return;
      setActive((i) => (i + delta + images.length) % images.length);
    },
    [images.length]
  );

  function onKeyDown(e: ReactKeyboardEvent) {
    if (!many) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      step(forward);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      step(-forward);
    }
  }

  // --- swipe + hover zoom on the main image --------------------------------
  const frameRef = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  // `swipe.current` is cleared by the time the click lands, so the verdict of
  // the pointer-up that preceded it is parked here on the way out.
  const movedRef = useRef(false);
  const [zoom, setZoom] = useState<{ x: number; y: number } | null>(null);

  function onPointerDown(e: ReactPointerEvent) {
    swipe.current = { x: e.clientX, y: e.clientY, moved: false };
  }

  function onPointerMove(e: ReactPointerEvent) {
    const start = swipe.current;
    if (start && Math.abs(e.clientX - start.x) > SWIPE_PX) start.moved = true;

    // Only a real mouse gets the magnifier: on a touch screen there is no
    // hover, and the same photo opens full size with a tap anyway.
    if (e.pointerType !== "mouse" || !frameRef.current) return;
    const box = frameRef.current.getBoundingClientRect();
    setZoom({
      x: ((e.clientX - box.left) / box.width) * 100,
      y: ((e.clientY - box.top) / box.height) * 100,
    });
  }

  function onPointerUp(e: ReactPointerEvent) {
    const start = swipe.current;
    swipe.current = null;
    if (!start || !many) return;
    const dx = e.clientX - start.x;
    // A mostly-vertical drag is the page being scrolled, not a swipe.
    if (Math.abs(dx) <= SWIPE_PX || Math.abs(dx) < Math.abs(e.clientY - start.y)) return;
    step(dx < 0 ? forward : -forward);
  }

  /** True when the pointer-up that preceded this click was a swipe. */
  function swallowClickAfterSwipe(e: ReactMouseEvent) {
    if (movedRef.current) {
      movedRef.current = false;
      e.preventDefault();
      return true;
    }
    return false;
  }

  // --- thumbnails follow the photo ------------------------------------------
  // A swipe or an arrow key can move to a thumbnail that sits off the end of
  // the strip; scroll it into view so the strip always shows which photo is
  // up. Instant under reduced motion, a short glide otherwise.
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const el = thumbRefs.current[active];
    if (!el || !many) return;
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ behavior: calm ? "auto" : "smooth", block: "nearest", inline: "nearest" });
  }, [active, many]);

  // --- lightbox -------------------------------------------------------------
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Captured now: by cleanup time the ref may already point elsewhere, and
    // the button that opened the lightbox is the one focus must return to.
    const opener = openerRef.current;

    focusablesIn(dialog)[0]?.focus();

    // The page behind must not scroll away under the photo.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        step(forward);
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-forward);
        return;
      }
      if (e.key !== "Tab" || !dialog) return;

      // Focus trap: wrap at both ends so Tab never reaches the page behind.
      const items = focusablesIn(dialog);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = document.activeElement;
      if (e.shiftKey && (activeEl === first || !dialog.contains(activeEl))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (activeEl === last || !dialog.contains(activeEl))) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [open, step, forward]);

  return (
    // Arrow keys work wherever the focus sits in the gallery — the main photo
    // or any thumbnail — because the handler catches them on the way up.
    <div onKeyDown={onKeyDown}>
      <div
        ref={frameRef}
        className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-paper"
      >
        {current ? (
          <button
            ref={openerRef}
            type="button"
            aria-label={t.product.zoomImage}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={(e) => {
              movedRef.current = swipe.current?.moved ?? false;
              onPointerUp(e);
            }}
            onPointerLeave={() => {
              swipe.current = null;
              setZoom(null);
            }}
            onClick={(e) => {
              if (!swallowClickAfterSwipe(e)) setOpen(true);
            }}
            className="block h-full w-full cursor-zoom-in touch-pan-y select-none"
          >
            {/* Merchant media are arbitrary remote URLs (no next/image allowlist). */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current}
              alt={name}
              width={900}
              height={900}
              fetchPriority="high"
              draggable={false}
              style={
                zoom
                  ? { transform: "scale(1.9)", transformOrigin: `${zoom.x}% ${zoom.y}%` }
                  : undefined
              }
              className="h-full w-full object-cover transition-transform duration-200 motion-reduce:transition-none"
            />
            <span
              aria-hidden
              className="pointer-events-none absolute bottom-3 end-3 flex h-9 w-9 items-center justify-center rounded-xl bg-paper-raised/90 text-ink shadow-sm backdrop-blur"
            >
              <ZoomIcon size={18} />
            </span>
          </button>
        ) : (
          <div className="flex h-full w-full items-center justify-center text-primary/40">
            <BoxIcon size={72} />
          </div>
        )}
      </div>

      {many && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <li key={`${src}-${i}`} className="shrink-0">
              <button
                ref={(el) => {
                  thumbRefs.current[i] = el;
                }}
                type="button"
                onClick={() => setActive(i)}
                aria-label={`${name} — ${i + 1}/${images.length}`}
                aria-pressed={i === active}
                className={`block h-16 w-16 cursor-pointer overflow-hidden rounded-xl border-2 transition-colors sm:h-20 sm:w-20 ${
                  i === active ? "border-primary" : "border-line hover:border-primary"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" width={80} height={80} loading="lazy" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && current && (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={t.product.gallery}
          className="fixed inset-0 z-50 flex flex-col bg-paper/95 p-4 backdrop-blur-sm sm:p-8"
          // The backdrop is the element itself; a click on the photo inside
          // stops before it gets here.
          onClick={() => setOpen(false)}
        >
          <div className="flex justify-end">
            <button
              type="button"
              aria-label={t.product.closeImage}
              onClick={() => setOpen(false)}
              className={iconBtn}
            >
              <CrossIcon />
            </button>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center gap-3">
            {many && (
              <button
                type="button"
                aria-label={t.product.previousImage}
                onClick={(e) => {
                  e.stopPropagation();
                  step(-forward);
                }}
                className={`${iconBtn} shrink-0`}
              >
                <ArrowIcon className="rotate-180 rtl:rotate-0" />
              </button>
            )}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current}
              alt={name}
              width={1600}
              height={1600}
              onClick={(e) => e.stopPropagation()}
              className="max-h-full min-h-0 w-auto max-w-full rounded-2xl object-contain"
            />

            {many && (
              <button
                type="button"
                aria-label={t.product.nextImage}
                onClick={(e) => {
                  e.stopPropagation();
                  step(forward);
                }}
                className={`${iconBtn} shrink-0`}
              >
                <ArrowIcon className="rtl:rotate-180" />
              </button>
            )}
          </div>

          {many && (
            <p className="mt-3 text-center text-sm text-ink-soft" dir="ltr">
              {active + 1} / {images.length}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
