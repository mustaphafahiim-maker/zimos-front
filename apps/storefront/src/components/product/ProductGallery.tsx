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
import { swipeStep, SWIPE_PX } from "@/lib/swipe";
import { ArrowIcon, BoxIcon, CrossIcon, ZoomIcon } from "../Icons";
import { iconBtn, skeleton } from "../ui";

/**
 * The product's photos.
 *
 * The main photo is a horizontal scroll-snap track with one slide per photo,
 * so a swipe on a phone is the browser's own scrolling: the photo follows the
 * finger and snaps, in either reading direction, with no script in the way.
 * The first slide is the page's largest image and is fetched first; the rest
 * load as they come near. Dots (or «2 / 5» for a long gallery) over the
 * photo's bottom edge say where the shopper is, and the thumbnail strip
 * follows the track and drives it.
 *
 * Around that: arrow keys, a drag with a mouse, a magnifier that follows the
 * cursor on a desktop, and a tap to see the photo at full size — in a
 * lightbox that swipes the same way.
 *
 * Deliberately library-free, like the rest of the storefront.
 */

/** Everything inside the lightbox a Tab can reach. */
function focusablesIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1'])")).filter(
    (el) => !el.hasAttribute("disabled")
  );
}

/** A snap track: its slides in a row, each as wide as the track, no scrollbar, and the page does not move sideways with it. */
const TRACK =
  "flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

/** More photos than this and the dots become a counter. */
const MAX_DOTS = 6;

/** How long a glide to a chosen photo may take before the track is believed again. */
const SEEK_MS = 900;

function calmMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The slide a track rests on (or is nearest to): slides are as wide as the track, in either direction. */
function trackIndex(track: HTMLElement, count: number): number {
  const width = track.clientWidth;
  if (width === 0 || count === 0) return 0;
  return Math.min(count - 1, Math.max(0, Math.round(Math.abs(track.scrollLeft) / width)));
}

/**
 * Brings a slide to the track's edge. Measured on screen rather than from
 * `scrollLeft`, so it is right in an RTL store too — and it only ever moves
 * the track, never the page (which `scrollIntoView` would). True when the
 * track had to move.
 */
function scrollTrackTo(track: HTMLElement | null, index: number, behavior: ScrollBehavior): boolean {
  const slide = track?.children[index] as HTMLElement | undefined;
  if (!track || !slide) return false;
  const delta = slide.getBoundingClientRect().left - track.getBoundingClientRect().left;
  if (Math.abs(delta) < 1) return false;
  track.scrollBy({ left: delta, behavior });
  return true;
}

/** Scrolls a strip just enough to show one of its items; the page stays where it is. */
function revealIn(strip: HTMLElement, item: HTMLElement, behavior: ScrollBehavior) {
  const box = strip.getBoundingClientRect();
  const rect = item.getBoundingClientRect();
  const dx = rect.left < box.left ? rect.left - box.left : rect.right > box.right ? rect.right - box.right : 0;
  const dy = rect.top < box.top ? rect.top - box.top : rect.bottom > box.bottom ? rect.bottom - box.bottom : 0;
  if (dx !== 0 || dy !== 0) strip.scrollBy({ left: dx, top: dy, behavior });
}

