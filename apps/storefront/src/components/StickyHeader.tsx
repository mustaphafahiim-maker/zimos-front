"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

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
 *
 * The page under the header never moves for it. The bar is in the page's
 * flow, so a bar that lost 8px would pull everything below it up by 8px the
 * moment the shopper starts to scroll. Instead the header hands those 8px
 * back as a bottom margin while it floats (`data-[scrolled]:mb-2`), on the
 * same clock as the bar's height: the two always add up to the tall bar, the
 * space the header takes in the page stays what it was at the first paint, and
 * only the header's own edge moves. A theme whose bar shrinks by a different
 * amount sets that margin itself, next to its heights (store-theme-uokids.css).
 *
 * `sticky={false}` is the merchant's choice (the editor's Header panel) to
 * let the bar scroll away with the page; it then never floats, so it never
 * needs the scrolled shadow either. `data-zimos-shell` names the header for
 * the editor preview's click-to-select; it changes nothing on a live page.
 */
export function StickyHeader({
  children,
  transparent = false,
  sticky = true,
}: {
  children: ReactNode;
  transparent?: boolean;
  sticky?: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);
  const header = useRef<HTMLElement>(null);

  useEffect(() => {
    let frame = 0;
    const decide = () => {
      frame = 0;
      // Floating means pinned to the top of the screen with the page under it. While something
      // still sits above the header — a holiday or invite banner — it has not reached the top,
      // and the margin that keeps the page still would show as a gap under a bar that is not floating.
      const top = header.current?.getBoundingClientRect().top ?? 0;
      setScrolled(window.scrollY > 8 && top < 1);
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

  const floating = sticky && scrolled;
  const overlay = transparent && !floating;

  return (
    <header
      ref={header}
      data-zimos-shell="header"
      data-scrolled={floating ? "" : undefined}
      data-overlay={overlay ? "" : undefined}
      className={`group/header ${sticky ? "sticky top-0" : "relative"} z-30 border-b transition-[background-color,box-shadow,border-color,margin] duration-200 data-[scrolled]:mb-2 motion-reduce:transition-none ${
        overlay
          ? "border-transparent bg-transparent"
          : `border-line bg-paper-raised/95 backdrop-blur supports-[backdrop-filter]:bg-paper-raised/85 ${
              floating ? "shadow-[0_1px_0_0_var(--color-line),0_8px_24px_-16px_rgba(0,0,0,0.35)]" : ""
            }`
      }`}
    >
      {children}
    </header>
  );
}
