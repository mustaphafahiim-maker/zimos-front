"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/lib/StoreContext";
import { BoxIcon } from "../Icons";

/**
 * Swipeable product gallery: native scroll-snap on touch (no library, no
 * jank), arrows and dots on desktop, thumbnails, and a full-screen zoom view
 * with keyboard support. RTL-safe: scrolling uses the slide element itself.
 */
export function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const { t } = useStore();
  const g = t.product.gallery;
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [zoom, setZoom] = useState<number | null>(null);
  const count = images.length;

  const goTo = useCallback((i: number, smooth = true) => {
    const track = trackRef.current;
    const slide = track?.children[i] as HTMLElement | undefined;
    if (!track || !slide) return;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    slide.scrollIntoView({ behavior: smooth && !reduce ? "smooth" : "auto", block: "nearest", inline: "center" });
  }, []);

  // Which slide is in view → active dot/thumbnail.
  useEffect(() => {
    const track = trackRef.current;
    if (!track || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.index));
      },
      { root: track, threshold: 0.6 }
    );
    Array.from(track.children).forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, [count]);

  if (count === 0) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-2xl border border-line bg-zimos-cloud text-primary/40 dark:bg-primary-soft">
        <BoxIcon size={72} />
      </div>
    );
  }

  const arrow =
    "absolute top-1/2 z-10 hidden h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border border-line bg-paper-raised/90 text-ink shadow-card backdrop-blur transition hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-0 md:flex focus-visible:outline-2 focus-visible:outline-primary";

  return (
    <div>
      <div className="group relative">
        <div
          ref={trackRef}
          role="region"
          aria-roledescription="carousel"
          aria-label={name}
          className="flex snap-x snap-mandatory overflow-x-auto overscroll-x-contain rounded-2xl border border-line bg-zimos-cloud [scrollbar-width:none] dark:bg-primary-soft [&::-webkit-scrollbar]:hidden"
        >
          {images.map((src, i) => (
            <div key={`${src}-${i}`} data-index={i} className="relative aspect-square w-full shrink-0 snap-center" aria-roledescription="slide" aria-label={g.image(i + 1, count)}>
              <button type="button" onClick={() => setZoom(i)} className="block h-full w-full cursor-zoom-in" aria-label={g.zoom}>
                {/* Merchant media are arbitrary remote URLs (no next/image allowlist). */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt={i === 0 ? name : ""}
                  width={900}
                  height={900}
                  loading={i === 0 ? "eager" : "lazy"}
                  fetchPriority={i === 0 ? "high" : "auto"}
                  decoding="async"
                  draggable={false}
                  className="h-full w-full object-cover"
                />
              </button>
            </div>
          ))}
        </div>

        {count > 1 && (
          <>
            <button type="button" onClick={() => goTo(active - 1)} disabled={active === 0} aria-label={g.prev} className={`${arrow} start-3`}>
              <Chevron className="rotate-180 rtl:rotate-0" />
            </button>
            <button type="button" onClick={() => goTo(active + 1)} disabled={active === count - 1} aria-label={g.next} className={`${arrow} end-3`}>
              <Chevron className="rtl:rotate-180" />
            </button>
            <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5 md:hidden" aria-hidden>
              {images.map((_, i) => (
                <span key={i} className={`h-1.5 rounded-full bg-white shadow transition-all ${i === active ? "w-5 opacity-100" : "w-1.5 opacity-60"}`} />
              ))}
            </div>
            <span className="absolute end-3 top-3 rounded-full bg-black/55 px-2 py-0.5 text-xs font-medium text-white tabular-nums" aria-hidden>
              {active + 1}/{count}
            </span>
          </>
        )}
      </div>

      {count > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {images.map((src, i) => (
            <li key={`${src}-${i}`} className="shrink-0">
              <button
                type="button"
                onClick={() => goTo(i)}
                aria-label={g.image(i + 1, count)}
                aria-current={i === active}
                className={`block h-16 w-16 cursor-pointer overflow-hidden rounded-xl border-2 transition-[border-color,opacity] sm:h-20 sm:w-20 ${
                  i === active ? "border-primary" : "border-line opacity-75 hover:border-line-strong hover:opacity-100"
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" width={80} height={80} loading="lazy" className="h-full w-full object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {zoom !== null && <Lightbox images={images} start={zoom} name={name} onClose={(i) => { setZoom(null); goTo(i, false); }} />}
    </div>
  );
}

function Chevron({ className = "" }: { className?: string }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

/** Full-screen viewer: tap to zoom in/out, swipe or arrows to move, Esc to close. */
function Lightbox({ images, start, name, onClose }: { images: string[]; start: number; name: string; onClose: (index: number) => void }) {
  const { t, locale } = useStore();
  const g = t.product.gallery;
  const [index, setIndex] = useState(start);
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState("50% 50%");
  const closeRef = useRef<HTMLButtonElement>(null);
  const touchX = useRef<number | null>(null);
  const rtl = locale === "ar";
  const count = images.length;

  const move = useCallback((delta: number) => {
    setZoomed(false);
    setIndex((i) => Math.min(count - 1, Math.max(0, i + delta)));
  }, [count]);

  useEffect(() => {
    const prevFocus = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(index);
      else if (e.key === "ArrowRight") move(rtl ? -1 : 1);
      else if (e.key === "ArrowLeft") move(rtl ? 1 : -1);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [index, move, onClose, rtl]);

  const btn = "flex h-11 w-11 cursor-pointer items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20 disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-white";

  return (
    <div role="dialog" aria-modal="true" aria-label={name} className="fixed inset-0 z-[60] flex flex-col bg-black/95 motion-safe:animate-[zr-fade_150ms_ease-out]">
      <div className="flex items-center justify-between p-3 text-white">
        <span className="text-sm tabular-nums">{index + 1}/{count}</span>
        <button ref={closeRef} type="button" onClick={() => onClose(index)} aria-label={g.close} className={btn}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden"
        onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchX.current === null || zoomed) return;
          const dx = e.changedTouches[0].clientX - touchX.current;
          touchX.current = null;
          if (Math.abs(dx) > 50) move((dx < 0 ? 1 : -1) * (rtl ? -1 : 1));
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={images[index]}
          alt={g.image(index + 1, count)}
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            setOrigin(`${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`);
            setZoomed((z) => !z);
          }}
          style={{ transformOrigin: origin }}
          className={`max-h-full max-w-full select-none object-contain transition-transform duration-300 motion-reduce:transition-none ${zoomed ? "scale-[2.2] cursor-zoom-out" : "cursor-zoom-in"}`}
          draggable={false}
        />
        {count > 1 && (
          <>
            <button type="button" onClick={() => move(-1)} disabled={index === 0} aria-label={g.prev} className={`${btn} absolute start-3 top-1/2 -translate-y-1/2`}>
              <Chevron className="rotate-180 rtl:rotate-0" />
            </button>
            <button type="button" onClick={() => move(1)} disabled={index === count - 1} aria-label={g.next} className={`${btn} absolute end-3 top-1/2 -translate-y-1/2`}>
              <Chevron className="rtl:rotate-180" />
            </button>
          </>
        )}
      </div>
      <p className="p-3 text-center text-xs text-white/60">{g.zoomHint}</p>
    </div>
  );
}
