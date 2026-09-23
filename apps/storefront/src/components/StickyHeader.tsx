"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * The masthead's shell. It is sticky either way; what changes once the page
 * has scrolled under it is a hairline shadow and a slightly shorter bar, so
 * the header reads as "floating over the page" rather than as the page's top
 * edge. The bar's own height lives on the child through `data-scrolled` so
 * the server-rendered markup inside stays exactly as StoreHeader wrote it.
 *
 * The first paint is always the tall bar (nothing is measured on the server),
 * and the change is a transition on height/shadow only — cheap, and off
 * under reduced motion.
 */
export function StickyHeader({ children }: { children: ReactNode }) {
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

  return (
    <header
      data-scrolled={scrolled ? "" : undefined}
      className={`group/header sticky top-0 z-30 border-b border-line bg-paper-raised/95 backdrop-blur transition-shadow duration-200 supports-[backdrop-filter]:bg-paper-raised/85 motion-reduce:transition-none ${
        scrolled ? "shadow-[0_1px_0_0_var(--color-line),0_8px_24px_-16px_rgba(0,0,0,0.35)]" : ""
      }`}
    >
      {children}
    </header>
  );
}