export function ProductGallery({
  images,
  name,
  focusSrc = null,
  expected = 0,
}: {
  images: string[];
  name: string;
  /** The photo to bring into view when it changes (the chosen variant's own picture): the track glides to its slide. */
  focusSrc?: string | null;
  /** How many photos are still on their way (an A/B test not answered yet): the frame and that many thumbnails hold their place. */
  expected?: number;
}) {
  const { t, dir, intlLocale } = useStore();
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const count = images.length;
  const many = count > 1;
  // A photo taken away under the shopper (a variant's own picture) leaves them on the last one.
  const shown = count === 0 ? 0 : Math.min(active, count - 1);
  const imagesKey = images.join("\n");
  const waiting = Math.max(0, expected - count);

  // In an RTL store the "next" photo lives to the left, so the two arrow keys
  // swap over — as does the direction a mouse drag has to travel.
  const forward = dir === "rtl" ? -1 : 1;

  const trackRef = useRef<HTMLDivElement>(null);
  const lightRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const slideBtns = useRef<(HTMLButtonElement | null)[]>([]);
  const imgs = useRef<(HTMLImageElement | null)[]>([]);
  // What the handlers below read without being rebuilt on every photo change.
  const activeRef = useRef(0);
  const countRef = useRef(count);
  useEffect(() => {
    activeRef.current = shown;
    countRef.current = count;
  }, [shown, count]);

  // --- where the track is ----------------------------------------------------
  // A glide to a chosen photo passes over the ones between; they are not
  // reported while it is on its way.
  const seek = useRef<{ index: number; until: number } | null>(null);
  const frame = useRef(0);
  const lightFrame = useRef(0);

  /** False while a glide is still heading somewhere else. */
  const settled = useCallback((index: number) => {
    const want = seek.current;
    if (!want) return true;
    if (index === want.index || performance.now() > want.until) {
      seek.current = null;
      return true;
    }
    return false;
  }, []);

  const onTrackScroll = useCallback(() => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      const track = trackRef.current;
      if (!track) return;
      const index = trackIndex(track, countRef.current);
      if (settled(index)) setActive(index);
    });
  }, [settled]);

  const onLightScroll = useCallback(() => {
    if (lightFrame.current) return;
    lightFrame.current = requestAnimationFrame(() => {
      lightFrame.current = 0;
      const track = lightRef.current;
      if (!track) return;
      const index = trackIndex(track, countRef.current);
      if (!settled(index)) return;
      setActive(index);
      // The page's own photo follows, so closing the lightbox lands on the same one.
      scrollTrackTo(trackRef.current, index, "auto");
    });
  }, [settled]);

  // A glide the shopper cut short (a swipe the other way while it ran) may send
  // no further scroll once its time is up: the track is read once more then, so
  // the dots and the thumbnails never stay on a photo the track has left.
  const recheck = useRef(0);
  const readTrack = useCallback(() => {
    recheck.current = 0;
    seek.current = null;
    const track = lightRef.current ?? trackRef.current;
    if (track) setActive(trackIndex(track, countRef.current));
  }, []);

  // A swipe made before the page's script arrived has already moved the track.
  useEffect(() => {
    onTrackScroll();
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
      if (lightFrame.current) cancelAnimationFrame(lightFrame.current);
      if (recheck.current) window.clearTimeout(recheck.current);
      frame.current = 0;
      lightFrame.current = 0;
      recheck.current = 0;
    };
  }, [onTrackScroll]);

  // --- hover zoom (a real mouse only) -----------------------------------------
  // Written straight onto the photo: a moving cursor must not re-render every slide.
  const zoomed = useRef<HTMLImageElement | null>(null);
  const clearZoom = useCallback(() => {
    const img = zoomed.current;
    if (img) {
      img.style.transform = "";
      img.style.transformOrigin = "";
    }
    zoomed.current = null;
  }, []);

  // --- moving between photos ----------------------------------------------------
  const goTo = useCallback(
    (index: number, how: "glide" | "jump" = "glide") => {
      const total = countRef.current;
      if (total === 0) return;
      const next = ((index % total) + total) % total;
      const instant = how === "jump" || calmMotion();
      clearZoom();
      setActive(next);
      const behavior: ScrollBehavior = instant ? "auto" : "smooth";
      const moved = scrollTrackTo(trackRef.current, next, behavior);
      const movedLight = scrollTrackTo(lightRef.current, next, behavior);
      if (recheck.current) window.clearTimeout(recheck.current);
      recheck.current = 0;
      // Only a glide that really started is waited for: a tap on the photo
      // already showing must not mute the swipe that follows it.
      if (!instant && (moved || movedLight)) {
        seek.current = { index: next, until: performance.now() + SEEK_MS };
        recheck.current = window.setTimeout(readTrack, SEEK_MS + 60);
      } else {
        seek.current = null;
      }
    },
    [clearZoom, readTrack]
  );

  const step = useCallback(
    (delta: number) => {
      const total = countRef.current;
      if (total === 0) return;
      const next = (activeRef.current + delta + total) % total;
      // The key was pressed on the photo: the focus goes with it, without tugging the track.
      const follow = trackRef.current?.contains(document.activeElement) ?? false;
      goTo(next);
      if (follow) slideBtns.current[next]?.focus({ preventScroll: true });
    },
    [goTo]
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

  // The chosen variant's own picture: the track glides to its slide. The
  // gallery is not rebuilt, so the frame never empties and nothing below moves.
  const lastFocus = useRef(focusSrc);
  useEffect(() => {
    if (focusSrc === lastFocus.current) return;
    lastFocus.current = focusSrc;
    if (!focusSrc) return;
    const index = imagesKey.split("\n").indexOf(focusSrc);
    if (index >= 0) goTo(index);
  }, [focusSrc, imagesKey, goTo]);

  // --- a drag with a mouse (touch scrolls the track itself) -------------------
  const swipe = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  // `swipe.current` is cleared by the time the click lands, so the verdict of
  // the pointer-up that preceded it is parked here on the way out.
  const movedRef = useRef(false);

  function onPointerDown(e: ReactPointerEvent) {
    // A drag that ended off the photo never got its click: it must not eat this one.
    movedRef.current = false;
    if (e.pointerType !== "mouse") return;
    swipe.current = { x: e.clientX, y: e.clientY, moved: false };
  }

  function onPointerMove(e: ReactPointerEvent) {
    // Only a real mouse drags and gets the magnifier: on a touch screen the
    // track scrolls by itself, and the same photo opens full size with a tap.
    if (e.pointerType !== "mouse" || !frameRef.current) return;
    const start = swipe.current;
    if (start && Math.abs(e.clientX - start.x) > SWIPE_PX) start.moved = true;

    const img = imgs.current[activeRef.current];
    if (!img) return;
    if (zoomed.current && zoomed.current !== img) clearZoom();
    const box = frameRef.current.getBoundingClientRect();
    img.style.transformOrigin = `${((e.clientX - box.left) / box.width) * 100}% ${((e.clientY - box.top) / box.height) * 100}%`;
    img.style.transform = "scale(1.9)";
    zoomed.current = img;
  }

  function onPointerUp(e: ReactPointerEvent) {
    const start = swipe.current;
    movedRef.current = start?.moved ?? false;
    swipe.current = null;
    if (!start || !many) return;
    const delta = swipeStep(start, { x: e.clientX, y: e.clientY }, forward);
    if (delta !== null) step(delta);
  }

  function onPointerLeave() {
    swipe.current = null;
    clearZoom();
  }

  /** True when the pointer-up that preceded this click was a drag. */
  function swallowClickAfterSwipe(e: ReactMouseEvent) {
    if (movedRef.current) {
      movedRef.current = false;
      e.preventDefault();
      return true;
    }
    return false;
  }

  // --- photos that are slow to arrive -------------------------------------------
  // Photos are merchant-hosted and can be slow; a themed pulse sits behind
  // each one until it has loaded, so the frame never shows blank space. It is
  // behind the photo, not over it: a photo that loaded before this script ran
  // is never veiled. Keyed by URL so a photo already seen never pulses again.
  const [loaded, setLoaded] = useState<Set<string>>(() => new Set());
  const markLoaded = useCallback((src: string) => {
    setLoaded((prev) => (prev.has(src) ? prev : new Set(prev).add(src)));
  }, []);
  useEffect(() => {
    imagesKey.split("\n").forEach((src, i) => {
      const img = imgs.current[i];
      if (src && img?.complete && img.naturalWidth > 0) markLoaded(src);
    });
  }, [imagesKey, markLoaded]);

  // --- thumbnails follow the photo ------------------------------------------
  // A swipe or an arrow key can move to a thumbnail that sits off the end of
  // the strip; the strip scrolls it into view — the strip only, so choosing a
  // colour further down the page never pulls the page back up here.
  const stripRef = useRef<HTMLUListElement>(null);
  const thumbRefs = useRef<(HTMLButtonElement | null)[]>([]);
  useEffect(() => {
    const strip = stripRef.current;
    const el = thumbRefs.current[shown];
    if (!strip || !el || !many) return;
    revealIn(strip, el, calmMotion() ? "auto" : "smooth");
  }, [shown, many]);

  // --- lightbox -------------------------------------------------------------
  const dialogRef = useRef<HTMLDivElement>(null);
  // The lightbox opens on the photo the page is showing, before it is painted.
  const setLightTrack = useCallback((el: HTMLDivElement | null) => {
    lightRef.current = el;
    if (el) scrollTrackTo(el, activeRef.current, "auto");
  }, []);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

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
      // Back to the photo that is showing now (it may not be the one that was
      // opened), without the focus dragging the track to it.
      slideBtns.current[activeRef.current]?.focus({ preventScroll: true });
    };
  }, [open, step, forward]);

  const number = new Intl.NumberFormat(intlLocale);
  const position = `${number.format(shown + 1)} / ${number.format(count)}`;

  return (
    // Arrow keys work wherever the focus sits in the gallery — the main photo
    // or any thumbnail — because the handler catches them on the way up.
    <div onKeyDown={onKeyDown} className="zt-gallery" data-many={many || expected > 1 ? "" : undefined}>
      <div
        ref={frameRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerLeave}
        onPointerCancel={onPointerLeave}
        className="zt-gallery-frame relative aspect-square overflow-hidden rounded-2xl border border-line bg-paper"
      >
        {count > 0 ? (
          <div ref={trackRef} onScroll={onTrackScroll} className={TRACK}>
            {images.map((src, i) => (
              <div key={`${src}-${i}`} className="relative h-full w-full shrink-0 snap-start snap-always overflow-hidden">
                <button
                  ref={(el) => {
                    slideBtns.current[i] = el;
                  }}
                  type="button"
                  aria-label={many ? `${t.product.zoomImage} — ${i + 1}/${count}` : t.product.zoomImage}
                  // One stop in the tab order: the photo that is showing.
                  tabIndex={i === shown ? 0 : -1}
                  onClick={(e) => {
                    if (!swallowClickAfterSwipe(e)) setOpen(true);
                  }}
                  className="relative block h-full w-full cursor-zoom-in select-none"
                >
                  {!loaded.has(src) && <span aria-hidden className={`absolute inset-0 ${skeleton}`} />}
                  {/* Merchant media are arbitrary remote URLs (no next/image allowlist). */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={(el) => {
                      imgs.current[i] = el;
                    }}
                    src={src}
                    alt={i === 0 ? name : `${name} — ${i + 1}/${count}`}
                    width={900}
                    height={900}
                    // The first photo is the page's largest paint: asked for at once, ahead of everything else.
                    fetchPriority={i === 0 ? "high" : undefined}
                    loading={i === 0 ? "eager" : "lazy"}
                    decoding="async"
                    draggable={false}
                    onLoad={() => markLoaded(src)}
                    className="relative h-full w-full object-cover transition-transform duration-200 motion-reduce:transition-none"
                  />
                </button>
              </div>
            ))}
          </div>
        ) : expected > 0 ? (
          <span aria-hidden className={`absolute inset-0 ${skeleton}`} />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-primary/40">
            <BoxIcon size={72} />
          </div>
        )}

        {count > 0 && (
          // Over the photo's bottom edge: where the shopper is, and that a tap opens it larger.
          <div aria-hidden className="pointer-events-none absolute inset-x-3 bottom-3 flex items-center justify-between gap-3">
            <span className="h-9 w-9 shrink-0" />
            {many ? (
              count <= MAX_DOTS ? (
                <span className="flex items-center gap-1.5 rounded-full bg-paper-raised/90 px-2.5 py-2 shadow-sm backdrop-blur">
                  {images.map((src, i) => (
                    <span
                      key={`${src}-${i}`}
                      className={`h-1.5 w-1.5 rounded-full transition-[transform,opacity] duration-200 motion-reduce:transition-none ${
                        i === shown ? "scale-150 bg-primary opacity-100" : "bg-ink opacity-35"
                      }`}
                    />
                  ))}
                </span>
              ) : (
                <span className="rounded-full bg-paper-raised/90 px-3 py-1 text-xs font-semibold tabular-nums text-ink shadow-sm backdrop-blur">
                  {position}
                </span>
              )
            ) : (
              <span />
            )}
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-paper-raised/90 text-ink shadow-sm backdrop-blur">
              <ZoomIcon size={18} />
            </span>
          </div>
        )}
      </div>

      {many && (
        <p className="sr-only" aria-live="polite">
          {position}
        </p>
      )}

      {(many || expected > 1) && (
        <ul ref={stripRef} className="zt-gallery-thumbs mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((src, i) => (
            <li key={`${src}-${i}`} className="shrink-0">
              <button
                ref={(el) => {
                  thumbRefs.current[i] = el;
                }}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`${name} — ${i + 1}/${count}`}
                aria-pressed={i === shown}
                className={`relative block h-16 w-16 cursor-pointer overflow-hidden rounded-xl border-2 transition-colors sm:h-20 sm:w-20 ${
                  i === shown ? "border-primary" : "border-line hover:border-primary"
                }`}
              >
                {!loaded.has(src) && <span aria-hidden className={`absolute inset-0 ${skeleton}`} />}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={src}
                  alt=""
                  width={80}
                  height={80}
                  loading="lazy"
                  // The strip sits right under the first photo and shares its files: they queue behind it.
                  fetchPriority="low"
                  decoding="async"
                  onLoad={() => markLoaded(src)}
                  className="relative h-full w-full object-cover"
                />
              </button>
            </li>
          ))}
          {/* Photos still on their way: their thumbnails hold their place, so nothing below jumps when they land. */}
          {Array.from({ length: waiting }, (_, i) => (
            <li key={`waiting-${i}`} aria-hidden className={`h-16 w-16 shrink-0 sm:h-20 sm:w-20 ${skeleton}`} />
          ))}
        </ul>
      )}

      {open && count > 0 && (
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

          <div className="relative mt-3 min-h-0 flex-1">
            {many && (
              <button
                type="button"
                aria-label={t.product.previousImage}
                onClick={(e) => {
                  e.stopPropagation();
                  step(-1);
                }}
                className={`${iconBtn} absolute start-0 top-1/2 z-10 -translate-y-1/2`}
              >
                <ArrowIcon className="rotate-180 rtl:rotate-0" />
              </button>
            )}

            {/* The same track as the page's photo: a swipe moves between photos here too. */}
            <div ref={setLightTrack} onScroll={onLightScroll} tabIndex={-1} className={`${TRACK} outline-none`}>
              {images.map((src, i) => (
                <div key={`${src}-${i}`} className="flex h-full w-full shrink-0 snap-start snap-always items-center justify-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={many ? `${name} — ${i + 1}/${count}` : name}
                    width={1600}
                    height={1600}
                    loading={i === shown ? "eager" : "lazy"}
                    decoding="async"
                    draggable={false}
                    onClick={(e) => e.stopPropagation()}
                    className="max-h-full min-h-0 w-auto max-w-full rounded-2xl object-contain"
                  />
                </div>
              ))}
            </div>

            {many && (
              <button
                type="button"
                aria-label={t.product.nextImage}
                onClick={(e) => {
                  e.stopPropagation();
                  step(1);
                }}
                className={`${iconBtn} absolute end-0 top-1/2 z-10 -translate-y-1/2`}
              >
                <ArrowIcon className="rtl:rotate-180" />
              </button>
            )}
          </div>

          {many && <p className="mt-3 text-center text-sm tabular-nums text-ink-soft">{position}</p>}
        </div>
      )}
    </div>
  );
}
