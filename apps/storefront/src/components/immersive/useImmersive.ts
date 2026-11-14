"use client";

import { useEffect, useState } from "react";

/**
 * Whether this visitor should get the heavy, moving version of a section.
 *
 * Three ways to say no, and any one of them is enough:
 *  - the OS asks for reduced motion;
 *  - the connection is metered or slow (Save-Data, 2g/3g);
 *  - the device looks low-powered (few cores, little memory).
 *
 * Starts as `false` so the first paint is always the still fallback: a shopper
 * on a weak phone never downloads or runs an effect just to have it swapped
 * out, and the section is readable before any of this resolves.
 */
export function useImmersiveAllowed(): boolean {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const calm = window.matchMedia("(prefers-reduced-motion: reduce)");

    const decide = () => {
      if (calm.matches) return setAllowed(false);

      const nav = navigator as Navigator & {
        connection?: { saveData?: boolean; effectiveType?: string };
        deviceMemory?: number;
      };
      const conn = nav.connection;
      if (conn?.saveData) return setAllowed(false);
      if (conn?.effectiveType && /(^|-)(2g|3g)$/.test(conn.effectiveType)) return setAllowed(false);
      if (typeof nav.deviceMemory === "number" && nav.deviceMemory > 0 && nav.deviceMemory < 4) return setAllowed(false);
      if (typeof nav.hardwareConcurrency === "number" && nav.hardwareConcurrency > 0 && nav.hardwareConcurrency < 4) {
        return setAllowed(false);
      }
      return setAllowed(true);
    };

    decide();
    calm.addEventListener("change", decide);
    return () => calm.removeEventListener("change", decide);
  }, []);

  return allowed;
}

/**
 * True once the element has been near the viewport, and false again when it
 * leaves — WebGL and 3D sections use it to stop drawing off-screen.
 */
export function useOnScreen(ref: React.RefObject<Element | null>, rootMargin = "200px"): boolean {
  const [onScreen, setOnScreen] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => setOnScreen(entries[0]?.isIntersecting ?? false), { rootMargin });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin]);

  return onScreen;
}

/** The store's own colours, read from the theme variables on the wrapper. */
export function useThemeColors(ref: React.RefObject<Element | null>): { primary: string; accent: string; paper: string } {
  const [colors, setColors] = useState({ primary: "#1f5d5b", accent: "#e2a33d", paper: "#f5f4ef" });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const styles = getComputedStyle(el);
    const read = (name: string, fallback: string) => styles.getPropertyValue(name).trim() || fallback;
    setColors({
      primary: read("--color-primary", "#1f5d5b"),
      accent: read("--color-accent", "#e2a33d"),
      paper: read("--color-paper", "#f5f4ef"),
    });
  }, [ref]);

  return colors;
}
