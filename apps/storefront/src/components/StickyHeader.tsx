"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * The masthead's shell. It is sticky either way; what changes once the page
 * has scrolled under it is a hairline shadow and a slightly shorter bar, so
 * the header reads as "floating over the page" rather than as the page's top
 * edge. The bar's own height lives on the child through `data-scrolled` so
 * the server-rendered markup inside stays exactly as StoreHeader wrote it.
 *
 * `transparent` is the home page's opt-in to a second look: before the
 * visitor scrolls, the shell carries no background, border or shadow at all,
 * so it reads as overlaid on whatever the page put behind it (a hero image, a
 * slideshow) — `data-overlay` is how StoreHeader's own children (the logo,
 * the nav text) know to switch to a light treatment, the same way they key
 * off `data-scrolled` today. It is never guessed from page content: the
 * caller passes `transparent` only on the route that opted in, and scrolling
 * past the threshold always wins back the solid look.
 *
 * The first paint is always the tall bar (nothing is measured on the server),
 * and the change is a transition on colour/shadow/height only — cheap, and
 * off under reduced motion.
 */
export function StickyHeader({
  children,
  transparent = false,
}: {
  children: ReactNode;
  transparent?: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const decide = () => {
      frame = 0;
      setScrolled(window.scrollY > 8);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(decide);
    };
    decide();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const overlay = transparent && !scrolled;

  return (
    <header
      data-scrolled={scrolled ? "" : undefined}
      data-overlay={overlay ? "" : undefined}
      className={`group/header sticky top-0 z-30 border-b transition-[background-color,box-shadow,border-color] duration-200 motion-reduce:transition-none ${
        overlay
          ? "border-transparent bg-transparent"
          : `border-line bg-paper-raised/95 backdrop-blur supports-[backdrop-filter]:bg-paper-raised/85 ${
              scrolled ? "shadow-[0_1px_0_0_var(--color-line),0_8px_24px_-16px_rgba(0,0,0,0.35)]" : ""
            }`
      }`}
    >
      {children}
    </header>
  );
}
