"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * How an amount on the checkout behaves while the server is asked again
 * (a new governorate, a ticked add-on): the last answer stays on screen,
 * dimmed, until the new one lands — and the new one is pointed out for a
 * moment. Nothing here works a price out; it only decides which of two
 * things the page already holds is shown.
 */

/**
 * `value`, except while `busy`: then the last value seen before it. `held`
 * says the caller is looking at that older value. On the very first render
 * there is nothing older, so the value is returned as it is.
 */
export function useHeldWhile<T>(value: T, busy: boolean, same: (a: T, b: T) => boolean = Object.is): { value: T; held: boolean } {
  const [last, setLast] = useState<{ value: T } | null>(busy ? null : { value });
  // Kept in step during render (React's own pattern for state that follows a prop): no extra paint, no effect.
  if (!busy && (last === null || !same(last.value, value))) setLast({ value });
  return busy && last !== null ? { value: last.value, held: true } : { value, held: false };
}

/** How long the highlight stays fully on before it fades (the fade itself is the 300ms transition below). */
const HOLD_MS = 160;

/**
 * Points out a figure that just changed: a soft tint behind it that comes on
 * at once and fades away. `signal` is what is compared — pass the text shown
 * (or any stable key for it); the first render never flashes. Opacity only,
 * and nothing at all under reduced motion.
 */
export function FlashOnChange({ signal, className = "", children }: { signal: string; className?: string; children: ReactNode }) {
  const [seen, setSeen] = useState(signal);
  const [lit, setLit] = useState(false);
  if (seen !== signal) {
    setSeen(signal);
    setLit(true);
  }

  useEffect(() => {
    if (!lit) return;
    const timer = window.setTimeout(() => setLit(false), HOLD_MS);
    return () => window.clearTimeout(timer);
  }, [lit, seen]);

  return (
    <span className={`relative inline-block ${className}`}>
      <span
        aria-hidden
        className={`pointer-events-none absolute -inset-x-1.5 -inset-y-0.5 rounded-md bg-primary-soft motion-reduce:hidden ${
          lit ? "opacity-100" : "opacity-0 transition-opacity duration-300"
        }`}
      />
      <span className="relative">{children}</span>
    </span>
  );
}

/** The dimmed, "still being fetched" look of a figure, with what assistive tech needs. */
export function busyProps(busy: boolean): { "aria-busy": true | undefined; className: string } {
  return {
    "aria-busy": busy ? true : undefined,
    className: `transition-opacity duration-200 motion-reduce:transition-none ${busy ? "opacity-60" : ""}`,
  };
}
