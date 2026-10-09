"use client";

import { useEffect, useState } from "react";
import { ArrowUpIcon } from "./Icons";

/**
 * The icon button's look (ui.ts `iconBtn`), spelled out without its
 * `relative`: Tailwind writes `.relative` after `.fixed`, so the recipe and
 * `fixed` on one element leave it in the page's flow — which is where this
 * button used to sit, under the footer, instead of floating.
 */
const floatingIconBtn =
  "zt-icon-btn inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl border border-line bg-paper-raised text-ink hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/**
 * A way back up, once there is enough page behind the shopper to need one.
 *
 * It appears after a screen of scrolling and not before, so a short page
 * never grows a floating button it has no use for. Nothing is measured on the
 * server, so the first paint has no button at all and no layout depends on it.
 * The scroll listener is passive and answers once a frame at most.
 *
 * It lives in the end corner with the WhatsApp button and sits above it when
 * the store has one; both stand clear of whatever bar is pinned to the bottom
 * of a phone — the order bar, the cart's, the checkout's, the theme's toolbar
 * (globals.css, `--sf-top-bottom`). It is moved with a transform, so a bar
 * sliding in under it lifts it smoothly and nothing else on the page moves.
 *
 * Reduced motion is honoured by asking the browser, not by guessing: a jump is
 * the correct behaviour for someone who asked for less movement.
 */
export function BackToTop({ label }: { label: string }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    let frame = 0;
    const decide = () => {
      frame = 0;
      setShown(window.scrollY > window.innerHeight);
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

  function toTop() {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    window.scrollTo({ top: 0, behavior: calm ? "auto" : "smooth" });
  }

  return (
    <button
      type="button"
      onClick={toTop}
      aria-label={label}
      title={label}
      tabIndex={shown ? 0 : -1}
      aria-hidden={!shown}
      className={`${floatingIconBtn} fixed bottom-0 end-4 z-30 -translate-y-[var(--sf-top-bottom,10rem)] shadow-md transition-[opacity,translate] duration-200 motion-reduce:transition-none ${
        shown ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <ArrowUpIcon />
    </button>
  );
}
