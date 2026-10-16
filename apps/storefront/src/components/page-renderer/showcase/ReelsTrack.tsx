"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * The `video_reels` strip: tall clips side by side, one playing at a time.
 *
 * The first clip starts, muted, once a fifth of the band is on screen — and
 * only then is anything fetched (`preload="none"` until the band is near).
 * Tapping a clip plays it and pauses the others; its speaker button turns the
 * sound on for that clip alone. Everything stops when the band leaves the
 * screen or the tab is hidden.
 *
 * The clips and their product chips are rendered by the server (`children`);
 * this component finds them by their `data-reel-*` markers.
 */
export function ReelsTrack({
  heading,
  children,
  rtl,
  labels,
}: {
  heading: ReactNode;
  children: ReactNode;
  rtl: boolean;
  labels: { previous: string; next: string; nav: string; soundOn: string; soundOff: string };
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const videos = Array.from(root.querySelectorAll<HTMLVideoElement>("video"));
    if (videos.length === 0) return;

    let active: HTMLVideoElement | null = null;
    let autoStarted = false;

    const pauseOthers = (keep: HTMLVideoElement | null) =>
      videos.forEach((v) => {
        if (v !== keep && !v.paused) v.pause();
      });
    const activate = (video: HTMLVideoElement) => {
      pauseOthers(video);
      active = video;
      video.play().catch(() => {});
    };
    const onPlay = (e: Event) => {
      const video = e.currentTarget as HTMLVideoElement;
      pauseOthers(video);
      active = video;
    };
    videos.forEach((v) => v.addEventListener("play", onPlay));

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const mute = target.closest<HTMLElement>("[data-reel-mute]");
      if (mute) {
        const video = mute.closest("[data-reel-card]")?.querySelector("video");
        if (!video) return;
        activate(video);
        video.muted = !video.muted;
        const sound = !video.muted;
        mute.setAttribute("aria-pressed", sound ? "true" : "false");
        mute.setAttribute("aria-label", sound ? labels.soundOff : labels.soundOn);
        return;
      }
      if (target.closest("a,button")) return;
      const video = target.closest("[data-reel-card]")?.querySelector("video");
      if (!video) return;
      if (video === active && !video.paused) video.pause();
      else activate(video);
    };
    root.addEventListener("click", onClick);

    const first = videos[0];
    const prewarm = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        first.preload = "metadata";
        first.load();
        prewarm.disconnect();
      },
      { rootMargin: "300px 0px", threshold: 0 }
    );
    prewarm.observe(root);

    const watcher = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry.isIntersecting && entry.intersectionRatio >= 0.2 && !autoStarted) {
          autoStarted = true;
          if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) activate(first);
        } else if (!entry.isIntersecting && active && !active.paused) {
          active.pause();
        }
      },
      { threshold: [0, 0.2] }
    );
    watcher.observe(root);

    const stopAll = () => pauseOthers(null);
    const onVisibility = () => {
      if (document.hidden) stopAll();
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", stopAll);

    return () => {
      videos.forEach((v) => v.removeEventListener("play", onPlay));
      root.removeEventListener("click", onClick);
      prewarm.disconnect();
      watcher.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", stopAll);
      stopAll();
    };
  }, [labels.soundOff, labels.soundOn]);

  function move(delta: 1 | -1) {
    const track = trackRef.current;
    if (!track) return;
    const card = track.querySelector<HTMLElement>("[data-reel-card]");
    const gap = parseFloat(getComputedStyle(track).columnGap) || 12;
    const step = card ? card.getBoundingClientRect().width + gap : Math.max(280, track.clientWidth * 0.8);
    track.scrollBy({ left: (rtl ? -1 : 1) * delta * step, behavior: "smooth" });
  }

  return (
    <div ref={rootRef} className="zs-reels__shell">
      <div className="zs-reels__head">
        {heading}
        <div className="zs-reels__nav" aria-label={labels.nav}>
          <button type="button" className="zs-round-btn" aria-label={labels.previous} onClick={() => move(-1)}>
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M14.5 5.5 8 12l6.5 6.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button type="button" className="zs-round-btn" aria-label={labels.next} onClick={() => move(1)}>
            <svg viewBox="0 0 24 24" aria-hidden>
              <path d="M9.5 5.5 16 12l-6.5 6.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>
      </div>
      <div ref={trackRef} className="zs-reels__track zs-scroll">
        {children}
      </div>
    </div>
  );
}
