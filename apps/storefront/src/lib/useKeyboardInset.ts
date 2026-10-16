"use client";

import { useEffect, useState } from "react";

/**
 * How many pixels at the bottom of the layout viewport the on-screen keyboard
 * covers, from the visual viewport — 0 when it is closed, when the browser
 * already shrank the page for it, or where `visualViewport` doesn't exist.
 *
 * A bar fixed to the bottom of the page sits under the keyboard on most phone
 * browsers; lifting it by this amount keeps it on screen. Small differences
 * (a toolbar sliding away) and pinch-zoom are ignored.
 */
export function useKeyboardInset(enabled = true): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const viewport = typeof window === "undefined" ? undefined : window.visualViewport;
    if (!enabled || !viewport) return;
    const update = () => {
      if (viewport.scale > 1.01) return setInset(0);
      const covered = window.innerHeight - (viewport.height + viewport.offsetTop);
      setInset(covered > 80 ? Math.round(covered) : 0);
    };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    return () => {
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
    };
  }, [enabled]);

  // A disabled bar is off screen anyway; a stale reading from before must not leak out.
  return enabled ? inset : 0;
}
