"use client";

import { useEffect, useState } from "react";
import { ArrowUpIcon } from "./Icons";
import { iconBtn } from "./ui";

/**
 * A way back up, once there is enough page behind the shopper to need one.
 *
 * It appears after two screens of scrolling and not before, so a short page
 * never grows a floating button it has no use for. Nothing is measured on the
 * server, so the first paint has no button at all and no layout depends on it.
 *
 * It sits above the footer but below the product page's sticky order bar
 * (z-40), and on a phone it lifts itself clear of that bar's height — the buy
 * button is the one thing that must never be covered.
 *
 * Reduced motion is honoured by asking the browser, not by guessing: a jump is
 * the correct behaviour for someone who asked for less movement.
 */
export function BackToTop({ label }: { label: string }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const decide = () => setShown(window.scrollY > window.innerHeight * 2);
    decide();
    window.addEventListener("scroll", decide, { passive: true });
    return () => window.removeEventListener("scroll", decide);
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
      className={`${iconBtn} fixed bottom-24 end-4 z-30 shadow-md transition-opacity duration-200 motion-reduce:transition-none md:bottom-6 ${
        shown ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <ArrowUpIcon />
    </button>
  );
}
